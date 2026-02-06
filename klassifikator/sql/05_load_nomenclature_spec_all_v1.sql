alter table public.nomenclature_spec_all_v1
  add column id bigserial;

update public.nomenclature_spec_all_v1
set id = nextval(pg_get_serial_sequence('public.nomenclature_spec_all_v1','id'))
where id is null;

alter table public.nomenclature_spec_all_v1
  add constraint pk_nomenclature_spec_all_v1 primary key (id);