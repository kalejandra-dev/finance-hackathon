"""Voz con ElevenLabs: speech-to-text y text-to-speech.

⚠️ SIN PROBAR todavía: revisad los endpoints, modelos y voice_id en la documentación
actual de ElevenLabs (https://elevenlabs.io/docs) antes de la demo.
"""
import os

import httpx

BASE_URL = "https://api.elevenlabs.io/v1"
STT_MODEL = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v1")
TTS_MODEL = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")


def _headers() -> dict:
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("Falta ELEVENLABS_API_KEY en el .env")
    return {"xi-api-key": key}


def transcribe(audio: bytes, filename: str = "audio.webm") -> str:
    r = httpx.post(f"{BASE_URL}/speech-to-text", headers=_headers(),
                   data={"model_id": STT_MODEL, "language_code": "es"},
                   files={"file": (filename, audio)}, timeout=60)
    r.raise_for_status()
    return r.json().get("text", "")


def speak(text: str) -> bytes:
    if not VOICE_ID:
        raise RuntimeError("Falta ELEVENLABS_VOICE_ID en el .env")
    r = httpx.post(f"{BASE_URL}/text-to-speech/{VOICE_ID}", headers=_headers(),
                   json={"text": text, "model_id": TTS_MODEL}, timeout=60)
    r.raise_for_status()
    return r.content  # audio/mpeg
