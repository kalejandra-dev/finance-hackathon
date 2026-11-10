"""Endpoints de «Mi presupuesto»: confirmar compras y consultar el historial."""
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.database import catalog, purchases
from app.schemas.models import Purchase, PurchaseHistory

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


class ConfirmRequest(BaseModel):
    result_id: int


@router.post("", response_model=Purchase)
def confirm_purchase(body: ConfirmRequest):
    result = catalog.load("results", body.result_id)
    if result is None:
        raise HTTPException(404, "Resultado no encontrado")
    if not result.get("optimized"):
        raise HTTPException(422, "Este resultado no tiene una compra que se pueda confirmar")
    return purchases.confirm(body.result_id, result)


@router.get("", response_model=PurchaseHistory)
def purchase_history():
    items = purchases.list_all()
    return PurchaseHistory(
        purchases=items,
        count=len(items),
        total_spent=round(sum(p["total_cost"] for p in items), 2),
        total_saved=round(sum(p["net_saving"] or 0 for p in items), 2),
    )


@router.delete("/{purchase_id}", status_code=204)
def delete_purchase(purchase_id: int):
    if not purchases.delete(purchase_id):
        raise HTTPException(404, "Compra no encontrada")
    return Response(status_code=204)
