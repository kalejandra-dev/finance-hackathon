"""Compras confirmadas por el usuario (historial de «Mi presupuesto»).

Un resultado de optimización es solo una estimación. Cuando el usuario confirma que ha
hecho la compra, se guarda aquí un resumen; solo estas compras cuentan como gasto y
ahorro en el historial (requisito de la pantalla 6 del documento del proyecto).

Va en un módulo aparte para no mezclarlo con la carga del catálogo (catalog.py).
"""
import json
from typing import Optional

from app.database.catalog import get_conn


def init_purchases() -> None:
    """Crea la tabla si no existe. No borra datos: el historial sobrevive a los reinicios."""
    with get_conn() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                result_id INTEGER UNIQUE NOT NULL,
                data TEXT NOT NULL,
                confirmed_at TEXT DEFAULT CURRENT_TIMESTAMP)"""
        )


def _to_dict(row) -> dict:
    return {"id": row["id"], "result_id": row["result_id"], "confirmed_at": row["confirmed_at"],
            **json.loads(row["data"])}


def summarize(result: dict) -> dict:
    """Resumen de un OptimizeResult guardado (solo lo necesario para el historial)."""
    opt = result["optimized"]
    return {
        "budget": result.get("budget"),
        "products_cost": opt["products_cost"],
        "travel_cost": opt["travel_cost"],
        "total_cost": opt["total_cost"],
        "net_saving": result.get("net_saving"),  # None si ningún súper tenía todo
        "stores": [{"name": s["name"], "subtotal": s["subtotal"]} for s in opt["stores"]],
        "n_items": len(opt["assignments"]),
    }


def get_by_result(result_id: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM purchases WHERE result_id = ?", (result_id,)).fetchone()
    return _to_dict(row) if row else None


def confirm(result_id: int, result: dict) -> dict:
    """Registra la compra. Si ya estaba confirmada, devuelve la existente (no duplica)."""
    existing = get_by_result(result_id)
    if existing:
        return existing
    with get_conn() as conn:
        conn.execute("INSERT INTO purchases (result_id, data) VALUES (?, ?)",
                     (result_id, json.dumps(summarize(result))))
    return get_by_result(result_id)


def list_all() -> list[dict]:
    """Compras confirmadas, de la más antigua a la más reciente."""
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM purchases ORDER BY id").fetchall()
    return [_to_dict(r) for r in rows]


def delete(purchase_id: int) -> bool:
    with get_conn() as conn:
        return conn.execute("DELETE FROM purchases WHERE id = ?", (purchase_id,)).rowcount > 0
