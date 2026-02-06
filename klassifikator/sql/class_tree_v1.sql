-- class_tree_v1.sql
-- Витрина иерархии L1-L4 (включая все уровни) + числовые поля для сортировки в Directus
-- Рекомендованная сортировка в Directus (API/UI): l1_num, l2_num, l3_num, l4_num, level (ASC)

drop table if exists public.class_tree_v1;

create table public.class_tree_v1 as
with
t_l1 as (
  select
    ('L1:' || l1.code) as id,
    1 as level,
    l1.code as l1_code,
    l1.name as l1_name,
    null::text as l2_code,
    null::text as l2_name,
    null::text as l3_code,
    null::text as l3_name,
    null::text as l4_code,
    null::text as l4_name
  from public.class_l1 l1
),
t_l2 as (
  select
    ('L2:' || l2.code) as id,
    2 as level,
    l1.code as l1_code,
    l1.name as l1_name,
    l2.code as l2_code,
    l2.name as l2_name,
    null::text as l3_code,
    null::text as l3_name,
    null::text as l4_code,
    null::text as l4_name
  from public.class_l2 l2
  join public.class_l1 l1 on l1.id = l2.parent_id_l1
),
t_l3 as (
  select
    ('L3:' || l3.code) as id,
    3 as level,
    l1.code as l1_code,
    l1.name as l1_name,
    l2.code as l2_code,
    l2.name as l2_name,
    l3.code as l3_code,
    l3.name as l3_name,
    null::text as l4_code,
    null::text as l4_name
  from public.class_l3 l3
  join public.class_l2 l2 on l2.id = l3.parent_id_l2
  join public.class_l1 l1 on l1.id = l2.parent_id_l1
),
t_l4 as (
  select
    ('L4:' || l4.code) as id,
    4 as level,
    l1.code as l1_code,
    l1.name as l1_name,
    l2.code as l2_code,
    l2.name as l2_name,
    l3.code as l3_code,
    l3.name as l3_name,
    l4.code as l4_code,
    l4.name as l4_name
  from public.class_l4 l4
  join public.class_l3 l3 on l3.id = l4.parent_id_l3
  join public.class_l2 l2 on l2.id = l3.parent_id_l2
  join public.class_l1 l1 on l1.id = l2.parent_id_l1
),
u as (
  select * from t_l1
  union all select * from t_l2
  union all select * from t_l3
  union all select * from t_l4
)
select
  u.*,

  -- Числовые ключи для правильной сортировки 1,2,3...10,11...
  coalesce(split_part(u.l1_code, '.', 1), '0')::int as l1_num,
  coalesce(split_part(u.l2_code, '.', 2), '0')::int as l2_num,
  coalesce(split_part(u.l3_code, '.', 3), '0')::int as l3_num,
  coalesce(split_part(u.l4_code, '.', 4), '0')::int as l4_num

from u;

-- PK для Directus
alter table public.class_tree_v1 add primary key (id);

-- Индексы (полезно для сортировки/фильтров в Directus)
create index if not exists ix_class_tree_v1_level  on public.class_tree_v1 (level);

create index if not exists ix_class_tree_v1_l1_num on public.class_tree_v1 (l1_num);
create index if not exists ix_class_tree_v1_l2_num on public.class_tree_v1 (l2_num);
create index if not exists ix_class_tree_v1_l3_num on public.class_tree_v1 (l3_num);
create index if not exists ix_class_tree_v1_l4_num on public.class_tree_v1 (l4_num);

create index if not exists ix_class_tree_v1_l1_code on public.class_tree_v1 (l1_code);
create index if not exists ix_class_tree_v1_l2_code on public.class_tree_v1 (l2_code);
create index if not exists ix_class_tree_v1_l3_code on public.class_tree_v1 (l3_code);
create index if not exists ix_class_tree_v1_l4_code on public.class_tree_v1 (l4_code);
