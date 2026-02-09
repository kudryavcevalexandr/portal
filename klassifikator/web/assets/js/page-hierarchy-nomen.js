// /assets/js/page-hierarchy-nomen.js
import { directusReadItems, directusUpdateItem } from "./api.js";

const COLLECTION = "class_tree_nomen_v1";
const LIMIT = 2000;

const elBody = document.getElementById("treeBody");
const elStat = document.getElementById("stat");
const btnReload = document.getElementById("btnReload");
const btnToggleAll = document.getElementById("btnToggleAll");

btnToggleAll?.addEventListener("click", () => {
  const branchIds = state.rows
    .filter(r => {
      const lvl = Number(r.level);
      return lvl >= 1 && lvl <= 3;
    })
    .map(r => r.id);

  const allOpened = branchIds.every(id => state.open.has(id));

  if (allOpened) {
    // свернуть всё: оставим открытыми только L1 (чтобы не был пустой экран)
    state.open.clear();
    for (const r of state.rows) if (Number(r.level) === 1) state.open.add(r.id);
    btnToggleAll.textContent = "Развернуть всё";
  } else {
    // развернуть всё
    for (const id of branchIds) state.open.add(id);
    btnToggleAll.textContent = "Свернуть всё";
  }

  render();
});

const state = {
  rows: [],
  byId: new Map(),
  children: new Map(),
  open: new Set(),
  loading: false
};

btnReload?.addEventListener("click", () => loadAndRender());

function nodeCode(row) {
  const lvl = Number(row.level);
  if (lvl === 1) return row.l1_code || "";
  if (lvl === 2) return row.l2_code || "";
  if (lvl === 3) return row.l3_code || "";
  return row.l4_code || (row.dup_root_id != null ? String(row.dup_root_id) : "");
}

function nodeTitle(row) {
  const lvl = Number(row.level);
  if (lvl === 1) return row.l1_name || "";
  if (lvl === 2) return row.l2_name || "";
  if (lvl === 3) return row.l3_name || "";
  return row.item_name || row.l4_name || "";
}

function isBranch(row) {
  const lvl = Number(row.level);
  return lvl >= 1 && lvl <= 3;
}

function buildTree(rows) {
  state.byId.clear();
  state.children.clear();

  // ВАЖНО: порядок детей будет таким, как пришёл из Directus (уже отсортирован)
  for (const r of rows) state.byId.set(r.id, r);

  for (const r of rows) {
    const pid = r.parent_id || "__root__";
    if (!state.children.has(pid)) state.children.set(pid, []);
    state.children.get(pid).push(r.id);
  }

  // раскрыть L1 по умолчанию
  if (state.open.size === 0) {
    for (const r of rows) if (Number(r.level) === 1) state.open.add(r.id);
  }
}

function hasChildren(id) {
  return (state.children.get(id) || []).length > 0;
}

