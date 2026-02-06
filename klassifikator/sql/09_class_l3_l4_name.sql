DROP TABLE IF EXISTS public.class_l3_l4_names_v1;

CREATE TABLE public.class_l3_l4_names_v1 AS
SELECT
l3.id AS l3_id,
l3.name AS l3_name,
string_agg(trim(l4.name), ' ' ORDER BY l4.name) AS l4_names_concat
FROM public.class_l3 l3
JOIN public.class_l4 l4 ON l4.parent_id_l3 = l3.id
WHERE l4.name IS NOT NULL AND btrim(l4.name) <> ''
GROUP BY l3.id, l3.name;

-- (желательно) индексы
CREATE UNIQUE INDEX IF NOT EXISTS ux_class_l3_l4_names_v1_l3_id
ON public.class_l3_l4_names_v1 (l3_id);

CREATE INDEX IF NOT EXISTS ix_class_l3_l4_names_v1_l3_name
ON public.class_l3_l4_names_v1 (l3_name);