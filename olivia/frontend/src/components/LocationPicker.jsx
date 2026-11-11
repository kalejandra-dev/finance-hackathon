import { useEffect, useState } from "react";
import { api } from "../services/api.js";

const MAX_SELECTED = 3;

/**
 * Paso «¿Dónde estás?»: ubicación del usuario + elegir 2-3 supermercados cercanos.
 * location: {lat, lon, label} | null · selected: ["S1", ...]
 */
export default function LocationPicker({ location, setLocation, selected, setSelected }) {
  const [stores, setStores] = useState([]);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Cada vez que cambia la ubicación, recalculamos los supers cercanos
  useEffect(() => {
    if (!location) return;
    api.nearby(location)
      .then((list) => {
        setStores(list);
        // Si aún no ha elegido, preseleccionamos los 2 más cercanos
        setSelected((prev) => (prev.length ? prev.filter((id) => list.some((s) => s.supermarket_id === id))
                                           : list.slice(0, 2).map((s) => s.supermarket_id)));
      })
      .catch((e) => setError(e.message));
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const useGps = () => run(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Tu navegador no permite la ubicación. Usa la de demo o escribe tu dirección."));
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Tu ubicación actual" }); resolve(); },
      () => reject(new Error("No he podido obtener tu ubicación. Usa la de demo o escribe tu dirección.")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }));
  const useDemo = () => run(async () => setLocation(await api.demoLocation()));
  const useAddress = (e) => {
    e.preventDefault();
    if (address.trim()) run(async () => setLocation(await api.geocode(address.trim())));
  };

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id)
      : prev.length < MAX_SELECTED ? [...prev, id] : prev));
  }

  const farFromAll = stores.length > 0 && stores[0].distance_km > 15;

  return (
    <div className="card location">
      <h3>📍 ¿Dónde estás?</h3>
      <div className="row">
        <button className="btn" onClick={useGps} disabled={busy}>📍 Usar mi ubicación</button>
        <button className="btn" onClick={useDemo} disabled={busy}>🎓 Campus UC3M Leganés (demo)</button>
      </div>
      <form className="row" onSubmit={useAddress}>
        <label htmlFor="address" className="sr-only">Tu dirección</label>
        <input id="address" className="grow" value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder="O escribe tu dirección (ej.: Calle Butarque 15, Leganés)" disabled={busy} />
        <button className="btn" type="submit" disabled={busy || !address.trim()}>Buscar</button>
      </form>
      {busy && <p className="muted">Buscando…</p>}
      {error && <p role="alert" className="error">{error}</p>}

      {location && (
        <>
          <p className="ok">✓ {location.label}</p>
          {farFromAll && (
            <p className="error">Estás lejos de los supermercados de la demo (están en Leganés). Prueba con la ubicación de demo.</p>
          )}
          <fieldset className="stores">
            <legend>Elige tus supermercados (máximo {MAX_SELECTED})</legend>
            {stores.map((s) => {
              const checked = selected.includes(s.supermarket_id);
              const disabled = !checked && selected.length >= MAX_SELECTED;
              return (
                <label key={s.supermarket_id} className={checked ? "store-option checked" : "store-option"}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(s.supermarket_id)} />
                  <span className="store-main">
                    <strong>{s.name}</strong>
                    <span className="muted">{s.address}</span>
                    <span className="muted small">{s.description}</span>
                  </span>
                  <span className="store-dist">
                    <strong>{s.distance_km.toString().replace(".", ",")} km</strong>
                    <span className="muted small">🚶 {s.walk_minutes} min</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </>
      )}
    </div>
  );
}
