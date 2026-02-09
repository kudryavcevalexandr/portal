import json
import logging
import os
from pathlib import Path

import requests


DEFAULT_URL = "http://localhost:9200"
INDEX_NAME = "class_tree_nomen_v1"
LOG_PATH = os.getenv(
    "CREATE_INDEX_LOG",
    str(Path(__file__).resolve().parent / "logs" / "create_class_tree_nomen_index.log"),
)


def setup_logging() -> None:
    log_file = Path(LOG_PATH)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=log_file,
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )


def build_payload() -> dict:
    return {
        "mappings": {
            "properties": {
                "id": {"type": "keyword"},
                "item_name": {"type": "text", "analyzer": "russian"},
            }
        }
    }


def create_index() -> None:
    opensearch_url = os.getenv("OPENSEARCH_URL", DEFAULT_URL).rstrip("/")
    url = f"{opensearch_url}/{INDEX_NAME}"
    payload = build_payload()

    logging.info("Starting index creation.")
    logging.info("Target URL: %s", url)
    logging.info("Payload: %s", json.dumps(payload, ensure_ascii=False))

    response = requests.put(url, json=payload, timeout=30)
    logging.info("Response status: %s", response.status_code)
    logging.info("Response body: %s", response.text)
    response.raise_for_status()
    logging.info("Index creation completed successfully.")


def main() -> None:
    setup_logging()
    logging.info("Script started.")
    try:
        create_index()
    except Exception:
        logging.exception("Index creation failed.")
        raise
    finally:
        logging.info("Script finished.")


if __name__ == "__main__":
    main()
