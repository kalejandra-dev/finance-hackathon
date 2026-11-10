import { useEffect, useState } from "react";
import { api } from "../services/api.js";

const eur = (n) => (n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`);

// SQLite guarda la fecha en UTC («AAAA-MM-DD HH:MM:SS»)
const toDate = (s) => new Date(`${s.replace(" ", "T")}Z`);
const fmtDate = (s) => toDate(s).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (s) =>
  `${fmtDate(s)}, ${toDate(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

function Stat({ label, value, note }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note && <span className="stat-note muted">{note}</span>}
    </div>
  );
}

/** Gasto por supermercado: barras horizontales de una sola serie, con el importe escrito. */
function StoreBars({ stores }) {
  const max = Math.max(...stores.map((s) => s.subtotal), 0.01);
  return (
    <ul className="hbars" aria-label="Gasto por supermercado">
      {stores.map((s) => (
        <li key={s.name} className="hbar-row">
          <span className="hbar-label">{s.name}</span>
          <span className="hbar-track" aria-hidden="true">
            <span className="hbar-fill" style={{ width: `${(s.subtotal / max) * 100}%` }} title={`${s.name}: ${eur(s.subtotal)}`} />
          </span>
          <span className="hbar-value">{eur(s.subtotal)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ahorro acumulado compra a compra (línea de una sola serie; la tabla de abajo es la vista accesible). */
function SavingsChart({ purchases }) {
  let acc = 0;
  const points = purchases.map((p, i) => {
    acc += p.net_saving || 0;
    return { n: i + 1, date: fmtDate(p.confirmed_at), saving: p.net_saving || 0, total: Math.round(acc * 100) / 100 };
  });
  const W = 600, H = 180, L = 56, R = 70, T = 16, B = 30;
  const max = Math.max(...points.map((p) => p.total), 1);
  const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v) => H - B - (v / max) * (H - T - B);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.total)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Ahorro acumulado: ${eur(last.total)} después de ${points.length} compras`}>
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line className="chart-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="chart-axis" x={L - 8} y={y(v) + 4} textAnchor="end">{eur(v)}</text>
          </g>
        ))}
        <text className="chart-axis" x={x(0)} y={H - 8} textAnchor="start">Compra 1</text>
        <text className="chart-axis" x={x(points.length - 1)} y={H - 8} textAnchor="end">Compra {points.length}</text>
        <path className="chart-line" d={path} />
        {points.map((p, i) => (
          <g key={p.n}>
            <circle className="chart-dot" cx={x(i)} cy={y(p.total)} r="5" />
            {/* zona de hover más grande que el punto */}
            <circle className="chart-hit" cx={x(i)} cy={y(p.total)} r="14">
              <title>{`Compra ${p.n} (${p.date}): ahorro ${eur(p.saving)} · acumulado ${eur(p.total)}`}</title>
            </circle>
          </g>
        ))}
        <text className="chart-label" x={x(points.length - 1) + 10} y={y(last.total) + 5}>{eur(last.total)}</text>
      </svg>
      <figcaption className="muted">Ahorro acumulado después de cada compra confirmada.</figcaption>
    </figure>
  );
}

function CurrentPurchase({ result }) {
  const { optimized, budget, net_saving, remaining_budget } = result;
  return (
    <section className="card" aria-labelledby="current-title">
      <h3 id="current-title">Tu última compra optimizada <small className="muted">(estimación)</small></h3>
      <dl className="kv">
        <dt>Presupuesto</dt><dd>{eur(budget)}</dd>
        <dt>Coste estimado</dt><dd><strong>{eur(optimized.total_cost)}</strong></dd>
        <dt>· Productos</dt><dd>{eur(optimized.products_cost)}</dd>
        <dt>· Desplazamiento</dt><dd>{eur(optimized.travel_cost)}</dd>
        <dt>Ahorro potencial</dt><dd>{eur(net_saving)}</dd>
        {remaining_budget != null && (
          <><dt>{remaining_budget >= 0 ? "Presupuesto restante" : "Te pasas en"}</dt>
            <dd className={remaining_budget >= 0 ? "ok" : "error"}>{eur(Math.abs(remaining_budget))}</dd></>
        )}
      </dl>
      <h4>¿Dónde va tu dinero?</h4>
      <StoreBars stores={optimized.stores} />
    </section>
  );
}

export default function Budget({ result, onPlan }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  const load = () => api.purchases().then(setHistory).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function remove(p) {
    if (!window.confirm(`¿Eliminar la compra del ${fmtDate(p.confirmed_at)} (${eur(p.total_cost)}) del historial?`)) return;
    try {
      await api.deletePurchase(p.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section aria-labelledby="budget-title">
      <h2 id="budget-title">Mi presupuesto</h2>

      {result?.optimized && <CurrentPurchase result={result} />}

      <h3 className="section-title">Tu historial</h3>
      {error && <p role="alert" className="error">No se pudo cargar el historial: {error}</p>}
      {!history && !error && <p className="muted" role="status">Cargando…</p>}

      {history && history.count === 0 && (
        <div className="card">
          <p>Todavía no has confirmado ninguna compra.</p>
          <p className="muted">
            Después de optimizar tu compra, pulsa <strong>«He hecho esta compra»</strong> en la pantalla de resultados
            y aparecerá aquí. Solo contamos el ahorro de las compras que confirmas.
          </p>
          <button className="btn primary" onClick={onPlan}>🛒 Planificar una compra</button>
        </div>
      )}

      {history && history.count > 0 && (
        <>
          <div className="stats">
            <Stat label="Compras confirmadas" value={history.count} />
            <Stat label="Total gastado" value={eur(history.total_spent)} />
            <Stat label="Ahorro acumulado" value={eur(history.total_saved)} note="frente a comprar todo en un solo súper" />
          </div>

          {history.count >= 2 && <SavingsChart purchases={history.purchases} />}

          <table className="table history">
            <caption className="sr-only">Compras confirmadas</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th><th scope="col">Supermercados</th>
                <th scope="col">Total</th><th scope="col">Ahorro</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {[...history.purchases].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{fmtDateTime(p.confirmed_at)}</td>
                  <td>{p.stores.map((s) => s.name).join(" + ")}</td>
                  <td>{eur(p.total_cost)}</td>
                  <td>{eur(p.net_saving)}</td>
                  <td>
                    <button className="btn danger" onClick={() => remove(p)}
                      aria-label={`Eliminar la compra del ${fmtDate(p.confirmed_at)}`}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="muted small-note">
        Los importes usan precios de demostración. El ahorro es una estimación frente a comprar todo en el
        supermercado único más barato, ya descontando el desplazamiento.
      </p>
    </section>
  );
}
