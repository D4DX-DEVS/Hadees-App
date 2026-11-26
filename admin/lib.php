<?php
declare(strict_types=1);

/**
 * Editor admin page: shared helpers (config, database, session, input, AI embeddings).
 * Included by admin/api.php and admin/index.php only; a direct request gets nothing.
 *
 * Config: the same /home/<account>/hadees-config.php as the public API (outside the web root, never deployed), with
 *   'editor_db_user' / 'editor_db_pass'   the database user made by api/editor-role.sql (may change the library)
 *   'editor_login' / 'editor_password_hash'   the one editor login; the hash comes from password_hash()
 *   'worker_url' / 'worker_admin_token'   the AI worker and its ADMIN_TOKEN secret, to make new search vectors
 */

if (!defined('HV_ADMIN')) {
    http_response_code(404);
    exit;
}

const SESSION_IDLE = 7200;          // logged out after 2 h without a request
const LOGIN_MAX_FAILS = 5;          // wrong passwords per visitor ...
const LOGIN_WINDOW = 900;           // ... per 15 minutes
const EMBED_MODEL = '@cf/baai/bge-m3';

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
    error_log('[hadees-admin] hadees-config.php not found');
    return $c = [];
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $c = cfg();
    if (empty($c['name']) || empty($c['editor_db_user'])) {
        fail(503, 'The admin page is not set up yet (editor_db_user missing in hadees-config.php).');
    }
    $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $c['host'] ?? '127.0.0.1', (int)($c['port'] ?? 5432), $c['name']);
    $pdo = new PDO($dsn, $c['editor_db_user'], $c['editor_db_pass'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $pdo->exec("set statement_timeout = '30s'");
    return $pdo;
}

/** all rows of a query as arrays */
function q(string $sql, array $params = []): array
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
}

/** first row or null */
function q1(string $sql, array $params = []): ?array
{
    $st = db()->prepare($sql);
    $st->execute($params);
    $r = $st->fetch();
    return $r === false ? null : $r;
}

/** first column of the first row */
function qv(string $sql, array $params = []): mixed
{
    $st = db()->prepare($sql);
    $st->execute($params);
    $v = $st->fetchColumn();
    return $v === false ? null : $v;
}

/** run $fn inside one transaction */
function tx(callable $fn): mixed
{
    $db = db();
    $db->beginTransaction();
    try {
        $out = $fn();
        $db->commit();
        return $out;
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}

// ───────── output ─────────
function security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
}

function out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $status, string $message): never
{
    out(['error' => $message], $status);
}

/** a client mistake with a message the editor can read (turned into 400 / 409 by api.php) */
final class UserError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

// ───────── session + login ─────────
function https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)SESSION_IDLE);
    session_name('hv_editor');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/admin/',
        'secure' => https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
    if (!empty($_SESSION['editor']) && time() - (int)($_SESSION['seen'] ?? 0) > SESSION_IDLE) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    if (!empty($_SESSION['editor'])) {
        $_SESSION['seen'] = time();
    }
}

function logged_in(): bool
{
    return !empty($_SESSION['editor']);
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** POST requests must come from this site and carry the session's CSRF token */
function check_csrf(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== ($_SERVER['HTTP_HOST'] ?? '')) {
        fail(403, 'wrong origin');
    }
    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($sent === '' || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        fail(403, 'Session expired. Reload the page.');
    }
}

/** counter file for failed logins of this visitor in the current window */
function fail_counter_path(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'anon';
    return sys_get_temp_dir() . '/hv-login-' . sha1($ip) . '-' . intdiv(time(), LOGIN_WINDOW);
}

function login_fail_count(): int
{
    $f = fail_counter_path();
    return is_file($f) ? (int)@file_get_contents($f) : 0;
}

function login_fail_add(): void
{
    $f = fail_counter_path();
    $fp = @fopen($f, 'c+');
    if ($fp === false) {
        return;
    }
    flock($fp, LOCK_EX);
    $n = (int)stream_get_contents($fp);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, (string)($n + 1));
    flock($fp, LOCK_UN);
    fclose($fp);
}

function login(string $user, string $pass): void
{
    $c = cfg();
    if (empty($c['editor_login']) || empty($c['editor_password_hash'])) {
        throw new UserError('The editor login is not set up yet (editor_login / editor_password_hash in hadees-config.php).', 503);
    }
    if (login_fail_count() >= LOGIN_MAX_FAILS) {
        throw new UserError('Too many wrong passwords. Try again in 15 minutes.', 429);
    }
    $ok = hash_equals((string)$c['editor_login'], $user) & password_verify($pass, (string)$c['editor_password_hash']);
    if (!$ok) {
        login_fail_add();
        usleep(800000);
        throw new UserError('Wrong username or password.', 401);
    }
    session_regenerate_id(true);
    $_SESSION = ['editor' => $user, 'seen' => time(), 'csrf' => bin2hex(random_bytes(32))];
}

function logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'],
            'httponly' => true, 'samesite' => 'Strict']);
    }
    session_destroy();
}

// ───────── input ─────────
function body(int $max = 1048576): array
{
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) {
        fail(413, 'request too large');
    }
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function gi(string $k): int
{
    $v = $_GET[$k] ?? '';
    if (!is_string($v) || !preg_match('/^\d{1,9}$/', $v)) {
        throw new UserError("missing or bad $k");
    }
    return (int)$v;
}

