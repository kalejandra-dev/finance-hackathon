import { useEffect, useState } from "react";
import { api } from "../services/api.js";

export default function ShoppingList({ items, setItems, budget, setBudget, maxStores, setMaxStores, onOptimized }) {
  const [catalog, setCatalog] = useState({});
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.products().then(setCatalog).catch(() => {}); }, []);

  const unitOf = (name) => Object.values(catalog[name] || {})[0]?.unit || "unidad";
  const update = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i) => setItems(items.filter((_, j) => j !== i));

  function add() {
    if (!newItem) return;
    setItems([...items, { name: newItem, quantity: unitOf(newItem) === "unidad" ? 1 : 500, unit: unitOf(newItem) }]);
    setNewItem("");
  }

  async function optimize() {
    setLoading(true);
    setError("");
    try {
      onOptimized(await api.optimize({ items, max_stores: maxStores, budget }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="list-title">
      <h2 id="list-title">Tu lista de la compra</h2>

      <table className="table">
        <thead><tr><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Unidad</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={`${it.name}-${i}`}>
              <td>{it.name}</td>
              <td>
                <input type="number" min="0" step="any" value={it.quantity} aria-label={`Cantidad de ${it.name}`}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
              </td>
              <td>{it.unit}</td>
              <td><button className="btn danger" onClick={() => remove(i)} aria-label={`Eliminar ${it.name}`}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row">
        <label htmlFor="add">Añadir producto</label>
        <select id="add" value={newItem} onChange={(e) => setNewItem(e.target.value)}>
          <option value="">— Elige —</option>
          {Object.keys(catalog).sort().map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button className="btn" onClick={add} disabled={!newItem}>Añadir</button>
      </div>

      <div className="row">
        <label htmlFor="budget">Presupuesto (€)</label>
        <input id="budget" type="number" min="0" value={budget ?? ""} onChange={(e) => setBudget(e.target.value === "" ? null : Number(e.target.value))} />
        <label htmlFor="stores">Máx. supermercados</label>
        <select id="stores" value={maxStores} onChange={(e) => setMaxStores(Number(e.target.value))}>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="error">{error}</p>}
      <button className="btn primary big" onClick={optimize} disabled={loading || !items.length}>
        {loading ? "Optimizando…" : "Optimizar mi compra"}
      </button>
    </section>
  );
}
