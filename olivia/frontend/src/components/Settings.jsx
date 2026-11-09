/** Barra de accesibilidad: tamaño de texto, alto contraste y voz automática. */
export default function Settings({ settings, setSettings }) {
  const set = (patch) => setSettings({ ...settings, ...patch });
  const sizes = [1, 1.15, 1.3];
  const idx = sizes.indexOf(settings.scale);

  return (
    <div className="settings" role="group" aria-label="Accesibilidad">
      <button className="chip" onClick={() => set({ scale: sizes[Math.max(0, idx - 1)] })}
        disabled={idx <= 0} aria-label="Reducir tamaño del texto">A−</button>
      <button className="chip" onClick={() => set({ scale: sizes[Math.min(sizes.length - 1, idx + 1)] })}
        disabled={idx >= sizes.length - 1} aria-label="Aumentar tamaño del texto">A+</button>
      <button className="chip" aria-pressed={settings.contrast} onClick={() => set({ contrast: !settings.contrast })}>
        Alto contraste
      </button>
      <button className="chip" aria-pressed={settings.autoVoice} onClick={() => set({ autoVoice: !settings.autoVoice })}>
        {settings.autoVoice ? "🔊 Voz activada" : "🔇 Voz desactivada"}
      </button>
    </div>
  );
}
