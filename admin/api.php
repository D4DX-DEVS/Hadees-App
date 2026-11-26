<?php
declare(strict_types=1);

/**
 * Editor admin page: JSON API used by admin/js/*.js.   GET  api.php?a=<action>&...   POST api.php?a=<action> (JSON body)
 * Every action except login needs the editor session; every POST needs the CSRF token (header X-CSRF-Token).
 */

define('HV_ADMIN', true);
require __DIR__ . '/lib.php';
require __DIR__ . '/tables.php';

security_headers();

set_exception_handler(function (Throwable $e): void {
    if ($e instanceof UserError) {
        fail($e->status, $e->getMessage());
    }
    error_log('[hadees-admin] ' . $e::class . ': ' . $e->getMessage());
    fail(500, 'Server error. Nothing was changed by the failed request.');
});

start_session();
$a = is_string($_GET['a'] ?? null) ? $_GET['a'] : '';
$post = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

// ───────── login / logout / who am I ─────────
if ($a === 'login') {
    if (!$post) {
        fail(405, 'POST only');
    }
    $b = body(4096);
    login(trim((string)($b['user'] ?? '')), (string)($b['pass'] ?? ''));
    out(['user' => $_SESSION['editor'], 'csrf' => csrf_token()]);
}
if (!logged_in()) {
    fail(401, 'Please log in.');
}
if ($post) {
    check_csrf();
} else {
    session_write_close();      // reading needs no session writes: let the page's parallel requests run at the same time
}
if ($a === 'logout') {
    logout();
    out(['ok' => true]);
}
if ($a === 'me') {
    out(['user' => $_SESSION['editor'], 'csrf' => csrf_token(), 'pending' => pending_count()]);
}

/** hadith list columns: enough to recognise a hadith in a list */
const HADITH_LIST = "h.id, h.hadith_no, h.hadith_label, h.needs_review, left(h.malayalam_text, 160) as snippet,
                     b.volume_id, b.book_no, b.title_ml as book_title, c.chapter_no,
                     exists (select 1 from embed_pending p where p.hadith_id = h.id) as pending";
const HADITH_FROM = 'hadiths h join books b on b.id = h.book_id left join chapters c on c.id = h.chapter_id';

$b = $post ? body() : [];

