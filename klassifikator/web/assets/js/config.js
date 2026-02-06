// assets/js/config.js
export const PORTAL_CONFIG = {
  apiBase: "/api",

  // Directus
  directusBase: "/directus",
  directusCollection: "class_tree_v1",

  // важно: fields лучше хранить массивом полей
  directusFields: {
    hierarchy: ["id","l1_code","l1_name","l2_code","l2_name","l3_code","l3_name","l4_code","l4_name","l1_num","l2_num","l3_num","l4_num","level"]
  }
};