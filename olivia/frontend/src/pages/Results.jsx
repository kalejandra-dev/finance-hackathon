const eur = (n) => (n == null ? "—" : `${n.toFixed(2).replace(".", ",")} €`);

function PlanCard({ title, plan }) {
  if (!plan) return (
    <div className="card"><h3>{title}</h3><p>Ningún supermercado tiene todos los productos.</p></div>
  );
  return (
    <div className="card">
      <h3>{title}</h3>
      <dl className="kv">
        <dt>Productos</dt><dd>{eur(plan.products_cost)}</dd>
        <dt>Desplazamiento</dt><dd>{eur(plan.travel_cost)}</dd>
        <dt>Total</dt><dd><strong>{eur(plan.total_cost)}</strong></dd>
        <dt>Supermercados</dt><dd>{plan.stores.map((s) => s.name).join(" + ")}</dd>
      </dl>
    </div>
  );
}

export default function Results({ result }) {
  const { optimized, best_single_store: single, net_saving, remaining_budget, within_budget, unavailable_items } = result;

  return (
    <section aria-labelledby="results-title">
      <h2 id="results-title">Tu compra optimizada</h2>

      {net_saving != null && (
        <p className="highlight" role="status">
          {net_saving > 0
            ? <>Ahorras <strong>{eur(net_saving)}</strong> (ya descontando el desplazamiento).</>
            : <>Comprar todo en un solo supermercado ya es la mejor opción.</>}
        </p>
      )}
      {within_budget === false && (
        <p role="alert" className="error">Te pasas del presupuesto en {eur(-remaining_budget)}. Prueba a quitar o sustituir algún producto.</p>
      )}
      {within_budget && <p>Te quedan <strong>{eur(remaining_budget)}</strong> de presupuesto.</p>}

      <div className="grid">
        <PlanCard title="Todo en un supermercado" plan={single} />
        <PlanCard title="Compra optimizada" plan={optimized} />
      </div>

      {optimized?.stores.map((s, idx) => (
        <div key={s.supermarket_id} className="card">
          <h3>Parada {idx + 1}: {s.name} <small>({s.address} · {s.distance_km} km)</small></h3>
          <table className="table">
            <thead><tr><th scope="col">Producto</th><th scope="col">Envase</th><th scope="col">Uds.</th><th scope="col">Precio</th></tr></thead>
            <tbody>
              {optimized.assignments.filter((a) => a.supermarket_id === s.supermarket_id).map((a) => (
                <tr key={a.item}><td>{a.item}</td><td>{a.product_name}</td><td>{a.packages}</td><td>{eur(a.line_total)}</td></tr>
              ))}
            </tbody>
          </table>
          <p>Subtotal: <strong>{eur(s.subtotal)}</strong></p>
        </div>
      ))}

      {unavailable_items?.length > 0 && <p className="error">No disponibles: {unavailable_items.join(", ")}</p>}
    </section>
  );
}
