(function(){
  const el = (id)=>document.getElementById(id);

  const INDEX = "v_nomenclature_spec_pairs_v1"; // как просил
  const tb = el("tb");
  const status = el("status");

  let lastRows = [];
  let lastQ = "";

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function setStatus(msg){ status.textContent = msg || ""; }

  function rowTr(r){
    const tr = document.createElement("tr");
    tr.dataset.id = r.id;

    const tdId = document.createElement("td");
    tdId.textContent = r.id ?? "";
    tr.appendChild(tdId);

    const tdTek = document.createElement("td");
    tdTek.innerHTML = `<div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:56vw;">${escapeHtml(r.name_tek)}</div>`;
    tr.appendChild(tdTek);

    const tdKorr = document.createElement("td");
    const inp = document.createElement("input");
    inp.className = "cell";
    inp.type = "text";
    inp.value = r.name_tep_korr ?? "";
    inp.dataset.orig = inp.value;
    inp.addEventListener("input", ()=>{
      const dirty = inp.value !== inp.dataset.orig;
      tr.classList.toggle("dirty", dirty);
    });
    inp.addEventListener("keydown", async (e)=>{
      if(e.key === "Enter"){
        e.preventDefault();
        await saveRow(tr, inp);
      }
      if(e.key === "Escape"){
        e.preventDefault();
        inp.value = inp.dataset.orig;
        tr.classList.remove("dirty","err","ok");
      }
    });
    tdKorr.appendChild(inp);
    tr.appendChild(tdKorr);

    const tdAct = document.createElement("td");
    tdAct.innerHTML = `
      <button class="btn" data-act="save">Сохранить</button>
      <button class="btn" data-act="undo">Откат</button>
    `;
    tdAct.addEventListener("click", async (e)=>{
      const btn = e.target.closest("button");
      if(!btn) return;
      const act = btn.getAttribute("data-act");
      if(act === "undo"){
        inp.value = inp.dataset.orig;
        tr.classList.remove("dirty","err","ok");
      }
      if(act === "save"){
        await saveRow(tr, inp);
      }
    });
    tr.appendChild(tdAct);

    return tr;
  }

  function render(rows){
    tb.innerHTML = "";
    rows.forEach(r=> tb.appendChild(rowTr(r)));
  }
  
  async function loadAll(offset = 0){
	  const size = parseInt(el("size").value, 10) || 200;
	  setStatus("Загрузка из базы…");

	  const url = `/api/pairs_list?limit=${encodeURIComponent(size)}&offset=${encodeURIComponent(offset)}`;
	  const r = await fetch(url);
	  if(!r.ok){
		const t = await r.text();
		tb.innerHTML = `<tr><td colspan="4" class="muted">${escapeHtml(t)}</td></tr>`;
		setStatus(`Ошибка базы: ${r.status}`);
		return;
	  }
	  const data = await r.json();
	  lastRows = data.rows || [];
	  render(lastRows);
	  setStatus(`Показано: ${lastRows.length} из ${data.total}`);
	} 


  async function load(){
    const q = el("q").value.trim();
    if(!q){
      return loadAll(0);
    }
    return loadFiltered(q);
  }

  async function loadFiltered(q){
    const size = parseInt(el("size").value, 10) || 100;

    lastQ = q;
    setStatus("Поиск…");

  // 1) OpenSearch -> получить кандидатов (id)
    const urlOS = `/api/pairs_search?index=${encodeURIComponent(INDEX)}&q=${encodeURIComponent(q)}&size=${encodeURIComponent(size)}`;
    const resOS = await fetch(urlOS, { headers: { "Accept":"application/json" }});

    if(!resOS.ok){
      const t = await resOS.text();
      setStatus(`Ошибка поиска: ${resOS.status}`);
      tb.innerHTML = `<tr><td colspan="4" class="muted">${escapeHtml(t)}</td></tr>`;
      return;
    }

    const dataOS = await resOS.json();
    const total = dataOS.total ?? 0;

    const ids = (dataOS.rows || [])
      .map(r => r && r.id)
      .filter(v => v !== null && v !== undefined);

    if(ids.length === 0){
      tb.innerHTML = `<tr><td colspan="4" class="muted">Ничего не найдено</td></tr>`;
      setStatus(`Найдено: ${total} (показано: 0)`);
      return;
    }

  // 2) Postgres -> взять реальные строки из базы по ids
    setStatus("Загрузка из базы…");
    const urlPG = `/api/pairs_rows?ids=${encodeURIComponent(ids.join(","))}`;
    const resPG = await fetch(urlPG, { headers: { "Accept":"application/json" }});

    if(!resPG.ok){
      const t = await resPG.text();
      setStatus(`Ошибка базы: ${resPG.status}`);
      tb.innerHTML = `<tr><td colspan="4" class="muted">${escapeHtml(t)}</td></tr>`;
      return;
    }

    const dataPG = await resPG.json();
    const rows = dataPG.rows || [];

    lastRows = rows;
    render(rows);
    setStatus(`Найдено: ${total} (в базе показано: ${rows.length})`);
  }

  async function saveRow(tr, inp){
    const id = tr.dataset.id;
    const name_tep_korr = inp.value ?? "";

    if(inp.value === inp.dataset.orig) return;

    tr.classList.remove("ok","err");
    tr.classList.add("saving");

    try{
      // ожидаем эндпоинт os_api: PATCH /api/pairs_update/<id>
      // он должен:
      // 1) записать name_tep_korr как пришло
      // 2) записать name_tek = left(name_tep_korr, 150)
      const res = await fetch(`/api/pairs_update/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json", "Accept":"application/json" },
        body: JSON.stringify({ name_tep_korr })
      });

      tr.classList.remove("saving");

      if(!res.ok){
        const t = await res.text();
        tr.classList.add("err");
        setStatus(`Ошибка сохранения id=${id}: ${res.status}`);
        console.warn(t);
        return;
      }

      const out = await res.json();
      // обновим отображение name_tek из ответа (если вернёшь)
      const tdTek = tr.children[1];
      if(out && typeof out.name_tek !== "undefined"){
        tdTek.innerHTML = `<div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:56vw;">${escapeHtml(out.name_tek)}</div>`;
      }

      inp.dataset.orig = inp.value;
      tr.classList.remove("dirty");
      tr.classList.add("ok");
      setStatus(`Сохранено id=${id}`);
	  fetch("/api/reindex", { method: "POST" }).catch(()=>{});
      setTimeout(()=> tr.classList.remove("ok"), 800);

    }catch(err){
      tr.classList.remove("saving");
      tr.classList.add("err");
      setStatus(`Ошибка сети при сохранении id=${id}`);
      console.error(err);
    }
  }

  el("btnSearch").addEventListener("click", load);
  
  el("btnReload").addEventListener("click", ()=>{
    el("q").value = "";
    loadAll(0);
  });

  // авто-поиск по последнему запросу
  window.addEventListener("load", ()=>{
    el("q").value = "";
	loadAll(0);
  });

})();