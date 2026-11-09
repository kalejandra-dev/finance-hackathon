"""Prueba ai_service.interpret con un cliente de Anthropic simulado (sin gastar créditos)."""
import os
from types import SimpleNamespace as NS

import anthropic

from app.database.catalog import init_db
from app.schemas.models import InterpretRequest
from app.services import ai_service

os.environ["OLIVIA_DB"] = "/tmp/olivia_test.db"


class FakeClient:
    def __init__(self, content):
        self.kwargs = None
        self.messages = NS(create=self._create)
        self._content = content

    def _create(self, **kwargs):
        self.kwargs = kwargs
        return NS(content=self._content)


def _run(monkeypatch, content):
    init_db()
    fake = FakeClient(content)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.delenv("OLIVIA_AI_MOCK", raising=False)
    monkeypatch.setattr(anthropic, "Anthropic", lambda: fake)
    return ai_service.interpret(InterpretRequest(text="carbonara para 2")), fake


def test_tool_use_response(monkeypatch):
    block = NS(type="tool_use", input={
        "intent": "create_shopping_list", "reply": "Aquí tienes la lista.",
        "items": [{"name": "pasta", "quantity": 200, "unit": "unidad"}],  # unidad mal a propósito
        "requires_clarification": False})
    result, fake = _run(monkeypatch, [NS(type="text", text="..."), block])
    assert fake.kwargs["tool_choice"] == {"type": "auto"}
    assert result.items[0].unit == "g"  # corregida con la unidad del catálogo


def test_text_only_fallback(monkeypatch):
    result, _ = _run(monkeypatch, [NS(type="text", text="¿Para cuántas personas?")])
    assert result.requires_clarification and "personas" in result.reply