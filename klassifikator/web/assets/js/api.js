// assets/js/api.js (ESM)
import { PORTAL_CONFIG } from "./config.js";

function apiUrl(path, params) {
  const base = PORTAL_CONFIG?.apiBase || "/api";
  const url = new URL(base + path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function apiGet(path, params) {
  const r = await fetch(apiUrl(path, params), { headers: { "Accept": "application/json" } });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { _raw: text }; }
  if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status, data });
  return data;
}

// ---------- Directus ----------
function directusUrl(path, params) {
  const base = PORTAL_CONFIG?.directusBase || "/directus";
  const url = new URL(base + path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function directusGet(path, params) {
  const r = await fetch(directusUrl(path, params), { headers: { "Accept": "application/json" } });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { _raw: text }; }
  if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status, data });
  return data;
}

async function directusReadItems(collection, { fields, limit = 200, offset = 0, sort = null, filter = null } = {}) { // fixed import/export
  const params = { limit: String(limit), offset: String(offset) };
  if (fields?.length) params.fields = fields.join(",");
  if (sort) params.sort = sort;
  if (filter) params.filter = JSON.stringify(filter);
  return directusGet(`/items/${collection}`, params);
}

// Совместимость: иногда в импорте проскакивает кириллическая "г" в имени функции.
// Оставляем алиас, чтобы страница не падала на этапе загрузки модуля.
const directusReadIteгms = directusReadItems;

async function directusPatch(path, body) {
  const r = await fetch(directusUrl(path), {
    method: "PATCH",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { _raw: text }; }
  if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status, data });
  return data;
}

async function directusUpdateItem(collection, id, patch) { // fixed import/export
  return directusPatch(`/items/${collection}/${encodeURIComponent(id)}`, patch);
}

// ---------- OpenSearch ----------
async function searchOpenSearch(q, { index = null, size = null } = {}) {
  const params = {};
  if (q != null) params.q = q;
  if (index) params.index = index;
  if (size != null) params.size = String(size);
  return apiGet("/v1/search", params);
}

// Экспортируем то, что нужно страницам
export { // fixed import/export
  apiUrl, apiGet,
  directusUrl, directusGet,
  directusReadItems,
  directusReadIteгms,
  directusUpdateItem,
  searchOpenSearch
};
