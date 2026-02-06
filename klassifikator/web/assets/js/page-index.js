// assets/js/page-index.js
const API_BASE = (window.CONFIG && (window.CONFIG.OS_API_URL || window.CONFIG.API_URL)) || "/api";

function el(id){ return document.getElementById(id); }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function fmtInt(n){
  const x = Number(n);
  if(!Number.isFinite(x)) return "";
  return x.toLocaleString("ru-RU");
}

function ensureReport1Styles(){
  if (document.getElementById("r1_styles")) return;

  const css = `
  /* Report1 table */
  #r1_table { width:100%; border-collapse:separate; border-spacing:0; }
  #r1_table th, #r1_table td { padding:10px 12px; border-bottom:1px solid var(--line); }
  #r1_table thead th {
    position: sticky; top: 0;
    background: rgba(16, 23, 34, .95);
    z-index: 1;
    text-align:left;
    font-weight:600;
  }
  #r1_table tbody tr:hover td { background: rgba(255,255,255,.03); }
  #r1_table td.num, #r1_table th.num { text-align:right; font-variant-numeric: tabular-nums; }
  #r1_table td:first-child { width: 70%; }
  .r1_wrap { overflow:auto; border:1px solid var(--line); border-radius: 14px; }
  .r1_badge { color: var(--muted); font-size: 12px; }
  `;

  const style = document.createElement("style");
  style.id = "r1_styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function ensureReport1Markup(){
  // Ожидаем, что в index.html уже есть:
  // r1_status, r1_tbody
  // Если таблица не имеет id="r1_table" и обёртки — добавим минимально (не ломая существующее).
  const tbody = el("r1_tbody");
  if (!tbody) return;

  const table = tbody.closest("table");
  if (table && !table.id) table.id = "r1_table";

  const wrap = table ? table.parentElement : null;
  if (wrap && !wrap.classList.contains("r1_wrap")) wrap.classList.add("r1_wrap");
}

async function loadReport1(){
  ensureReport1Styles();
  ensureReport1Markup();

  el("r1_status").textContent = "Загрузка…";
  el("r1_tbody").innerHTML = `
    <tr><td colspan="2" style="color:var(--muted); padding:12px 10px;">Загрузка…</td></tr>
  `;

  const url = `${API_BASE}/reports/nomenclature_by_object`;
  const r = await fetch(url);

  if(!r.ok){
    const t = await r.text().catch(()=> "");
    el("r1_status").textContent = `Ошибка ${r.status}`;
    el("r1_tbody").innerHTML = `
      <tr><td colspan="2" style="color:var(--muted); padding:12px 10px;">
        ${escapeHtml(t).slice(0,400)}
      </td></tr>
    `;
    return;
  }

  const data = await r.json();

  if(!Array.isArray(data) || data.length === 0){
    el("r1_status").textContent = "Строк: 0";
    el("r1_tbody").innerHTML = `
      <tr><td colspan="2" style="color:var(--muted); padding:12px 10px;">Нет данных</td></tr>
    `;
    return;
  }

  // нормализуем + сортируем по убыванию
  const rows = data.map(x => ({
    object_name: x.object_name ?? "",
    cnt: x.cnt ?? x.count ?? x.count_id ?? 0
  })).sort((a,b) => (Number(b.cnt)||0) - (Number(a.cnt)||0));

  const total = rows.reduce((s,r)=> s + (Number(r.cnt)||0), 0);
  el("r1_status").innerHTML = `<span class="r1_badge">Строк: ${rows.length} • Итого: ${fmtInt(total)}</span>`;

  el("r1_tbody").innerHTML = rows.map(r0 => `
    <tr>
      <td>${escapeHtml(r0.object_name)}</td>
      <td class="num">${fmtInt(r0.cnt)}</td>
    </tr>
  `).join("");
}

(async function boot(){
  console.log("page-index.js loaded");
  await loadReport1();
})();