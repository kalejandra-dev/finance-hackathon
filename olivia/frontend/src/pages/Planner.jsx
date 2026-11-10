import { useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import { speak } from "../services/voice.js";
import VoiceButton from "../components/VoiceButton.jsx";

const EXAMPLES = [
  "🥘 Paella para 4 personas, 35 €, máximo 2 supermercados",
  "🍝 Pasta carbonara para 2",
  "🍲 Lentejas para 3 personas con 10 €",
  "🛒 Leche, huevos, pan y café",
];

const GREETING = "¡Hola! Soy OlivIA. Dime qué quieres cocinar o comprar, tu presupuesto y cuántos supermercados quieres visitar.";

/** Chat inicial. El estado del chat vive en App para que no se pierda al cambiar de pantalla. */
export const initialChat = () => [{ from: "olivia", text: GREETING }];

export default function Planner({ items, setItems, budget, setBudget, maxStores, setMaxStores, autoVoice, onDone,
  messages, setMessages }) {
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

  const say = (t) => {
    setMessages((m) => [...m, { from: "olivia", text: t }]);
    if (autoVoice) speak(t);
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
      say(reply);
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
    <section aria-labelledby="planner-title">
      <h2 id="planner-title">¿Qué necesitas comprar?</h2>

      {messages.length === 1 && (
        <div className="examples">
          <p className="muted">Prueba con un ejemplo:</p>
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip example" onClick={() => send(ex)} disabled={loading}>{ex}</button>
          ))}
        </div>
      )}

      <div className="chat" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            <span className="sr-only">{m.from === "olivia" ? "OlivIA dice:" : "Tú:"}</span>
            {m.text}
            {m.from === "olivia" && (
              <button className="link" onClick={() => speak(m.text)} aria-label="Escuchar este mensaje">🔊</button>
            )}
          </div>
        ))}
        {loading && <div className="msg olivia typing" aria-label="OlivIA está pensando"><span /><span /><span /></div>}
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
        <div className="card summary-strip">
          <p>
            <strong>{items.length} productos</strong> en tu lista
            {budget != null && <> · Presupuesto <strong>{budget} €</strong></>}
            {" "}· Máx. <strong>{maxStores}</strong> {maxStores === 1 ? "supermercado" : "supermercados"}
          </p>
          <button className="btn primary big" onClick={onDone}>Revisar mi lista →</button>
        </div>
      )}
    </section>
  );
}
