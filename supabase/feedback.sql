-- User feedback from the app. Insert-only for the public (anon) role: nobody can read it back through the API;
-- read it with the Supabase dashboard / `supabase db query --linked "select * from feedback order by created_at desc"`.
create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('idea', 'problem', 'text', 'praise')),
  message     text not null check (char_length(message) between 3 and 2000),
  contact     text check (contact is null or char_length(contact) <= 200),
  hadith_id   int references hadiths(id) on delete set null,   -- set when reporting a mistake in a specific hadith
  page        text,                                             -- screen the user came from
  platform    text,                                             -- ios / android / web
  status      text not null default 'new' check (status in ('new', 'seen', 'done'))
);
create index if not exists feedback_created_idx on feedback (created_at desc);
alter table feedback enable row level security;
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert to anon, authenticated
  with check (kind in ('idea', 'problem', 'text', 'praise') and char_length(message) between 3 and 2000 and status = 'new');
revoke all on feedback from anon, authenticated;
grant insert on feedback to anon, authenticated;
