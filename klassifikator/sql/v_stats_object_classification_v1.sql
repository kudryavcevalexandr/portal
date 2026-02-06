create or replace view public.v_stats_object_classification_v1 as
select
  n.object_id,
  n.object_code,
  n.object_name,
  count(*) as total_positions,
  count(*) filter (where n.class_l3_id is not null) as classified_positions,
  count(*) filter (where n.class_l3_id is null) as unclassified_positions,
  round(
    100.0 * count(*) filter (where n.class_l3_id is not null) / nullif(count(*), 0),
    2
  ) as classified_pct
from public.nomenclature_spec_all_v1 n
group by n.object_id, n.object_code, n.object_name
order by n.object_code;