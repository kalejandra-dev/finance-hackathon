import traceback
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.database import catalog
from app.schemas.models import AIResult, InterpretRequest, ListItem, OptimizeRequest, OptimizeResult, RouteRequest
from app.services import ai_service, geo, optimizer, voice_service

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/products")
def products():
    return catalog.get_catalog()


@router.get("/supermarkets")
def supermarkets():
    return list(catalog.get_supermarkets().values())

@router.get("/location/demo")
def demo_location():
    return geo.DEMO_LOCATION


@router.get("/supermarkets/nearby")
def nearby(lat: float, lon: float, limit: int = 5):
    return geo.nearby_supermarkets(lat, lon, limit)


@router.get("/geocode")
def geocode(q: str):
    try:
        found = geo.geocode(q)
    except Exception:
        traceback.print_exc()
        raise HTTPException(502, "No se pudo buscar la dirección. Prueba con «Usar mi ubicación».")
    if not found:
        raise HTTPException(404, "No he encontrado esa dirección. Prueba a añadir la ciudad.")
    return found


@router.post("/route")
def route(req: RouteRequest):
    return geo.route((req.origin.lat, req.origin.lon), req.supermarket_ids)


@router.post("/ai/interpret", response_model=AIResult)
def interpret(req: InterpretRequest):
    try:
        return ai_service.interpret(req)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Error del servicio de IA: {type(e).__name__}")
    
@router.post("/voice/transcribe")
async def transcribe(file: UploadFile = File(...)):
    audio = await file.read()
    print(f"[voz] recibido {file.filename}, {len(audio)} bytes")
    try:
        return {"text": voice_service.transcribe(audio, file.filename or "audio.webm")}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(502, f"Error de voz: {e}")

class ShoppingList(BaseModel):
    items: list[ListItem]
    budget: Optional[float] = None
    max_stores: int = 2


@router.post("/shopping-list")
def create_list(body: ShoppingList):
    return {"id": catalog.save("shopping_lists", body.model_dump()), **body.model_dump()}


@router.put("/shopping-list/{list_id}")
def update_list(list_id: int, body: ShoppingList):
    if not catalog.update("shopping_lists", list_id, body.model_dump()):
        raise HTTPException(404, "Lista no encontrada")
    return {"id": list_id, **body.model_dump()}


@router.post("/optimize", response_model=OptimizeResult)
def optimize(req: OptimizeRequest):
    result = optimizer.optimize(req.items, req.max_stores, req.budget, req.include_travel,
                                supermarket_ids=req.supermarket_ids,
                                location=req.location.model_dump() if req.location else None)
    result.id = catalog.save("results", result.model_dump())
    return result


@router.get("/results/{result_id}", response_model=OptimizeResult)
def get_result(result_id: int):
    data = catalog.load("results", result_id)
    if data is None:
        raise HTTPException(404, "Resultado no encontrado")
    return {**data, "id": result_id}


class SpeakRequest(BaseModel):
    text: str


@router.post("/voice/speak")
def speak(req: SpeakRequest):
    try:
        return Response(content=voice_service.speak(req.text), media_type="audio/mpeg")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(502, f"Error de voz: {e}")
