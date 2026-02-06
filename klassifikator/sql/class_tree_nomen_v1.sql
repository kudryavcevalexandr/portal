-- 00_create_class_tree_nomen_v1.sql

drop table if exists public.class_tree_nomen_v1;

create table public.class_tree_nomen_v1 (
  id           text primary key,   -- стабильный ключ узла (L1:/L2:/L3:/L4:)
  parent_id    text null,          -- для дерева (null у L1)

  level        int  not null,       -- 1..4

  -- коды/имена уровней (как в твоём class_tree_v1)
  l1_code      text null,
  l1_name      text null,
  l2_code      text null,
  l2_name      text null,
  l3_code      text null,
  l3_name      text null,
  l4_code      text null,
  l4_name      text null,

  -- связь с номенклатурой (для L4)
  dup_root_id  int null,

  -- доп. поля L4 (то что хочешь видеть)
  item_name    text null,          -- например name_tep_korr
  unit         text null,          -- ед. изм (если есть)
  
  -- редактируемые поля (только L4 по смыслу)
  approved     boolean null,       -- "согласовано"
  note         text null,          -- "примечания"

  -- агрегат для уровней 1-3
  pending_cnt  int not null default 0,

  -- сортировка как у тебя
  l1_num       int not null default 0,
  l2_num       int not null default 0,
  l3_num       int not null default 0,
  l4_num       int not null default 0
);

create index if not exists ix_ctn1_level    on public.class_tree_nomen_v1(level);
create index if not exists ix_ctn1_parent   on public.class_tree_nomen_v1(parent_id);

create index if not exists ix_ctn1_l1_num   on public.class_tree_nomen_v1(l1_num);
create index if not exists ix_ctn1_l2_num   on public.class_tree_nomen_v1(l2_num);
create index if not exists ix_ctn1_l3_num   on public.class_tree_nomen_v1(l3_num);
create index if not exists ix_ctn1_l4_num   on public.class_tree_nomen_v1(l4_num);

create index if not exists ix_ctn1_l3_code  on public.class_tree_nomen_v1(l3_code);
create index if not exists ix_ctn1_dup_root on public.class_tree_nomen_v1(dup_root_id);