DROP TABLE IF EXISTS public.v_nomenclature_spec_pairs_v1 CASCADE;

CREATE TABLE public.v_nomenclature_spec_pairs_v1 (
id bigserial PRIMARY KEY,
dup_root_id bigint,-- public.v_nomenclatuer_spec_read_v1.dup_root_id
name_tep_korr text,-- доп. поле (пока пустое)
name_tek text-- доп. поле (пока пустое)
);

-- 2) индексы под быстрый фильтр/джойны
CREATE INDEX IF NOT EXISTS ix_v_nsp_pairs_v1_dup_root_id
ON public.v_nomenclature_spec_pairs_v1 (dup_root_id);


-- 3) (опционально) уникальность, если нужно "1 строка на dup_root_id"
CREATE UNIQUE INDEX IF NOT EXISTS ux_v_nsp_pairs_v1_dup_root_id
ON public.v_nomenclature_spec_pairs_v1 (dup_root_id);