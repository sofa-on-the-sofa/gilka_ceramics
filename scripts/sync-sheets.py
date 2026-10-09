#!/usr/bin/env python3
"""Sync items from public Google Sheet CSV into data.json."""

import csv
import io
import json
import os
import ssl
import sys
import urllib.request
from datetime import date
from pathlib import Path

DEFAULT_SHEET_ID = "1QnrrPIySVKrFLTLK9mOKWI8FTwogzg8HUUZI_Qcjyl8"
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_JSON_PATH = REPO_ROOT / "data.json"

STATUS_MAP = {
    # В наявності
    "в наявності": "available",
    "+": "available",
    "1": "available",
    "true": "available",
    "так": "available",
    "yes": "available",
    "available": "available",
    # Продано
    "продано": "sold",
    "-": "sold",
    "0": "sold",
    "false": "sold",
    "ні": "sold",
    "no": "sold",
    "sold": "sold",
    # Бронь
    "бронь": "reserved",
    "б": "reserved",
    "reserved": "reserved",
    # Приховано
    "приховано": "hidden",
    "hidden": "hidden",
}

def get_ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

def sync(sheet_id=DEFAULT_SHEET_ID):
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15, context=get_ssl_context()) as resp:
        content = resp.read().decode("utf-8")

    reader = csv.DictReader(io.StringIO(content))
    
    existing_data = {}
    items_by_code = {}
    if DATA_JSON_PATH.exists():
        with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
            existing_data = json.load(f)
            for it in existing_data.get("items", []):
                items_by_code[it.get("code")] = it

    new_items = []
    rows = list(reader)
    total = len(rows)
    for idx, row in enumerate(rows):
        code = (row.get("Код") or "").strip()
        if not code:
            continue
        name = (row.get("Назва") or "").strip()
        raw_type = (row.get("Тип") or "").strip().lower()
        raw_vol = (row.get("Обʼєм (мл)") or row.get("Об'єм (мл)") or row.get("Обєм (мл)") or "").strip()
        raw_price = (row.get("Ціна (грн)") or "").strip()
        raw_status = (row.get("Статус") or "").strip().lower()
        raw_drop = (row.get("Дроп") or "").strip().lower()

        vol = int(raw_vol) if raw_vol.isdigit() else None
        price = int(raw_price) if raw_price.isdigit() else 0
        status = STATUS_MAP.get(raw_status, "available")
        is_drop = raw_drop in ("так", "yes", "true", "+", "1")

        existing = items_by_code.get(code, {})
        item = {
            "code": code,
            "name": name or existing.get("name", code),
            "type": raw_type or existing.get("type", "piala"),
            "volume": vol,
            "price": price,
            "status": status,
            "order": total - idx,
        }
        if "duration" in existing:
            item["duration"] = existing["duration"]
        if is_drop:
            item["drop"] = True

        new_items.append(item)

    # Only update date if items actually changed
    old_items = existing_data.get("items", [])
    if old_items != new_items:
        existing_data["updated"] = date.today().isoformat()
        existing_data["items"] = new_items
        with open(DATA_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"Updated {len(new_items)} items in {DATA_JSON_PATH}")
    else:
        print("No changes in catalog items.")

if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SHEET_ID", DEFAULT_SHEET_ID)
    sync(sid)
