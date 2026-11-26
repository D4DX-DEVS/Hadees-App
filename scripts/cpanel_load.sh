#!/bin/bash
# Load the Hadees database into PostgreSQL on this server. Run from this folder (WHM Terminal / SSH):
#   DB_NAME=hadithencyclo_hadees DB_USER=hadithencyclo_hadithencyclo ./load.sh [start]
# start = a two-digit number (e.g. 40) or a file name (e.g. 26_data_hadiths_025.sql) to continue from; default: everything.
# The load runs in the BACKGROUND (nohup), so a dropped browser/SSH connection does not stop it:
#   tail -f load.log        follow the progress (Ctrl+C only stops tail, not the load)
#   pgrep -a psql           shows whether it is still running
# Safe to re-run: every data file is idempotent (one statement each, ON CONFLICT DO NOTHING); rows already there are
# never overwritten. Once the editor admin page has been used, the main library refuses to load (see below).
# The password is asked once, kept only in the environment of the running load, and never written to disk.
set -u
export LC_ALL=C
cd "$(dirname "$0")"
DB_NAME=${DB_NAME:-hadithencyclo_hadees}
DB_USER=${DB_USER:-hadithencyclo_hadithencyclo}
START=${1:-0}

if [ -z "${LOAD_CHILD:-}" ]; then
  read -rsp "Password for database user $DB_USER: " PGPASSWORD; echo
  export PGPASSWORD DB_NAME DB_USER
  psql -h /var/run/postgresql -U "$DB_USER" -d "$DB_NAME" -q -c "create table _probe(x int); drop table _probe;" 2>/tmp/load_probe.txt || {
    echo "Cannot create tables in $DB_NAME as $DB_USER:"; cat /tmp/load_probe.txt; exit 1; }
  # the editor admin page (/admin/) changes the live library: loading the main library again would bring back
  # hadith the editor deleted. Refuse once edits exist, unless FORCE=1 (sunnah / ihadis bundles are not affected).
  if ls 20_data_volumes_*.sql >/dev/null 2>&1 && [ "${FORCE:-}" != 1 ]; then
    edits=$(psql -h /var/run/postgresql -U "$DB_USER" -d "$DB_NAME" -tAq -c "select count(*) from admin_edits" 2>/dev/null || echo 0)
    if [ "${edits:-0}" -gt 0 ]; then
      echo "STOP: the live library has $edits edits made in the admin page; this load could undo deletions."
      echo "The live database is the master copy now. Only if you are sure: FORCE=1 ./load.sh $START"
      exit 1
    fi
  fi
  LOAD_CHILD=1 nohup "$0" "$START" > load.log 2>&1 &
  echo "Load started in the background (pid $!)."
  echo "Follow it with:   tail -f $PWD/load.log"
  exit 0
fi

P="psql -h /var/run/postgresql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -q"
for f in [0-9][0-9]_*.sql; do
  n=$((10#${f:0:2}))
  [ "$n" -ge 99 ] && continue
  case "$START" in
    ''|*[!0-9]*) [[ "$f" < "$START" ]] && continue ;;   # a file name: skip everything before it
    *) [ "$n" -lt "$START" ] && continue ;;               # a number: skip groups before it
  esac
  printf '%s %-52s' "$(date +%H:%M:%S)" "$f"; s=$(date +%s)
  if $P -f "$f" >/dev/null 2>/tmp/load_err.txt; then
    echo "ok ($(( $(date +%s) - s ))s)"
  else
    echo FAILED; head -20 /tmp/load_err.txt; echo "Fix the cause, then run: ./load.sh $f"; exit 1
  fi
done
echo; echo "ALL FILES LOADED. Verification (compare with 99_expected.txt):"
psql -h /var/run/postgresql -U "$DB_USER" -d "$DB_NAME" -f 99_verify.sql
