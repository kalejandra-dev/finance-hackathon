import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { resultSummary, speak } from "../services/voice.js";
import RouteMap from "../components/RouteMap.jsx";

const eur = (n) => (n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`);

function PlanCard({ title, plan, best }) {
  if (!plan) return (
    <div className="card"><h3>{title}</h3><p>Ningún supermercado tiene todos los productos.</p></div>
  );
  return (
    <div className={best ? "card plan best" : "card plan"}>
      {best && <span className="badge">✓ Recomendada</span>}
      <h3>{title}</h3>
      <dl className="kv">
        <dt>Productos</dt><dd>{eur(plan.products_cost)}</dd>
        <dt>Desplazamiento</dt><dd>{eur(plan.travel_cost)}</dd>
        <dt>Total</dt><dd><strong className="big-number">{eur(plan.total_cost)}</strong></dd>
        <dt>Dónde</dt><dd>{plan.stores.map((s) => s.name).join(" + ")}</dd>
      </dl>
    </div>
  );
}

function BudgetBar({ spent, budget }) {
  if (budget == null || !budget) return null;
  const pct = Math.min(100, (spent / budget) * 100);
  const over = spent > budget;
  return (
    <div className="budget">
      <div className="budget-labels">
        <span>Gastas <strong>{eur(spent)}</strong></span>
        <span>Presupuesto <strong>{eur(budget)}</strong></span>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={spent}
        aria-label={`Has usado el ${Math.round((spent / budget) * 100)} % del presupuesto`}>
        <div className={over ? "bar-fill over" : "bar-fill"} style={{ width: `${pct}%` }} />
      </div>
      <p className={over ? "error" : "ok"}>
        {over ? `Te pasas en ${eur(spent - budget)}. Prueba a quitar o sustituir algún producto.`
              : `Te quedan ${eur(budget - spent)}.`}
      </p>
    </div>
  );
}

/** El ahorro solo cuenta en «Mi presupuesto» cuando el usuario confirma que ha hecho la compra. */
function ConfirmPurchase({ resultId, confirmed, onConfirmed, onBudget, onNew }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      await api.confirmPurchase(resultId);
      onConfirmed(); // se recuerda en App: el botón no reaparece al volver a Resultados
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card confirm" aria-live="polite">
      {confirmed ? (
        <>
          <p className="ok">✓ Compra registrada en tu presupuesto.</p>
          <p className="muted">Tu cesta se mantiene por si quieres repetirla. ¿Qué quieres hacer ahora?</p>
          <div className="row">
            <button className="btn primary" onClick={onBudget}>Ver mi presupuesto →</button>
            <button className="btn" onClick={onNew}>🛒 Empezar una compra nueva</button>
          </div>
        </>
      ) : (
        <>
          <p>¿Has hecho esta compra? Confírmala para sumar el gasto y el ahorro a tu historial.</p>
          <button className="btn primary" onClick={confirm} disabled={saving || resultId == null}>
            {saving ? "Guardando…" : "✅ He hecho esta compra"}
          </button>
        </>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}

export default function Results({ result, location, autoVoice, onEdit, onBudget, onConfirmed, onNew }) {
  const { optimized, best_single_store: single, net_saving, budget, unavailable_items } = result;
  const summary = resultSummary(result);

  useEffect(() => { if (autoVoice) speak(summary); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="results-title">
      <h2 id="results-title">Tu compra optimizada</h2>

      <div className="saving" role="status">
        {net_saving > 0 ? (
          <>
            <span className="saving-label">Ahorras</span>
            <span className="saving-amount">{eur(net_saving)}</span>
            <span className="saving-note">frente a comprarlo todo en un solo supermercado, ya descontando el desplazamiento</span>
          </>
        ) : (
          <span className="saving-note">Comprar todo en un solo supermercado ya es la opción más barata. ¡Te ahorras el viaje extra!</span>
        )}
        <button className="btn" onClick={() => speak(summary)}>🔊 Escuchar resumen</button>
      </div>

      {optimized && <BudgetBar spent={optimized.total_cost} budget={budget} />}

      <div className="grid">
        <PlanCard title="Todo en un supermercado" plan={single} />
        <PlanCard title="Compra optimizada" plan={optimized} best={net_saving > 0} />
      </div>

      {optimized && <RouteMap location={location} storeIds={optimized.stores.map((s) => s.supermarket_id)} />}

      <h3 className="section-title">🧾 Qué comprar en cada supermercado</h3>
      {optimized?.stores.map((s, idx) => (
        <div key={s.supermarket_id} className="card">
          <h3><span className="stop">{idx + 1}</span> {s.name} <small className="muted">· {s.address} · {s.distance_km} km</small></h3>
          <ul className="buy-list">
            {optimized.assignments.filter((a) => a.supermarket_id === s.supermarket_id).map((a) => (
              <li key={a.item}>
                <span>{a.packages > 1 ? `${a.packages} × ` : ""}{a.product_name}</span>
                <span>{eur(a.line_total)}</span>
              </li>
            ))}
          </ul>
          <p className="subtotal">Subtotal: <strong>{eur(s.subtotal)}</strong></p>
        </div>
      ))}

      {unavailable_items?.length > 0 && <p className="error">No disponibles: {unavailable_items.join(", ")}</p>}

      {optimized && (
        <ConfirmPurchase resultId={result.id} confirmed={!!result.confirmed}
          onConfirmed={onConfirmed} onBudget={onBudget} onNew={onNew} />
      )}

      <button className="btn big" onClick={onEdit}>← Cambiar mi lista</button>
    </section>
  );
}
