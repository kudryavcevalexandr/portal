drop table if exists public.nomenclature_spec_all_v1;

-- Берём структуру из одной витрины (они у тебя одинаковые)
create table public.nomenclature_spec_all_v1 (
  like public.v_nomenclature_spec252m1_v1 including defaults including constraints
);

-- Наши служебные поля (для привязки к объекту)
alter table public.nomenclature_spec_all_v1
  add column object_id bigint,
  add column object_name text;

-- Поле для привязки к классификатору L3 (редактируемое в Directus)
alter table public.nomenclature_spec_all_v1
  add column class_l3_id bigint null;

alter table public.nomenclature_spec_all_v1
  add constraint fk_nomenclature_spec_all_v1_class_l3
  foreign key (class_l3_id) references public.class_l3(id);

-- PK для Directus
alter table public.nomenclature_spec_all_v1
  add column id bigserial;

alter table public.nomenclature_spec_all_v1
  add constraint pk_nomenclature_spec_all_v1 primary key (id);

-- Индексы
create index if not exists ix_nomenclature_all_object_id on public.nomenclature_spec_all_v1 (object_id);
create index if not exists ix_nomenclature_all_class_l3_id on public.nomenclature_spec_all_v1 (class_l3_id);