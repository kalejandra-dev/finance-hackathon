import { useState } from "react";
import Planner from "./pages/Planner.jsx";
import ShoppingList from "./pages/ShoppingList.jsx";
import Results from "./pages/Results.jsx";

const STEPS = [
  { id: "planner", label: "1. Planificar" },
  { id: "list", label: "2. Lista" },
  { id: "results", label: "3. Resultados" },
];

export default function App() {
  const [step, setStep] = useState("planner");
  const [items, setItems] = useState([]);
  const [budget, setBudget] = useState(35);
  const [maxStores, setMaxStores] = useState(2);
  const [result, setResult] = useState(null);

  return (
    <>
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <header className="header">
        <h1>🫒 OlivIA</h1>
        <p className="tagline">Compra mejor. Ahorra más.</p>
        <nav aria-label="Pasos">
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.id}>
                <button
                  className={step === s.id ? "step active" : "step"}
                  aria-current={step === s.id ? "step" : undefined}
                  onClick={() => setStep(s.id)}
                  disabled={(s.id === "list" && !items.length) || (s.id === "results" && !result)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main id="main">
        {step === "planner" && (
          <Planner
            items={items} setItems={setItems}
            budget={budget} setBudget={setBudget}
            maxStores={maxStores} setMaxStores={setMaxStores}
            onDone={() => setStep("list")}
          />
        )}
        {step === "list" && (
          <ShoppingList
            items={items} setItems={setItems}
            budget={budget} setBudget={setBudget}
            maxStores={maxStores} setMaxStores={setMaxStores}
            onOptimized={(r) => { setResult(r); setStep("results"); }}
          />
        )}
        {step === "results" && result && <Results result={result} />}
      </main>

      <footer className="footer">Precios de demostración: datos de ejemplo, no son precios reales.</footer>
    </>
  );
}
