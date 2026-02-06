// assets/js/tree.js (ESM)

function currentCode(r) {
  const lvl = Number(r.level || 1);
  return (lvl === 4 ? r.l4_code : lvl === 3 ? r.l3_code : lvl === 2 ? r.l2_code : r.l1_code) || "";
}
function currentName(r) {
  const lvl = Number(r.level || 1);
  return (lvl === 4 ? r.l4_name : lvl === 3 ? r.l3_name : lvl === 2 ? r.l2_name : r.l1_name) || "";
}

function parentId(r) {
  const lvl = Number(r.level || 1);
  if (lvl <= 1) return null;
  if (lvl === 2) return "L1:" + (r.l1_code || "");
  if (lvl === 3) return "L2:" + (r.l2_code || "");
  if (lvl === 4) return "L3:" + (r.l3_code || "");
  return null;
}

export function buildTree(rows) {
  const map = new Map();

  for (const r of rows || []) {
    if (!r?.id) continue;
    map.set(r.id, {
      id: r.id,
      level: Number(r.level || 1),
      code: currentCode(r),
      name: currentName(r),
      row: r,
      children: []
    });
  }

  const roots = [];
  for (const r of rows || []) {
    if (!r?.id) continue;
    const n = map.get(r.id);
    const pid = parentId(r);
    if (!pid) roots.push(n);
    else {
      const p = map.get(pid);
      if (p) p.children.push(n);
      else roots.push(n);
    }
  }

  return { id: "root", level: 0, code: "", name: "", children: roots };
}