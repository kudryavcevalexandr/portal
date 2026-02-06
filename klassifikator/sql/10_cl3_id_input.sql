DROP TABLE IF EXISTS public.v_nomenclature_spec_l3_dup_links_v1;

CREATE TABLE public.v_nomenclature_spec_l3_dup_links_v1(
l3_id bigint NOT NULL REFERENCES public.class_l3(id),
dup_root_id bigint NOT NULL,
date_in text DEFAULT to_char(current_date,'DD.MM.YYYY')
);

CREATE INDEX IF NOT EXISTS ix_v_ns_l3_dup_links_l3_id ON public.v_nomenclature_spec_l3_dup_links_v1(l3_id);
CREATE INDEX IF NOT EXISTS ix_v_ns_l3_dup_links_dup_root_id ON public.v_nomenclature_spec_l3_dup_links_v1(dup_root_id);