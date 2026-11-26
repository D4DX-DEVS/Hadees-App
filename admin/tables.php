<?php
declare(strict_types=1);

/**
 * Editor admin page: the tables the editor may change, input checks, and the one place that writes them.
 * Every change goes through save_row / insert_row / delete_row / undo_edit, inside one transaction that also writes
 * the edit history (admin_edits) and raises the data version.
 */

if (!defined('HV_ADMIN')) {
    http_response_code(404);
    exit;
}

/**
 * Field types: int, int? (null allowed), text:N (required, at most N characters), text?:N, bool, codes (text[]),
 * json? (jsonb), kind (article block kind). 'parent' = the column set once on insert and never changed afterwards.
 */
const TABLES = [
    'hadiths' => ['pk' => 'id', 'parent' => 'book_id', 'cols' => [
        'chapter_id' => 'int?', 'hadith_no' => 'int', 'hadith_label' => 'text?:60',
        'arabic_text' => 'text:30000', 'malayalam_text' => 'text:30000',
        'narrator_ar' => 'text?:500', 'narrator_ml' => 'text?:500', 'explanation_ml' => 'text?:30000',
        'source_codes_ar' => 'codes', 'source_codes_ml' => 'codes',
        'grading_note_ar' => 'text?:3000', 'grading_note_ml' => 'text?:3000',
        'page_start' => 'int?', 'page_end' => 'int?', 'needs_review' => 'bool',
    ]],
    'books' => ['pk' => 'id', 'cols' => ['title_ml' => 'text:500', 'title_ar' => 'text?:500', 'start_page' => 'int?']],
    'chapters' => ['pk' => 'id', 'parent' => 'book_id', 'cols' => [
        'chapter_no' => 'int', 'title_ml' => 'text:2000', 'title_ar' => 'text?:2000', 'start_page' => 'int?',
    ]],
    'articles' => ['pk' => 'id', 'cols' => ['title_ml' => 'text:500', 'start_page' => 'int?', 'end_page' => 'int?']],
    'article_blocks' => ['pk' => 'id', 'parent' => 'article_id', 'cols' => [
        'seq' => 'int', 'kind' => 'kind', 'text_ml' => 'text?:60000', 'rows' => 'json?', 'page' => 'int?',
    ]],
    'narrators' => ['pk' => 'id', 'cols' => ['name_ml' => 'text:300', 'bio_ml' => 'text:60000', 'page' => 'int?']],
    'narrator_spellings' => ['pk' => 'spelling', 'pkType' => 'text', 'cols' => ['narrator_id' => 'int']],
];

/** what the editor may do per table besides changing rows */
const CAN_INSERT = ['hadiths', 'chapters', 'article_blocks', 'narrator_spellings'];
const CAN_DELETE = ['hadiths', 'article_blocks', 'narrator_spellings'];
const BLOCK_KINDS = ['heading', 'subheading', 'paragraph', 'arabic', 'list_item', 'table', 'footnote'];

/** hadith fields that the AI search vector is made from */
const EMBED_FIELDS = ['chapter_id', 'malayalam_text', 'arabic_text', 'narrator_ml'];

function spec(string $tbl): array
{
    if (!isset(TABLES[$tbl])) {
        throw new UserError('unknown table');
    }
    return TABLES[$tbl];
}

/** the primary key value in the right PHP type */
function pk_value(string $tbl, mixed $v): int|string
{
    $s = spec($tbl);
    if (($s['pkType'] ?? 'int') === 'text') {
        $v = is_string($v) ? trim($v) : '';
        if ($v === '' || mb_strlen($v) > 300) {
            throw new UserError('bad key');
        }
        return $v;
    }
    if (is_int($v) || (is_string($v) && preg_match('/^\d{1,9}$/', $v))) {
        return (int)$v;
    }
    throw new UserError('bad id');
}

