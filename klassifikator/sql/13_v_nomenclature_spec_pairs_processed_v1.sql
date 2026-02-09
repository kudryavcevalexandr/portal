DROP TABLE IF EXISTS public.v_nomenclature_spec_pairs_processed_v1 CASCADE;

CREATE TABLE public.v_nomenclature_spec_pairs_processed_v1 (
    id bigserial PRIMARY KEY,
    position_name text,-- наименование позиции
    unit_measure text,-- ед изм
    note text,-- примечание
    note_added_date date,-- дата добавления примечаний
    is_new_position boolean,-- отметка что новая позиция или повторное согласование
    l3_id bigint references public.class_l3(id),-- связку
    classifier_binding bigint,-- привязка классификатора
    processed_name text-- наименование после обработки алгоритмами
);

-- 2) индексы под быстрый фильтр/джойны
CREATE INDEX IF NOT EXISTS ix_v_nsp_processed_v1_classifier_binding
ON public.v_nomenclature_spec_pairs_processed_v1 (classifier_binding);

-- 3) (опционально) уникальность, если нужно "1 строка на classifier_binding"
CREATE UNIQUE INDEX IF NOT EXISTS ux_v_nsp_processed_v1_classifier_binding
ON public.v_nomenclature_spec_pairs_processed_v1 (classifier_binding);
