import os

os.environ["OLIVIA_AI_MOCK"] = "1"
os.environ["OLIVIA_DB"] = "/tmp/olivia_test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.schemas.models import ListItem  # noqa: E402
from app.services.optimizer import optimize  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_interpret_mock_returns_valid_list(client):
    r = client.post("/api/ai/interpret", json={"text": "paella para 4 con 35 euros"})
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "create_shopping_list"
    assert len(body["items"]) > 0


def test_optimize_respects_max_stores(client):
    items = client.post("/api/ai/interpret", json={"text": "paella"}).json()["items"]
    for k in (1, 2, 3):
        r = client.post("/api/optimize", json={"items": items, "max_stores": k, "budget": 35})
        assert r.status_code == 200
        opt = r.json()["optimized"]
        if opt:
            assert len(opt["stores"]) <= k


def test_optimized_never_worse_than_single_store(client):
    items = [{"name": "leche", "quantity": 2000, "unit": "ml"},
             {"name": "huevos", "quantity": 12, "unit": "unidad"},
             {"name": "café", "quantity": 250, "unit": "g"},
             {"name": "arroz", "quantity": 1000, "unit": "g"}]
    res = client.post("/api/optimize", json={"items": items, "max_stores": 2}).json()
    if res["best_single_store"]:
        assert res["optimized"]["total_cost"] <= res["best_single_store"]["total_cost"] + 1e-6
        assert res["net_saving"] >= 0


def test_unknown_product_is_reported(client):
    res = client.post("/api/optimize", json={"items": [{"name": "caviar", "quantity": 1, "unit": "g"},
                                                       {"name": "leche", "quantity": 1000, "unit": "ml"}]}).json()
    assert "caviar" in res["unavailable_items"]


def test_packages_rounding(client):
    # 1200 ml de caldo con envases de 1 L -> 2 envases
    res = optimize([ListItem(name="caldo de pescado", quantity=1200, unit="ml")], max_stores=1)
    assert res.optimized.assignments[0].packages == 2


def test_result_persisted(client):
    r = client.post("/api/optimize", json={"items": [{"name": "pan", "quantity": 2, "unit": "unidad"}]}).json()
    assert client.get(f"/api/results/{r['id']}").status_code == 200