/** clean one field value; returns [value for SQL (string|null), cast] */
function clean_field(string $name, string $type, mixed $v): array
{
    $nullable = str_contains($type, '?');
    [$base, $max] = array_pad(explode(':', str_replace('?', '', $type)), 2, '0');
    if ($v === '' || $v === null) {
        if ($nullable || $base === 'codes') {
            return [$base === 'codes' ? '{}' : null, cast_of($base)];
        }
        throw new UserError("$name must not be empty");
    }
    switch ($base) {
        case 'int':
            if (is_string($v) && preg_match('/^-?\d{1,9}$/', trim($v))) {
                $v = (int)trim($v);
            }
            if (!is_int($v) || $v < 0 || $v > 2147483647) {
                throw new UserError("$name must be a whole number");
            }
            return [(string)$v, '::int'];
        case 'bool':
            return [$v === true || $v === 'true' || $v === 1 || $v === '1' ? 'true' : 'false', '::boolean'];
        case 'text':
        case 'kind':
            if (!is_string($v) || !mb_check_encoding($v, 'UTF-8')) {
                throw new UserError("$name must be text");
            }
            $v = str_replace(["\0", "\r\n"], ['', "\n"], $v);
            if ($base === 'kind') {
                if (!in_array($v, BLOCK_KINDS, true)) {
                    throw new UserError("$name must be one of " . implode(', ', BLOCK_KINDS));
                }
                return [$v, '::text'];
            }
            if (trim($v) === '') {
                if ($nullable) {
                    return [null, '::text'];
                }
                throw new UserError("$name must not be empty");
            }
            if (mb_strlen($v) > (int)$max) {
                throw new UserError("$name is too long (at most $max characters)");
            }
            return [$v, '::text'];
        case 'codes':
            $list = is_array($v) ? $v : preg_split('/[\s,،]+/u', (string)$v);
            $items = [];
            foreach (array_slice($list ?: [], 0, 40) as $s) {
                $s = is_string($s) ? trim($s) : '';
                if ($s !== '' && mb_strlen($s) <= 20) {
                    $items[] = '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $s) . '"';
                }
            }
            return ['{' . implode(',', $items) . '}', '::text[]'];
        case 'json':
            $j = is_string($v) ? json_decode($v, true) : $v;
            if (!is_array($j)) {
                throw new UserError("$name must be a JSON list");
            }
            return [json_encode($j, JSON_UNESCAPED_UNICODE), '::jsonb'];
    }
    throw new UserError("unknown field type for $name");
}

/** the SQL values of cleaned fields [col => [value, cast]], nulls kept */
function vals(array $clean): array
{
    return array_values(array_map(fn(array $c) => $c[0], $clean));
}

function cast_of(string $base): string
{
    return match ($base) {
        'int' => '::int', 'bool' => '::boolean', 'codes' => '::text[]', 'json' => '::jsonb', default => '::text',
    };
}

/** the full row as stored (jsonb), hadiths with their variants; null when missing */
function snapshot(string $tbl, int|string $id, bool $lock = false): ?array
{
    $s = spec($tbl);
    $cast = ($s['pkType'] ?? 'int') === 'text' ? '::text' : '::int';
    $j = qv("select to_jsonb(t) from $tbl t where {$s['pk']} = ?$cast" . ($lock ? ' for update' : ''), [$id]);
    if ($j === null) {
        return null;
    }
    $row = json_decode((string)$j, true);
    if ($tbl === 'hadiths') {
        $row['_variants'] = json_decode((string)qv("select coalesce(jsonb_agg(jsonb_build_object('arabic_text', arabic_text,
            'malayalam_text', malayalam_text) order by seq), '[]') from hadith_variants where hadith_id = ?::int", [$id]), true);
    }
    return $row;
}

/** version string of a row: the editor's save is refused when the row changed after the editor opened it */
function row_ver(?array $row): string
{
    return $row === null ? '' : substr(sha1(json_encode($row, JSON_UNESCAPED_UNICODE)), 0, 16);
}

function audit(string $tbl, int|string $id, string $action, ?array $old, ?array $new, string $note = '', ?int $undoes = null): int
{
    return (int)qv('insert into admin_edits (tbl, row_id, action, old_row, new_row, note, undoes)
                    values (?::text, ?::text, ?::text, ?::jsonb, ?::jsonb, ?::text, ?::bigint) returning id', [
        $tbl, (string)$id, $action,
        $old === null ? null : json_encode($old, JSON_UNESCAPED_UNICODE),
        $new === null ? null : json_encode($new, JSON_UNESCAPED_UNICODE),
        $note === '' ? null : mb_substr($note, 0, 500), $undoes,
    ]);
}

