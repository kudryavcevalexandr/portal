// assets/js/page-hierarchy.js
// Загружает данные из Directus, строит дерево и рисует таблицу.
// Кнопки: Свернуть всё / Развернуть всё
// Сортировка API: l1_num,l2_num,l3_num,l4_num,level

function el(id) { return document.getElementById(id); }

function ensureButtons() {
  const host = document.querySelector(".panel") || document.querySelector(".top") || document.body;

  if (!document.getElementById("btn-collapse-all")) {
    const b = document.createElement("button");
    b.id = "btn-collapse-all";
    b.className = "btn";
    b.type = "button";
    b.textContent = "Свернуть всё";
    b.onclick = () => window.TableTree?.collapseAll?.();
    host.appendChild(b);
  }

  if (!document.getElementById("btn-expand-all")) {
    const b = document.createElement("button");
    b.id = "btn-expand-all";
    b.className = "btn";
    b.type = "button";
    b.textContent = "Развернуть всё";
    b.onclick = () => window.TableTree?.expandAll?.();
    host.appendChild(b);
  }
}

async function loadAllRows(collection, fields, pageSize) {
  let all = [];
  let offset = 0;

  while (true) {
    if (el("stat")) el("stat").textContent = `загрузка… ${all.length} строк`;

    const j = await directusReadItems(collection, {
      fields,
      limit: pageSize,
      offset,
      sort: "l1_num,l2_num,l3_num,l4_num,level"
    });

    const rows = j?.data || [];
    all = all.concat(rows);

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  if (el("stat")) el("stat").textContent = `загружено: ${all.length} строк`;
  return all;
}

function applyClientFilter(all, q) {
  const needle = (q || "").toLowerCase().trim();
  if (!needle) return all;

  return all.filter(r => {
    const code = (r.l4_code || r.l3_code || r.l2_code || r.l1_code || "").toLowerCase();
    const name = (r.l4_name || r.l3_name || r.l2_name || r.l1_name || "").toLowerCase();
    return code.includes(needle) || name.includes(needle);
  });
}

function renderFromRows(rows) {
  const root = window.buildTree(rows);
  window.renderTableTree(root);
  window.TableTree?.collapseAll?.(); // по умолчанию свернуто
}

(async function initHierarchyPage() {
  try {
    ensureButtons();

    if (typeof window.buildTree !== "function") throw new Error("tree.js не подключён или buildTree не объявлен");
    if (typeof window.renderTableTree !== "function") throw new Error("table-tree.js не подключён или renderTableTree не объявлен");

    const cfg = window.PORTAL_CONFIG || {};
    const collection = cfg.hierarchyCollection || cfg.classTreeCollection || "class_tree_v1";

    const fields =
      cfg.directusFields?.hierarchy ||
      cfg.hierarchyFields ||
      [
        "id","level",
        "l1_code","l1_name","l2_code","l2_name","l3_code","l3_name","l4_code","l4_name",
        "l1_num","l2_num","l3_num","l4_num"
      ];

    const pageSize = Number(cfg.hierarchyPageSize || 2000);

    const all = await loadAllRows(collection, fields, pageSize);
    renderFromRows(all);

    // фильтр
    const q = el("q");
    if (q) {
      q.addEventListener("input", () => {
        const filtered = applyClientFilter(all, q.value);
        renderFromRows(filtered);
      });
    }

    // обновить
    const reload = el("reload");
    if (reload) {
      reload.onclick = async () => {
        const all2 = await loadAllRows(collection, fields, pageSize);
        renderFromRows(applyClientFilter(all2, q?.value));
      };
    }
  } catch (e) {
    console.error(e);
    if (el("stat")) el("stat").textContent = `ошибка: ${e?.message || e}`;
  }
})();