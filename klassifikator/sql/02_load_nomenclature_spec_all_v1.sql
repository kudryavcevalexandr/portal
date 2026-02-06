drop table if exists public.nomenclature_spec_all_v1;

create table public.nomenclature_spec_all_v1 (
  like public.v_nomenclature_spec252m1_v1 including defaults including constraints
);

alter table public.nomenclature_spec_all_v1
  add column source_object_code text not null,
  add column object_id bigint,
  add column object_name text,
  add column class_l3_id bigint null;

alter table public.nomenclature_spec_all_v1
  add constraint fk_nomenclature_spec_all_v1_class_l3
  foreign key (class_l3_id) references public.class_l3(id);