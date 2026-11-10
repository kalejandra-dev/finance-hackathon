import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Planner, { initialChat } from "./pages/Planner.jsx";
import ShoppingList from "./pages/ShoppingList.jsx";
import Results from "./pages/Results.jsx";
import Budget from "./pages/Budget.jsx";
import Settings from "./components/Settings.jsx";
import { stopSpeaking } from "./services/voice.js";

const STEPS = [
  { id: "planner", label: "1. Planificar" },
  { id: "list", label: "2. Lista" },
  { id: "results", label: "3. Resultados" },
  { id: "budget", label: "4. Mi presupuesto" },
];

const DEFAULT_SETTINGS = { scale: 1, contrast: false, autoVoice: true };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("olivia-settings") || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [step, setStep] = useState("home");
  const [items, setItems] = useState([]);
  const [budget, setBudget] = useState(35);
  const [maxStores, setMaxStores] = useState(2);
  const [result, setResult] = useState(null);
  const [chat, setChat] = useState(initialChat); // se conserva al cambiar de pantalla
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.scale * 100}%`;
    document.documentElement.classList.toggle("high-contrast", settings.contrast);
    try {
      localStorage.setItem("olivia-settings", JSON.stringify(settings));
    } catch {
      /* sin almacenamiento: los ajustes duran solo esta sesión */
    }
  }, [settings]);

  const go = (s) => {
    stopSpeaking();
    setStep(s);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <header className="header">
        <Settings settings={settings} setSettings={setSettings} />
        <button className="brand" onClick={() => go("home")} aria-label="OlivIA, ir al inicio">
          <h1>🫒 OlivIA</h1>
        </button>
        <p className="tagline">Compra mejor. Ahorra más.</p>
        {step !== "home" && (
          <nav aria-label="Pasos">
            <ol className="steps">
              {STEPS.map((s) => (
                <li key={s.id}>
                  <button
                    className={step === s.id ? "step active" : "step"}
                    aria-current={step === s.id ? "step" : undefined}
                    onClick={() => go(s.id)}
                    disabled={(s.id === "list" && !items.length) || (s.id === "results" && !result)}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </header>

      <main id="main">
        {step === "home" && <Home onStart={() => go("planner")} onBudget={() => go("budget")} />}
        {step === "planner" && (
          <Planner
            items={items} setItems={setItems}
            budget={budget} setBudget={setBudget}
            maxStores={maxStores} setMaxStores={setMaxStores}
            autoVoice={settings.autoVoice}
            messages={chat} setMessages={setChat}
            onDone={() => go("list")}
          />
        )}
        {step === "list" && (
          <ShoppingList
            items={items} setItems={setItems}
            budget={budget} setBudget={setBudget}
            maxStores={maxStores} setMaxStores={setMaxStores}
            onOptimized={(r) => { setResult(r); go("results"); }}
          />
        )}
        {step === "results" && result && (
          <Results result={result} autoVoice={settings.autoVoice} onEdit={() => go("list")} onBudget={() => go("budget")}
            onConfirmed={() => setResult((r) => ({ ...r, confirmed: true }))}
            onNew={() => { setItems([]); setResult(null); setChat(initialChat()); go("planner"); }} />
        )}
        {step === "budget" && <Budget result={result} onPlan={() => go("planner")} />}
      </main>

      <footer className="footer">Precios de demostración: datos de ejemplo, no son precios reales.</footer>
    </>
  );
}