function flattenVisible() {
  const out = [];
  const rootKids = state.children.get("__root__") || [];

  const walk = (id, depth) => {
    const row = state.byId.get(id);
    if (!row) return;
    out.push({ row, depth });

    if (isBranch(row) && state.open.has(id)) {
      const kids = state.children.get(id) || [];
      for (const k of kids) walk(k, depth + 1);
    }
  };

  for (const id of rootKids) walk(id, 0);
  return out;
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function render() {
  const visible = flattenVisible();

  // stat
	const l4Count = state.rows.reduce((acc, r) => acc + (Number(r.level) === 4 ? 1 : 0), 0);
	elStat.textContent = `на согласовании: ${l4Count}`

  if (!visible.length) {
    elBody.innerHTML = `<tr><td colspan="7" class="muted" style="padding:14px;">Нет данных</td></tr>`;
    return;
  }

  elBody.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const { row, depth } of visible) {
    const lvl = Number(row.level);

    const tr = document.createElement("tr");
	tr.dataset.level = String(lvl);
	if (lvl === 4) tr.dataset.approved = (row.approved === true ? "1" : "0");

    // код
    const tdCode = document.createElement("td");
    tdCode.textContent = (lvl === 4) ? "" : nodeCode(row);
    tr.appendChild(tdCode);

    // наименование + toggle
    const tdName = document.createElement("td");

    const indent = document.createElement("span");
    indent.style.display = "inline-block";
    indent.style.width = `${depth * 18}px`;
    tdName.appendChild(indent);

    if (isBranch(row) && hasChildren(row.id)) {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.style.padding = "4px 8px";
      btn.style.marginRight = "8px";
      btn.textContent = state.open.has(row.id) ? "–" : "+";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (state.open.has(row.id)) state.open.delete(row.id);
        else state.open.add(row.id);
        render();
      });
      tdName.appendChild(btn);
    } else {
      const pad = document.createElement("span");
      pad.style.display = "inline-block";
      pad.style.width = "28px";
      tdName.appendChild(pad);
    }

    const title = document.createElement("span");
    title.textContent = nodeTitle(row) || "—";
    tdName.appendChild(title);

    tr.appendChild(tdName);

    // уровень
    const tdLvl = document.createElement("td");
    tdLvl.textContent = String(lvl);
    tr.appendChild(tdLvl);

    // pending_cnt только для L1-3
    const tdPending = document.createElement("td");
    tdPending.className = "td-right";
    tdPending.textContent = isBranch(row) ? String(Number(row.pending_cnt) || 0) : "";
    tr.appendChild(tdPending);

    // unit только L4
    const tdUnit = document.createElement("td");
    tdUnit.textContent = lvl === 4 ? (row.unit || "") : "";
    tr.appendChild(tdUnit);

    // approved только L4
    const tdAppr = document.createElement("td");
    tdAppr.className = "td-center";
    if (lvl === 4) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = row.approved === true;

      cb.addEventListener("change", async () => {
        cb.disabled = true;
        try {
          const resp = await directusUpdateItem(COLLECTION, row.id, { approved: cb.checked });
          // directusUpdateItem возвращает весь ответ {data:...} как у directus
          const updated = resp?.data ?? resp;
          row.approved = updated?.approved ?? cb.checked;
        } catch (e) {
          console.error(e);
          cb.checked = !cb.checked;
          alert("Не удалось сохранить approved (см. консоль).");
        } finally {
          cb.disabled = false;
        }
      });

      tdAppr.appendChild(cb);
    }
    tr.appendChild(tdAppr);

    // note только L4
    const tdNote = document.createElement("td");
    if (lvl === 4) {
      const inp = document.createElement("input");
      inp.className = "note-input";
      inp.value = row.note || "";
      inp.placeholder = "Примечание…";

      // Функция сохранения (без блокировки поля)
      const saveAction = async (val) => {
        try {
          const resp = await directusUpdateItem(COLLECTION, row.id, { note: val });
          const updated = resp?.data ?? resp;
          row.note = updated?.note ?? val;
        } catch (e) {
          console.error("Ошибка сохранения:", e);
        }
      };

      const debouncedSave = debounce(() => saveAction(inp.value), 1000);

      // Сохранение при наборе (с задержкой 1 сек)
      inp.addEventListener("input", debouncedSave);

      // Сохранение при потере фокуса (мгновенно)
      inp.addEventListener("change", () => saveAction(inp.value));

      tdNote.appendChild(inp);
    }
    tr.appendChild(tdNote);

    frag.appendChild(tr);
  }

  elBody.appendChild(frag);
}

async function loadAllRows() {
  // directusReadItems использует offset, значит пагинация offset-ами
  const fields = [
    "id","parent_id","level",
    "l1_code","l1_name",
    "l2_code","l2_name",
    "l3_code","l3_name",
    "l4_code","l4_name",
    "dup_root_id",
    "item_name","unit","approved","note",
    "pending_cnt",
    "l1_num","l2_num","l3_num","l4_num"
  ];

  let all = [];
  let offset = 0;

  while (true) {
    const resp = await directusReadItems(COLLECTION, {
      fields,
      limit: LIMIT,
      offset,
      sort: "l1_num,l2_num,l3_num,l4_num,level"
    });

    const data = resp?.data ?? [];
    all = all.concat(data);

    if (data.length < LIMIT) break;
    offset += LIMIT;
  }

  return all;
}

async function loadAndRender() {
  if (state.loading) return;
  state.loading = true;
  elBody.innerHTML = `<tr><td colspan="7" class="muted" style="padding:14px;">Загрузка…</td></tr>`;

  try {
    state.rows = await loadAllRows();
    buildTree(state.rows);
    render();
	if (btnToggleAll) btnToggleAll.textContent = "Развернуть всё";
  } catch (e) {
    console.error(e);
    elBody.innerHTML = `<tr><td colspan="7" style="padding:14px; color:#ffb3b3;">Ошибка загрузки (см. консоль)</td></tr>`;
  } finally {
    state.loading = false;
  }
}

loadAndRender();
