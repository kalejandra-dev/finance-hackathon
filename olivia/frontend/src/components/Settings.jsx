import { stopSpeaking } from "../services/voice.js";

const SIZES = [1, 1.15, 1.3, 1.5];

/** Botones de accesibilidad de la cabecera: tamaño de texto (A− / % / A+), alto contraste y voz automática. */
export default function Settings({ settings, setSettings }) {
  const set = (patch) => setSettings({ ...settings, ...patch });
  const idx = Math.max(0, SIZES.indexOf(settings.scale));
  const pct = Math.round(SIZES[idx] * 100);
  const zoomed = idx > 0;

  return (
    <div className="header-tools">
      <div className="text-size" role="group" aria-label={`Tamaño del texto: ${pct} %`}>
        <button className="header-settings" onClick={() => set({ scale: SIZES[idx - 1] })} disabled={idx === 0}
          aria-label="Reducir el tamaño del texto" title="Reducir texto">A−</button>
        <button className={zoomed ? "size-reset zoomed" : "size-reset"} onClick={() => set({ scale: 1 })} disabled={!zoomed}
          aria-label={zoomed ? `Texto al ${pct} %. Pulsa para volver al tamaño normal` : "Texto a tamaño normal"}
          title={zoomed ? "Volver al tamaño normal" : "Tamaño normal"}>{pct}%</button>
        <button className="header-settings" onClick={() => set({ scale: SIZES[idx + 1] })} disabled={idx === SIZES.length - 1}
          aria-label="Aumentar el tamaño del texto" title="Aumentar texto">A+</button>
      </div>
      <button className="header-settings" aria-pressed={settings.contrast} onClick={() => set({ contrast: !settings.contrast })}
        aria-label="Alto contraste" title={settings.contrast ? "Desactivar alto contraste" : "Activar alto contraste"}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 2a8 8 0 0 1 0 16Z" fill="currentColor" />
        </svg>
      </button>
      <button className="header-settings" aria-pressed={settings.autoVoice} onClick={() => { if (settings.autoVoice) stopSpeaking(); set({ autoVoice: !settings.autoVoice }); }}
        aria-label={settings.autoVoice ? "Voz activada" : "Voz desactivada"} title="Leer respuestas en voz alta">
        <span aria-hidden="true">{settings.autoVoice ? "🔊" : "🔇"}</span>
      </button>
    </div>
  );
}
