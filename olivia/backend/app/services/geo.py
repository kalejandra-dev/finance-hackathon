"""Geolocalización: distancias, supermercados cercanos, geocodificación y rutas.

Todo es gratuito y sin API key:
- Distancias: fórmula de haversine (línea recta sobre la Tierra).
- Direcciones -> coordenadas: Nominatim (OpenStreetMap).
- Rutas por calles: OSRM (servidores públicos de OpenStreetMap).
Si un servicio externo falla, se usa una ruta en línea recta: la demo nunca se rompe.
"""
import math
from typing import Optional

import httpx

from app.database.catalog import get_catalog, get_supermarkets

# Ubicación de demo: Campus UC3M de Leganés (aprox.)
DEMO_LOCATION = {"lat": 40.3326, "lon": -3.7651, "label": "Campus UC3M Leganés (demo)"}

EUR_PER_KM = 0.25  # coste estimado del desplazamiento por km recorrido
WALK_KMH = 4.8  # velocidad media andando
ROUTE_FACTOR = 1.3  # las calles no van en línea recta: corrección para la estimación

USER_AGENT = "OlivIA-hackathon-demo/1.0"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URLS = [
    "https://routing.openstreetmap.de/routed-foot/route/v1/foot",  # rutas a pie
    "https://router.project-osrm.org/route/v1/driving",  # alternativa (coche)
]


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def travel_cost(distance_km: float) -> float:
    """Ida y vuelta desde la ubicación del usuario."""
    return round(distance_km * ROUTE_FACTOR * 2 * EUR_PER_KM, 2)


def price_index() -> dict[str, float]:
    """Índice de precio de cada súper: media de (su precio / precio más barato) en los productos
    que vende. 1.00 = siempre el más barato; 1.20 = un 20 % más caro de media."""
    ratios: dict[str, list[float]] = {}
    for offers in get_catalog().values():
        cheapest = min(o["price_eur"] for o in offers.values())
        for sid, o in offers.items():
            ratios.setdefault(sid, []).append(o["price_eur"] / cheapest)
    return {sid: round(sum(r) / len(r), 3) for sid, r in ratios.items()}


def _price_level(index: float, lo: float, hi: float) -> int:
    """1 = €, 2 = €€, 3 = €€€ (relativo a los súpers de la demo)."""
    if hi - lo < 1e-9:
        return 2
    t = (index - lo) / (hi - lo)
    return 1 if t < 1 / 3 else 2 if t < 2 / 3 else 3


def nearby_supermarkets(lat: float, lon: float, limit: int = 5) -> list[dict]:
    """Supermercados ordenados del más cercano al más lejano, con distancia, coste,
    nivel de precio y cuántos productos del catálogo tiene."""
    idx = price_index()
    lo, hi = min(idx.values()), max(idx.values())
    catalog = get_catalog()
    stores = []
    for s in get_supermarkets().values():
        sid = s["supermarket_id"]
        d = round(haversine_km((lat, lon), (s["lat"], s["lon"])), 2)
        stores.append({**s, "distance_km": d, "travel_cost_eur": travel_cost(d),
                       "walk_minutes": round(d * ROUTE_FACTOR / WALK_KMH * 60),
                       "price_index": idx.get(sid), "price_level": _price_level(idx.get(sid, hi), lo, hi),
                       "catalog_coverage": round(sum(sid in o for o in catalog.values()) / len(catalog), 2),
                       "cheapest": idx.get(sid) == lo})
    return sorted(stores, key=lambda s: s["distance_km"])[:limit]


def geocode(address: str) -> Optional[dict]:
    """Dirección escrita -> coordenadas (Nominatim). None si no se encuentra."""
    r = httpx.get(NOMINATIM_URL, params={"q": address, "format": "json", "limit": 1, "countrycodes": "es"},
                  headers={"User-Agent": USER_AGENT}, timeout=10)
    r.raise_for_status()
    data = r.json()
    if not data:
        return None
    return {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"]), "label": data[0]["display_name"]}


def order_stops(origin: tuple[float, float], stops: list[dict]) -> list[dict]:
    """Ordena las paradas por el vecino más cercano (con 2-3 paradas es prácticamente óptimo)."""
    pending, ordered, here = list(stops), [], origin
    while pending:
        nxt = min(pending, key=lambda s: haversine_km(here, (s["lat"], s["lon"])))
        ordered.append(nxt)
        pending.remove(nxt)
        here = (nxt["lat"], nxt["lon"])
    return ordered


def route(origin: tuple[float, float], supermarket_ids: list[str]) -> dict:
    """Ruta desde el usuario por los supermercados elegidos y vuelta a casa."""
    all_stores = get_supermarkets()
    stops = order_stops(origin, [all_stores[i] for i in supermarket_ids if i in all_stores])
    points = [origin] + [(s["lat"], s["lon"]) for s in stops] + [origin]

    result = {"origin": {"lat": origin[0], "lon": origin[1]},
              "stops": [{"supermarket_id": s["supermarket_id"], "name": s["name"], "address": s["address"],
                         "lat": s["lat"], "lon": s["lon"]} for s in stops]}

    coords = ";".join(f"{lon},{lat}" for lat, lon in points)  # OSRM usa lon,lat
    for base in OSRM_URLS:
        try:
            r = httpx.get(f"{base}/{coords}", params={"overview": "full", "geometries": "geojson"},
                          headers={"User-Agent": USER_AGENT}, timeout=8)
            r.raise_for_status()
            best = r.json()["routes"][0]
            km = best["distance"] / 1000
            return {**result, "source": "osrm",
                    "geometry": [[lat, lon] for lon, lat in best["geometry"]["coordinates"]],
                    "distance_km": round(km, 2), "walk_minutes": round(km / WALK_KMH * 60)}
        except Exception:
            continue

    # Sin conexión con OSRM: línea recta (estimación)
    km = sum(haversine_km(points[i], points[i + 1]) for i in range(len(points) - 1)) * ROUTE_FACTOR
    return {**result, "source": "estimate", "geometry": [list(p) for p in points],
            "distance_km": round(km, 2), "walk_minutes": round(km / WALK_KMH * 60)}
