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
    // the tables / rights of api/editor-extras.sql are missing: say what to do instead of "server error"
    if ($e instanceof PDOException && in_array((string)$e->getCode(), ['42P01', '42501', '3F000', '42703'], true)) {
        error_log('[hadees-admin] ' . $e->getMessage());
        fail(503, 'This part needs a one-time database update: run api/editor-extras.sql as the database owner.');
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
                     exists (select 1 from embed_pending p where p.hadith_id = h.id) as pending,
                     to_jsonb(h)->>'grade' as grade";   // via jsonb: no error before api/editor-extras.sql added the column
const HADITH_FROM = 'hadiths h join books b on b.id = h.book_id left join chapters c on c.id = h.chapter_id';

/**
 * The grade of an extra-library hadith, in this order: the editor's corrected grade (source_flags.grade), the grade
 * Sunnah.com prints (grade_en: only Abu Dawud, Nasa'i, Ibn Majah, Tirmidhi, part of Mishkat), the iHadis grade
 * (hadith_meta.ihadis_grade: also Bukhari, Muslim, ...). iHadis hadith carry their own grade.
 */
const SRC_GRADE = "coalesce(nullif(f.grade, ''), nullif(h.grade_en, ''), nullif(m.ihadis_grade, ''))";
const IH_GRADE = "coalesce(nullif(f.grade, ''), nullif(h.grade, ''))";
/** grade text -> one of sahih | hasan | weak | unknown (for filters and counts); weak words first: "Da'if" never counts as accepted */
function grade_class(string $g): string
{
    return "case when $g is null or $g ~* 'undetermined|not graded|unknown' then 'unknown'
                 when $g ~* 'da.?if|daif|weak|fabricat|mawdu|maudu|munkar|batil|shadh|matruk|very weak' then 'weak'
                 when $g ~* 'hasan' then 'hasan'
                 when $g ~* 'sahih|saheeh|authentic' then 'sahih'
                 else 'unknown' end";
}
/**
 * The optional grade of an encyclopedia hadith (hadiths.grade, a fixed value) -> the same four classes.
 * Read through to_jsonb(h), so lists keep working before api/editor-extras.sql added the column.
 */
const OWN_GRADE = "(to_jsonb(h)->>'grade')";
function own_grade_class(string $g): string
{
    return "case when $g is null then 'unknown' when $g in ('daif', 'very_daif', 'mawdu') then 'weak'
                 when $g like 'hasan%' then 'hasan' else 'sahih' end";
}
/** ?grade=sahih|hasan|weak|unknown -> [' and <class> = ?', [value]] or ['', []] */
function grade_filter(string $g, string $classFn = 'grade_class'): array
{
    $want = gs('grade', 10);
    return in_array($want, ['sahih', 'hasan', 'weak', 'unknown'], true) ? [' and ' . $classFn($g) . ' = ?::text', [$want]] : ['', []];
}
/** how many hadith of each grade class match $from (with its WHERE) */
function grade_counts(string $from, string $g, array $params, string $classFn = 'grade_class'): array
{
    $out = ['sahih' => 0, 'hasan' => 0, 'weak' => 0, 'unknown' => 0];
    foreach (q('select ' . $classFn($g) . " as k, count(*)::int as n from $from group by 1", $params) as $r) {
        $out[$r['k']] = $r['n'];
    }
    return $out;
}

/** Sunnah.com list columns, with the editor's marks (own text / topics added, hidden, corrected grade) */
const SRC_LIST = "h.urn, h.collection, h.book_number, h.chapter_number, h.hadith_number, " . SRC_GRADE . " as grade,
                  (f.grade is not null and f.grade <> '') as grade_fixed, left(h.text_en, 180) as snippet,
                  exists (select 1 from hadith_texts t where t.ref = 's:' || h.urn) as edited,
                  exists (select 1 from hadith_topics t where t.ref = 's:' || h.urn) as tagged,
                  coalesce(f.hidden, false) as hidden";
const SRC_FROM = "sunnah.hadiths h left join sunnah.hadith_meta m on m.urn = h.urn left join source_flags f on f.ref = 's:' || h.urn";
/** hadith numbers are text ("12", "12a"): order by the leading number */
const SRC_ORDER = "coalesce(nullif(regexp_replace(h.hadith_number, '[^0-9].*$', ''), '')::bigint, 0)";
const IH_LIST = "h.lang, h.book_slug, h.hadith_id, h.chapter_id, h.display_label, " . IH_GRADE . " as grade,
                 (f.grade is not null and f.grade <> '') as grade_fixed, left(h.translation, 180) as snippet,
                 exists (select 1 from hadith_texts t where t.ref = 'i:' || h.book_slug || '/' || h.hadith_id) as edited,
                 exists (select 1 from hadith_topics t where t.ref = 'i:' || h.book_slug || '/' || h.hadith_id) as tagged,
                 coalesce(f.hidden, false) as hidden";
const IH_FROM = "ihadis.hadiths h left join source_flags f on f.ref = 'i:' || h.book_slug || '/' || h.hadith_id";
const IH_ORDER = "coalesce(nullif(regexp_replace(h.hadith_id, '[^0-9].*$', ''), '')::bigint, 0)";

/** label + first words of the hadith behind x.ref, in any library (used as a LATERAL subquery) */
const REF_LABEL = "select coalesce(h.hadith_label, 'Hadith ' || h.hadith_no) || ' · Volume ' || b.volume_id || ' · Book ' || b.book_no as label,
                          left(h.malayalam_text, 160) as snippet
                   from hadiths h join books b on b.id = h.book_id
                   where h.id = case when x.ref like 'h:%' then substr(x.ref, 3)::int end
                   union all
                   select c.name_en || ' ' || s.hadith_number, left(s.text_en, 160)
                   from sunnah.hadiths s join sunnah.collections c on c.slug = s.collection
                   where x.ref like 's:%' and s.urn = substr(x.ref, 3)
                   union all
                   (select ih.book_slug || ' ' || ih.hadith_id, left(ih.translation, 160) from ihadis.hadiths ih
                    where x.ref like 'i:%' and ih.book_slug = split_part(substr(x.ref, 3), '/', 1) and ih.hadith_id = split_part(substr(x.ref, 3), '/', 2)
                    order by (ih.lang = 'en') desc limit 1)
                   limit 1";

/**
 * The key of the previous ($dir -1) / next (+1) hadith in the same book of an extra library, ordered by
 * $order (the leading number) then $key. $where + $params pick the book; $at is the current hadith's key.
 */
function sibling(string $from, string $where, string $order, string $key, array $params, string $at, int $dir): ?string
{
    $cmp = $dir < 0 ? '<' : '>';
    $sort = $dir < 0 ? 'desc' : 'asc';
    $v = qv("with cur as (select $order as o from $from where $where and $key = ?::text)
             select $key from $from, cur where $where and ($order, $key) $cmp (cur.o, ?::text)
             order by $order $sort, $key $sort limit 1", [...$params, $at, ...$params, $at]);
    return $v === null ? null : (string)$v;
}

/** a page of encyclopedia hadith, filtered by ?grade=, with the grade counts of the whole (unfiltered) list */
function own_graded(string $from, string $order, array $params): array
{
    [$gf, $gp] = grade_filter(OWN_GRADE, 'own_grade_class');
    return paged(HADITH_LIST, $from . $gf, $order, [...$params, ...$gp])
        + ['grades' => grade_counts($from, OWN_GRADE, $params, 'own_grade_class')];
}

/** the editor's translations / corrections, topics and (extra libraries) switches of one hadith */
function extras_of(string $ref): array
{
    $texts = array_map(function ($r) {
        $j = json_decode((string)$r['j'], true);
        return ['row' => $j, 'ver' => row_ver($j)];
    }, q('select to_jsonb(t) as j from hadith_texts t where ref = ?::text order by lang', [$ref]));
    $flag = null;
    if (!str_starts_with($ref, 'h:')) {
        $j = qv('select to_jsonb(f) from source_flags f where ref = ?::text', [$ref]);
        if ($j !== null) {
            $j = json_decode((string)$j, true);
            $flag = ['row' => $j, 'ver' => row_ver($j)];
        }
    }
    return ['ref' => $ref, 'texts' => $texts, 'flag' => $flag,
        'topics' => q('select x.id, x.topic_id, t.name_en, t.name_ml, t.name_ur from hadith_topics x join topics t on t.id = x.topic_id
                       where x.ref = ?::text order by lower(t.name_en)', [$ref])];
}

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

    case 'chapter_hadiths':   // one page of a chapter's hadith (?grade= filters)
        out(own_graded(HADITH_FROM . ' where h.chapter_id = ?::int', 'h.hadith_no', [gi('chapter')]));

    case 'book_hadiths':      // one page of the hadith of a book without a chapter
        out(own_graded(HADITH_FROM . ' where h.book_id = ?::int and h.chapter_id is null', 'h.hadith_no', [gi('book')]));

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
        out(own_graded(HADITH_FROM . "
               where (position(nullif(ml_search_key(?::text), '') in h.malayalam_search) > 0
                  or position(nullif(strip_harakat(?::text), '') in h.arabic_plain) > 0
                  or h.malayalam_text ilike ?::text or h.narrator_ml ilike ?::text or h.hadith_label ilike ?::text)",
            'b.volume_id, b.book_no, h.hadith_no', [$t, $t, $p, $p, $p]));

    case 'review':            // hadith flagged during OCR
        out(own_graded(HADITH_FROM . ' where h.needs_review', 'b.volume_id, b.book_no, h.hadith_no', []));

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


    // ───────── translations (en / ur / ml), corrections and topics of ANY hadith (api/editor-extras.sql) ─────────
    case 'extras':            // ?ref=h:12 | s:<urn> | i:<book>/<id>
        out(extras_of(clean_ref(gs('ref', 200))));

    case 'extras_stats':      // the home screen: what was added so far
        out(q1("select (select count(*) from hadith_texts where ref like 'h:%')::int as own_texts,
                       (select count(*) from hadith_texts where ref not like 'h:%')::int as source_texts,
                       (select count(*) from topics)::int as topics,
                       (select count(*) from hadith_topics)::int as tagged,
                       (select count(*) from source_flags where hidden)::int as hidden,
                       (select count(*) from sunnah.hadiths)::int as sunnah,
                       (select count(*) from (select distinct book_slug, hadith_id from ihadis.hadiths) z)::int as ihadis"));

    case 'topics':
        out(q('select t.id, t.name_en, t.name_ml, t.name_ur, (select count(*) from hadith_topics x where x.topic_id = t.id)::int as hadiths
               from topics t order by lower(t.name_en)'));

    case 'topic':
        $id = gi('id');
        $row = snapshot('topics', $id) ?? throw new UserError('Topic not found.', 404);
        out(['row' => $row, 'ver' => row_ver($row)]);

    case 'topic_hadiths':     // one page of the hadith (any library) that carry a topic
        out(paged('x.id, x.ref, r.label, r.snippet', 'hadith_topics x left join lateral (' . REF_LABEL . ') r on true where x.topic_id = ?::int',
            'x.ref', [gi('topic')]));

    // ───────── Sunnah.com (schema sunnah, read-only; the editor's work lives in hadith_texts / source_flags) ─────────
    case 'src_overview':
        out([
            'collections' => q("select c.slug, c.name_en, c.name_ar, c.grp, c.book_count,
                                       (select count(*) from sunnah.hadiths h where h.collection = c.slug)::int as hadiths
                                from sunnah.collections c order by (c.grp = 'nine') desc, c.name_en"),
            'ihadis' => q("select slug, array_agg(lang order by lang) as langs,
                                  coalesce(max(title) filter (where lang = 'en'), max(title)) as title, max(hadith_count)::int as hadiths
                           from ihadis.books group by slug order by (count(*) filter (where lang = 'en') = 0), slug"),
        ]);

    case 'src_books':         // ?c=<collection>
        $c = gs('c', 60);
        $col = q1('select slug, name_en, name_ar, grp, intro_en from sunnah.collections where slug = ?::text', [$c])
            ?? throw new UserError('Collection not found.', 404);
        out(['collection' => $col, 'grades' => grade_counts(SRC_FROM . ' where h.collection = ?::text', SRC_GRADE, [$c]),
            'books' => q("select b.book_number, b.name_en, b.name_ar, b.range_start, b.range_end,
                    (select count(*) from sunnah.hadiths h where h.collection = b.collection and h.book_number = b.book_number)::int as hadiths
             from sunnah.books b where b.collection = ?::text
             order by nullif(regexp_replace(b.book_number, '[^0-9]', '', 'g'), '')::int nulls last, b.book_number", [$c])]);

    case 'src_hadiths':       // ?c=&b= one page of a Sunnah.com book
        $where = SRC_FROM . ' where h.collection = ?::text and h.book_number = ?::text';
        $params = [gs('c', 60), gs('b', 20)];
        [$gf, $gp] = grade_filter(SRC_GRADE);
        out(paged(SRC_LIST, $where . $gf, SRC_ORDER . ', h.urn', [...$params, ...$gp]) + ['grades' => grade_counts($where, SRC_GRADE, $params)]);

    case 'src_hadith':        // ?urn=
        $urn = gs('urn', 120);
        $row = q1("select h.urn, h.collection, c.name_en as collection_name, h.book_number, b.name_en as book_name, h.chapter_number,
                          ch.title_en as chapter_title, h.hadith_number, h.reference, h.in_book_reference, h.grade_en, h.grade_ar,
                          h.narrator_en, h.text_en, h.sanad_ar, h.text_ar, h.footnote_ar, h.url,
                          m.ihadis_grade, m.note_en, " . SRC_GRADE . " as grade, (f.grade is not null and f.grade <> '') as grade_fixed
                   from sunnah.hadiths h join sunnah.collections c on c.slug = h.collection
                   left join source_flags f on f.ref = 's:' || h.urn
                   left join sunnah.books b on b.collection = h.collection and b.book_number = h.book_number
                   left join lateral (select x.title_en from sunnah.chapters x where x.collection = h.collection
                                      and x.book_number = h.book_number and x.chapter_number = h.chapter_number limit 1) ch on true
                   left join sunnah.hadith_meta m on m.urn = h.urn
                   where h.urn = ?::text", [$urn]) ?? throw new UserError('Hadith not found.', 404);
        out(['row' => $row,
            'prev' => sibling('sunnah.hadiths h', 'h.collection = ?::text and h.book_number = ?::text', SRC_ORDER, 'h.urn',
                [$row['collection'], $row['book_number']], $urn, -1),
            'next' => sibling('sunnah.hadiths h', 'h.collection = ?::text and h.book_number = ?::text', SRC_ORDER, 'h.urn',
                [$row['collection'], $row['book_number']], $urn, 1),
            'translations' => q('select lang, body, grade from sunnah.translations where urn = ?::text order by lang', [$urn]),
            'topics' => q("select distinct t.title from sunnah.topic_hadiths x join sunnah.topics t
                           on t.lang = x.lang and t.subject_slug = x.subject_slug and t.topic_id = x.topic_id
                           where x.urn = ?::text and x.lang = 'en' order by t.title", [$urn]),
            'extras' => extras_of('s:' . $urn)]);

    // ───────── iHadis (schema ihadis, read-only) ─────────
    case 'ih_book':           // ?b=<slug>&lang=  the book in one language + its chapters
        $slug = gs('b', 80);
        $books = q('select lang, title, hadith_count, chapter_count, description, publication from ihadis.books where slug = ?::text order by lang', [$slug]);
        if (!$books) {
            throw new UserError('Book not found.', 404);
        }
        $langs = array_column($books, 'lang');
        $lang = gs('lang', 4);
        $lang = in_array($lang, $langs, true) ? $lang : (in_array('en', $langs, true) ? 'en' : $langs[0]);
        out(['slug' => $slug, 'lang' => $lang, 'books' => $books,
            'grades' => grade_counts(IH_FROM . ' where h.lang = ?::text and h.book_slug = ?::text', IH_GRADE, [$lang, $slug]),
            'chapters' => q('select c.chapter_id, c.title, c.hadith_range, c.display_label,
                                    (select count(*) from ihadis.hadiths h where h.lang = c.lang and h.book_slug = c.book_slug and h.chapter_id = c.chapter_id)::int as hadiths
                             from ihadis.chapters c where c.lang = ?::text and c.book_slug = ?::text order by c.chapter_id', [$lang, $slug])]);

    case 'ih_hadiths':        // ?b=&lang=&ch=  one page of an iHadis chapter
        $where = IH_FROM . ' where h.lang = ?::text and h.book_slug = ?::text and h.chapter_id = ?::int';
        $params = [gs('lang', 4), gs('b', 80), gi('ch')];
        [$gf, $gp] = grade_filter(IH_GRADE);
        out(paged(IH_LIST, $where . $gf, IH_ORDER . ', h.hadith_id', [...$params, ...$gp]) + ['grades' => grade_counts($where, IH_GRADE, $params)]);

    case 'ih_hadith':         // ?b=&id=  every language of one iHadis hadith
        $slug = gs('b', 80);
        $hid = gs('id', 40);
        $rows = q("select h.lang, h.chapter_id, c.title as chapter_title, h.display_label, h.arabic, h.narrator, h.translation, h.note,
                          h.grade, h.sunnah_ref, h.in_book_ref, bk.title as book_title
                   from ihadis.hadiths h left join ihadis.chapters c on c.lang = h.lang and c.book_slug = h.book_slug and c.chapter_id = h.chapter_id
                   left join ihadis.books bk on bk.lang = h.lang and bk.slug = h.book_slug
                   where h.book_slug = ?::text and h.hadith_id = ?::text order by (h.lang = 'en') desc, h.lang", [$slug, $hid]);
        if (!$rows) {
            throw new UserError('Hadith not found.', 404);
        }
        $lang = $rows[0]['lang'];
        out(['slug' => $slug, 'id' => $hid, 'rows' => $rows,
            'prev' => sibling('ihadis.hadiths h', 'h.lang = ?::text and h.book_slug = ?::text', IH_ORDER, 'h.hadith_id', [$lang, $slug], $hid, -1),
            'next' => sibling('ihadis.hadiths h', 'h.lang = ?::text and h.book_slug = ?::text', IH_ORDER, 'h.hadith_id', [$lang, $slug], $hid, 1),
            'topics' => q("select distinct t.title from ihadis.topic_hadiths x join ihadis.topics t
                           on t.lang = x.lang and t.subject_slug = x.subject_slug and t.topic_id = x.topic_id
                           where x.book_slug = ?::text and x.hadith_id = ?::text and x.lang = 'en' order by t.title", [$slug, $hid]),
            'extras' => extras_of("i:$slug/$hid")]);

    case 'src_find':          // ?src=sunnah|ihadis&q=  "bukhari 52" opens a number; other words: English full-text search
        $t = gs('q', 200);
        $src = gs('src', 10) === 'ihadis' ? 'ihadis' : 'sunnah';
        $none = ['data' => [], 'page' => 1, 'pageSize' => 20, 'total' => 0, 'totalPages' => 1];
        if (mb_strlen($t) < 2) {
            out($none);
        }
        if (preg_match('/^([a-z0-9._-]+)[\s:#]+(\d+[a-z]?)$/i', $t, $m)) {
            out($src === 'sunnah'
                ? paged(SRC_LIST, SRC_FROM . ' where h.collection = ?::text and h.hadith_number = ?::text', 'h.urn', [strtolower($m[1]), $m[2]])
                : paged(IH_LIST, IH_FROM . ' where h.book_slug = ?::text and h.hadith_id = ?::text', 'h.lang', [strtolower($m[1]), $m[2]]));
        }
        preg_match_all('/[A-Za-z]{3,}/', $t, $w);
        if (!$w[0]) {
            out($none);
        }
        $tsq = implode(' & ', array_slice(array_values(array_unique(array_map('strtolower', $w[0]))), 0, 8));
        [$gf, $gp] = grade_filter($src === 'sunnah' ? SRC_GRADE : IH_GRADE);
        out($src === 'sunnah'
            ? paged(SRC_LIST, SRC_FROM . " where h.fts @@ to_tsquery('english', ?::text)" . $gf, 'h.collection, ' . SRC_ORDER . ', h.urn', [$tsq, ...$gp])
            : paged(IH_LIST, IH_FROM . " where h.lang = 'en' and h.fts @@ to_tsquery('english', ?::text)" . $gf, 'h.book_slug, ' . IH_ORDER . ', h.hadith_id', [$tsq, ...$gp]));

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
                      coalesce(e.new_row, e.old_row)->>'name_en' as name_en,
                      coalesce(e.new_row, e.old_row)->>'ref' as ref,
                      coalesce(e.new_row, e.old_row)->>'lang' as lang,
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
