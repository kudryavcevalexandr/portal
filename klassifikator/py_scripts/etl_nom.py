#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETL: v_nomenclature_spec_l3_dup_links_v1 -> v_nomenclature_spec_pairs_v1

Логика:
1) Берём dup_root_id из public.v_nomenclature_spec_l3_dup_links_v1
2) Подтягиваем item_name + type_mark из public.v_nomenclature_spec_read_v1
3) Склеиваем: full_name = item_name + " " + type_mark (если type_mark не пуст)
4) Применяем нормализацию (наши правила)
5) Пишем:
   - name_tep_korr = полностью нормализованное
   - name_tek      = обрезка до 150 символов
   - dup_root_id   = ключ
Upsert по dup_root_id.
"""

import os
import re
import sys
import time
import logging
from datetime import datetime

import pandas as pd
from sqlalchemy import create_engine, text

# ====== НАСТРОЙКИ ======
DB_USER = os.getenv("DB_USER", "directus")
DB_PASS = os.getenv("DB_PASS", "f8a9a07ead7fdaa5fabffc68d5df591d")
DB_HOST = os.getenv("DB_HOST", "172.16.10.129")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "directus")

SRC_LINKS_VIEW = "public.v_nomenclature_spec_l3_dup_links_v1"
SRC_READ_VIEW  = "public.v_nomenclature_spec_read_v1"
DST_TABLE      = "public.v_nomenclature_spec_pairs_v1"

CHUNK_SIZE     = int(os.getenv("CHUNK_SIZE", "50000"))
N_LOOKAHEAD_NOUN = 10

# аббревиатуры/термины, которые НЕ трогаем регистром и НЕ используем как слова для морфологии
TERMS_UPPER = {
    "ПВХ","НГ","IP","ГОСТ","ТУ","DIN","ISO","EN","ASTM",
    "ШПС","ШС","ШУ","ЩС","ЩУ","КИП","АСУ","ТП","РЗА","ГРЩ","ВРУ",
    "AC","DC","UPS","UHF","VHF","LAN","WAN","CAT","RJ"
}

# ====== ЛОГИРОВАНИЕ ======
def setup_logger() -> logging.Logger:
    logger = logging.getLogger("pairs_etl")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    # файл лога (в текущей папке)
    fh = logging.FileHandler(f"pairs_etl_{datetime.now().strftime('%Y%m%d')}.log", encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    return logger

log = setup_logger()

# ====== MORPH ======
try:
    import pymorphy3
    MORPH = pymorphy3.MorphAnalyzer()
    log.info("pymorphy3: OK")
except Exception as e:
    MORPH = None
    log.warning("pymorphy3: NOT AVAILABLE (%s) — перестановка/согласование отключены", str(e))

# ====== REGEX / MAPS ======
WS_RE            = re.compile(r"[ \t\u00A0]+")
TRAIL_PUNCT_RE   = re.compile(r"[ \t\u00A0]*[\.!,;:…]+[ \t\u00A0]*$")
# ВАЖНО: замену x/×/*/X/Х делаем ТОЛЬКО между цифрами, чтобы не трогать "ПВХ"
DIM_NUM_RE       = re.compile(r"(?<=\d)\s*[*×xXХ]\s*(?=\d)")

# служебные хвосты вида "_ х 000D_" / "_000D_" и т.п.
SERVICE_CODE_RE  = re.compile(r"_\s*х?\s*\d+[A-Za-z]+\s*_", re.IGNORECASE)

# мусор в конце (подчёркивания/дефисы/тире)
TRAIL_JUNK_RE    = re.compile(r"[ _\-–—]+$")

QUOTES_MAP = str.maketrans({
    "«": "''", "»": "''",
    "“": "''", "”": "''",
    "„": "''", "‟": "''",
    "‘": "''", "’": "''",
    "‚": "''", "‛": "''",
    "Ё": "Е", "ё": "е",
})

def _strip_edges(token: str) -> str:
    return re.sub(r"^[^\wА-Яа-яЁё]+|[^\wА-Яа-яЁё]+$", "", token)

def _lower_first_alpha(token: str) -> str:
    m = re.search(r"[A-Za-zА-Яа-яЁё]", token)
    if not m:
        return token
    i = m.start()
    return token[:i] + token[i].lower() + token[i+1:]

def _is_all_caps_word(w: str) -> bool:
    return w.isalpha() and w.upper() == w and len(w) >= 2

def _norm_caps_token(tok: str) -> str:
    core = _strip_edges(tok)
    if not core:
        return tok
    if _is_all_caps_word(core) and core.upper() not in TERMS_UPPER:
        return tok.replace(core, core.lower())
    return tok

def _replace_dim_x(s: str) -> str:
    # 34x34 -> 34х34 (БЕЗ ПРОБЕЛОВ вокруг х)
    s = DIM_NUM_RE.sub("х", s)
    # если вдруг где-то появились пробелы вокруг "х" между цифрами — добиваем
    s = re.sub(r"(\d)\s*х\s*(\d)", r"\1х\2", s)
    return s

def normalize_name(s: str) -> str:
    if s is None:
        return ""
    s = str(s)

    # переносы + один пробел
    s = s.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    s = WS_RE.sub(" ", s).strip()

    # кавычки + ё->е
    s = s.translate(QUOTES_MAP)

    # вырезаем служебные коды
    s = SERVICE_CODE_RE.sub(" ", s)
    s = WS_RE.sub(" ", s).strip()

    # размерности
    s = _replace_dim_x(s)

    # убрать пунктуацию в конце + хвост мусора
    s = TRAIL_PUNCT_RE.sub("", s).strip()
    s = TRAIL_JUNK_RE.sub("", s).strip()

    if not s:
        return ""

    toks = s.split(" ")
    toks = [_norm_caps_token(t) for t in toks]

    # перестановка: ищем существительное в первых 10 словах
    if MORPH and len(toks) >= 2:
        max_i = min(N_LOOKAHEAD_NOUN, len(toks))

        noun_i = None
        for i in range(1, max_i):
            w = _strip_edges(toks[i])
            if not w or w.upper() in TERMS_UPPER:
                continue
            if not re.fullmatch(r"[A-Za-zА-Яа-яЁё-]+", w):
                continue
            p = MORPH.parse(w)[0]
            if ("NOUN" in p.tag) or ("NPRO" in p.tag):
                noun_i = i
                break

        if noun_i is not None:
            t0 = toks[noun_i - 1]   # слово перед существительным (ожидаем прилагательное)
            t1 = toks[noun_i]       # найденное существительное
            w0, w1 = _strip_edges(t0), _strip_edges(t1)

            if w0 and w1 and w0.isalpha() and w1.isalpha():
                p0 = MORPH.parse(w0)[0]
                p1 = MORPH.parse(w1)[0]

                is_adj0  = ("ADJF" in p0.tag) or ("ADJS" in p0.tag)
                is_noun1 = ("NOUN" in p1.tag) or ("NPRO" in p1.tag)

                if is_adj0 and is_noun1:
                    # существительное: ед.ч., им.п.
                    noun_inf = p1.inflect({"sing", "nomn"})
                    noun_word = noun_inf.word if noun_inf else p1.word

                    # прилагательное: согласовать с существительным (ед.ч., им.п. + род если есть)
                    feats = {"sing", "nomn"}
                    if "masc" in p1.tag: feats.add("masc")
                    if "femn" in p1.tag: feats.add("femn")
                    if "neut" in p1.tag: feats.add("neut")

                    adj_inf = p0.inflect(feats)
                    adj_word = adj_inf.word if adj_inf else p0.word

                    t1_new = re.sub(re.escape(w1), noun_word, t1, count=1)
                    t0_new = re.sub(re.escape(w0), adj_word, t0, count=1)
                    t0_new = _lower_first_alpha(t0_new)

                    rest = toks[:noun_i-1] + toks[noun_i+1:]
                    toks = [t1_new, t0_new] + rest

    s = " ".join(toks)
    s = WS_RE.sub(" ", s).strip()

    # первая буква заглавная
    if s:
        s = s[0].upper() + s[1:]
    return s

# ====== SQL ======
SQL_SELECT = f"""
WITH roots AS (
  SELECT DISTINCT dup_root_id
  FROM {SRC_LINKS_VIEW}
  WHERE dup_root_id IS NOT NULL
),
read_one AS (
  SELECT
    dup_root_id,
    MAX(item_name) AS item_name,
    MAX(type_mark) AS type_mark
  FROM {SRC_READ_VIEW}
  WHERE dup_root_id IS NOT NULL
  GROUP BY dup_root_id
)
SELECT
  r.dup_root_id,
  r.item_name,
  r.type_mark