/** turn a unique-key clash into a message the editor understands */
function friendly_db_error(PDOException $e): UserError
{
    $code = (string)$e->getCode();
    if ($code === '23505') {
        $m = $e->getMessage();
        return new UserError(match (true) {
            str_contains($m, 'hadith_no') => 'This hadith number is already used in this book.',
            str_contains($m, 'chapter_no') => 'This chapter number is already used in this book.',
            str_contains($m, 'seq') => 'Two blocks have the same position. Reload and try again.',
            str_contains($m, 'spelling') => 'This spelling is already linked to a narrator.',
            default => 'This value is already used.',
        }, 409);
    }
    if ($code === '23503') {
        return new UserError('A linked row does not exist (check the chapter / book / narrator).', 409);
    }
    throw $e;
}

/** clean the editable fields that were sent; returns [col => [value, cast]] */
function clean_fields(string $tbl, array $fields): array
{
    $out = [];
    foreach (spec($tbl)['cols'] as $col => $type) {
        if (array_key_exists($col, $fields)) {
            $out[$col] = clean_field($col, $type, $fields[$col]);
        }
    }
    return $out;
}

/** normalise a stored value the same way the input is cleaned, to see whether a field really changed */
function same_value(string $type, mixed $stored, ?string $new): bool
{
    $base = explode(':', str_replace('?', '', $type))[0];
    if ($stored === null || $new === null) {
        return $stored === null && $new === null || ($base === 'codes' && ($stored ?? []) === [] && $new === '{}');
    }
    return match ($base) {
        'int' => (string)$stored === $new,
        'bool' => ($stored ? 'true' : 'false') === $new,
        'codes' => clean_field('x', 'codes', $stored)[0] === $new,
        'json' => json_encode($stored, JSON_UNESCAPED_UNICODE) === $new,
        default => (string)$stored === $new,
    };
}

/** hadith variants from the editor: list of {arabic_text, malayalam_text}, empty ones dropped */
function clean_variants(mixed $list): array
{
    $out = [];
    foreach (array_slice(is_array($list) ? $list : [], 0, 50) as $v) {
        $ar = clean_field('variant Arabic', 'text?:30000', is_array($v) ? ($v['arabic_text'] ?? null) : null)[0];
        $ml = clean_field('variant Malayalam', 'text?:30000', is_array($v) ? ($v['malayalam_text'] ?? null) : null)[0];
        if ($ar !== null || $ml !== null) {
            $out[] = ['arabic_text' => $ar, 'malayalam_text' => $ml];
        }
    }
    return $out;
}

function write_variants(int $hadithId, array $variants): void
{
    db()->prepare('delete from hadith_variants where hadith_id = ?::int')->execute([$hadithId]);
    $ins = db()->prepare('insert into hadith_variants (hadith_id, seq, arabic_text, malayalam_text) values (?::int, ?::int, ?::text, ?::text)');
    foreach (array_values($variants) as $i => $v) {
        $ins->execute([$hadithId, $i + 1, $v['arabic_text'], $v['malayalam_text']]);
    }
}

/**
 * Change one row. $fields = only the columns the editor changed (others keep their value); $ver = row_ver() the editor saw.
 * Returns ['row' => new snapshot, 'ver' => ..., 'changed' => [cols]].
 */
function save_row(string $tbl, int|string $id, array $fields, string $ver, string $note = '', ?array $variants = null): array
{
    $s = spec($tbl);
    $clean = clean_fields($tbl, $fields);
    try {
        return tx(function () use ($tbl, $s, $id, $clean, $ver, $note, $variants): array {
            $old = snapshot($tbl, $id, true);
            if ($old === null) {
                throw new UserError('This row no longer exists.', 404);
            }
            if ($ver !== '' && !hash_equals(row_ver($old), $ver)) {
                throw new UserError('Someone changed this after you opened it. Reload to see the latest version (your text is still in the form).', 409);
            }
            $changed = [];
            foreach ($clean as $col => [$val]) {
                if (!same_value($s['cols'][$col], $old[$col] ?? null, $val)) {
                    $changed[$col] = $clean[$col];
                }
            }
            $variantsChanged = $variants !== null && $variants !== ($old['_variants'] ?? []);
            if (!$changed && !$variantsChanged) {
                return ['row' => $old, 'ver' => row_ver($old), 'changed' => []];
            }
            if ($changed) {
                $sets = implode(', ', array_map(fn($c) => "$c = ?{$changed[$c][1]}", array_keys($changed)));
                $cast = ($s['pkType'] ?? 'int') === 'text' ? '::text' : '::int';
                db()->prepare("update $tbl set $sets where {$s['pk']} = ?$cast")
                    ->execute([...vals($changed), $id]);
            }
            if ($variantsChanged) {
                write_variants((int)$id, $variants);
            }
            after_change($tbl, $id, array_keys($changed));
            $new = snapshot($tbl, $id);
            audit($tbl, $id, 'update', $old, $new, $note);
            bump_version();
            return ['row' => $new, 'ver' => row_ver($new), 'changed' => [...array_keys($changed), ...($variantsChanged ? ['variants'] : [])]];
        });
    } catch (PDOException $e) {
        throw friendly_db_error($e);
    }
}

