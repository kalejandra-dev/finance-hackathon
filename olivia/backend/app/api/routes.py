from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.database import catalog
from app.schemas.models import AIResult, InterpretRequest, ListItem, OptimizeRequest, OptimizeResult
from app.services import ai_service, optimizer, voice_service

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

@router.post("/ai/interpret", response_model=AIResult)
def interpret(req: InterpretRequest):
    try:
        return ai_service.interpret(req)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Error del servicio de IA: {type(e).__name__}")
    
@router.post("/voice/transcribe")
async def transcribe(file: UploadFile = File(...)):
    audio = await file.read()
    print(f"[voz] recibido {file.filename}, {len(audio)} bytes")
    try:
        return {"text": voice_service.transcribe(audio, file.filename or "audio.webm")}
    except Exception as e:
        import traceback
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
    result = optimizer.optimize(req.items, req.max_stores, req.budget, req.include_travel)
    result.id = catalog.save("results", result.model_dump())
    return result


@router.get("/results/{result_id}", response_model=OptimizeResult)
def get_result(result_id: int):
    data = catalog.load("results", result_id)
    if data is None:
        raise HTTPException(404, "Resultado no encontrado")
    return {**data, "id": result_id}


@router.post("/voice/transcribe")
async def transcribe(file: UploadFile = File(...)):
    try:
        return {"text": voice_service.transcribe(await file.read(), file.filename or "audio.webm")}
    except Exception as e:
        raise HTTPException(502, f"Error de voz: {e}")


class SpeakRequest(BaseModel):
    text: str


@router.post("/voice/speak")
def speak(req: SpeakRequest):
    try:
        return Response(content=voice_service.speak(req.text), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(502, f"Error de voz: {e}")
