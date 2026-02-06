DROP TABLE IF EXISTS public.v_nomenclature_spec_status_v1;

CREATE TABLE public.v_nomenclature_spec_status_v1 AS
WITH roots AS (
SELECT
dup_root_id,
(false_condition)::boolean AS false_condition
FROM public.v_nomenclature_spec_dup_roots_v1
),
na_sogl AS (
SELECT DISTINCT r.dup_root_id
FROM roots r
JOIN public.v_nomenclature_spec_read_v1 rr
ON rr.dup_root_id = r.dup_root_id
JOIN public.nomenclature_spec_all_v1 n
ON n.id = rr.id_nom
WHERE n.class_l3_id IS NOT NULL
),
na_klass AS (
SELECT r.dup_root_id
FROM roots r
LEFT JOIN na_sogl s
ON s.dup_root_id = r.dup_root_id
WHERE r.false_condition IS NULL
AND s.dup_root_id IS NULL
)
SELECT 1 AS ord, 'Всего уникальных позиций' AS metric, COUNT(*) AS value
FROM roots
UNION ALL
SELECT 2 AS ord, 'Количество некорректных позиций' AS metric, COUNT(*) AS value
FROM roots
WHERE false_condition IS TRUE
UNION ALL
SELECT 3 AS ord, 'Количество позиций в работе' AS metric, COUNT(*) AS value
FROM roots
WHERE false_condition IS FALSE
UNION ALL
SELECT 4 AS ord, 'Количество позиций на согласовании' AS metric, COUNT(*) AS value
FROM na_sogl
UNION ALL
SELECT 5 AS ord, 'Количество позиций на классификации' AS metric, COUNT(*) AS value
FROM na_klass
UNION ALL
SELECT 6 AS ord, 'Количество согласованных позиций' AS metric, 0 AS value
ORDER BY ord;

CREATE INDEX IF NOT EXISTS ix_v_nomenclature_spec_status_v1_ord
ON public.v_nomenclature_spec_status_v1 (ord);
