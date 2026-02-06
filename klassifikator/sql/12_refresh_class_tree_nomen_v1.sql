truncate table public.class_tree_nomen_v1;

with
l4_raw as (
  select
    ld.dup_root_id,
    ('DR:' || ld.dup_root_id::text) as id,
    ('L3:' || l3.code)              as parent_id,
    4                               as level,

    l1.code as l1_code, l1.name as l1_name,
    l2.code as l2_code, l2.name as l2_name,
    l3.code as l3_code, l3.name as l3_name,

    null::text as l4_code,
    null::text as l4_name,

    p.name_tep_korr as item_name,
    s.uom           as unit,

    0::boolean as approved,
    null::text as note,

    0::int as pending_cnt,

    coalesce(split_part(l1.code, '.', 1), '0')::int as l1_num,
    coalesce(split_part(l2.code, '.', 2), '0')::int as l2_num,
    coalesce(split_part(l3.code, '.', 3), '0')::int as l3_num,
    ld.dup_root_id as l4_num
  from (
    select distinct on (dup_root_id) dup_root_id, l3_id
    from public.v_nomenclature_spec_l3_dup_links_v1
    where dup_root_id is not null and l3_id is not null
    order by dup_root_id, l3_id
  ) ld
  join public.class_l3 l3 on l3.id = ld.l3_id
  join public.class_l2 l2 on l2.id = l3.parent_id_l2
  join public.class_l1 l1 on l1.id = l2.parent_id_l1

  join public.v_nomenclature_spec_pairs_v1 p
    on p.dup_root_id = ld.dup_root_id
   and p.name_tep_korr is not null
   and lower(p.name_tep_korr) not like '%удалить%'

  left join public.v_nomenclature_spec_read_v1 r
    on r.dup_root_id = ld.dup_root_id

  left join public.v_nomenclature_spec_v1 s
    on s.id = r.id_nom
),

-- ДЕДУП: одна строка на dup_root_id
-- приоритет: где есть unit, потом по имени (стабильно)
l4 as (
  select distinct on (dup_root_id)
    id, parent_id, level,
    l1_code, l1_name,
    l2_code, l2_name,
    l3_code, l3_name,
    l4_code, l4_name,
    dup_root_id,
    item_name,
    unit,
    approved, note,
    pending_cnt,
    l1_num, l2_num, l3_num, l4_num
  from l4_raw
  order by dup_root_id,
           (unit is not null) desc,
           item_name
),

-- L1-L3 узлы: берём из class_tree_v1, только те ветки, где есть L4
nodes as (
  select
    case
      when ct.level = 1 then ('L1:' || ct.l1_code)
      when ct.level = 2 then ('L2:' || ct.l2_code)
      when ct.level = 3 then ('L3:' || ct.l3_code)
    end as id,

    case
      when ct.level = 1 then null::text
      when ct.level = 2 then ('L1:' || ct.l1_code)
      when ct.level = 3 then ('L2:' || ct.l2_code)
    end as parent_id,

    ct.level,

    ct.l1_code, ct.l1_name,
    ct.l2_code, ct.l2_name,
    ct.l3_code, ct.l3_name,
    null::text as l4_code,
    null::text as l4_name,

    null::int  as dup_root_id,
    null::text as item_name,
    null::text as unit,

    0::boolean as approved,
    null::text as note,

    0::int as pending_cnt,

    coalesce(ct.l1_num,0) as l1_num,
    coalesce(ct.l2_num,0) as l2_num,
    coalesce(ct.l3_num,0) as l3_num,
    0::int                as l4_num
  from public.class_tree_v1 ct
  where ct.level in (1,2,3)
    and exists (
      select 1
      from l4 x
      where
        (ct.level = 1 and x.l1_code = ct.l1_code) or
        (ct.level = 2 and x.l2_code = ct.l2_code) or
        (ct.level = 3 and x.l3_code = ct.l3_code)
    )
)

insert into public.class_tree_nomen_v1 (
  id, parent_id, level,
  l1_code, l1_name,
  l2_code, l2_name,
  l3_code, l3_name,
  l4_code, l4_name,
  dup_root_id, item_name, unit,
  approved, note,
  pending_cnt,
  l1_num, l2_num, l3_num, l4_num
)
select
  id, parent_id, level,
  l1_code, l1_name,
  l2_code, l2_name,
  l3_code, l3_name,
  l4_code, l4_name,
  dup_root_id, item_name, unit,
  approved, note,
  pending_cnt,
  l1_num, l2_num, l3_num, l4_num
from nodes

union all

select
  id, parent_id, level,
  l1_code, l1_name,
  l2_code, l2_name,
  l3_code, l3_name,
  l4_code, l4_name,
  dup_root_id, item_name, unit,
  approved, note,
  pending_cnt,
  l1_num, l2_num, l3_num, l4_num
from l4;

-- pending_cnt: L3 = count(L4)
update public.class_tree_nomen_v1 t
set pending_cnt = x.cnt
from (
  select parent_id as l3_id, count(*)::int as cnt
  from public.class_tree_nomen_v1
  where level = 4
  group by parent_id
) x
where t.level = 3 and t.id = x.l3_id;

-- вверх: L2 = sum(L3), L1 = sum(L2)
update public.class_tree_nomen_v1 t
set pending_cnt = x.cnt
from (
  select parent_id as l2_id, sum(pending_cnt)::int as cnt
  from public.class_tree_nomen_v1
  where level = 3
  group by parent_id
) x
where t.level = 2 and t.id = x.l2_id;

update public.class_tree_nomen_v1 t
set pending_cnt = x.cnt
from (
  select parent_id as l1_id, sum(pending_cnt)::int as cnt
  from public.class_tree_nomen_v1
  where level = 2
  group by parent_id
) x
where t.level = 1 and t.id = x.l1_id;