/** follow-up work after a change: hadith / titles that feed the AI search vectors */
function after_change(string $tbl, int|string $id, array $cols): void
{
    if ($tbl === 'hadiths' && array_intersect($cols, EMBED_FIELDS)) {
        mark_pending('h.id = ?::int', [$id]);
    } elseif ($tbl === 'chapters' && in_array('title_ml', $cols, true)) {
        mark_pending('h.chapter_id = ?::int', [$id]);
    } elseif ($tbl === 'books' && in_array('title_ml', $cols, true)) {
        mark_pending('h.book_id = ?::int', [$id]);
    }
}

/** add a row; $fields must hold every required column plus the parent column (or the key for narrator_spellings) */
function insert_row(string $tbl, array $fields, string $note = '', ?array $variants = null): array
{
    if (!in_array($tbl, CAN_INSERT, true)) {
        throw new UserError('Adding rows to this table is not allowed here.');
    }
    $s = spec($tbl);
    $cols = [];
    foreach ($s['cols'] as $col => $type) {
        if (array_key_exists($col, $fields) || !str_contains($type, '?')) {
            $cols[$col] = clean_field($col, $type, $fields[$col] ?? null);
        }
    }
    if (isset($s['parent'])) {
        $cols[$s['parent']] = [(string)pk_value($tbl, $fields[$s['parent']] ?? null), '::int'];
    }
    if (($s['pkType'] ?? 'int') === 'text') {
        $cols[$s['pk']] = [(string)pk_value($tbl, $fields[$s['pk']] ?? null), '::text'];
    }
    try {
        return tx(function () use ($tbl, $s, $cols, $note, $variants): array {
            if ($tbl === 'hadiths' && isset($cols['chapter_id'][0])) {
                $ok = qv('select 1 from chapters where id = ?::int and book_id = ?::int', [$cols['chapter_id'][0], $cols['book_id'][0]]);
                if (!$ok) {
                    throw new UserError('The chapter is not in this book.');
                }
            }
            $names = implode(', ', array_keys($cols));
            $marks = implode(', ', array_map(fn($c) => '?' . $c[1], $cols));
            $id = qv("insert into $tbl ($names) values ($marks) returning {$s['pk']}", vals($cols));
            $id = pk_value($tbl, is_int($id) ? $id : (string)$id);
            if ($tbl === 'hadiths') {
                write_variants((int)$id, $variants ?? []);
                mark_pending('h.id = ?::int', [$id]);
            }
            $new = snapshot($tbl, $id);
            audit($tbl, $id, 'insert', null, $new, $note);
            bump_version();
            return ['id' => $id, 'row' => $new, 'ver' => row_ver($new)];
        });
    } catch (PDOException $e) {
        throw friendly_db_error($e);
    }
}

