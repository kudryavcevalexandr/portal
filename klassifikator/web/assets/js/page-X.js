import { CONFIG } from "./config.js";

/**
 * Витрина: public.nomenclature_spec_all_v1 (в Directus: коллекция nomenclature_spec_all_v1)
 * Поля: item_name, type_mark, uom, class_l3_id
 */

const COLLECTION = "nomenclature_spec_all_v1";
const FIELDS = ["item_name", "type_mark", "uom", "class_l3_id"];

const el = (id) => document.getElementById(id);

const state = {
  q: "",
  f_item_name: "",
  f_type_mark: "",
  f_uom: "",
  f_class_l3_id: "",
  page: 1,
  limit: 100,
  sort: "item_name",   // поле
  dir: "asc",          // asc/desc
  total: null,
  loading: false,
};

// ---------- utils ----------
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function debounce(fn, ms=250){
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function setStatus(text){
  el("statusLeft").textContent = text;
}

// ---------- Directus query ----------
function buildFilter(){
  const and = [];

  // глобальный поиск (по всем 4 полям)
  if (state.q.trim()){
    const q = state.q.trim();
    and.push({
      _or: [
        { item_name:   { _icontains: q } },
        { type_mark:   { _icontains: q } },
        { uom:         { _icontains: q } },
        // class_l3_id может быть числом — но _icontains в Directus для числа не всегда ок.
        // поэтому делаем "равно" если похоже на число, иначе пропускаем.
        ...(isFinite(Number(q)) ? [{ class_l3_id: { _eq: Number(q) } }] : [])
      ]
    });
  }

  // точечные фильтры
  if (state.f_item_name.trim()) and.push({ item_name: { _icontains: state.f_item_name.trim() } });
  if (state.f_type_mark.trim()) and.push({ type_mark: { _icontains: state.f_type_mark.trim() } });
  if (state.f_uom.trim())       and.push({ uom:       { _icontains: state.f_uom.trim() } });

  if (state.f_class_l3_id.trim()){
    const v = state.f_class_l3_id.trim();
    if (isFinite(Number(v))) and.push({ class_l3_id: { _eq: Number(v) } });
    else and.push({ class_l3_id: { _null: false } }); // мягко: если ввели не число — просто не ломаем запрос
  }

  if (!and.length) return null;
  return { _and: and };
}

function buildUrl(){
  const url = new URL(`${CONFIG.DIRECTUS_URL}/items/${COLLECTION}`);

  // fields
  url.searchParams.set("fields", FIELDS.join(","));

  // pagination
  url.searchParams.set("limit", String(state.limit));
  url.searchParams.set("page", String(state.page));

  // sort
  // directus: sort=field или sort=-field
  url.searchParams.set("sort", (state.dir === "desc" ? "-" : "") + state.sort);

  // meta total_count (нужно для пагинации)
  url.searchParams.set("meta", "total_count");

  // filters
  const filter = buildFilter();
  if (filter) url.searchParams.set("filter", JSON.stringify(filter));

  return url.toString();
}

async function fetchData(){
  state.loading = true;
  setStatus("Загрузка…");

  const tbody = el("tbody");
  tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted); padding:14px 10px;">Загрузка…</td></tr>`;

  const url = buildUrl();
  const r = await fetch(url, { headers: { "Content-Type": "application/json" } });

  if (!r.ok){
    const txt = await r.text().catch(() => "");
    state.loading = false;
    setStatus(`Ошибка ${r.status}`);
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted); padding:14px 10px;">
      Ошибка загрузки: ${escapeHtml(r.status)}<br><span class="mono">${escapeHtml(txt).slice(0, 400)}</span>
    </td></tr>`;
    return;
  }

  const json = await r.json();
  const rows = json?.data || [];
  const total = json?.meta?.total_count ?? null;

  state.total = total;
  state.loading = false;

  render(rows);
  renderPager();
  renderSortIndicators();

  const totalStr = (total == null) ? "?" : String(total);
  setStatus(`Найдено: ${totalStr} · показано: ${rows.length} · стр.: ${state.page}`);
}

function render(rows){
  const tbody = el("tbody");
  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted); padding:14px 10px;">Ничего не найдено</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.item_name)}</td>
      <td>${escapeHtml(r.type_mark)}</td>
      <td>${escapeHtml(r.uom)}</td>
      <td class="mono">${escapeHtml(r.class_l3_id)}</td>
    </tr>
  `).join("");
}

function renderPager(){
  const total = state.total;
  const limit = state.limit;

  let pages = null;
  if (total != null && limit > 0) pages = Math.max(1, Math.ceil(total / limit));

  const canPrev = state.page > 1;
  const canNext = pages == null ? true : state.page < pages;

  el("prev").disabled = !canPrev || state.loading;
  el("next").disabled = !canNext || state.loading;

  el("pageInfo").textContent =
    pages == null
      ? `page ${state.page}`
      : `page ${state.page} / ${pages}`;
}