switch ($a) {
    // ───────── browse ─────────
    case 'volumes':
        out(q('select v.id, v.title_ml, count(distinct bk.id)::int as books, count(h.id)::int as hadiths
               from volumes v left join books bk on bk.volume_id = v.id left join hadiths h on h.book_id = bk.id
               group by v.id order by v.id'));

    case 'books':
        out(q('select bk.id, bk.book_no, bk.title_ml, bk.title_ar, bk.start_page,
                      (select count(*) from chapters c where c.book_id = bk.id)::int as chapters,
                      (select count(*) from hadiths h where h.book_id = bk.id)::int as hadiths
               from books bk where bk.volume_id = ?::int order by bk.book_no', [gi('volume')]));

    case 'book':
        $id = gi('id');
        $row = snapshot('books', $id) ?? throw new UserError('Book not found.', 404);
        out(['row' => $row, 'ver' => row_ver($row),
            'chapters' => q('select c.id, c.chapter_no, c.title_ml, c.title_ar, c.start_page,
                                    (select count(*) from hadiths h where h.chapter_id = c.id)::int as hadiths
                             from chapters c where c.book_id = ?::int order by c.chapter_no', [$id]),
            'unchaptered' => (int)qv('select count(*) from hadiths where book_id = ?::int and chapter_id is null', [$id])]);

    case 'chapter':
        $id = gi('id');
        $row = snapshot('chapters', $id) ?? throw new UserError('Chapter not found.', 404);
        out(['row' => $row, 'ver' => row_ver($row),
            'book' => q1('select id, volume_id, book_no, title_ml from books where id = ?::int', [$row['book_id']]),
            'hadiths' => (int)qv('select count(*) from hadiths where chapter_id = ?::int', [$id]),
            'last_no' => qv('select max(hadith_no) from hadiths where chapter_id = ?::int', [$id])]);

    case 'chapter_hadiths':   // one page of a chapter's hadith
        out(paged(HADITH_LIST, HADITH_FROM . ' where h.chapter_id = ?::int', 'h.hadith_no', [gi('chapter')]));

    case 'book_hadiths':      // one page of the hadith of a book without a chapter
        out(paged(HADITH_LIST, HADITH_FROM . ' where h.book_id = ?::int and h.chapter_id is null', 'h.hadith_no', [gi('book')]));

    case 'hadith':
        $id = gi('id');
        $row = snapshot('hadiths', $id) ?? throw new UserError('Hadith not found.', 404);
        $book = q1('select id, volume_id, book_no, title_ml from books where id = ?::int', [$row['book_id']]);
        out(['row' => $row, 'ver' => row_ver($row), 'book' => $book,
            'chapters' => q('select id, chapter_no, title_ml from chapters where book_id = ?::int order by chapter_no', [$row['book_id']]),
            'pending' => (bool)qv('select 1 from embed_pending where hadith_id = ?::int', [$id]),
            'prev' => qv('select id from hadiths where book_id = ?::int and hadith_no < ?::int order by hadith_no desc limit 1', [$row['book_id'], $row['hadith_no']]),
            'next' => qv('select id from hadiths where book_id = ?::int and hadith_no > ?::int order by hadith_no limit 1', [$row['book_id'], $row['hadith_no']]),
            'edits' => (int)qv("select count(*) from admin_edits where tbl = 'hadiths' and row_id = ?::text", [(string)$id])]);

    case 'goto':              // volume / book number / hadith number -> hadith id
        $id = qv('select h.id from hadiths h join books b on b.id = h.book_id
                  where b.volume_id = ?::int and b.book_no = ?::int and h.hadith_no = ?::int', [gi('v'), gi('b'), gi('n')]);
        out(['id' => $id]);

    case 'search':
        $t = gs('q', 200);
        if (mb_strlen($t) < 2) {
            out(['data' => [], 'page' => 1, 'pageSize' => 20, 'total' => 0, 'totalPages' => 1]);
        }
        if (preg_match('/^#?(\d{1,9})$/', $t, $m)) {
            out(paged(HADITH_LIST, HADITH_FROM . ' where h.id = ?::int', 'h.id', [(int)$m[1]]));
        }
        $p = '%' . like_escape($t) . '%';
        out(paged(HADITH_LIST, HADITH_FROM . "
               where position(nullif(ml_search_key(?::text), '') in h.malayalam_search) > 0
                  or position(nullif(strip_harakat(?::text), '') in h.arabic_plain) > 0
                  or h.malayalam_text ilike ?::text or h.narrator_ml ilike ?::text or h.hadith_label ilike ?::text",
            'b.volume_id, b.book_no, h.hadith_no', [$t, $t, $p, $p, $p]));

    case 'review':            // hadith flagged during OCR
        out(paged(HADITH_LIST, HADITH_FROM . ' where h.needs_review', 'b.volume_id, b.book_no, h.hadith_no'));

    case 'pending':
        out(paged(HADITH_LIST, 'embed_pending p join ' . HADITH_FROM . ' on h.id = p.hadith_id', 'p.since, p.hadith_id'));

    case 'overview':          // the home screen: the shelf of books, the review queue, today's work
        out([
            'volumes' => q('select id, title_ml from volumes order by id'),
            'books' => q('select bk.id, bk.volume_id, bk.book_no, bk.title_ml, count(h.id)::int as hadiths,
                                 (count(h.id) filter (where h.needs_review))::int as review
                          from books bk left join hadiths h on h.book_id = bk.id
                          group by bk.id order by bk.volume_id, bk.book_no'),
            'review' => (int)qv('select count(*) from hadiths where needs_review'),
            'pending' => pending_count(),
            'edits_today' => (int)qv("select count(*) from admin_edits where at >= date_trunc('day', now())"),
            'last_edit' => q1('select id, at, tbl, row_id, action from admin_edits order by id desc limit 1'),
        ]);

    case 'sources':
        out(q('select code_ar, code_ml, name_en, name_ml from sources order by code_ml'));

    // ───────── articles + narrators ─────────
    case 'articles':
        out(q('select a.id, a.volume_id, a.section_no, a.title_ml, a.start_page, a.end_page,
                      (select count(*) from article_blocks x where x.article_id = a.id)::int as blocks
               from articles a order by a.volume_id, a.section_no'));

    case 'article':
        $id = gi('id');
        $row = snapshot('articles', $id) ?? throw new UserError('Article not found.', 404);
        $blocks = q('select to_jsonb(x) as j from article_blocks x where article_id = ?::int order by seq', [$id]);
        out(['row' => $row, 'ver' => row_ver($row), 'blocks' => array_map(function ($r) {
            $j = json_decode((string)$r['j'], true);
            return ['row' => $j, 'ver' => row_ver($j)];
        }, $blocks)]);

    case 'narrators':
        out(paged('n.id, n.name_ml, n.page, (select count(*) from narrator_spellings s where s.narrator_id = n.id)::int as spellings',
            'narrators n', 'n.id'));

    case 'narrator':
        $id = gi('id');
        $row = snapshot('narrators', $id) ?? throw new UserError('Narrator not found.', 404);
        out(['row' => $row, 'ver' => row_ver($row),
            'spellings' => array_map(function ($r) {
                $j = ['spelling' => $r['spelling'], 'narrator_id' => (int)$r['narrator_id']];
                return $j + ['hadiths' => (int)$r['hadiths'], 'ver' => row_ver($j)];
            }, q('select s.spelling, s.narrator_id, (select count(*) from hadiths h where h.narrator_ml = s.spelling)::int as hadiths
                  from narrator_spellings s where s.narrator_id = ?::int order by s.spelling', [$id]))]);

    // ───────── history ─────────
    case 'history':
        $where = [];
        $params = [];
        if (($t = gs('tbl', 40)) !== '') {
            spec($t);
            $where[] = 'e.tbl = ?::text';
            $params[] = $t;
        }
        if (($r = gs('row', 300)) !== '') {
            $where[] = 'e.row_id = ?::text';
            $params[] = $r;
        }
        out(paged("e.id, e.at, e.tbl, e.row_id, e.action, e.note, e.undone_by, e.undoes,
                      coalesce(e.new_row, e.old_row)->>'hadith_no' as hadith_no,
                      coalesce(e.new_row, e.old_row)->>'title_ml' as title,
                      coalesce(e.new_row, e.old_row)->>'name_ml' as name,
                      (select b.volume_id from books b where b.id = (coalesce(e.new_row, e.old_row)->>'book_id')::int) as volume_id,
                      (select b.book_no from books b where b.id = (coalesce(e.new_row, e.old_row)->>'book_id')::int) as book_no",
            'admin_edits e' . ($where ? ' where ' . implode(' and ', $where) : ''), 'e.id desc', $params));

    case 'edit':
        $e = q1('select * from admin_edits where id = ?::bigint', [gi('id')]) ?? throw new UserError('Edit not found.', 404);
        $e['old_row'] = $e['old_row'] === null ? null : json_decode((string)$e['old_row'], true);
        $e['new_row'] = $e['new_row'] === null ? null : json_decode((string)$e['new_row'], true);
        out($e);

    // ───────── changes (POST) ─────────
    case 'save':              // {tbl, id, ver, fields, note, variants?}
        if (!$post) {
            fail(405, 'POST only');
        }
        $tbl = (string)($b['tbl'] ?? '');
        $id = pk_value($tbl, $b['id'] ?? null);
        $variants = $tbl === 'hadiths' && array_key_exists('variants', $b) ? clean_variants($b['variants']) : null;
        if ($tbl === 'hadiths' && isset($b['fields']['chapter_id']) && $b['fields']['chapter_id'] !== null && $b['fields']['chapter_id'] !== '') {
            $book = qv('select book_id from hadiths where id = ?::int', [$id]);
            if (!qv('select 1 from chapters where id = ?::int and book_id = ?::int', [pk_value('chapters', $b['fields']['chapter_id']), $book])) {
                throw new UserError('The chapter is not in this book.');
            }
        }
        $res = save_row($tbl, $id, is_array($b['fields'] ?? null) ? $b['fields'] : [], (string)($b['ver'] ?? ''),
            trim((string)($b['note'] ?? '')), $variants);
        if ($tbl === 'hadiths' && $res['changed']) {
            $res['embed'] = embed_pending_batch(20, (int)$id);
        }
        $res['pending'] = pending_count();
        out($res);

    case 'create':            // {tbl, fields, note, variants?}
        if (!$post) {
            fail(405, 'POST only');
        }
        $tbl = (string)($b['tbl'] ?? '');
        spec($tbl);
        $res = insert_row($tbl, is_array($b['fields'] ?? null) ? $b['fields'] : [], trim((string)($b['note'] ?? '')),
            $tbl === 'hadiths' ? clean_variants($b['variants'] ?? []) : null);
        if ($tbl === 'hadiths') {
            $res['embed'] = embed_pending_batch(20, (int)$res['id']);
        }
        $res['pending'] = pending_count();
        out($res);

    case 'delete':            // {tbl, id, ver, note}
        if (!$post) {
            fail(405, 'POST only');
        }
        $tbl = (string)($b['tbl'] ?? '');
        out(delete_row($tbl, pk_value($tbl, $b['id'] ?? null), (string)($b['ver'] ?? ''), trim((string)($b['note'] ?? ''))));

    case 'block_move':        // {id, dir: -1 | 1} swap an article block with its neighbour
        if (!$post) {
            fail(405, 'POST only');
        }
        $id = pk_value('article_blocks', $b['id'] ?? null);
        $dir = ($b['dir'] ?? 0) === -1 ? -1 : 1;
        out(tx(function () use ($id, $dir): array {
            $me = snapshot('article_blocks', $id, true) ?? throw new UserError('Block not found.', 404);
            $other = q1('select id from article_blocks where article_id = ?::int and seq ' . ($dir < 0 ? '<' : '>') . ' ?::int
                         order by seq ' . ($dir < 0 ? 'desc' : 'asc') . ' limit 1 for update', [$me['article_id'], $me['seq']]);
            if ($other === null) {
                return ['moved' => false];
            }
            $them = snapshot('article_blocks', $other['id']);
            // swap through a free negative position (seq is unique per article)
            $set = db()->prepare('update article_blocks set seq = ?::int where id = ?::int');
            $set->execute([-1 - (int)$me['seq'], $id]);
            $set->execute([$me['seq'], $them['id']]);
            $set->execute([$them['seq'], $id]);
            audit('article_blocks', $id, 'update', $me, snapshot('article_blocks', $id), 'moved');
            audit('article_blocks', $them['id'], 'update', $them, snapshot('article_blocks', $them['id']), 'moved');
            bump_version();
            return ['moved' => true];
        }));

    case 'undo':              // {edit}
        if (!$post) {
            fail(405, 'POST only');
        }
        $res = undo_edit(pk_value('hadiths', $b['edit'] ?? null));
        $res['pending'] = pending_count();
        out($res);

    case 'embed_run':         // make new AI search vectors for the next pending hadith
        if (!$post) {
            fail(405, 'POST only');
        }
        out(embed_pending_batch(50));
}

fail(404, 'unknown action');