FROM roots x
JOIN read_one r
  ON r.dup_root_id = x.dup_root_id
ORDER BY r.dup_root_id;
"""

def main() -> int:
    t0 = time.time()

    if not DB_PASS:
        log.error("DB_PASS пустой. Укажи переменную окружения DB_PASS.")
        return 2

    engine = create_engine(
        f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
        future=True,
        pool_pre_ping=True,
    )

    log.info("DB: %s@%s:%s/%s", DB_USER, DB_HOST, DB_PORT, DB_NAME)
    log.info("SRC: %s + %s | DST: %s", SRC_LINKS_VIEW, SRC_READ_VIEW, DST_TABLE)

    # гарантируем уникальность для upsert
    with engine.begin() as c:
        c.execute(text(f"""
            CREATE UNIQUE INDEX IF NOT EXISTS ux_pairs_dup_root_id
            ON {DST_TABLE} (dup_root_id);
        """))

    total_rows = 0
    total_upserted = 0

    # читаем чанками, чтобы не уронить память
    for chunk_idx, df in enumerate(pd.read_sql_query(SQL_SELECT, engine, chunksize=CHUNK_SIZE), start=1):
        n = len(df)
        total_rows += n
        log.info("Chunk %d: loaded %d rows", chunk_idx, n)

        df["item_name"] = df["item_name"].fillna("").astype(str)
        df["type_mark"] = df["type_mark"].fillna("").astype(str)

        # full name = item_name + (type_mark)
        df["full_name"] = (df["item_name"].str.strip() + " " + df["type_mark"].str.strip()).str.strip()
        df["name_tep_korr"] = df["full_name"].map(normalize_name)
        df["name_tek"] = df["name_tep_korr"].map(lambda x: x[:150] if len(x) > 150 else x)

        out = df[["dup_root_id", "name_tep_korr", "name_tek"]].copy()

        # staging -> upsert
        staging = f"stg_pairs_{os.getpid()}_{chunk_idx}"

        with engine.begin() as c:
            c.execute(text(f"DROP TABLE IF EXISTS public.{staging};"))
            c.execute(text(f"""
                CREATE TEMP TABLE {staging} (
                  dup_root_id   bigint,
                  name_tep_korr text,
                  name_tek      text
                ) ON COMMIT DROP;
            """))

        out.to_sql(staging, engine, if_exists="append", index=False, method="multi", chunksize=5000)

        with engine.begin() as c:
            res = c.execute(text(f"""
                INSERT INTO {DST_TABLE} (dup_root_id, name_tep_korr, name_tek)
                SELECT dup_root_id, name_tep_korr, name_tek
                FROM {staging}
                WHERE dup_root_id IS NOT NULL
                ON CONFLICT (dup_root_id) DO UPDATE
                SET
                  name_tep_korr = EXCLUDED.name_tep_korr,
                  name_tek      = EXCLUDED.name_tek;
            """))
            # rowcount для INSERT..ON CONFLICT в psycopg2 бывает "не точный", но как индикатор годится
            upc = int(getattr(res, "rowcount", 0) or 0)
            total_upserted += max(upc, 0)

        # краткая диагностика
        bad = (out["name_tep_korr"].str.len() == 0).sum()
        log.info("Chunk %d: upserted~%d, empty_names=%d", chunk_idx, upc, int(bad))

    dt = time.time() - t0
    log.info("DONE. rows=%d, upserted~%d, time=%.1fs", total_rows, total_upserted, dt)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())