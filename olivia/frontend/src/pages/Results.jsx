import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { resultSummary, speak } from "../services/voice.js";
import RouteMap from "../components/RouteMap.jsx";
import PageHeading from "../components/PageHeading.jsx";

const eur = (n) => (n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`);

/** Productos de un plan agrupados por supermercado. En el plan recomendado se pueden ir tachando. */
function Allocation({ plan, checkable, got, onToggle }) {
  return plan.stores.map((s, idx) => {
    const lines = plan.assignments.filter((a) => a.supermarket_id === s.supermarket_id);
    const done = lines.filter((a) => got[`${s.supermarket_id}:${a.item}`]).length;
    return (
      <div className="allocation-store" key={s.supermarket_id}>
        <div className="allocation-store-head">
          <span className="store-pill"><span className="stop">{idx + 1}</span>{s.name}</span>
          <span className="store-head-right">
            {checkable && (
              <span className={done === lines.length ? "count-pill complete" : "count-pill"}>
                {done}/{lines.length}<span className="sr-only"> productos cogidos</span>
              </span>
            )}
            <strong>{eur(s.subtotal)}</strong>
          </span>
        </div>
        <p className="store-addr">{s.address} · {String(s.distance_km).replace(".", ",")} km</p>
        <ul className="buy-list">
          {lines.map((a) => {
            const key = `${s.supermarket_id}:${a.item}`;
            const name = <span className="buy-name">{a.packages > 1 ? `${a.packages} × ` : ""}{a.product_name}</span>;
            return (
              <li key={a.item} className={checkable && got[key] ? "got" : ""}>
                {checkable ? (
                  <label className="buy-item">
                    <input type="checkbox" checked={!!got[key]} onChange={() => onToggle(key)} />
                    {name}
                  </label>
                ) : <span className="buy-item">{name}</span>}
                <span className="buy-price">{eur(a.line_total)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  });
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
    <section className="surface confirmation-card" aria-live="polite" aria-labelledby="confirm-title">
      <div>
        <span className="small-label">BIENESTAR FINANCIERO</span>
        {confirmed ? (
          <>
            <h2 id="confirm-title" className="ok">✓ Compra registrada en tu presupuesto</h2>
            <p>Tu cesta se mantiene por si quieres repetirla. ¿Qué quieres hacer ahora?</p>
          </>
        ) : (
          <>
            <h2 id="confirm-title">¿Ya has hecho la compra?</h2>
            <p>Confírmala para sumar el gasto y el ahorro a tu historial. No contamos el ahorro como real sin tu confirmación.</p>
          </>
        )}
        {error && <p role="alert" className="error">{error}</p>}
      </div>
      <div className="confirmation-actions">
        {confirmed ? (
          <>
            <button className="btn primary" onClick={onBudget}>Ver mi presupuesto →</button>
            <button className="btn" onClick={onNew}>🛒 Empezar una compra nueva</button>
          </>
        ) : (
          <button className="btn primary" onClick={confirm} disabled={saving || resultId == null}>
            {saving ? "Guardando…" : "✅ He hecho esta compra"}
          </button>
        )}
      </div>
    </section>
  );
}

export default function Results({ result, location, autoVoice, onEdit, onBudget, onConfirmed, onNew }) {
  const { optimized, best_single_store: single, net_saving, budget, remaining_budget, unavailable_items } = result;
  const summary = resultSummary(result);
  const [tab, setTab] = useState("best");
  const [got, setGot] = useState({}); // productos ya cogidos en la tienda
  const toggleGot = (key) => setGot((g) => ({ ...g, [key]: !g[key] }));

  useEffect(() => { if (autoVoice) speak(summary); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = tab === "single" && single ? single : optimized;
  const over = remaining_budget != null && remaining_budget < 0;

  return (
    <section className="content-page" aria-labelledby="results-title">
      <PageHeading id="results-title" eyebrow="PASO 03 — AHORRA" title="Tu compra" em="optimizada."
        desc="La combinación más económica entre tus supermercados, contando también el desplazamiento."
        right={<button className="btn" onClick={onEdit}>✎ Cambiar mi lista</button>} />

      {over && (
        <div className="notice notice-warning" role="status">
          ⚠️ La compra más económica cuesta {eur(optimized.total_cost)}, {eur(-remaining_budget)} por encima de tu
          presupuesto de {eur(budget)}. Prueba a quitar o sustituir algún producto.
        </div>
      )}
      {unavailable_items?.length > 0 && (
        <div className="notice notice-warning">No disponibles: {unavailable_items.join(", ")}</div>
      )}

      {!optimized ? (
        <div className="surface error-results">
          <h2>No encontramos una combinación válida</h2>
          <p>Revisa tus productos o elige otros supermercados.</p>
          <button className="btn primary" onClick={onEdit}>Revisar mi lista →</button>
        </div>
      ) : (
        <>
          <div className="result-feature" role="status">
            <div className="result-feature-left">
              <span className="green-label">✧ TU MEJOR COMBINACIÓN</span>
              <p>Coste total estimado</p>
              <div className="hero-amount">{eur(optimized.total_cost)}</div>
              <span className="sub-feature">
                {optimized.stores.map((s) => s.name).join(" + ")} · productos + desplazamiento
              </span>
              <button className="btn light listen" onClick={() => speak(summary)}>🔊 Escuchar resumen</button>
            </div>
            <div className="result-feature-right">
              <div className="result-illustration" aria-hidden="true">↘</div>
              <span>AHORRO NETO ESTIMADO</span>
              <strong>{net_saving == null ? "—" : eur(net_saving)}</strong>
              <small>
                {single
                  ? net_saving > 0 ? "Frente a la mejor cesta en un solo supermercado, ya descontando el desplazamiento."
                    : "Comprar todo en un solo supermercado ya es lo más barato. ¡Te ahorras el viaje extra!"
                  : "Ningún supermercado tiene todos los productos por sí solo."}
              </small>
            </div>
          </div>

          <div className="metric-grid">
            <div className="metric-card"><span>Productos</span><strong>{eur(optimized.products_cost)}</strong>
              <small>Coste de la cesta</small><span className="metric-symbol" aria-hidden="true">🧺</span></div>
            <div className="metric-card"><span>Desplazamiento</span><strong>{eur(optimized.travel_cost)}</strong>
              <small>Estimación del trayecto</small><span className="metric-symbol" aria-hidden="true">📍</span></div>
            <div className="metric-card"><span>Tu presupuesto</span><strong>{budget == null ? "Sin límite" : eur(budget)}</strong>
              <small className={over ? "error" : ""}>{budget == null ? "No configurado" : over ? "Límite superado" : "Dentro de tu límite"}</small>
              <span className="metric-symbol" aria-hidden="true">💶</span></div>
          </div>

          <div className="results-layout">
            <section className="surface allocation-card" aria-labelledby="alloc-title">
              <div className="panel-top">
                <div>
                  <h2 id="alloc-title">Así haríamos tu compra</h2>
                  <p>{tab === "best" ? "Marca cada producto cuando lo metas en la cesta." : "Comparación: todo en un único supermercado."}</p>
                </div>
                <span className="tiny-demo">CATÁLOGO DEMO</span>
              </div>
              <div className="results-tabs" role="tablist" aria-label="Plan de compra">
                <button role="tab" aria-selected={tab === "best"} className={tab === "best" ? "selected" : ""}
                  onClick={() => setTab("best")}>Compra optimizada</button>
                <button role="tab" aria-selected={tab === "single"} className={tab === "single" ? "selected" : ""}
                  onClick={() => setTab("single")} disabled={!single}>Solo un súper</button>
              </div>
              <Allocation plan={shown} checkable={tab === "best"} got={got} onToggle={toggleGot} />
              <div className="allocation-footer">
                <div><span>Productos</span><b>{eur(shown.products_cost)}</b></div>
                <div><span>Desplazamiento</span><b>{eur(shown.travel_cost)}</b></div>
                <div className="total"><strong>Total</strong><strong>{eur(shown.total_cost)}</strong></div>
              </div>
            </section>

            <aside className="results-aside">
              <section className="surface budget-card" aria-labelledby="budget-card-title">
                <div className="budget-card-icon" aria-hidden="true">€</div>
                <h2 id="budget-card-title">¿Y tu presupuesto?</h2>
                {budget ? (
                  <>
                    <div className="budget-gauge" role="progressbar" aria-valuemin={0} aria-valuemax={budget}
                      aria-valuenow={optimized.total_cost}
                      aria-label={`Has usado el ${Math.round((optimized.total_cost / budget) * 100)} % del presupuesto`}>
                      <span className={over ? "over" : ""} style={{ width: `${Math.min(100, (optimized.total_cost / budget) * 100)}%` }} />
                    </div>
                    <strong className={over ? "overspent" : ""}>
                      {over ? `Te pasas en ${eur(-remaining_budget)}` : `Te quedan ${eur(remaining_budget)}`}
                    </strong>
                    <p>de {eur(budget)}, después de esta compra estimada.</p>
                  </>
                ) : <p>No has establecido un presupuesto.</p>}
                <button className="text-link" onClick={onBudget}>Ver mi presupuesto →</button>
              </section>

              <section className="surface compare-card" aria-labelledby="compare-title">
                <span className="small-label">COMPARATIVA</span>
                <h2 id="compare-title">Optimizada vs. un solo súper</h2>
                <dl className="kv">
                  <dt>Compra optimizada</dt><dd><strong>{eur(optimized.total_cost)}</strong></dd>
                  <dt>Todo en {single ? single.stores[0]?.name : "un súper"}</dt><dd>{single ? eur(single.total_cost) : "No posible"}</dd>
                  <dt>Diferencia</dt><dd className="ok">{net_saving == null ? "—" : eur(net_saving)}</dd>
                </dl>
              </section>
            </aside>
          </div>

          <RouteMap location={location} storeIds={optimized.stores.map((s) => s.supermarket_id)} />

          <ConfirmPurchase resultId={result.id} confirmed={!!result.confirmed}
            onConfirmed={onConfirmed} onBudget={onBudget} onNew={onNew} />
        </>
      )}

      <p className="end-note">ⓘ Los precios y desplazamientos son datos de ejemplo para demostrar el algoritmo. Verifica siempre los precios reales.</p>
    </section>
  );
}
