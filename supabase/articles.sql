-- Prose sections of Vol 1 (introduction, foreword, biography, hadith sciences, narrators) — not hadith
create table if not exists articles (
  id          serial primary key,
  volume_id   smallint not null references volumes(id) on delete cascade,
  section_no  smallint not null,            -- number in the volume TOC (1 = ആമുഖമായി ...)
  title_ml    text not null,
  start_page  int,
  end_page    int,
  unique (volume_id, section_no)
);
create table if not exists article_blocks (
  id          serial primary key,
  article_id  int not null references articles(id) on delete cascade,
  seq         int not null,                 -- order inside the article
  kind        text not null check (kind in ('heading','subheading','paragraph','arabic','list_item','table','footnote')),
  text_ml     text,                         -- text (Malayalam / Arabic for kind='arabic')
  rows        jsonb,                        -- table rows for kind='table'
  page        int,                          -- printed page
  unique (article_id, seq)
);
create index if not exists article_blocks_article_idx on article_blocks(article_id, seq);
alter table articles enable row level security;
alter table article_blocks enable row level security;
drop policy if exists articles_read on articles;
create policy articles_read on articles for select using (true);
drop policy if exists article_blocks_read on article_blocks;
create policy article_blocks_read on article_blocks for select using (true);
grant select on articles, article_blocks to anon, authenticated;
