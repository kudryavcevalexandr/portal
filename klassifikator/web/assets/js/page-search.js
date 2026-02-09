import { apiGet } from "./api.js"; // fixed import/export

function el(id){ return document.getElementById(id); }

function pretty(n){
  try { return new Intl.NumberFormat('ru-RU').format(n); } catch { return String(n); }
}

async function runHealth(){
  el("health").textContent = "проверяю /api/health ...";
  try{
    const j = await apiGet("/health");
    el("health").textContent = "OK ✅ " + JSON.stringify(j);
  }catch(e){
    el("health").textContent = "ERR ❌ " + (e.data ? JSON.stringify(e.data) : e.message);
  }
}

async function runSearch(q){
  el("out").textContent = "ищу: " + q + " ...";
  try{
    const j = await apiGet("/search", { q, size: "10" });

    // ожидаем структуру вида { hits: { total, hits:[...] } } или что-то близкое
    const total =
      (j?.hits?.total?.value ?? j?.hits?.total ?? j?.total ?? null);

    const top = (j?.hits?.hits || []).slice(0, 5).map(h => {
      const s = h._source || {};
      return {
        score: h._score,
        code: s.code || s.l4_code || s.kod || s.id || "",
        name: s.name || s.l4_name || s.naimenovanie || ""
      };
    });

    el("out").textContent =
      "Найдено: " + (total === null ? "?" : pretty(total)) + "\n\n" +
      (top.length ? top.map(x => `• ${x.code} — ${x.name} (score ${x.score})`).join("\n") : "Пусто (нет hits)");

  }catch(e){
    el("out").textContent = "ERR ❌ " + (e.data ? JSON.stringify(e.data) : e.message);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  runHealth();

  const form = el("form");
  const inp = el("q");
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const q = (inp.value || "").trim();
    if (q) runSearch(q);
  });

  // быстрые кнопки
  document.querySelectorAll("[data-q]").forEach(btn=>{
    btn.addEventListener("click", ()=> {
      inp.value = btn.getAttribute("data-q");
      runSearch(inp.value);
    });
  });
});
