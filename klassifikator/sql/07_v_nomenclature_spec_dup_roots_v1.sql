DROP TABLE IF EXISTS public.v_nomenclature_spec_dup_roots_v1;

CREATE TABLE public.v_nomenclature_spec_dup_roots_v1 AS
SELECT DISTINCT
dup_root_id, (false_condition)::boolean AS false_condition FROM public.v_nomenclature_spec_read_v1;
CREATE INDEX IF NOT EXISTS ix_v_nomenclature_spec_dup_roots_v1_dup_root_id
ON public.v_nomenclature_spec_dup_roots_v1 (dup_root_id);
