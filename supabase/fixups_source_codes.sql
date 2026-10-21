-- Misprinted source codes in the book -> the legend codes (each verified against the Arabic code printed on the same hadith).
-- ത/തി -> തു (Tirmidhi), ദാ -> ദ, ജു -> ജ, മ -> മു, ബൂ -> ബു, and merged pairs split: തുന, തുജ, ദന.
-- Run after (re)seeding. Codes end up in the legend order: ബു, മു, ദ, തു, ന, ജ.
update hadiths h set source_codes_ml = (
  select coalesce(array_agg(c order by array_position(array['ബു','മു','ദ','തു','ന','ജ'], c)), '{}') from (
    select distinct c from (
      select unnest(case s
        when 'ത' then array['തു'] when 'തി' then array['തു'] when 'ദാ' then array['ദ'] when 'ജു' then array['ജ']
        when 'മ' then array['മു'] when 'ബൂ' then array['ബു']
        when 'തുന' then array['തു','ന'] when 'തുജ' then array['തു','ജ'] when 'ദന' then array['ദ','ന']
        else array[s] end) as c
      from unnest(h.source_codes_ml) as s) y) x)
where id in (639,870,1041,2729,3122,11883,12509,13895,14000,15497,15890,16795,17204);
