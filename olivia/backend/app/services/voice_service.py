"""Voz con ElevenLabs (SDK oficial de Python): speech-to-text y text-to-speech.

La API key NO va en el código: el SDK lee ELEVENLABS_API_KEY del entorno
(app/main.py carga .env y .env.local al arrancar).
"""
import os
from functools import lru_cache
from io import BytesIO

from elevenlabs import ElevenLabs

STT_MODEL = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2")
# eleven_flash_v2_5: el modelo de menor latencia de ElevenLabs (~75 ms), en español
TTS_MODEL = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
# Voz por defecto: Sarah (multilingüe). Cambiadla en .env con ELEVENLABS_VOICE_ID.
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID") or "EXAVITQu4vr4xnSDxMaL"
LANGUAGE = "es"


@lru_cache
def _client() -> ElevenLabs:
    return ElevenLabs()  # lee ELEVENLABS_API_KEY del entorno


def transcribe(audio: bytes, filename: str = "audio.webm") -> str:
    """Audio del micrófono -> texto (Scribe v2)."""
    file = BytesIO(audio)
    file.name = filename  # ayuda a identificar el formato (webm en Chrome, mp4 en Safari)
    result = _client().speech_to_text.convert(file=file, model_id=STT_MODEL, language_code=LANGUAGE)
    return result.text.strip()


def speak(text: str) -> bytes:
    """Texto -> audio MP3 para leer en voz alta las respuestas de OlivIA."""
    audio = _client().text_to_speech.convert(
        text=text,
        voice_id=VOICE_ID,
        model_id=TTS_MODEL,
        language_code=LANGUAGE,
        output_format="mp3_44100_128",
    )
    return b"".join(audio)