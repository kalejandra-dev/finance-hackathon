"""Pruebas de «Mi presupuesto»: confirmar compras e historial."""
import os

os.environ["OLIVIA_AI_MOCK"] = "1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import catalog  # noqa: E402
from app.main import app  # noqa: E402

ITEMS = [{"name": "leche", "quantity": 2000, "unit": "ml"},
         {"name": "huevos", "quantity": 12, "unit": "unidad"},
         {"name": "arroz", "quantity": 1000, "unit": "g"}]


@pytest.fixture()
def client():
    with TestClient(app) as c:
        with catalog.get_conn() as conn:
            conn.execute("DELETE FROM purchases")  # cada test empieza con el historial vacío
        yield c


def _optimize(client, budget=30):
    r = client.post("/api/optimize", json={"items": ITEMS, "max_stores": 2, "budget": budget})
    assert r.status_code == 200
    return r.json()


def test_history_starts_empty(client):
    body = client.get("/api/purchases").json()
    assert body == {"purchases": [], "count": 0, "total_spent": 0, "total_saved": 0}


def test_confirm_purchase_stores_summary(client):
    res = _optimize(client)
    r = client.post("/api/purchases", json={"result_id": res["id"]})
    assert r.status_code == 200
    p = r.json()
    assert p["result_id"] == res["id"]
    assert p["total_cost"] == res["optimized"]["total_cost"]
    assert p["budget"] == 30
    assert p["n_items"] == len(ITEMS)
    assert [s["name"] for s in p["stores"]] == [s["name"] for s in res["optimized"]["stores"]]
    assert p["confirmed_at"]


def test_confirm_is_idempotent(client):
    res = _optimize(client)
    first = client.post("/api/purchases", json={"result_id": res["id"]}).json()
    second = client.post("/api/purchases", json={"result_id": res["id"]}).json()
    assert first["id"] == second["id"]
    assert client.get("/api/purchases").json()["count"] == 1


def test_history_totals(client):
    a, b = _optimize(client, budget=30), _optimize(client, budget=None)
    for res in (a, b):
        client.post("/api/purchases", json={"result_id": res["id"]})
    body = client.get("/api/purchases").json()
    assert body["count"] == 2
    assert body["total_spent"] == round(a["optimized"]["total_cost"] + b["optimized"]["total_cost"], 2)
    assert body["total_saved"] == round((a["net_saving"] or 0) + (b["net_saving"] or 0), 2)
    assert [p["result_id"] for p in body["purchases"]] == [a["id"], b["id"]]  # orden cronológico


def test_confirm_unknown_result_is_404(client):
    assert client.post("/api/purchases", json={"result_id": 999999}).status_code == 404


def test_confirm_result_without_plan_is_422(client):
    res = client.post("/api/optimize", json={"items": [{"name": "caviar", "quantity": 1, "unit": "g"}]}).json()
    assert res["optimized"] is None
    assert client.post("/api/purchases", json={"result_id": res["id"]}).status_code == 422


def test_delete_purchase(client):
    res = _optimize(client)
    pid = client.post("/api/purchases", json={"result_id": res["id"]}).json()["id"]
    assert client.delete(f"/api/purchases/{pid}").status_code == 204
    assert client.get("/api/purchases").json()["count"] == 0
    assert client.delete(f"/api/purchases/{pid}").status_code == 404
