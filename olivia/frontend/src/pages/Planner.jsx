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

export default function Planner({ items, setItems, budget, setBudget, maxStores, setMaxStores, autoVoice, onDone }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([{ from: "olivia", text: GREETING }]);
  const chatEnd = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, loading]);

  const say = (t) => {
    setMessages((m) => [...m, { from: "olivia", text: t }]);
    if (autoVoice) speak(t);
  };

  async function send(input) {
    const value = (input ?? text).replace(/^\p{Extended_Pictographic}\s*/u, "").trim();
    if (!value) return;
    setMessages((m) => [...m, { from: "user", text: value }]);
    setText("");
    setLoading(true);
    try {
      const r = await api.interpret({ text: value, current_items: items, budget, max_stores: maxStores });
      let reply = r.reply;
      if (r.not_in_catalog?.length) reply += ` (No tengo en el catálogo: ${r.not_in_catalog.join(", ")}.)`;
      say(reply);
      if (r.budget != null) setBudget(r.budget);
      if (r.max_stores != null) setMaxStores(r.max_stores);
      if (r.items?.length) setItems(r.items);
    } catch (e) {
      setMessages((m) => [...m, { from: "olivia", text: `Ha habido un problema: ${e.message}. Puedes intentarlo otra vez.` }]);
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
        <input id="request" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Escribe aquí o pulsa Hablar…" disabled={loading} autoComplete="off" />
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
