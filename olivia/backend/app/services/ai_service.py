"""Servicio de IA: interpreta peticiones en lenguaje natural con Claude (API de Anthropic).

- Usa *tool use* con `strict: true` para que la respuesta sea un JSON que cumple el
  esquema, y después se valida con Pydantic (AIResult). Sonnet 5.5 no admite forzar la
  herramienta (`tool_choice` "tool"/"any" da error 400), así que se usa "auto" y el
  system prompt le pide usarla siempre.
- Se envía el historial reciente del chat para que entienda respuestas cortas («4», «sí»).
- `effort` bajo (configurable con OLIVIA_EFFORT) para que responda rápido.
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
EFFORT = os.getenv("OLIVIA_EFFORT", "low")  # low | medium | high
MAX_TOKENS = 8000
MAX_HISTORY_TURNS = 10

SYSTEM_PROMPT = """Eres OlivIA, un asistente inteligente especializado en planificación de compras de alimentación, recetas y ahorro doméstico.

Tu objetivo es ayudar a los usuarios a organizar sus compras de manera económica, eficiente y personalizada.

Puedes:
- Crear recetas según las preferencias del usuario y el número de personas.
- Generar listas de ingredientes con cantidades.
- Crear listas de la compra a partir de recetas o peticiones directas.
- Añadir, eliminar y sustituir productos cuando el usuario lo solicite.
- Interpretar presupuestos y restricciones (presupuesto máximo, número máximo de supermercados).

Reglas:
- Responde SIEMPRE llamando a la herramienta olivia_response, nunca solo con texto.
- No inventes precios, disponibilidad, descuentos ni distancias: los proporciona la aplicación.
- No calcules cuál es el supermercado más barato: eso lo hace el optimizador.
- Usa SOLO nombres de producto del catálogo y SU unidad (g, ml o unidad). Convierte cantidades a esa unidad
  (p. ej. 1 L -> 1000 ml, medio kilo -> 500 g). Si algo no existe en el catálogo, ponlo en not_in_catalog
  y menciónalo en reply; si hay un sustituto razonable en el catálogo, propónlo en reply sin añadirlo por tu cuenta.
- Al crear una receta, elige tú los ingredientes del catálogo y NO menciones los que has decidido no usar
  (p. ej. no digas «chorizo no, que no está en el catálogo»). Usa not_in_catalog solo para productos que el
  usuario ha pedido expresamente, o para un ingrediente imprescindible de la receta que falte.
- Si te dan una lista actual y el usuario pide un cambio, devuelve la lista COMPLETA ya modificada
  (intent=modify_list) y explica el cambio en reply. Nunca cambies la lista sin decirlo.
- Si falta información imprescindible (p. ej. para cuántas personas), pregunta brevemente (requires_clarification=true).
- Recibes el historial reciente de la conversación: úsalo para entender respuestas cortas como «4» o «sí»
  (p. ej. si preguntaste para cuántas personas y responde «4», completa la petición anterior para 4 personas).
- La «Lista actual» que envía la aplicación es la fuente de verdad: el usuario puede haberla editado a mano.
- Rellena budget, max_stores y recipe solo si el usuario los indica o cambian; si no, usa null.
- reply: 1-2 frases, cercanas, claras y sin tecnicismos (se leerán también en voz alta).
- No presiones al usuario para comprar más.

Catálogo disponible (producto [unidad]):
{catalog}
"""


def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def _tool_schema(product_names: list[str]) -> dict:
    # strict: true exige additionalProperties=false en cada objeto y todos los campos en "required"
    # (los opcionales se expresan como "valor o null").
    properties = {
        "intent": {"type": "string",
                   "enum": ["create_shopping_list", "modify_list", "ask_clarification", "other"]},
        "reply": {"type": "string", "description": "Mensaje breve para el usuario"},
        "recipe": _nullable({
            "type": "object",
            "properties": {"name": {"type": "string"}, "servings": {"type": "integer"}},
            "required": ["name", "servings"],
            "additionalProperties": False,
        }),
        "budget": _nullable({"type": "number", "description": "Presupuesto en euros si se indica"}),
        "max_stores": _nullable({"type": "integer"}),
        "items": {"type": "array", "items": {
            "type": "object",
            "properties": {"name": {"type": "string", "enum": product_names},
                           "quantity": {"type": "number"},
                           "unit": {"type": "string", "enum": ["g", "ml", "unidad"]}},
            "required": ["name", "quantity", "unit"],
            "additionalProperties": False}},
        "not_in_catalog": {"type": "array", "items": {"type": "string"}},
        "preferences": {"type": "array", "items": {"type": "string"}},
        "requires_clarification": {"type": "boolean"},
    }
    return {
        "name": "olivia_response",
        "description": "Devuelve la interpretación estructurada de la petición del usuario.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": properties,
            "required": list(properties),
            "additionalProperties": False,
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


def _messages(req: InterpretRequest) -> list[dict]:
    """Historial reciente + petición actual (con la lista y restricciones actuales)."""
    turns = req.history[-MAX_HISTORY_TURNS:]
    while turns and turns[0].role == "assistant":  # la API exige que el primer mensaje sea del usuario
        turns = turns[1:]
    messages = [{"role": t.role, "content": t.text} for t in turns]
    messages.append({"role": "user", "content": _user_message(req)})
    return messages


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
        max_tokens=MAX_TOKENS,
        output_config={"effort": EFFORT},
        system=SYSTEM_PROMPT.format(catalog=catalog_txt),
        tools=[tool],
        # Este modelo no admite forzar la herramienta (tool_choice "tool"/"any"),
        # así que usamos "auto" y el system prompt le pide usarla siempre.
        tool_choice={"type": "auto"},
        messages=_messages(req),
    )
    if response.stop_reason in ("max_tokens", "refusal"):
        # Respuesta cortada o rechazada: no usamos un JSON que puede estar incompleto
        return AIResult(intent="other", reply="No he podido completar la respuesta. ¿Puedes repetirlo de otra forma?",
                        items=req.current_items, requires_clarification=True)
    tool_use = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_use is None:
        # Red de seguridad: si contesta solo con texto, no rompemos la app
        text = " ".join(b.text for b in response.content if b.type == "text").strip()
        return AIResult(intent="other", reply=text or "¿Puedes repetirlo de otra forma?",
                        items=req.current_items, requires_clarification=True)
    return _fix_units(AIResult.model_validate(tool_use.input))