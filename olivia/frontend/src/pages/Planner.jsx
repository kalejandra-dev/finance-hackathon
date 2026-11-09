import { useState } from "react";
import { api } from "../services/api.js";
import VoiceButton from "../components/VoiceButton.jsx";

export default function Planner({ items, setItems, budget, setBudget, maxStores, setMaxStores, onDone }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { from: "olivia", text: "¡Hola! Dime qué quieres cocinar o comprar, tu presupuesto y cuántos supermercados quieres visitar." },
  ]);

  async function send(input) {
    const value = (input ?? text).trim();
    if (!value) return;
    setMessages((m) => [...m, { from: "user", text: value }]);
    setText("");
    setLoading(true);
    try {
      const r = await api.interpret({ text: value, current_items: items, budget, max_stores: maxStores });
      setMessages((m) => [...m, { from: "olivia", text: r.reply }]);
      if (r.budget != null) setBudget(r.budget);
      if (r.max_stores != null) setMaxStores(r.max_stores);
      if (r.items?.length) setItems(r.items);
      if (r.not_in_catalog?.length) {
        setMessages((m) => [...m, { from: "olivia", text: `No tengo en el catálogo: ${r.not_in_catalog.join(", ")}.` }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { from: "olivia", text: `Ha habido un problema: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function play(t) {
    try {
      new Audio(await api.speak(t)).play();
    } catch {
      /* si la voz falla, el texto sigue visible */
    }
  }

  return (
    <section aria-labelledby="planner-title">
      <h2 id="planner-title">Planifica tu compra</h2>

      <div className="chat" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            <span className="sr-only">{m.from === "olivia" ? "OlivIA dice:" : "Tú:"}</span>
            {m.text}
            {m.from === "olivia" && (
              <button className="link" onClick={() => play(m.text)} aria-label="Escuchar este mensaje">🔊</button>
            )}
          </div>
        ))}
        {loading && <div className="msg olivia">Pensando…</div>}
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="request" className="sr-only">Tu petición</label>
        <input id="request" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: Paella para 4 personas, 35 €, máximo 2 supermercados" disabled={loading} />
        <button className="btn primary" type="submit" disabled={loading || !text.trim()}>Enviar</button>
        <VoiceButton onText={(t) => send(t)} disabled={loading} />
      </form>

      {items.length > 0 && (
        <button className="btn primary big" onClick={onDone}>Ver mi lista ({items.length} productos) →</button>
      )}
    </section>
  );
}
