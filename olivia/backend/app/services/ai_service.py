"""Servicio de IA: interpreta peticiones en lenguaje natural con Claude (API de Anthropic).

- Usa *tool use* con `tool_choice` forzado para que la respuesta SIEMPRE sea un JSON
  que cumple el esquema, y después se valida con Pydantic (AIResult).
- Los nombres de producto válidos se pasan como `enum`, así la IA solo puede usar
  productos que existen en el catálogo (lo que no exista va a `not_in_catalog`).
- Si no hay ANTHROPIC_API_KEY (o OLIVIA_AI_MOCK=1) devuelve una respuesta simulada,
  para que el frontend pueda desarrollarse sin gastar créditos.
"""
import json
import os

from app.database.catalog import catalog_units
from app.schemas.models import AIResult, InterpretRequest

MODEL = os.getenv("OLIVIA_MODEL", "claude-sonnet-5-5")

SYSTEM_PROMPT = """Eres OlivIA, un asistente inteligente especializado en planificación de compras de alimentación, recetas y ahorro doméstico.

Tu objetivo es ayudar a los usuarios a organizar sus compras de manera económica, eficiente y personalizada.

Puedes:
- Crear recetas según las preferencias del usuario y el número de personas.
- Generar listas de ingredientes con cantidades.
- Crear listas de la compra a partir de recetas o peticiones directas.
- Añadir, eliminar y sustituir productos cuando el usuario lo solicite.
- Interpretar presupuestos y restricciones (presupuesto máximo, número máximo de supermercados).

Reglas:
- No inventes precios, disponibilidad, descuentos ni distancias: los proporciona la aplicación.
- No calcules cuál es el supermercado más barato: eso lo hace el optimizador.
- Usa SOLO nombres de producto del catálogo y SU unidad (g, ml o unidad). Convierte cantidades a esa unidad
  (p. ej. 1 L -> 1000 ml, medio kilo -> 500 g). Si algo no existe en el catálogo, ponlo en not_in_catalog
  y menciónalo en reply; si hay un sustituto razonable en el catálogo, propónlo en reply sin añadirlo por tu cuenta.
- Si te dan una lista actual y el usuario pide un cambio, devuelve la lista COMPLETA ya modificada
  (intent=modify_list) y explica el cambio en reply. Nunca cambies la lista sin decirlo.
- Si falta información imprescindible (p. ej. para cuántas personas), pregunta brevemente (requires_clarification=true).
- reply: 1-2 frases, cercanas, claras y sin tecnicismos (se leerán también en voz alta).
- No presiones al usuario para comprar más.

Catálogo disponible (producto [unidad]):
{catalog}
"""


def _tool_schema(product_names: list[str]) -> dict:
    return {
        "name": "olivia_response",
        "description": "Devuelve la interpretación estructurada de la petición del usuario.",
        "input_schema": {
            "type": "object",
            "properties": {
                "intent": {"type": "string",
                           "enum": ["create_shopping_list", "modify_list", "ask_clarification", "other"]},
                "reply": {"type": "string", "description": "Mensaje breve para el usuario"},
                "recipe": {"type": ["object", "null"],
                           "properties": {"name": {"type": "string"}, "servings": {"type": "integer"}}},
                "budget": {"type": ["number", "null"], "description": "Presupuesto en euros si se indica"},
                "max_stores": {"type": ["integer", "null"]},
                "items": {"type": "array", "items": {
                    "type": "object",
                    "properties": {"name": {"type": "string", "enum": product_names},
                                   "quantity": {"type": "number"},
                                   "unit": {"type": "string", "enum": ["g", "ml", "unidad"]}},
                    "required": ["name", "quantity", "unit"]}},
                "not_in_catalog": {"type": "array", "items": {"type": "string"}},
                "preferences": {"type": "array", "items": {"type": "string"}},
                "requires_clarification": {"type": "boolean"},
            },
            "required": ["intent", "reply", "items", "requires_clarification"],
        },
    }


def _user_message(req: InterpretRequest) -> str:
    parts = [f"Petición del usuario: {req.text}"]
    if req.current_items:
        parts.append("Lista actual: " + json.dumps([i.model_dump() for i in req.current_items], ensure_ascii=False))
    if req.budget is not None:
        parts.append(f"Presupuesto actual: {req.budget} €")
    if req.max_stores is not None:
        parts.append(f"Máximo de supermercados actual: {req.max_stores}")
    return "\n".join(parts)


def _fix_units(result: AIResult) -> AIResult:
    """Fuerza la unidad del catálogo por si el modelo se equivoca."""
    units = catalog_units()
    for it in result.items:
        it.unit = units.get(it.name, it.unit)
    return result


def _mock(req: InterpretRequest) -> AIResult:
    return AIResult(
        intent="create_shopping_list",
        reply="(Modo demo sin IA) Te propongo los ingredientes de una paella para 4 personas.",
        recipe={"name": "Paella", "servings": 4},
        budget=req.budget or 35.0, max_stores=req.max_stores or 2,
        items=[
            {"name": "arroz", "quantity": 400, "unit": "g"},
            {"name": "gambas", "quantity": 300, "unit": "g"},
            {"name": "mejillones", "quantity": 500, "unit": "g"},
            {"name": "caldo de pescado", "quantity": 1200, "unit": "ml"},
            {"name": "pimiento rojo", "quantity": 200, "unit": "g"},
            {"name": "tomate triturado", "quantity": 200, "unit": "g"},
            {"name": "ajo", "quantity": 1, "unit": "unidad"},
            {"name": "azafrán", "quantity": 1, "unit": "g"},
            {"name": "aceite de oliva", "quantity": 60, "unit": "ml"},
        ],
        requires_clarification=False,
    )


def interpret(req: InterpretRequest) -> AIResult:
    if os.getenv("OLIVIA_AI_MOCK") == "1" or not os.getenv("ANTHROPIC_API_KEY"):
        return _mock(req)

    import anthropic  # import aquí para que los tests en modo mock no lo necesiten

    units = catalog_units()
    catalog_txt = "\n".join(f"- {name} [{unit}]" for name, unit in sorted(units.items()))
    tool = _tool_schema(sorted(units))

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        system=SYSTEM_PROMPT.format(catalog=catalog_txt),
        tools=[tool],
        tool_choice={"type": "tool", "name": tool["name"]},
        messages=[{"role": "user", "content": _user_message(req)}],
    )
    tool_use = next(block for block in response.content if block.type == "tool_use")
    return _fix_units(AIResult.model_validate(tool_use.input))
