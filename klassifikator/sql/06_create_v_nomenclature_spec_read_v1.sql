DROP TABLE IF EXISTS public.v_nomenclature_spec_read_v1;

CREATE TABLE public.v_nomenclature_spec_read_v1 AS
WITH src AS (
SELECT
object_id,
id AS id_nom,
item_name,
type_mark,
false_condition,
lower(translate(coalesce(item_name,'') || coalesce(type_mark,''), ' ' || chr(9) || chr(10) || chr(13), '')) AS dup_key
FROM public.nomenclature_spec_all_v1
),
roots AS (
SELECT
*,
MIN(id_nom) OVER (PARTITION BY dup_key) AS dup_root_id
FROM src
)
SELECT
object_id,
id_nom,
item_name,
type_mark,
false_condition,
dup_root_id
FROM roots;