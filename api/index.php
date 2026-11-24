<?php
declare(strict_types=1);

/**
 * Hadees Vijnanakosham: JSON API over the PostgreSQL database on this server. One file, no framework.
 *
 *   /api/index.php?r=<route>&<params>      (GET routes)      POST routes: search, feedback, match
 *
 * Every query is a prepared statement. The database user (see api/db-role.sql) can only read the library
 * and insert feedback. Credentials live OUTSIDE the web root in /home/<account>/hadees-config.php
 * (see api/hadees-config.sample.php). Responses are built by PostgreSQL (json_agg), so their shape is the
 * same as the earlier Supabase responses and the app's types did not change.
 */

// ───────── output ─────────
if (extension_loaded('zlib') && !ini_get('zlib.output_compression') && str_contains($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip')) {
    ob_start('ob_gzhandler');
}

function send(string $json, int $status = 200, int $ttl = 0): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header($ttl > 0 ? "Cache-Control: public, max-age=$ttl" : 'Cache-Control: no-store');
    echo $json;
    exit;
}

function fail(int $status, string $message): never
{
    send(json_encode(['error' => $message], JSON_UNESCAPED_UNICODE), $status);
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: content-type, x-api-key');
header('Access-Control-Max-Age: 86400');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

set_exception_handler(function (Throwable $e): void {
    error_log('[hadees-api] ' . $e::class . ': ' . $e->getMessage());
    if ($e instanceof PDOException && (string)$e->getCode() === '57014') {   // statement timeout: a heavy query
        fail(503, 'server busy, please try again');
    }
    // the real error text is shown only on the health route and only while 'debug' is true in the config
    fail(500, !empty(cfg()['debug']) && ($_GET['r'] ?? '') === 'health' ? $e->getMessage() : 'server error');
});

// ───────── config + database ─────────
function cfg(): array
{
    static $c = null;
    if ($c !== null) {
        return $c;
    }
    $candidates = array_filter([
        getenv('HADEES_CONFIG') ?: '',
        dirname(__DIR__, 2) . '/hadees-config.php',                 // /home/<account>/hadees-config.php
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/../hadees-config.php',
    ]);
    foreach ($candidates as $f) {
        if (is_file($f)) {
            $v = require $f;
            if (is_array($v)) {
                return $c = $v;
            }
        }
    }
    error_log('[hadees-api] hadees-config.php not found');
    return $c = [];
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $c = cfg();
    if (empty($c['name']) || empty($c['user'])) {
        fail(500, 'server not configured');
    }
    $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $c['host'] ?? '127.0.0.1', (int)($c['port'] ?? 5432), $c['name']);
    $pdo = new PDO($dsn, $c['user'], $c['pass'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $pdo->exec("set statement_timeout = '12s'");
    return $pdo;
}

/** JSON array of rows, e.g. [{"id":1,...}, ...] ('[]' when empty) */
function rows(string $sql, array $params = []): string
{
    $st = db()->prepare("select coalesce(json_agg(t), '[]'::json) from ($sql) t");
    $st->execute($params);
    return (string)$st->fetchColumn();
}

/** JSON object of the first row, or null */
function one(string $sql, array $params = []): ?string
{
    $st = db()->prepare("select to_json(t) from ($sql) t limit 1");
    $st->execute($params);
    $v = $st->fetchColumn();
    return $v === false || $v === null ? null : (string)$v;
}

// ───────── input ─────────
function method(string ...$allowed): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        fail(405, 'method not allowed');
    }
}

function cleanText(mixed $v, int $max): string
{
    if (!is_scalar($v)) {
        return '';
    }
    $s = str_replace("\0", '', (string)$v);
    return mb_check_encoding($s, 'UTF-8') ? mb_substr($s, 0, $max) : '';
}

function intOrNull(mixed $v): ?int
{
    if (is_int($v)) {
        return $v >= -2147483648 && $v <= 2147483647 ? $v : null;   // a larger value would be a database error
    }
    return is_string($v) && preg_match('/^-?\d{1,9}$/', $v) ? (int)$v : null;
}

/** integer query parameter; null when missing; 400 when present but not a number */
function qi(string $k, ?int $default = null, int $min = 0, int $max = 2147483647): ?int
{
    $v = $_GET[$k] ?? null;
    if ($v === null || $v === '') {
        return $default;
    }
    $n = intOrNull($v);
    if ($n === null) {
        fail(400, "bad $k");
    }
    return max($min, min($max, $n));
}

function qr(string $k): int
{
    $n = qi($k);
    if ($n === null) {
        fail(400, "missing $k");
    }
    return $n;
}