function renderSortIndicators(){
  const ids = ["item_name","type_mark","uom","class_l3_id"];
  for (const k of ids){
    const s = el(`si_${k}`);
    if (!s) continue;
    if (state.sort !== k){
      s.textContent = "";
      continue;
    }
    s.textContent = state.dir === "asc" ? "▲" : "▼";
  }
}

// ---------- URL state (optional, удобно) ----------
function syncStateToUrl(){
  const u = new URL(location.href);
  u.searchParams.set("page", String(state.page));
  u.searchParams.set("limit", String(state.limit));
  u.searchParams.set("sort", state.sort);
  u.searchParams.set("dir", state.dir);

  const setOrDel = (key, val) => {
    const v = (val ?? "").trim();
    if (v) u.searchParams.set(key, v);
    else u.searchParams.delete(key);
  };

  setOrDel("q", state.q);
  setOrDel("f_item_name", state.f_item_name);
  setOrDel("f_type_mark", state.f_type_mark);
  setOrDel("f_uom", state.f_uom);
  setOrDel("f_class_l3_id", state.f_class_l3_id);

  history.replaceState(null, "", u.toString());
}

function initStateFromUrl(){
  const u = new URL(location.href);
  state.page = Number(u.searchParams.get("page") || "1") || 1;
  state.limit = Number(u.searchParams.get("limit") || "100") || 100;
  state.sort = u.searchParams.get("sort") || "item_name";
  state.dir = u.searchParams.get("dir") || "asc";

  state.q = u.searchParams.get("q") || "";
  state.f_item_name = u.searchParams.get("f_item_name") || "";
  state.f_type_mark = u.searchParams.get("f_type_mark") || "";
  state.f_uom = u.searchParams.get("f_uom") || "";
  state.f_class_l3_id = u.searchParams.get("f_class_l3_id") || "";

  // проставляем в инпуты
  el("q").value = state.q;
  el("f_item_name").value = state.f_item_name;
  el("f_type_mark").value = state.f_type_mark;
  el("f_uom").value = state.f_uom;
  el("f_class_l3_id").value = state.f_class_l3_id;

  el("page_size").value = String(state.limit);
}

// ---------- events ----------
const reloadDebounced = debounce(async () => {
  state.page = 1;
  syncStateToUrl();
  await fetchData();
}, 300);

function bind(){
  el("q").addEventListener("input", () => { state.q = el("q").value; reloadDebounced(); });
  el("f_item_name").addEventListener("input", () => { state.f_item_name = el("f_item_name").value; reloadDebounced(); });
  el("f_type_mark").addEventListener("input", () => { state.f_type_mark = el("f_type_mark").value; reloadDebounced(); });
  el("f_uom").addEventListener("input", () => { state.f_uom = el("f_uom").value; reloadDebounced(); });
  el("f_class_l3_id").addEventListener("input", () => { state.f_class_l3_id = el("f_class_l3_id").value; reloadDebounced(); });

  el("page_size").addEventListener("change", async () => {
    state.limit = Number(el("page_size").value) || 100;
    state.page = 1;
    syncStateToUrl();
    await fetchData();
  });

  el("reset").addEventListener("click", async () => {
    state.q = "";
    state.f_item_name = "";
    state.f_type_mark = "";
    state.f_uom = "";
    state.f_class_l3_id = "";
    state.page = 1;

    el("q").value = "";
    el("f_item_name").value = "";
    el("f_type_mark").value = "";
    el("f_uom").value = "";
    el("f_class_l3_id").value = "";

    syncStateToUrl();
    await fetchData();
  });

  el("refresh").addEventListener("click", async () => {
    syncStateToUrl();
    await fetchData();
  });

  el("prev").addEventListener("click", async () => {
    if (state.page <= 1) return;
    state.page -= 1;
    syncStateToUrl();
    await fetchData();
  });

  el("next").addEventListener("click", async () => {
    state.page += 1;
    syncStateToUrl();
    await fetchData();
  });

  // сортировка по клику на заголовок
  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", async () => {
      const field = th.getAttribute("data-sort");
      if (!field) return;

      if (state.sort === field){
        state.dir = (state.dir === "asc") ? "desc" : "asc";
      } else {
        state.sort = field;
        state.dir = "asc";
      }
      state.page = 1;
      syncStateToUrl();
      renderSortIndicators();
      await fetchData();
    });
  });
}

// ---------- boot ----------
(async function boot(){
  initStateFromUrl();
  bind();
  syncStateToUrl();
  await fetchData();
})();