/** delete a row; the full row (hadiths: with variants + relations) stays in the history so Undo can bring it back */
function delete_row(string $tbl, int|string $id, string $ver, string $note = ''): array
{
    if (!in_array($tbl, CAN_DELETE, true)) {
        throw new UserError('Deleting rows of this table is not allowed here.');
    }
    $s = spec($tbl);
    return tx(function () use ($tbl, $s, $id, $ver, $note): array {
        $old = snapshot($tbl, $id, true);
        if ($old === null) {
            throw new UserError('This row no longer exists.', 404);
        }
        if ($ver !== '' && !hash_equals(row_ver($old), $ver)) {
            throw new UserError('Someone changed this after you opened it. Reload first.', 409);
        }
        if ($tbl === 'hadiths') {
            $old['_relations'] = json_decode((string)qv('select coalesce(jsonb_agg(to_jsonb(r)), \'[]\') from hadith_relations r
                                                         where hadith_id = ?::int or related_id = ?::int', [$id, $id]), true);
        }
        $cast = ($s['pkType'] ?? 'int') === 'text' ? '::text' : '::int';
        db()->prepare("delete from $tbl where {$s['pk']} = ?$cast")->execute([$id]);
        $editId = audit($tbl, $id, 'delete', $old, null, $note);
        bump_version();
        return ['edit' => $editId];
    });
}

/** put a full stored row back (Undo of a delete) */
function restore_row(string $tbl, array $row): void
{
    $plain = array_filter($row, fn($k) => $k[0] !== '_', ARRAY_FILTER_USE_KEY);
    db()->prepare("insert into $tbl select * from jsonb_populate_record(null::$tbl, ?::jsonb)")
        ->execute([json_encode($plain, JSON_UNESCAPED_UNICODE)]);
    if ($tbl === 'hadiths') {
        $id = (int)$row['id'];
        write_variants($id, $row['_variants'] ?? []);
        foreach ($row['_relations'] ?? [] as $r) {
            db()->prepare('insert into hadith_relations select * from jsonb_populate_record(null::hadith_relations, ?::jsonb)
                           on conflict do nothing')->execute([json_encode($r, JSON_UNESCAPED_UNICODE)]);
        }
        mark_pending('h.id = ?::int', [$id]);
    }
}

/**
 * Undo one edit. Allowed only when it is the newest edit of that row that is still in effect, so a later change is
 * never lost silently. The undo itself is written to the history too.
 */
function undo_edit(int $editId): array
{
    try {
        return tx(function () use ($editId): array {
            $e = q1('select * from admin_edits where id = ?::bigint for update', [$editId]);
            if ($e === null) {
                throw new UserError('Edit not found.', 404);
            }
            if ($e['action'] === 'undo' || $e['undone_by'] !== null) {
                throw new UserError('This edit was already undone.', 409);
            }
            $newer = qv("select id from admin_edits where tbl = ?::text and row_id = ?::text and id > ?::bigint
                         and action <> 'undo' and undone_by is null order by id limit 1", [$e['tbl'], $e['row_id'], $editId]);
            if ($newer !== null) {
                throw new UserError("A newer change of the same row exists (#$newer). Undo that one first.", 409);
            }
            $tbl = $e['tbl'];
            $s = spec($tbl);
            $id = pk_value($tbl, $e['row_id']);
            $old = $e['old_row'] === null ? null : json_decode((string)$e['old_row'], true);
            $before = snapshot($tbl, $id, true);
            $cast = ($s['pkType'] ?? 'int') === 'text' ? '::text' : '::int';
            switch ($e['action']) {
                case 'update':
                    if ($before === null) {
                        throw new UserError('The row was deleted since. Undo the delete first.', 409);
                    }
                    $fields = array_intersect_key($old, $s['cols']);
                    $clean = [];
                    foreach ($fields as $col => $v) {
                        $clean[$col] = clean_field($col, str_replace(['text:', 'int'], ['text?:', 'int?'], $s['cols'][$col]), $v);
                    }
                    $sets = implode(', ', array_map(fn($c) => "$c = ?{$clean[$c][1]}", array_keys($clean)));
                    db()->prepare("update $tbl set $sets where {$s['pk']} = ?$cast")->execute([...vals($clean), $id]);
                    if ($tbl === 'hadiths') {
                        write_variants((int)$id, $old['_variants'] ?? []);
                    }
                    after_change($tbl, $id, array_keys($clean));
                    break;
                case 'insert':
                    if ($before !== null) {
                        db()->prepare("delete from $tbl where {$s['pk']} = ?$cast")->execute([$id]);
                    }
                    break;
                case 'delete':
                    if ($before !== null) {
                        throw new UserError('A row with this key exists again. Nothing to restore.', 409);
                    }
                    restore_row($tbl, $old);
                    break;
            }
            $after = snapshot($tbl, $id);
            $undoId = audit($tbl, $id, 'undo', $before, $after, 'Undo of #' . $editId, $editId);
            db()->prepare('update admin_edits set undone_by = ?::bigint where id = ?::bigint')->execute([$undoId, $editId]);
            bump_version();
            return ['undo' => $undoId, 'tbl' => $tbl, 'id' => $id];
        });
    } catch (PDOException $e) {
        throw friendly_db_error($e);
    }
}
