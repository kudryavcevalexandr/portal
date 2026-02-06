-- базовый (если Directus/портал часто фильтруют по object_id)
CREATE INDEX IF NOT EXISTS ix_v_nom_spec_read_object_id
ON public.v_nomenclature_spec_read_v1 (object_id);

-- для быстрых выборок дублей/групп
CREATE INDEX IF NOT EXISTS ix_v_nom_spec_read_dup_root_id
ON public.v_nomenclature_spec_read_v1 (dup_root_id);

-- если часто ищешь конкретную запись по id
CREATE INDEX IF NOT EXISTS ix_v_nom_spec_read_id_nom
ON public.v_nomenclature_spec_read_v1 (id_nom);