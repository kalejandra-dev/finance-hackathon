"""Ubicación, supermercados cercanos, selección de supers y rutas (sin llamar a internet)."""
import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import geo

CAMPUS = {"lat": 40.3326, "lon": -3.7651}
PAELLA = [{"name": "arroz", "quantity": 400, "unit": "g"},
          {"name": "gambas", "quantity": 300, "unit": "g"},
          {"name": "caldo de pescado", "quantity": 1200, "unit": "ml"},
          {"name": "azafrán", "quantity": 1, "unit": "g"}]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def no_internet(monkeypatch):
    def fail(*a, **k):
        raise httpx.ConnectError("sin internet en los tests")
    monkeypatch.setattr(geo.httpx, "get", fail)


def test_haversine_known_distance():
    # Puerta del Sol -> Campus UC3M Leganés: ~11 km en línea recta
    assert 10 < geo.haversine_km((40.4169, -3.7035), (CAMPUS["lat"], CAMPUS["lon"])) < 12


def test_nearby_sorted_by_distance(client):
    stores = client.get("/api/supermarkets/nearby", params=CAMPUS).json()
    assert len(stores) == 5
    dists = [s["distance_km"] for s in stores]
    assert dists == sorted(dists)
    assert all("walk_minutes" in s and "lat" in s for s in stores)


def test_optimize_only_uses_selected_stores(client):
    selected = ["S1", "S3"]
    r = client.post("/api/optimize", json={"items": PAELLA, "max_stores": 2, "supermarket_ids": selected,
                                           "location": CAMPUS}).json()
    used = {s["supermarket_id"] for s in r["optimized"]["stores"]}
    assert used <= set(selected)
    if r["best_single_store"]:
        assert r["best_single_store"]["stores"][0]["supermarket_id"] in selected


def test_travel_cost_depends_on_location(client):
    near = client.post("/api/optimize", json={"items": PAELLA, "max_stores": 1, "supermarket_ids": ["S1"],
                                              "location": CAMPUS}).json()
    far = client.post("/api/optimize", json={"items": PAELLA, "max_stores": 1, "supermarket_ids": ["S1"],
                                             "location": {"lat": 40.4169, "lon": -3.7035}}).json()
    assert far["optimized"]["travel_cost"] > near["optimized"]["travel_cost"]


def test_route_falls_back_to_estimate_without_internet(client):
    r = client.post("/api/route", json={"origin": CAMPUS, "supermarket_ids": ["S5", "S1"]}).json()
    assert r["source"] == "estimate"
    assert [s["supermarket_id"] for s in r["stops"]] == ["S1", "S5"]  # primero el más cercano
    assert r["geometry"][0] == r["geometry"][-1]  # vuelve a casa
    assert r["walk_minutes"] > 0


def test_geocode_error_is_friendly(client):
    r = client.get("/api/geocode", params={"q": "Calle Falsa 123"})
    assert r.status_code == 502


def test_nearby_includes_price_level_and_one_cheapest(client):
    stores = client.get("/api/supermarkets/nearby", params=CAMPUS).json()
    assert all(s["price_level"] in (1, 2, 3) for s in stores)
    assert sum(s["cheapest"] for s in stores) == 1
    cheapest = next(s for s in stores if s["cheapest"])
    assert cheapest["price_index"] == min(s["price_index"] for s in stores)
