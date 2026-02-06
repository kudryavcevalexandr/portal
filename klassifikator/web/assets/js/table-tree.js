// assets/js/table-tree.js (ESM)
// renderTableTree(root, { tableId, bodyId })
// + TableTree.expandAll() / collapseAll()

function esc(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setHeader(table) {
  const thead = table.querySelector("thead");
  if (!thead) return;
  thead.innerHTML = `
    <tr>
      <th style="min-width: 80px">Код</th>
      <th>Наименование</th>
      <th style="width:70px">Уровень</th>
    </tr>
  `;
}

function flatten(root) {
  const out = [];
  (function walk(n, parentId) {
    for (const ch of n.children || []) {
      out.push({ node: ch, parentId });
      walk(ch, ch.id);
    }
  })(root, null);
  return out;
}

function expandNode(id, tbody) {
  const kids = tbody.querySelectorAll(`tr[data-parent="${CSS.escape(id)}"]`);
  kids.forEach(tr => { tr.style.display = ""; });
}

function collapseNode(id, tbody) {
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    const kids = Array.from(tbody.querySelectorAll(`tr[data-parent="${CSS.escape(cur)}"]`));
    for (const tr of kids) {
      tr.style.display = "none";
      const tid = tr.dataset.id;
      if (tid) stack.push(tid);

      const btn = tr.querySelector("[data-tree-toggle]");
      if (btn) {
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = "▸";
      }
    }
  }
}

export function renderTableTree(root, opts = {}) {
  const table = document.getElementById(opts.tableId || "tbl");
  const tbody = document.getElementById(opts.bodyId || "body");
  if (!table || !tbody) throw new Error("Не найден #tbl или #body");

  setHeader(table);

  const rows = flatten(root);

  const childrenCount = new Map();
  for (const r of rows) {
    childrenCount.set(r.node.id, (r.node.children || []).length);
  }

  tbody.innerHTML = rows.map(({ node, parentId }) => {
    const hasKids = (childrenCount.get(node.id) || 0) > 0;
    const indent = (node.level - 1) * 18;
    const hidden = node.level > 1 ? 'style="display:none"' : "";

    return `
      <tr data-id="${esc(node.id)}" data-parent="${esc(parentId || "")}" data-level="${node.level}" ${hidden}>
        <td>
          <div style="display:flex; align-items:center; gap:8px; padding-left:${indent}px">
            ${hasKids
              ? `<button class="btn" data-tree-toggle="1" aria-expanded="false" style="padding:4px 10px">▸</button>`
              : `<span style="display:inline-block; width:34px"></span>`
            }
            <span class="mono">${esc(node.code)}</span>
          </div>
        </td>
        <td>${esc(node.name)}</td>
        <td class="muted">${node.level}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-tree-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      const id = tr?.dataset?.id;
      if (!id) return;

      const expanded = btn.getAttribute("aria-expanded") === "true";
      if (expanded) collapseNode(id, tbody);
      else expandNode(id, tbody);

      btn.setAttribute("aria-expanded", expanded ? "false" : "true");
      btn.textContent = expanded ? "▸" : "▾";
    });
  });
}

function collapseAll() {
  const tbody = document.getElementById("body");
  if (!tbody) return;

  tbody.querySelectorAll("tr[data-level]").forEach(tr => {
    const lvl = Number(tr.dataset.level || "1");
    tr.style.display = (lvl <= 1) ? "" : "none";
    const btn = tr.querySelector("[data-tree-toggle]");
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "▸";
    }
  });
}

function expandAll() {
  const tbody = document.getElementById("body");
  if (!tbody) return;

  tbody.querySelectorAll("tr[data-level]").forEach(tr => {
    tr.style.display = "";
    const btn = tr.querySelector("[data-tree-toggle]");
    if (btn) {
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "▾";
    }
  });
}

export const TableTree = { render: renderTableTree, collapseAll, expandAll };