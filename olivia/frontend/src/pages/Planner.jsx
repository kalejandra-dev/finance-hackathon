import { useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import { onSpeakingChange, prepareSpeech, toggleSpeak } from "../services/voice.js";
import VoiceButton from "../components/VoiceButton.jsx";
import Logo from "../components/Logo.jsx";
import PageHeading from "../components/PageHeading.jsx";

const EXAMPLES = [
  ["🥘", "Paella para 4 personas, 35 €, máximo 2 supermercados"],
  ["🍝", "Pasta carbonara para 2"],
  ["🍲", "Lentejas para 3 personas con 10 €"],
  ["🛒", "Leche, huevos, pan y café"],
];

const GREETING = "¡Hola! Soy OlivIA. Dime qué quieres cocinar o comprar, tu presupuesto y cuántos supermercados quieres visitar.";

/** Chat inicial. El estado del chat vive en App para que no se pierda al cambiar de pantalla. */
export const initialChat = () => [{ from: "olivia", text: GREETING }];

export default function Planner({ items, setItems, budget, setBudget, maxStores, setMaxStores, autoVoice, onDone,
  onManual, messages, setMessages, initialPrompt, onPromptUsed }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEnd = useRef(null);
  const textarea = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, loading]);

  // El campo crece hacia abajo según el texto (hasta un máximo; luego hace scroll)
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 4}px`;
  }, [text]);

  // Si se llega desde una idea de la portada, OlivIA empieza con esa petición (una sola vez)
  const startedFromIdea = useRef(false);
  useEffect(() => {
    if (initialPrompt && !startedFromIdea.current) {
      startedFromIdea.current = true;
      onPromptUsed?.();
      send(initialPrompt);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [speakingText, setSpeakingText] = useState(null);
  useEffect(() => onSpeakingChange(setSpeakingText), []);

  // Con voz activada, primero se prepara el audio y luego se enseñan texto y voz a la vez
  // (máximo 3 s de espera: si la voz tarda más, se enseña el texto sin voz).
  const say = async (t) => {
    const start = autoVoice ? await prepareSpeech(t) : null;
    setMessages((m) => [...m, { from: "olivia", text: t }]);
    start?.();
  };

  async function send(input) {
    const value = (input ?? text).replace(/^\p{Extended_Pictographic}\s*/u, "").trim();
    if (!value) return;
    // Historial para la IA: sin el saludo inicial ni los mensajes de error
    const history = messages.slice(1)
      .filter((m) => !m.error)
      .map((m) => ({ role: m.from === "user" ? "user" : "assistant", text: m.text }));
    setMessages((m) => [...m, { from: "user", text: value }]);
    setText("");
    setLoading(true);
    try {
      const r = await api.interpret({ text: value, history, current_items: items, budget, max_stores: maxStores });
      let reply = r.reply;
      if (r.not_in_catalog?.length) reply += ` (No tengo en el catálogo: ${r.not_in_catalog.join(", ")}.)`;
      await say(reply);
      if (r.budget != null) setBudget(r.budget);
      if (r.max_stores != null) setMaxStores(r.max_stores);
      if (r.items?.length) setItems(r.items);
    } catch (e) {
      setMessages((m) => [...m, { from: "olivia", error: true, text: `Ha habido un problema: ${e.message}. Puedes intentarlo otra vez.` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-page" aria-labelledby="planner-title">
      <PageHeading id="planner-title" eyebrow="PASO 01 — PLANIFICA" title="¿Qué compramos" em="hoy?"
        desc="Cuéntale a OlivIA qué necesitas: una receta, una lista o tu presupuesto. Por texto o por voz."
        right={<span className="subtle-tag">✧ Asistente con IA</span>} />

      <div className="planner-layout">
      <div className="surface planner-card">
      <div className="card-top">
        <span className="field-icon" aria-hidden="true"><Logo size={28} /></span>
        <div><h2>Habla con OlivIA</h2><p>Tu asistente de compras</p></div>
        <span className="ai-tag">IA + VOZ</span>
      </div>

      <div className="chat" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`msg-row ${m.from}`}>
            {m.from === "olivia" && <span className="avatar" aria-hidden="true"><Logo size={22} /></span>}
            <div className={`msg ${m.from}`}>
              <span className="sr-only">{m.from === "olivia" ? "OlivIA dice:" : "Tú:"}</span>
              {m.text}
              {m.from === "olivia" && (
                <button className="link" onClick={() => toggleSpeak(m.text)}
                  aria-label={speakingText === m.text ? "Parar la lectura" : "Escuchar este mensaje"}>
                  {speakingText === m.text ? "⏹" : "🔊"}
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg-row olivia">
            <span className="avatar" aria-hidden="true"><Logo size={22} /></span>
            <div className="msg olivia typing" aria-label="OlivIA está pensando"><span /><span /><span /></div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="request" className="sr-only">Tu petición</label>
        <textarea id="request" ref={textarea} rows={1} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Mayús+Enter hace salto de línea
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
          }}
          placeholder="Escribe aquí o pulsa Hablar…" disabled={loading} autoComplete="off"
          aria-describedby="request-hint" />
        <span id="request-hint" className="sr-only">Pulsa Enter para enviar y Mayúsculas más Enter para cambiar de línea.</span>
        <button className="btn primary" type="submit" disabled={loading || !text.trim()}>Enviar</button>
        <VoiceButton onText={(t) => send(t)} disabled={loading} />
      </form>

      {items.length > 0 && (
        <div className="inline-feedback">
          <p>
            ✓ <strong>{items.length} productos</strong> en tu lista
            {budget != null && <> · Presupuesto <strong>{budget} €</strong></>}
            {" "}· Máx. <strong>{maxStores}</strong> {maxStores === 1 ? "supermercado" : "supermercados"}
          </p>
          <button className="btn primary" onClick={onDone}>Revisar mi lista →</button>
        </div>
      )}
      <p className="planner-footnote">✓ Siempre puedes editar los productos antes de comparar.</p>
      </div>

      <aside className="planner-side">
        <div className="surface inspiration-card">
          <span className="small-label">¿NO SABES QUÉ PEDIR?</span>
          <h2>Empieza por una idea ✨</h2>
          <p>Prueba una de estas sugerencias.</p>
          <div className="sample-list">
            {EXAMPLES.map(([emoji, ex]) => (
              <button key={ex} onClick={() => send(ex)} disabled={loading}>
                <span className="sample-emoji" aria-hidden="true">{emoji}</span>
                <span>{ex}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </div>
        <div className="quick-cart">
          <div className="quick-cart-symbol" aria-hidden="true">🧺</div>
          <div>
            <h2>¿Prefieres hacerlo tú?</h2>
            <p>Añade productos uno a uno, sin usar IA.</p>
            <button className="text-link" onClick={onManual}>Crear lista manual →</button>
          </div>
        </div>
      </aside>
      </div>
    </section>
  );
}
