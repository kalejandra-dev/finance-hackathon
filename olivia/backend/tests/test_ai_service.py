"""Prueba ai_service.interpret con un cliente de Anthropic simulado (sin gastar créditos)."""
import os
from types import SimpleNamespace as NS

import anthropic

from app.database.catalog import init_db
from app.schemas.models import InterpretRequest
from app.services import ai_service

os.environ["OLIVIA_DB"] = "/tmp/olivia_test.db"


class FakeClient:
    def __init__(self, content, stop_reason):
        self.kwargs = None
        self.messages = NS(create=self._create)
        self._content = content
        self._stop_reason = stop_reason

    def _create(self, **kwargs):
        self.kwargs = kwargs
        return NS(content=self._content, stop_reason=self._stop_reason)


def _run(monkeypatch, content, stop_reason="tool_use", req=None):
    init_db()
    fake = FakeClient(content, stop_reason)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.delenv("OLIVIA_AI_MOCK", raising=False)
    monkeypatch.setattr(anthropic, "Anthropic", lambda: fake)
    return ai_service.interpret(req or InterpretRequest(text="carbonara para 2")), fake


def _tool_block(**overrides):
    data = {"intent": "create_shopping_list", "reply": "Aquí tienes la lista.",
            "items": [{"name": "pasta", "quantity": 200, "unit": "g"}],
            "requires_clarification": False}
    data.update(overrides)
    return NS(type="tool_use", input=data)


def test_tool_use_response(monkeypatch):
    block = _tool_block(items=[{"name": "pasta", "quantity": 200, "unit": "unidad"}])  # unidad mal a propósito
    result, fake = _run(monkeypatch, [NS(type="text", text="..."), block])
    assert fake.kwargs["tool_choice"] == {"type": "auto"}
    assert result.items[0].unit == "g"  # corregida con la unidad del catálogo


def test_text_only_fallback(monkeypatch):
    result, _ = _run(monkeypatch, [NS(type="text", text="¿Para cuántas personas?")], stop_reason="end_turn")
    assert result.requires_clarification and "personas" in result.reply


def test_sends_effort_and_enough_tokens(monkeypatch):
    _, fake = _run(monkeypatch, [_tool_block()])
    assert fake.kwargs["output_config"] == {"effort": ai_service.EFFORT}
    assert fake.kwargs["max_tokens"] >= 4000


def test_history_is_sent_in_order(monkeypatch):
    req = InterpretRequest(text="4", history=[
        {"role": "assistant", "text": "¡Hola! Soy OlivIA."},  # empieza por assistant: se descarta
        {"role": "user", "text": "Quiero hacer lentejas"},
        {"role": "assistant", "text": "¿Para cuántas personas?"},
    ])
    _, fake = _run(monkeypatch, [_tool_block()], req=req)
    msgs = fake.kwargs["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant", "user"]
    assert msgs[0]["content"] == "Quiero hacer lentejas"
    assert msgs[1]["content"] == "¿Para cuántas personas?"
    assert "Petición del usuario: 4" in msgs[2]["content"]


def test_history_is_truncated(monkeypatch):
    history = [{"role": "user" if i % 2 == 0 else "assistant", "text": f"mensaje {i}"} for i in range(30)]
    _, fake = _run(monkeypatch, [_tool_block()], req=InterpretRequest(text="hola", history=history))
    assert len(fake.kwargs["messages"]) <= ai_service.MAX_HISTORY_TURNS + 1
    assert fake.kwargs["messages"][0]["role"] == "user"


def test_tool_schema_is_strict():
    tool = ai_service._tool_schema(["arroz", "leche"])
    assert tool["strict"] is True

    def check(schema):
        if isinstance(schema, dict):
            if schema.get("type") == "object":
                assert schema.get("additionalProperties") is False
                assert set(schema["required"]) == set(schema["properties"])
            for v in schema.values():
                check(v)
        elif isinstance(schema, list):
            for v in schema:
                check(v)

    check(tool["input_schema"])


def test_truncated_response_falls_back(monkeypatch):
    req = InterpretRequest(text="paella", current_items=[{"name": "arroz", "quantity": 400, "unit": "g"}])
    result, _ = _run(monkeypatch, [_tool_block(items=[])], stop_reason="max_tokens", req=req)
    assert result.intent == "other" and result.requires_clarification
    assert result.items[0].name == "arroz"  # se conserva la lista actual
