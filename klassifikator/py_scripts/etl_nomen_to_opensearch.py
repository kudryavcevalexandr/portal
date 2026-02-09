import os
import json
import time
import logging
import requests
import psycopg2
import psycopg2.extras

# =========================
# CONFIG (правишь тут)
# =========================

JOBS = [
    {
        "schema": "public",
        "table": "class_tree_nomen_v1",
        "index": "class_tree_nomen_v1",
        "id_col": "id",
        "fields": ["id", "item_name"],
        "order_by": "id",
        "recreate_index": False,   # True = удалить индекс и создать заново
        "truncate_index": True,    # True = очистить документы (DELETE BY QUERY match_all)
        "settings": {"number_of_shards": 1, "number_of_replicas": 0},
        "mappings": {
            "id": {"type": "long"},
            "item_name": {"type": "text"},
        }
    },
]

# =========================
# ENV (обычно не трогаешь)
# =========================

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "http://127.0.0.1:9200").rstrip("/")
PG_HOST = os.getenv("PG_HOST", "127.0.0.1")
PG_PORT = int(os.getenv("PG_PORT", "5432"))
PG_DB   = os.getenv("PG_DB", "directus")
PG_USER = os.getenv("PG_USER", "directus")
PG_PASS = os.getenv("PG_PASS", "directus")

BATCH = int(os.getenv("BATCH", "2000"))
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "60"))

# =========================
# Helpers
# =========================

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("etl_nomen_to_opensearch")

def pg_conn():
    logger.warning(
        "Using hardcoded Postgres connection settings; env vars ignored. "
        "Target: 172.16.10.129:5432/directus"
    )
    return psycopg2.connect(
        host="172.16.10.129", port=5432, dbname="directus",
        user="directus", password="f8a9a07ead7fdaa5fabffc68d5df591d"
    )

def pg_stream(sql):
    conn = pg_conn()
    try:
        with conn.cursor(name="cur", cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.itersize = BATCH
            logger.info("Executing SQL: %s", sql)
            cur.execute(sql)
            while True:
                rows = cur.fetchmany(BATCH)
                if not rows:
                    break
                yield [dict(r) for r in rows]
    except Exception:
        logger.exception("Postgres streaming failed.")
        raise
    finally:
        conn.close()

def os_req(method, path, **kwargs):
    url = f"{OPENSEARCH_URL}{path}"
    logger.debug("OpenSearch request %s %s", method, url)
    try:
        response = requests.request(method, url, timeout=HTTP_TIMEOUT, **kwargs)
    except Exception:
        logger.exception("OpenSearch request failed: %s %s", method, url)
        raise
    logger.debug(
        "OpenSearch response %s %s -> %s",
        method,
        url,
        response.status_code,
    )
    if response.status_code >= 400:
        logger.error(
            "OpenSearch error %s %s -> %s: %s",
            method,
            url,
            response.status_code,
            response.text[:2000],
        )
    return response

def index_exists(index):
    r = os_req("GET", f"/{index}")
    return r.status_code == 200

def delete_index(index):
    try:
        r = os_req("DELETE", f"/{index}")
        if r.status_code not in (200, 404):
            r.raise_for_status()
    except Exception:
        logger.exception("Failed to delete index: %s", index)
        raise

def create_index(index, settings, mappings):
    body = {
        "settings": {"index": settings or {"number_of_shards": 1, "number_of_replicas": 0}},
        "mappings": {"properties": mappings or {}}
    }
    try:
        r = os_req("PUT", f"/{index}", json=body)
        r.raise_for_status()
    except Exception:
        logger.exception("Failed to create index: %s", index)
        raise

def truncate_index(index):
    # безопаснее, чем удалять/создавать, но может быть медленнее на больших объёмах
    body = {"query": {"match_all": {}}}
    try:
        r = os_req("POST", f"/{index}/_delete_by_query?conflicts=proceed&refresh=true", json=body)
        r.raise_for_status()
    except Exception:
        logger.exception("Failed to truncate index: %s", index)
        raise

def bulk_index(index, id_col, rows):
    lines = []
    for r in rows:
        _id = r.get(id_col)
        if _id is None:
            continue
        lines.append(json.dumps({"index": {"_index": index, "_id": _id}}, ensure_ascii=False))
        lines.append(json.dumps(r, ensure_ascii=False))
    payload = "\n".join(lines) + "\n"

    r = os_req(
        "POST", "/_bulk",
        data=payload.encode("utf-8"),
        headers={"Content-Type": "application/x-ndjson"}
    )
    r.raise_for_status()
    data = r.json()
    if data.get("errors"):
        items = data.get("items") or []
        bad = []
        for it in items:
            act = list(it.values())[0]
            if act.get("error"):
                bad.append(act.get("error"))
            if len(bad) >= 3:
                break
        logger.error("Bulk index errors (first 3): %s", bad)
        raise RuntimeError(f"Bulk errors (first 3): {bad}")

def job_sql(schema, table, fields, order_by):
    cols = ", ".join(fields)
    ob = order_by or fields[0]
    return f"select {cols} from {schema}.{table} order by {ob}"

def run_job(job):
    schema = job["schema"]
    table = job["table"]
    index = job["index"]
    id_col = job["id_col"]
    fields = job["fields"]
    order_by = job.get("order_by") or id_col

    recreate = bool(job.get("recreate_index"))
    trunc = bool(job.get("truncate_index"))
    settings = job.get("settings") or {"number_of_shards": 1, "number_of_replicas": 0}
    mappings = job.get("mappings") or {}

    print("="*80)
    print(f"JOB: {schema}.{table}  ->  {index}")
    print(f"fields={fields}, id_col={id_col}, batch={BATCH}")

    try:
        if recreate:
            print("recreate_index=True → deleting index (if exists) ...")
            delete_index(index)

        if not index_exists(index):
            print("index not exists → creating ...")
            create_index(index, settings, mappings)
            print("created.")
        else:
            print("index exists.")

        if trunc:
            print("truncate_index=True → deleting all docs ...")
            truncate_index(index)
            print("cleared.")
    except Exception:
        logger.exception("Index preparation failed for %s", index)
        raise

    sql = job_sql(schema, table, fields, order_by)
    total = 0
    t0 = time.time()
    try:
        for batch in pg_stream(sql):
            bulk_index(index, id_col, batch)
            total += len(batch)
            if total % (BATCH * 5) == 0:
                dt = time.time() - t0
                print(f"indexed: {total}  ({total/dt:.1f} rows/s)")
    except Exception:
        logger.exception("Batch indexing failed for index: %s", index)
        raise
    dt = time.time() - t0
    print(f"DONE: {total} rows in {dt:.1f}s ({total/dt:.1f} rows/s)")

def main():
    # быстрый health-check OS
    try:
        r = os_req("GET", "/")
        r.raise_for_status()
        print(f"OpenSearch: {OPENSEARCH_URL} OK")
    except Exception:
        logger.exception("OpenSearch health-check failed: %s", OPENSEARCH_URL)
        raise

    # pg check
    try:
        conn = pg_conn()
        conn.close()
        print(f"Postgres: {PG_HOST}:{PG_PORT}/{PG_DB} OK")
    except Exception:
        logger.exception("Postgres connection check failed.")
        raise

    for job in JOBS:
        run_job(job)

if __name__ == "__main__":
    main()
