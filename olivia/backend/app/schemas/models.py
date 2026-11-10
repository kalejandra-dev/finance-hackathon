"""Contratos de datos (Pydantic) compartidos por la API, la IA y el optimizador."""
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ListItem(BaseModel):
    name: str = Field(..., description="Nombre del producto tal como aparece en el catálogo")
    quantity: float = Field(..., gt=0)
    unit: str


class Recipe(BaseModel):
    name: str
    servings: int = Field(..., ge=1)


class AIResult(BaseModel):
    """Salida estructurada de OlivIA (sección 2.5 del documento del proyecto)."""
    intent: Literal["create_shopping_list", "modify_list", "ask_clarification", "other"]
    reply: str = Field(..., description="Mensaje corto para mostrar/leer al usuario")
    recipe: Optional[Recipe] = None
    budget: Optional[float] = None
    max_stores: Optional[int] = None
    items: list[ListItem] = []
    not_in_catalog: list[str] = []
    preferences: list[str] = []
    requires_clarification: bool = False


class ChatTurn(BaseModel):
    """Un mensaje anterior del chat (para que la IA entienda respuestas cortas como «4»)."""
    role: Literal["user", "assistant"]
    text: str = Field(..., min_length=1, max_length=2000)


class InterpretRequest(BaseModel):
    text: str = Field(..., min_length=1)
    history: list[ChatTurn] = []  # conversación previa, del más antiguo al más reciente
    current_items: list[ListItem] = []  # lista actual, para poder editarla por voz/texto
    budget: Optional[float] = None
    max_stores: Optional[int] = None


class OptimizeRequest(BaseModel):
    items: list[ListItem] = Field(..., min_length=1)
    max_stores: int = Field(2, ge=1, le=3)
    budget: Optional[float] = None
    include_travel: bool = True


class Assignment(BaseModel):
    item: str
    quantity: float
    unit: str
    supermarket_id: str
    supermarket_name: str
    product_name: str
    packages: int
    unit_price: float
    line_total: float


class StoreSummary(BaseModel):
    supermarket_id: str
    name: str
    address: str
    distance_km: float
    travel_cost: float
    subtotal: float
    items: list[str]


class Plan(BaseModel):
    products_cost: float
    travel_cost: float
    total_cost: float
    stores: list[StoreSummary]
    assignments: list[Assignment]


class PurchaseStore(BaseModel):
    name: str
    subtotal: float


class Purchase(BaseModel):
    """Compra confirmada por el usuario (resumen guardado en el historial)."""
    id: int
    result_id: int
    confirmed_at: str  # UTC, formato SQLite «AAAA-MM-DD HH:MM:SS»
    budget: Optional[float]
    products_cost: float
    travel_cost: float
    total_cost: float
    net_saving: Optional[float]
    stores: list[PurchaseStore]
    n_items: int


class PurchaseHistory(BaseModel):
    purchases: list[Purchase]
    count: int
    total_spent: float
    total_saved: float


class OptimizeResult(BaseModel):
    id: Optional[int] = None
    optimized: Optional[Plan]
    best_single_store: Optional[Plan]  # None si ningún súper tiene todo
    net_saving: Optional[float]
    budget: Optional[float]
    within_budget: Optional[bool]
    remaining_budget: Optional[float]
    unavailable_items: list[str]
    demo_data: bool = True