function gs(string $k, int $max = 300): string
{
    $v = $_GET[$k] ?? '';
    return is_string($v) && mb_check_encoding($v, 'UTF-8') ? trim(mb_substr(str_replace("\0", '', $v), 0, $max)) : '';
}

/**
 * One page of a list (server-side paging). ?page=1.. and ?pageSize=10|20|50|100 (default 20) come from the URL.
 * $from includes the joins and the WHERE; $order the ORDER BY. Returns the same shape every time, even when empty:
 * {data, page, pageSize, total, totalPages}. The count and the page run as two statements with the same filter.
 */
function paged(string $select, string $from, string $order, array $params = []): array
{
    $size = (int)($_GET['pageSize'] ?? 20);
    if (!in_array($size, [10, 20, 50, 100], true)) {
        $size = 20;
    }
    $page = max(1, min(100000, (int)($_GET['page'] ?? 1)));
    $total = (int)qv("select count(*) from $from", $params);
    $pages = max(1, (int)ceil($total / $size));
    $page = min($page, $pages);
    $data = q("select $select from $from order by $order limit $size offset " . (($page - 1) * $size), $params);
    return ['data' => $data, 'page' => $page, 'pageSize' => $size, 'total' => $total, 'totalPages' => $pages];
}

/** escape % _ \ for a LIKE pattern */
function like_escape(string $s): string
{
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $s);
}

// ───────── data version + AI search vectors ─────────
function bump_version(): void
{
    db()->exec("update app_meta set value = value + 1 where key = 'data_version'");
}

/** mark hadith whose search vector must be made again */
function mark_pending(string $where, array $params): void
{
    db()->prepare("insert into embed_pending (hadith_id) select h.id from hadiths h where $where on conflict do nothing")
        ->execute($params);
}

function pending_count(): int
{
    return (int)qv('select count(*) from embed_pending');
}

/** POST JSON to the AI worker; null when it does not answer properly */
function worker_post(string $path, array $payload): ?array
{
    $c = cfg();
    $url = rtrim((string)($c['worker_url'] ?? ''), '/');
    $tok = (string)($c['worker_admin_token'] ?? '');
    if ($url === '' || $tok === '') {
        return null;
    }
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $headers = ['Content-Type: application/json', 'x-admin-token: ' . $tok];
    if (function_exists('curl_init')) {
        $ch = curl_init($url . $path);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_CONNECTTIMEOUT => 10]);
        $res = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $headers),
            'content' => $json, 'timeout' => 60, 'ignore_errors' => true]]);
        $res = @file_get_contents($url . $path, false, $ctx);
        $code = preg_match('#^HTTP/\S+ (\d{3})#', $http_response_header[0] ?? '', $m) ? (int)$m[1] : 0;
    }
    if (!is_string($res) || $code !== 200) {
        error_log("[hadees-admin] worker $path: HTTP $code " . (is_string($res) ? substr($res, 0, 300) : ''));
        return null;
    }
    $d = json_decode($res, true);
    return is_array($d) ? $d : null;
}

/**
 * Make new search vectors for up to $limit pending hadith (the same text the original vectors were made from:
 * book › chapter title, narrator, Malayalam, Arabic without harakat). Returns ['done' => n, 'left' => n, 'error' => ?].
 */
function embed_pending_batch(int $limit = 50, ?int $first = null): array
{
    $rows = q("select h.id, left(concat_ws(E'\\n', b.title_ml || coalesce(' › ' || c.title_ml, ''),
                      h.narrator_ml, h.malayalam_text, h.arabic_plain), 3000) as text
               from embed_pending p join hadiths h on h.id = p.hadith_id
               join books b on b.id = h.book_id left join chapters c on c.id = h.chapter_id
               order by (p.hadith_id = ?::int) desc nulls last, p.since, p.hadith_id limit " . max(1, min(100, $limit)), [$first]);
    if (!$rows) {
        return ['done' => 0, 'left' => 0, 'error' => null];
    }
    $res = worker_post('/admin/embed', ['texts' => array_column($rows, 'text')]);
    $vecs = $res['vectors'] ?? null;
    if (!is_array($vecs) || count($vecs) !== count($rows)) {
        return ['done' => 0, 'left' => pending_count(),
            'error' => 'The AI service did not answer (its free daily limit may be used up). The edits are saved; try again later.'];
    }
    tx(function () use ($rows, $vecs): void {
        $up = db()->prepare("insert into hadith_embeddings (hadith_id, model, embedding) values (?::int, ?::text, ?::vector)
                             on conflict (hadith_id) do update set model = excluded.model, embedding = excluded.embedding, updated_at = now()");
        $del = db()->prepare('delete from embed_pending where hadith_id = ?::int');
        foreach ($rows as $i => $r) {
            $v = $vecs[$i];
            if (!is_array($v) || count($v) !== 1024) {
                continue;
            }
            $up->execute([$r['id'], EMBED_MODEL, '[' . implode(',', array_map(fn($x) => (string)(float)$x, $v)) . ']']);
            $del->execute([$r['id']]);
        }
    });
    return ['done' => count($rows), 'left' => pending_count(), 'error' => null];
}
