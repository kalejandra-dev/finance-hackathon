import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import LocationPicker from "../components/LocationPicker.jsx";
import PageHeading from "../components/PageHeading.jsx";

const nice = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Paso de los botones −/+ según la unidad y la cantidad actual
function stepFor(unit, q) {
  if (unit === "unidad") return 1;
  if (q >= 500) return 100;
  if (q >= 100) return 50;
  if (q >= 20) return 10;
  return 1;
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

export default function ShoppingList({ items, setItems, budget, setBudget, maxStores, setMaxStores, onOptimized, onPlanner,
  location, setLocation, selectedStores, setSelectedStores }) {
  const [catalog, setCatalog] = useState({});
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.products().then(setCatalog).catch(() => {}); }, []);

  const unitOf = (name) => Object.values(catalog[name] || {})[0]?.unit || "unidad";
  const update = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i) => setItems(items.filter((_, j) => j !== i));
  const bump = (i, dir) => {
    const { unit, quantity: q } = items[i];
    const next = dir > 0 ? q + stepFor(unit, q) : q - stepFor(unit, q - 1);
    update(i, { quantity: Math.max(1, Math.round(next * 100) / 100) });
  };

  function add() {
    if (!newItem) return;
    setItems([...items, { name: newItem, quantity: unitOf(newItem) === "unidad" ? 1 : 500, unit: unitOf(newItem) }]);
    setNewItem("");
  }

  async function optimize() {
    setLoading(true);
    setError("");
    try {
      onOptimized(await api.optimize({
        items, budget,
        max_stores: Math.min(maxStores, selectedStores.length),
        supermarket_ids: selectedStores,
        location: { lat: location.lat, lon: location.lon },
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Por qué no se puede optimizar todavía (se muestra junto al botón)
  const blocker = !items.length ? "Añade al menos un producto a tu lista."
    : !location ? "Indica dónde estás para continuar."
      : !selectedStores.length ? "Elige al menos un supermercado." : "";

  return (
    <section className="content-page list-page" aria-labelledby="list-title">
      <PageHeading id="list-title" eyebrow="PASO 02 — ORGANIZA" title="Tu lista," em="a tu gusto."
        desc="Ajusta las cantidades, indica dónde estás y elige tus supermercados antes de comparar."
        right={<button className="btn" onClick={onPlanner}>✧ Volver a OlivIA</button>} />

      <div className="cart-layout">
        <div className="cart-main">
          <section className="surface catalog-panel" aria-labelledby="products-title">
            <div className="panel-top">
              <div>
                <h2 id="products-title"><span className="step-num" aria-hidden="true">1</span>Tus productos</h2>
                <p>{items.length} {items.length === 1 ? "producto" : "productos"} · cantidades en gramos, mililitros o unidades</p>
              </div>
              <span className="tiny-demo">DEMO</span>
            </div>

            <ul className="items">
              {items.map((it, i) => (
                <li key={`${it.name}-${i}`} className="item-row">
                  <span className="item-name">{nice(it.name)}</span>
                  <div className="qty">
                    <button type="button" className="qty-btn" onClick={() => bump(i, -1)} disabled={it.quantity <= 1}
                      aria-label={`Menos ${it.name}`}>−</button>
                    <input type="number" min="0" step="any" value={it.quantity} aria-label={`Cantidad de ${it.name} en ${it.unit}`}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
                    <span className="qty-unit">{it.unit === "unidad" ? "ud." : it.unit}</span>
                    <button type="button" className="qty-btn" onClick={() => bump(i, 1)} aria-label={`Más ${it.name}`}>+</button>
                  </div>
                  <button className="icon-btn delete" onClick={() => remove(i)} aria-label={`Eliminar ${it.name}`} title="Eliminar">
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
            {!items.length && (
              <div className="empty-basket">
                <span aria-hidden="true">🧺</span>
                <strong>Tu lista está vacía</strong>
                <p>Añade productos aquí abajo o deja que OlivIA la prepare por ti.</p>
              </div>
            )}

            <div className="add-row">
              <label htmlFor="add" className="sr-only">Añadir producto</label>
              <select id="add" value={newItem} onChange={(e) => setNewItem(e.target.value)}>
                <option value="">＋ Añadir un producto del catálogo…</option>
                {Object.keys(catalog).sort().map((n) => <option key={n} value={n}>{nice(n)}</option>)}
              </select>
              <button className="btn" onClick={add} disabled={!newItem}>Añadir</button>
            </div>
          </section>

          <LocationPicker location={location} setLocation={setLocation}
            selected={selectedStores} setSelected={setSelectedStores} />
        </div>

        <aside className="surface basket-panel" aria-labelledby="summary-title">
          <div className="basket-head">
            <div>
              <h2 id="summary-title">Resumen</h2>
              <span>{items.length} productos · {selectedStores.length} {selectedStores.length === 1 ? "súper" : "súpers"} elegidos</span>
            </div>
            <span className="cart-basket-icon" aria-hidden="true">🧺</span>
          </div>
          <div className="basket-body">
            <div className="field">
              <label htmlFor="budget">PRESUPUESTO MÁXIMO</label>
              <div className="input-suffix">
                <input id="budget" type="number" min="0" value={budget ?? ""}
                  onChange={(e) => setBudget(e.target.value === "" ? null : Number(e.target.value))} />
                <span aria-hidden="true">€</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="stores">MÁXIMO DE SUPERMERCADOS</label>
              <select id="stores" value={maxStores} onChange={(e) => setMaxStores(Number(e.target.value))}>
                {[1, 2, 3].filter((n) => n <= Math.max(1, selectedStores.length)).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="basket-bottom" aria-live="polite">
            {error && <p role="alert" className="error">{error}</p>}
            {!error && blocker && <p className="hint">⚠️ {blocker}</p>}
            {!error && !blocker && <small>Compararemos precios y desplazamiento entre tus supermercados.</small>}
            <button className="btn primary btn-full" onClick={optimize} disabled={loading || !!blocker}>
              {loading ? "Optimizando…" : "Optimizar mi compra"}
            </button>
            <button className="btn subtle btn-full" onClick={onPlanner}>✧ Seguir con OlivIA</button>
          </div>
        </aside>
      </div>
    </section>
  );
}
