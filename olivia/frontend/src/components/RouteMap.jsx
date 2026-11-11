import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../services/api.js";

/** Enlace a Google Maps con la ruta a pie (no necesita API key). */
function googleMapsUrl(origin, stops) {
  const p = (x) => `${x.lat},${x.lon}`;
  const params = new URLSearchParams({
    api: "1",
    origin: p(origin),
    destination: p(stops[stops.length - 1]),
    travelmode: "walking",
  });
  if (stops.length > 1) params.set("waypoints", stops.slice(0, -1).map(p).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

const pin = (html, cls) => L.divIcon({ html, className: `pin ${cls}`, iconSize: [34, 34], iconAnchor: [17, 17] });

/** Ventana «TU RECORRIDO»: mapa con la ruta desde el usuario por los supermercados de la compra. */
export default function RouteMap({ location, storeIds }) {
  const mapEl = useRef(null);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!location || !storeIds.length) return;
    api.route({ lat: location.lat, lon: location.lon }, storeIds).then(setRoute).catch((e) => setError(e.message));
  }, [location, storeIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!route || !mapEl.current) return;
    const map = L.map(mapEl.current, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const line = L.polyline(route.geometry, { color: "#4b5d23", weight: 5, opacity: 0.85,
      dashArray: route.source === "estimate" ? "8 8" : null }).addTo(map);
    L.marker([route.origin.lat, route.origin.lon], { icon: pin("🏠", "home"), title: "Tu ubicación" })
      .addTo(map).bindPopup("Tu ubicación");
    route.stops.forEach((s, i) => {
      L.marker([s.lat, s.lon], { icon: pin(String(i + 1), "stop-pin"), title: s.name })
        .addTo(map).bindPopup(`<strong>${i + 1}. ${s.name}</strong><br>${s.address}`);
    });
    map.fitBounds(line.getBounds(), { padding: [30, 30] });
    return () => map.remove();
  }, [route]);

  if (!location) return null;

  return (
    <div className="card route">
      <h3>🗺️ TU RECORRIDO</h3>
      {error && <p role="alert" className="error">No se pudo calcular la ruta: {error}</p>}
      {!route && !error && <p className="muted">Calculando la ruta…</p>}
      {route && (
        <>
          <p className="route-summary">
            <strong>🚶 {route.walk_minutes} min</strong> andando · {route.distance_km.toString().replace(".", ",")} km
            (ida y vuelta)
            {route.source === "estimate" && <span className="muted small"> · ruta aproximada</span>}
          </p>
          <ol className="route-stops">
            <li>🏠 Sales de: {location.label}</li>
            {route.stops.map((s, i) => <li key={s.supermarket_id}><span className="stop">{i + 1}</span> {s.name} · {s.address}</li>)}
            <li>🏠 Vuelves a casa</li>
          </ol>
        </>
      )}
      <div ref={mapEl} className="map" role="img" aria-label="Mapa con tu recorrido de compra" />
      {route && (
        <a className="btn primary big" href={googleMapsUrl(route.origin, route.stops)} target="_blank" rel="noreferrer">
          📍 Abrir ruta en Google Maps
        </a>
      )}
    </div>
  );
}