function qs(string $k, int $max = 300): string
{
    $v = $_GET[$k] ?? '';
    $s = trim(cleanText($v, $max));
    if ($s === '') {
        fail(400, "missing $k");
    }
    return $s;
}

function qsOpt(string $k, int $max = 300): string
{
    return trim(cleanText($_GET[$k] ?? '', $max));
}

function body(int $max = 262144): array
{
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) {
        fail(413, 'request too large');
    }
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

/** PostgreSQL text[] literal from a list of strings */
function pgTextArray(mixed $list, int $maxItems = 40): string
{
    $out = [];
    foreach (array_slice(is_array($list) ? array_values($list) : [], 0, $maxItems) as $s) {
        $s = cleanText($s, 100);
        if ($s !== '') {
            $out[] = '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $s) . '"';
        }
    }
    return '{' . implode(',', $out) . '}';
}

/** At most $max requests per visitor per $windowSeconds for one bucket. Counted under a file lock, so parallel requests cannot slip through. */
function rateLimit(string $bucket, int $max, int $windowSeconds): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'anon';
    if (str_contains($ip, ':')) {                       // IPv6: one visitor can rotate addresses inside its /64
        $ip = implode(':', array_slice(explode(':', $ip), 0, 4));
    }
    $dir = sys_get_temp_dir();
    $fp = @fopen("$dir/hv-$bucket-" . sha1($ip) . '-' . intdiv(time(), $windowSeconds), 'c+');
    if ($fp === false) {
        return;                                         // cannot count: never block real users because of it
    }
    flock($fp, LOCK_EX);
    $n = (int)stream_get_contents($fp);
    if ($n >= $max) {
        flock($fp, LOCK_UN);
        fclose($fp);
        fail(429, 'Too many requests, please try again later.');
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, (string)($n + 1));
    flock($fp, LOCK_UN);
    fclose($fp);
    if (random_int(1, 100) === 1) {                     // now and then remove counters of finished windows
        foreach (glob("$dir/hv-$bucket-*") ?: [] as $old) {
            if (@filemtime($old) < time() - 2 * $windowSeconds) {
                @unlink($old);
            }
        }
    }
}

/** all printed spellings of a narrator's name (just the name itself when it has no group) */
const NARRATOR_NAMES = "coalesce(nullif(array(select spelling from narrator_groups where gkey = (select gkey from narrator_groups where spelling = ?::text)), '{}'::text[]), array[?::text])";

// ───────── routes ─────────
$route = is_string($_GET['r'] ?? null) ? $_GET['r'] : '';
const TTL = 300; // seconds the browser may keep a library response (the data only changes when it is corrected)

