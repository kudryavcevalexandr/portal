import { searchOpenSearch } from "./api.js";

const el = (id) => document.getElementById(id);

const input = el("q");
const btnSearch = el("btnSearch");
const btnReindex = el("btnReindex");
const tableBody = el("resultsBody");
const status = el("status");

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(text){
  if (status) status.textContent = text || "";
}

function clearTable(){
  if (tableBody) tableBody.innerHTML = "";
}

function renderRows(rows){
  clearTable();

  if (!rows || !rows.length) {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="2" class="muted">Ничего не найдено</td></tr>`;
    }
    return;
  }

  const frag = document.createDocumentFragment();

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const tdCode = document.createElement("td");
    tdCode.className = "code";
    tdCode.textContent = row.id ?? "";

    const tdName = document.createElement("td");
    tdName.className = "name";
    tdName.innerHTML = `<span class="ellipsis">${escapeHtml(row.item_name ?? "")}</span>`;

    tr.appendChild(tdCode);
    tr.appendChild(tdName);
    frag.appendChild(tr);
  });

  if (tableBody) tableBody.appendChild(frag);
}

async function runSearch(){
  const q = (input?.value || "").trim();
  clearTable();

  if (!q) {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="2" class="muted">Введите запрос и нажмите «Найти»</td></tr>`;
    }
    setStatus("");
    return;
  }

  setStatus("Идет поиск...");

  try {
    const data = await searchOpenSearch(q, {
      index: "class_tree_nomen_v1",
      size: 50
    });

    const rows = data.rows || [];
    const total = data.total ?? rows.length;

    renderRows(rows);
    setStatus(`Найдено строк: ${total}`);
  } catch (err) {
    console.error(err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="2" class="muted">Ошибка: ${escapeHtml(err.message)}</td></tr>`;
    }
    setStatus("Не удалось получить данные");
  }
}

if (btnSearch) btnSearch.addEventListener("click", runSearch);
if (input) {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  });
}

if (btnReindex) {
  btnReindex.addEventListener("click", async () => {
    try {
      await fetch("/api/reindex_nomen", { method: "POST" });
      alert("Синхронизация запущена, подождите 10 секунд");
    } catch (e) {
      alert("Ошибка запуска реиндексации");
    }
  });
}
