const SIZES = [1, 1.15, 1.3];

/** Botones de accesibilidad de la cabecera: tamaño de texto, alto contraste y voz automática. */
export default function Settings({ settings, setSettings }) {
  const set = (patch) => setSettings({ ...settings, ...patch });
  const idx = Math.max(0, SIZES.indexOf(settings.scale));
  const nextSize = SIZES[(idx + 1) % SIZES.length];
  const pct = Math.round(settings.scale * 100);

  return (
    <div className="header-tools">
      <button className="header-settings" onClick={() => set({ scale: nextSize })}
        aria-label={`Tamaño del texto: ${pct} %. Pulsa para cambiarlo`} title="Tamaño del texto">
        <span className="a-icon" aria-hidden="true">A</span>
        {pct > 100 && <span className="size-badge" aria-hidden="true">{pct}%</span>}
      </button>
      <button className="header-settings" aria-pressed={settings.contrast} onClick={() => set({ contrast: !settings.contrast })}
        aria-label="Alto contraste" title="Alto contraste">
        <span aria-hidden="true">◐</span>
      </button>
      <button className="header-settings" aria-pressed={settings.autoVoice} onClick={() => set({ autoVoice: !settings.autoVoice })}
        aria-label={settings.autoVoice ? "Voz activada" : "Voz desactivada"} title="Leer respuestas en voz alta">
        <span aria-hidden="true">{settings.autoVoice ? "🔊" : "🔇"}</span>
      </button>
    </div>
  );
}
