(function(){
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
    status.textContent = text || "";
  }

  function clearTable(){
    tableBody.innerHTML = "";
  }

  function renderRows(rows){
    clearTable();

    if (!rows.length) {
      tableBody.innerHTML = `<tr><td colspan="2" class="muted">Ничего не найдено</td></tr>`;
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

    tableBody.appendChild(frag);
  }

  function normalizeResponse(data){
    if (Array.isArray(data?.rows)) {
      return {
        rows: data.rows,
        total: data.total ?? data.rows.length
      };
    }

    const hits = data?.hits?.hits || [];
    const total = data?.hits?.total?.value ?? data?.hits?.total ?? hits.length;
    return {
      rows: hits.map((hit) => hit?._source || {}),
      total
    };
  }

  async function runSearch(){
    const q = (input.value || "").trim();
    clearTable();

    if (!q) {
      tableBody.innerHTML = `<tr><td colspan="2" class="muted">Введите запрос и нажмите «Найти»</td></tr>`;
      setStatus("");
      return;
    }

    const url = new URL("/api/v1/search", window.location.origin);
    url.searchParams.set("index", "class_tree_nomen_v1");
    url.searchParams.set("q", q);

    setStatus("Идет поиск...");

    try{
      const res = await fetch(url.toString(), { headers: { "Accept": "application/json" }});
      if (!res.ok) {
        const text = await res.text();
        tableBody.innerHTML = `<tr><td colspan="2" class="muted">${escapeHtml(text)}</td></tr>`;
        setStatus(`Ошибка поиска: ${res.status}`);
        return;
      }

      const data = await res.json();
      const normalized = normalizeResponse(data);

      renderRows(normalized.rows || []);
      setStatus(`Найдено строк: ${normalized.total ?? (normalized.rows || []).length}`);
    }catch(err){
      tableBody.innerHTML = `<tr><td colspan="2" class="muted">Ошибка запроса</td></tr>`;
      setStatus("Не удалось получить данные");
    }
  }

  btnSearch.addEventListener("click", runSearch);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  });

  btnReindex.addEventListener("click", async () => {
    await fetch("/api/reindex_nomen", { method: "POST" });
    alert("Синхронизация запущена, подождите 10 секунд");
  });
})();
