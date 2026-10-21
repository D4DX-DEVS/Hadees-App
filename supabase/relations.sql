-- Link the same hadith appearing under different numbers.
-- Compares harakat-stripped Arabic with pg_trgm similarity; keeps human-verified rows.

set local pg_trgm.similarity_threshold = 0.45;

delete from hadith_relations where not verified;

insert into hadith_relations (hadith_id, related_id, relation, score)
select a.id, b.id,
       case when s >= 0.75 then 'duplicate' when s >= 0.55 then 'variant' else 'partial' end,
       s
from hadiths a
join hadiths b on a.id < b.id and matn_core(a.arabic_text) % matn_core(b.arabic_text)   -- uses hadiths_matn_trgm
cross join lateral (select similarity(matn_core(a.arabic_text), matn_core(b.arabic_text)) as s) x
on conflict (hadith_id, related_id) do nothing;

-- group_id = smallest hadith id in each connected cluster of duplicate/variant links
update hadiths set group_id = null;
with recursive edges as (
  select hadith_id a, related_id b from hadith_relations where relation in ('duplicate','variant')
  union select related_id, hadith_id from hadith_relations where relation in ('duplicate','variant')
), reach(start, node) as (
  select a, a from edges
  union
  select r.start, e.b from reach r join edges e on e.a = r.node
)
update hadiths h set group_id = g.gid
from (select start, min(node) gid from reach group by start) g
where h.id = g.start;
