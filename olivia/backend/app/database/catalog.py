"""Catálogo de productos y supermercados.

Para el MVP los datos de demostración viven en /data/*.csv y se cargan en SQLite
al arrancar. Las listas y resultados de optimización también se guardan en SQLite.
"""
import csv
from typing import Optional
import json
import os
import sqlite3
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data"
DB_PATH = Path(os.getenv("OLIVIA_DB", ROOT / "backend" / "olivia.db"))


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Crea las tablas y (re)carga el catálogo desde los CSV."""
    with get_conn() as conn:
        conn.executescript(
            """
            DROP TABLE IF EXISTS supermarkets;
            DROP TABLE IF EXISTS products;
            CREATE TABLE supermarkets (
                supermarket_id TEXT PRIMARY KEY, name TEXT, address TEXT,
                distance_km REAL, travel_cost_eur REAL);
            CREATE TABLE products (
                item TEXT, supermarket_id TEXT, product_name TEXT,
                package_qty REAL, unit TEXT, price_eur REAL,
                PRIMARY KEY (item, supermarket_id));
            CREATE TABLE IF NOT EXISTS shopping_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP);
            """
        )
        with open(DATA_DIR / "supermarkets.csv", encoding="utf-8") as f:
            conn.executemany(
                "INSERT INTO supermarkets VALUES (:supermarket_id,:name,:address,:distance_km,:travel_cost_eur)",
                list(csv.DictReader(f)),
            )
        with open(DATA_DIR / "products.csv", encoding="utf-8") as f:
            conn.executemany(
                "INSERT INTO products VALUES (:item,:supermarket_id,:product_name,:package_qty,:unit,:price_eur)",
                list(csv.DictReader(f)),
            )
    get_catalog.cache_clear()
    get_supermarkets.cache_clear()


@lru_cache
def get_supermarkets() -> dict[str, dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM supermarkets").fetchall()
    return {r["supermarket_id"]: dict(r) for r in rows}


@lru_cache
def get_catalog() -> dict[str, dict[str, dict]]:
    """{item: {supermarket_id: {product_name, package_qty, unit, price_eur}}}"""
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM products").fetchall()
    catalog: dict[str, dict[str, dict]] = {}
    for r in rows:
        catalog.setdefault(r["item"], {})[r["supermarket_id"]] = dict(r)
    return catalog


def catalog_units() -> dict[str, str]:
    """{item: unidad} — se le pasa a la IA para que use nombres y unidades válidos."""
    return {item: next(iter(offers.values()))["unit"] for item, offers in get_catalog().items()}


def save(table: str, payload: dict) -> int:
    assert table in {"shopping_lists", "results"}
    with get_conn() as conn:
        cur = conn.execute(f"INSERT INTO {table} (data) VALUES (?)", (json.dumps(payload),))
        return cur.lastrowid


def load(table: str, row_id: int) -> Optional[dict]:
    assert table in {"shopping_lists", "results"}
    with get_conn() as conn:
        row = conn.execute(f"SELECT data FROM {table} WHERE id = ?", (row_id,)).fetchone()
    return json.loads(row["data"]) if row else None


def update(table: str, row_id: int, payload: dict) -> bool:
    assert table in {"shopping_lists", "results"}
    with get_conn() as conn:
        cur = conn.execute(f"UPDATE {table} SET data = ? WHERE id = ?", (json.dumps(payload), row_id))
        return cur.rowcount > 0
