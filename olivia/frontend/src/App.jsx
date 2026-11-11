import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Planner, { initialChat } from "./pages/Planner.jsx";
import ShoppingList from "./pages/ShoppingList.jsx";
import Results from "./pages/Results.jsx";
import Budget from "./pages/Budget.jsx";
import Settings from "./components/Settings.jsx";
import Logo from "./components/Logo.jsx";
import { stopSpeaking } from "./services/voice.js";

const NAV = [
  { id: "home", label: "Inicio", icon: "⌂" },
  { id: "planner", label: "Planificar", icon: "✧" },
  { id: "list", label: "Mi lista", icon: "☷" },
  { id: "results", label: "Resultados", icon: "▥" },
  { id: "budget", label: "Mi presupuesto", icon: "€" },
];

const DEFAULT_SETTINGS = { scale: 1, contrast: false, autoVoice: true };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("olivia-settings") || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Marca: aceituna + «OlivIA» con «IA» en verde. */
export function Brand({ small }) {
  return (
    <span className={small ? "brand small" : "brand"}>
      <Logo size={small ? 26 : 34} />
      <span>Oliv<span className="brand-ia">IA</span></span>
    </span>
  );
}

export default function App() {
  const [step, setStep] = useState("home");
  const [items, setItems] = useState([]);
  const [budget, setBudget] = useState(35);
  const [maxStores, setMaxStores] = useState(2);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState(null); // {lat, lon, label}
  const [selectedStores, setSelectedStores] = useState([]); // supers elegidos (2-3)
  const [chat, setChat] = useState(initialChat); // se conserva al cambiar de pantalla
  const [settings, setSettings] = useState(loadSettings);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState(null); // idea pulsada en la portada
  const [scrolled, setScrolled] = useState(false);

  // Sombra suave en la cabecera al bajar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.scale * 100}%`;
    document.documentElement.classList.toggle("high-contrast", settings.contrast);
    // Con el texto ampliado, la cabecera pasa a menú compacto para que no se rompa
    document.documentElement.classList.toggle("zoom-md", settings.scale >= 1.15);
    document.documentElement.classList.toggle("zoom-lg", settings.scale >= 1.3);
    try {
      localStorage.setItem("olivia-settings", JSON.stringify(settings));
    } catch {
      /* sin almacenamiento: los ajustes duran solo esta sesión */
    }
  }, [settings]);

  const go = (s) => {
    stopSpeaking();
    setStep(s);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const startNew = () => { setItems([]); setResult(null); setChat(initialChat()); go("planner"); };
  const newPurchase = () => {
    const busy = items.length > 0 || chat.length > 1;
    if (!busy || window.confirm("¿Empezar una compra nueva? Se vaciará tu lista actual y la conversación.")) startNew();
  };

  return (
    <>
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <header className={scrolled ? "site-header scrolled" : "site-header"}>
        <div className="header-inner">
          <button className="unstyled-logo" onClick={() => go("home")} aria-label="OlivIA, ir al inicio">
            <Brand />
          </button>
          <nav className={menuOpen ? "nav-links open" : "nav-links"} id="main-nav" aria-label="Navegación principal">
            {NAV.map((n) => (
              <button key={n.id} className={step === n.id ? "active" : ""} aria-current={step === n.id ? "page" : undefined}
                onClick={() => go(n.id)} disabled={n.id === "results" && !result}>
                <span className="nav-icon" aria-hidden="true">{n.icon}</span> {n.label}
                {n.id === "list" && items.length > 0 && (
                  <span className="nav-count">{items.length}<span className="sr-only"> productos</span></span>
                )}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <Settings settings={settings} setSettings={setSettings} />
            <button className="header-cta" onClick={newPurchase}>Nueva compra ↗</button>
            <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-nav"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenuOpen(!menuOpen)}>
              <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>
      </header>
      <div className="disclaimer-line">
        <span className="demo-pulse" aria-hidden="true" /> MODO DEMOSTRACIÓN <span className="dash">—</span>
        Los precios y desplazamientos son datos de ejemplo, no ofertas reales.
      </div>

      <main id="main" className={`page-${step}`}>
        <div className="page-enter" key={step}>
          {step === "home" && (
            <Home onStart={() => go("planner")} onBudget={() => go("budget")}
              onIdea={(text) => { setPendingPrompt(text); go("planner"); }} />
          )}
          {step === "planner" && (
            <Planner
              items={items} setItems={setItems}
              budget={budget} setBudget={setBudget}
              maxStores={maxStores} setMaxStores={setMaxStores}
              autoVoice={settings.autoVoice}
              messages={chat} setMessages={setChat}
              initialPrompt={pendingPrompt} onPromptUsed={() => setPendingPrompt(null)}
              onDone={() => go("list")} onManual={() => go("list")}
            />
          )}
          {step === "list" && (
            <ShoppingList
              items={items} setItems={setItems}
              budget={budget} setBudget={setBudget}
              maxStores={maxStores} setMaxStores={setMaxStores}
              onOptimized={(r) => { setResult(r); go("results"); }}
              onPlanner={() => go("planner")}
              location={location} setLocation={setLocation}
              selectedStores={selectedStores} setSelectedStores={setSelectedStores}
            />
          )}
          {step === "results" && result && (
            <Results result={result} location={location} autoVoice={settings.autoVoice} onEdit={() => go("list")} onBudget={() => go("budget")}
              onConfirmed={() => setResult((r) => ({ ...r, confirmed: true }))}
              onNew={startNew} />
          )}
          {step === "budget" && <Budget result={result} onPlan={() => go("planner")} />}
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <Brand small />
            <p className="footer-claim">Compra mejor.<br /><em>Ahorra más.</em></p>
          </div>
          <nav className="footer-col" aria-label="La app">
            <h2>La app</h2>
            {NAV.filter((n) => n.id !== "home").map((n) => (
              <button key={n.id} onClick={() => go(n.id)} disabled={n.id === "results" && !result}>{n.label}</button>
            ))}
          </nav>
          <div className="footer-col">
            <h2>Accesibilidad</h2>
            <span>Navegación con teclado</span>
            <span>Alto contraste</span>
            <span>Texto ampliable (A− / A+)</span>
            <span>Lectura en voz alta 🔊</span>
          </div>
          <div className="footer-col">
            <h2>Proyecto</h2>
            <span>HackFinance 2026 · MVP</span>
            <span>IA de lenguaje y voz</span>
            <span>Optimización matemática</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>🔒 Sin cuenta bancaria conectada · Precios de demostración, no son precios reales.</span>
          <span>© 2026 OlivIA</span>
        </div>
      </footer>
    </>
  );
}
