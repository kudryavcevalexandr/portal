insert into public.nomenclature_spec_all_v1
select
  t.*,
  '141N50'::text as source_object_code,
  o.id as object_id,
  o.object_name as object_name,
  null::bigint as class_l3_id
from public.v_nomenclature_spec141N50_v1 t
join public.object_v1 o
  on o.subobject_code = '141N50';