switch ($route) {
    case 'health':
        method('GET', 'HEAD');
        try {
            $n = (int)db()->query('select count(*) from hadiths')->fetchColumn();
            send(json_encode(['ok' => true, 'db' => true, 'hadiths' => $n, 'mbstring' => function_exists('mb_substr')]));
        } catch (Throwable $e) {
            error_log('[hadees-api] health: ' . $e->getMessage());
            send(json_encode(['ok' => false, 'db' => false] + (!empty(cfg()['debug']) ? ['error' => $e->getMessage()] : [])), 503);
        }

    // ── library structure ──
    case 'volumes':
        method('GET', 'HEAD');
        send(rows('select id, title_ml from volumes order by id'), 200, 3600);
    case 'books':
        method('GET', 'HEAD');
        send(rows('select * from book_stats order by volume_id, book_no'), 200, 3600);
    case 'chapters':
        method('GET', 'HEAD');
        send(rows('select * from chapter_stats where book_id = ?::int order by chapter_no', [qr('book')]), 200, TTL);
    case 'sources':
        method('GET', 'HEAD');
        send(rows('select * from sources'), 200, 3600);

    // ── hadith ──
    case 'chapter_hadiths':
        method('GET', 'HEAD');
        send(rows('select * from hadith_full where chapter_id = ?::int order by hadith_no', [qr('chapter')]), 200, TTL);
    case 'book_hadiths':
        method('GET', 'HEAD');
        $from = qi('from', 0, 0, 100000);
        $to = qi('to', $from + 29, $from, $from + 999);
        send(rows('select * from hadith_full where book_id = ?::int order by hadith_no offset ?::int limit ?::int', [qr('book'), $from, $to - $from + 1]), 200, TTL);
    case 'hadith':
        method('GET', 'HEAD');
        $h = one('select * from hadith_full where id = ?::int', [qr('id')]);
        $h === null ? fail(404, 'not found') : send($h, 200, TTL);
    case 'neighbours':
        method('GET', 'HEAD');
        $b = qr('book');
        $no = qr('no');
        send((string)one(
            'select (select id from hadiths where book_id = ?::int and hadith_no < ?::int order by hadith_no desc limit 1) as prev,
                    (select id from hadiths where book_id = ?::int and hadith_no > ?::int order by hadith_no limit 1) as next',
            [$b, $no, $b, $no],
        ), 200, TTL);
    case 'variants':
        method('GET', 'HEAD');
        send(rows('select * from hadith_variants where hadith_id = ?::int order by seq', [qr('hadith')]), 200, TTL);
    case 'cross_refs':
        method('GET', 'HEAD');
        send(rows('select * from app_cross_refs(?::int)', [qr('hadith')]), 200, TTL);
    case 'ref_counts':
        method('GET', 'HEAD');
        $ids = [];
        foreach (explode(',', qsOpt('ids', 4000)) as $x) {
            $n = intOrNull(trim($x));
            if ($n !== null && count($ids) < 400) {
                $ids[] = $n;
            }
        }
        if (!$ids) {
            send('[]');
        }
        $arr = '{' . implode(',', $ids) . '}';
        send(rows(
            'select id, count(*)::int as n from (
               select hadith_id as id from hadith_relations where hadith_id = any(?::int[])
               union all
               select related_id from hadith_relations where related_id = any(?::int[])) x group by id',
            [$arr, $arr],
        ), 200, TTL);
    case 'hadith_count':
        method('GET', 'HEAD');
        send((string)one('select count(*)::int as n from hadiths'), 200, 3600);
    case 'hadith_at':
        method('GET', 'HEAD');
        send(rows('select * from hadith_full order by id offset ?::int limit 1', [qr('n')]), 200, TTL);
    case 'hadith_by_number':
        method('GET', 'HEAD');
        send(rows('select * from hadith_full where book_id = ?::int and hadith_no = ?::int limit 1', [qr('book'), qr('no')]), 200, TTL);
    case 'hadith_of_day':
        method('GET', 'HEAD');
        $d = qsOpt('d', 10);
        if ($d === '') {
            send(rows('select * from hadith_of_day()'), 200, 300);
        }
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
            fail(400, 'bad d');
        }
        send(rows('select * from hadith_of_day(?::date)', [$d]), 200, 3600);

    // ── narrators ──
    case 'narrator_map':
        method('GET', 'HEAD');
        send(rows('select spelling, narrator_id from narrator_spellings'), 200, 3600);
    case 'narrator_spellings':
        method('GET', 'HEAD');
        send(rows('select spelling from narrator_groups where gkey = (select gkey from narrator_groups where spelling = ?::text)', [qs('name')]), 200, TTL);
    case 'narrator_count':
        method('GET', 'HEAD');
        $name = qs('name');
        send((string)one('select count(*)::int as n from hadiths where narrator_ml = any(' . NARRATOR_NAMES . ')', [$name, $name]), 200, TTL);
    case 'narrator_by_name':
        method('GET', 'HEAD');
        $name = qs('name');
        $off = qi('offset', 0, 0, 100000);
        $lim = qi('limit', 30, 1, 200);
        $list = rows(
            'select * from hadith_full where narrator_ml = any(' . NARRATOR_NAMES . ') order by volume_id, book_no, hadith_no offset ?::int limit ?::int',
            [$name, $name, $off, $lim],
        );
        $total = (int)json_decode((string)one('select count(*)::int as n from hadiths where narrator_ml = any(' . NARRATOR_NAMES . ')', [$name, $name]), true)['n'];
        send('{"rows":' . $list . ',"total":' . $total . '}', 200, TTL);
    case 'narrator':
        method('GET', 'HEAD');
        $n = one('select * from narrator_stats where id = ?::int', [qr('id')]);
        $n === null ? fail(404, 'not found') : send($n, 200, TTL);
    case 'narrator_hadiths':
        method('GET', 'HEAD');
        send(rows('select * from narrator_hadiths(?::int, ?::int, ?::int)', [qr('id'), qi('limit', 30, 1, 200), qi('offset', 0, 0, 100000)]), 200, TTL);

    // ── articles ──
    case 'articles':
        method('GET', 'HEAD');
        send(rows('select * from articles order by volume_id, section_no'), 200, 3600);
    case 'article':
        method('GET', 'HEAD');
        $id = qr('id');
        $a = one('select * from articles where id = ?::int', [$id]);
        $a === null ? fail(404, 'not found') : send('{"article":' . $a . ',"blocks":' . rows('select * from article_blocks where article_id = ?::int order by seq', [$id]) . '}', 200, TTL);

    // ── search ──
    case 'search':
        method('POST');
        rateLimit('search', 180, 60);
        $b = body();
        $sort = ($b['sort'] ?? '') === 'book' ? 'book' : 'relevance';
        $src = cleanText($b['src'] ?? '', 20);
        $ngroup = cleanText($b['ngroup'] ?? '', 100);
        send(rows(
            'select * from app_search(?::text, ?::int, ?::int, ?::text, ?::int, ?::int, ?::text, ?::text[], ?::text[], ?::text)',
            [
                cleanText($b['q'] ?? '', 500),
                intOrNull($b['vol'] ?? null),
                intOrNull($b['book'] ?? null),
                $src === '' ? null : $src,
                max(1, min(200, intOrNull($b['lim'] ?? null) ?? 30)),
                max(0, min(100000, intOrNull($b['off'] ?? null) ?? 0)),
                $sort,
                pgTextArray($b['terms'] ?? [], 12),
                pgTextArray($b['narr'] ?? [], 12),
                $ngroup === '' ? null : $ngroup,
            ],
        ));
    case 'suggest':
        method('GET', 'HEAD');
        rateLimit('search', 180, 60);
        $q = qsOpt('q', 200);
        send($q === '' ? '[]' : rows('select * from app_suggest(?::text, 8)', [$q]));
    case 'search_titles':
        method('GET', 'HEAD');
        rateLimit('search', 180, 60);
        $q = qsOpt('q', 200);
        send($q === '' ? '[]' : rows('select * from app_search_titles(?::text, 8)', [$q]));

    // ── extra libraries: schemas `sunnah` and `ihadis` (read-only; English full-text search, see api/sources-search.sql) ──
    case 'src_stats':
        method('GET', 'HEAD');
        send(one(
            "select (select count(*) from sunnah.hadiths) as sunnah_hadiths,
                    (select count(*) from sunnah.hadiths where text_en <> '') as sunnah_english,
                    (select count(*) from ihadis.hadiths) as ihadis_hadiths,
                    (select count(*) from ihadis.hadiths where lang = 'en') as ihadis_english"
        ) ?? '{}', 200, TTL);
    case 'src_search':
        method('POST');
        rateLimit('search', 180, 60);
        $b = body();
        // English keywords (letters only). First a passage must contain ALL of them (fast, precise); only when that finds
        // too little the words are joined with OR. ts_rank_cd ranks passages that contain more of the words higher.
        preg_match_all('/[A-Za-z]{3,}/', cleanText($b['q'] ?? '', 300), $m);
        $words = array_slice(array_values(array_unique(array_map('strtolower', $m[0]))), 0, 12);
        if (!$words) {
            send('[]');
        }
        $lim = max(1, min(30, intOrNull($b['lim'] ?? null) ?? 8));
        $coll = cleanText($b['collection'] ?? '', 40);
        if (($b['src'] ?? 'sunnah') === 'ihadis') {
            $sql = "select 'ihadis' as source, h.book_slug, h.hadith_id, h.display_label, h.grade, h.narrator,
                           left(h.translation, 1500) as text_en, left(h.arabic, 800) as text_ar, h.sunnah_ref,
                           ts_rank_cd(h.fts, q) as rank
                    from ihadis.hadiths h, to_tsquery('english', ?::text) q
                    where h.lang = 'en' and h.fts @@ q and (?::text = '' or h.book_slug = ?::text)
                    order by rank desc limit ?::int";
        } else {
            $sql = "select 'sunnah' as source, h.urn, h.collection, c.name_en as collection_name, h.book_number, h.chapter_number,
                           h.hadith_number, h.reference, h.in_book_reference, h.grade_en, m.ihadis_grade, h.narrator_en,
                           left(h.text_en, 1500) as text_en, left(coalesce(h.sanad_ar, '') || ' ' || coalesce(h.text_ar, ''), 800) as text_ar,
                           h.url, ts_rank_cd(h.fts, q) as rank
                    from sunnah.hadiths h
                    join sunnah.collections c on c.slug = h.collection
                    left join sunnah.hadith_meta m on m.urn = h.urn,
                    to_tsquery('english', ?::text) q
                    where h.fts @@ q and (?::text = '' or h.collection = ?::text)
                    order by rank desc limit ?::int";
        }
        $run = fn(array $w, string $op): array => json_decode(rows($sql, [implode($op, $w), $coll, $coll, $lim]), true) ?: [];
        $rid = fn(array $r): string => ($r['urn'] ?? '') . '|' . ($r['book_slug'] ?? '') . '|' . ($r['hadith_id'] ?? '');
        $found = [];
        $seen = [];
        $add = function (array $list) use (&$found, &$seen, $rid, $lim): void {
            foreach ($list as $r) {
                if (!isset($seen[$rid($r)]) && count($found) < $lim) {
                    $found[] = $r;
                    $seen[$rid($r)] = true;
                }
            }
        };
        if (!empty($b['strict'])) {
            // for the AI: only passages that contain the main words TOGETHER. All words first, then fewer (the first words are the most
            // important), never fewer than two, and never "any word": a passage that matches one common word is noise.
            for ($n = count($words); $n >= min(2, count($words)) && count($found) < min($lim, 3); $n--) {
                $add($run(array_slice($words, 0, $n), ' & '));
            }
        } else {
            $add($run($words, ' & '));
            if (count($words) > 1 && count($found) < min($lim, 5)) {
                $add($run($words, ' | '));
            }
        }
        send(json_encode($found, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    case 'src_hadith':
        method('GET', 'HEAD');
        rateLimit('search', 180, 60);
        if (qsOpt('src', 10) === 'ihadis') {
            send(rows(
                'select lang, book_slug, hadith_id, display_label, arabic, narrator, translation, note, grade, sunnah_ref, in_book_ref
                 from ihadis.hadiths where book_slug = ?::text and hadith_id = ?::text order by lang',
                [qs('book', 80), qs('id', 40)],
            ), 200, TTL);
        }
        $h = one(
            "select h.urn, h.collection, h.book_number, h.chapter_number, h.hadith_number, h.reference, h.in_book_reference, h.grade_en,
                    h.grade_ar, h.narrator_en, h.text_en, h.sanad_ar, h.text_ar, h.url, m.ihadis_grade, m.ihadis_grade_color,
                    (select coalesce(json_agg(json_build_object('lang', t.lang, 'body', t.body, 'grade', t.grade)), '[]'::json)
                       from sunnah.translations t where t.urn = h.urn) as translations
             from sunnah.hadiths h left join sunnah.hadith_meta m on m.urn = h.urn where h.urn = ?::text",
            [qs('urn', 80)],
        );
        $h === null ? fail(404, 'not found') : send($h, 200, TTL);

    // ── feedback from the app ──
    case 'feedback':
        method('POST');
        $b = body(16384);
        $kind = cleanText($b['kind'] ?? '', 20);
        $message = trim(cleanText($b['message'] ?? '', 2000));
        if (!in_array($kind, ['idea', 'problem', 'text', 'praise'], true) || mb_strlen($message) < 3) {
            fail(400, 'Please write a few words.');
        }
        rateLimit('fb', 5, 3600);
        $contact = trim(cleanText($b['contact'] ?? '', 200));
        $page = trim(cleanText($b['page'] ?? '', 80));
        $platform = trim(cleanText($b['platform'] ?? '', 20));
        $st = db()->prepare('insert into feedback (kind, message, contact, hadith_id, page, platform) values (?::text, ?::text, ?::text, ?::int, ?::text, ?::text)');
        $row = [$kind, $message, $contact ?: null, intOrNull($b['hadith_id'] ?? null), $page ?: null, $platform ?: null];
        try {
            $st->execute($row);
        } catch (PDOException $e) {
            if ((string)$e->getCode() !== '23503') {     // the hadith id does not exist: keep the message without it
                throw $e;
            }
            $row[3] = null;
            $st->execute($row);
        }
        send('{"ok":true}');

    // ── semantic search for the AI service (needs the shared key) ──
    case 'match':
        method('POST');
        $key = (string)(cfg()['match_key'] ?? '');
        if ($key === '' || !hash_equals($key, (string)($_SERVER['HTTP_X_API_KEY'] ?? ''))) {
            fail(403, 'forbidden');
        }
        $b = body();
        $emb = $b['embedding'] ?? null;
        if (!is_array($emb) || count($emb) !== 1024) {
            fail(400, 'embedding must have 1024 numbers');
        }
        $vec = [];
        foreach ($emb as $x) {
            if (!is_int($x) && !is_float($x)) {
                fail(400, 'embedding must have 1024 numbers');
            }
            $vec[] = (string)(float)$x;
        }
        $minSim = is_numeric($b['min_sim'] ?? null) ? max(-1.0, min(1.0, (float)$b['min_sim'])) : 0.3;
        send(rows(
            'select * from match_hadiths(?::vector, ?::int, ?::int, ?::real)',
            ['[' . implode(',', $vec) . ']', max(1, min(50, intOrNull($b['k'] ?? null) ?? 12)), intOrNull($b['vol'] ?? null), $minSim],
        ));

    default:
        fail(404, 'not found');
}
