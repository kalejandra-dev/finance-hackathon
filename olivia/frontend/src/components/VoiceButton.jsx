import { useRef, useState } from "react";
import { api } from "../services/api.js";

/** Graba audio con el micrófono y lo transcribe con ElevenLabs (vía backend). */
export default function VoiceButton({ onText, disabled }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef(null);

  async function toggle() {
    setError("");
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        try {
          // Chrome graba en webm y Safari en mp4
          const type = rec.mimeType || "audio/webm";
          const filename = type.includes("mp4") ? "audio.mp4" : "audio.webm";
          onText(await api.transcribe(new Blob(chunks, { type }), filename));
        } catch (e) {
          setError(e.message);
        }
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("No se pudo acceder al micrófono. Puedes escribir tu petición.");
    }
  }

  return (
    <>
      <button type="button" className={recording ? "btn mic recording" : "btn mic"} onClick={toggle}
        disabled={disabled} aria-pressed={recording}
        aria-label={recording ? "Detener grabación" : "Hablar con OlivIA"}>
        {recording ? "⏹ Parar" : "🎤 Hablar"}
      </button>
      {error && <p role="alert" className="error">{error}</p>}
    </>
  );
}
