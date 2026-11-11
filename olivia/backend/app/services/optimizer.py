"""Optimizador de la cesta (MILP con PuLP).

Variables:
    x[i,s] = 1 si el producto i se compra en el supermercado s
    y[s]   = 1 si se visita el supermercado s
Minimizar:  sum coste[i,s]*x[i,s] + sum desplazamiento[s]*y[s]
Sujeto a:   sum_s x[i,s] = 1           (cada producto se compra en un sitio)
            x[i,s] <= y[s]             (solo en súpers visitados)
            sum_s y[s] <= max_stores   (límite de establecimientos)

coste[i,s] = nº de envases necesarios * precio del envase.
El presupuesto NO es restricción dura: si no se cumple, se informa (within_budget=False)
para que OlivIA proponga alternativas en lugar de devolver "sin solución".
"""
import math
from typing import Optional

import pulp

from app.database.catalog import get_catalog, get_supermarkets
from app.services import geo
from app.schemas.models import Assignment, ListItem, OptimizeResult, Plan, StoreSummary


def _packages(quantity: float, package_qty: float) -> int:
    return max(1, math.ceil(round(quantity / package_qty, 6)))


def _line(item: ListItem, sid: str) -> Assignment:
    offer = get_catalog()[item.name][sid]
    packs = _packages(item.quantity, offer["package_qty"])
    return Assignment(
        item=item.name, quantity=item.quantity, unit=item.unit,
        supermarket_id=sid, supermarket_name=get_supermarkets()[sid]["name"],
        product_name=offer["product_name"], packages=packs,
        unit_price=offer["price_eur"], line_total=round(packs * offer["price_eur"], 2),
    )


def _build_plan(assignments: list[Assignment], include_travel: bool, stores: dict) -> Plan:
    used = sorted({a.supermarket_id for a in assignments}, key=lambda s: stores[s]["distance_km"])
    summaries = []
    for sid in used:
        lines = [a for a in assignments if a.supermarket_id == sid]
        s = stores[sid]
        summaries.append(StoreSummary(
            supermarket_id=sid, name=s["name"], address=s["address"], distance_km=s["distance_km"],
            travel_cost=s["travel_cost_eur"] if include_travel else 0.0,
            subtotal=round(sum(a.line_total for a in lines), 2), items=[a.item for a in lines],
        ))
    products = round(sum(a.line_total for a in assignments), 2)
    travel = round(sum(s.travel_cost for s in summaries), 2)
    return Plan(products_cost=products, travel_cost=travel, total_cost=round(products + travel, 2),
                stores=summaries, assignments=assignments)


def _merge_duplicates(items: list[ListItem]) -> list[ListItem]:
    merged: dict[str, ListItem] = {}
    for it in items:
        if it.name in merged:
            merged[it.name].quantity += it.quantity
        else:
            merged[it.name] = it.model_copy()
    return list(merged.values())


def _candidate_stores(supermarket_ids: Optional[list[str]], location: Optional[dict]) -> dict:
    """Supermercados que puede usar el optimizador.

    - supermarket_ids: los que ha elegido el usuario (None = todos).
    - location: {"lat", "lon"} del usuario; si se da, distancia y coste de desplazamiento
      se calculan desde ahí en vez de usar los valores fijos del CSV.
    """
    stores = {sid: dict(s) for sid, s in get_supermarkets().items()
              if not supermarket_ids or sid in supermarket_ids}
    if location:
        for s in stores.values():
            d = round(geo.haversine_km((location["lat"], location["lon"]), (s["lat"], s["lon"])), 2)
            s["distance_km"], s["travel_cost_eur"] = d, geo.travel_cost(d)
    return stores


def optimize(items: list[ListItem], max_stores: int = 2, budget: Optional[float] = None,
             include_travel: bool = True, supermarket_ids: Optional[list[str]] = None,
             location: Optional[dict] = None) -> OptimizeResult:
    stores = _candidate_stores(supermarket_ids, location)
    # Ofertas solo de los supermercados elegidos
    catalog = {name: {s: o for s, o in offers.items() if s in stores} for name, offers in get_catalog().items()}
    catalog = {name: offers for name, offers in catalog.items() if offers}
    items = _merge_duplicates(items)
    available = [it for it in items if it.name in catalog]
    unavailable = [it.name for it in items if it.name not in catalog]

    if not available:
        return OptimizeResult(optimized=None, best_single_store=None, net_saving=None, budget=budget,
                              within_budget=None, remaining_budget=None, unavailable_items=unavailable)

    travel = {s: (stores[s]["travel_cost_eur"] if include_travel else 0.0) for s in stores}
    cost = {(it.name, s): _line(it, s).line_total for it in available for s in catalog[it.name]}

    prob = pulp.LpProblem("olivia_basket", pulp.LpMinimize)
    x = {k: pulp.LpVariable(f"x_{i}_{k[1]}", cat="Binary") for i, k in enumerate(cost)}
    y = {s: pulp.LpVariable(f"y_{s}", cat="Binary") for s in stores}
    prob += pulp.lpSum(cost[k] * x[k] for k in cost) + pulp.lpSum(travel[s] * y[s] for s in stores)
    for it in available:
        prob += pulp.lpSum(x[(it.name, s)] for s in catalog[it.name]) == 1
    for (name, s), var in x.items():
        prob += var <= y[s]
    prob += pulp.lpSum(y.values()) <= max_stores
    prob.solve(pulp.PULP_CBC_CMD(msg=False, timeLimit=10))

    optimized = None
    if pulp.LpStatus[prob.status] == "Optimal":
        chosen = [_line(it, s) for it in available for s in catalog[it.name] if x[(it.name, s)].value() > 0.5]
        optimized = _build_plan(chosen, include_travel, stores)
    else:
        # p. ej. max_stores=1 y ningún súper tiene todos los productos
        unavailable_msg = "No hay combinación posible con ese número de supermercados"
        unavailable = unavailable + [unavailable_msg]

    # Referencia: el mejor supermercado único que tenga TODOS los productos
    single = None
    for s in stores:
        if all(s in catalog[it.name] for it in available):
            plan = _build_plan([_line(it, s) for it in available], include_travel, stores)
            if single is None or plan.total_cost < single.total_cost:
                single = plan

    saving = round(single.total_cost - optimized.total_cost, 2) if (single and optimized) else None
    within = remaining = None
    if budget is not None and optimized:
        remaining = round(budget - optimized.total_cost, 2)
        within = remaining >= 0

    return OptimizeResult(optimized=optimized, best_single_store=single, net_saving=saving, budget=budget,
                          within_budget=within, remaining_budget=remaining, unavailable_items=unavailable)
