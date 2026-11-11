import { useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";

const RECEIPT = [
  ["🍚", "Arroz redondo", "1 kg", "1,20 €"],
  ["🦐", "Gambas peladas", "400 g", "6,02 €"],
  ["🫒", "Aceite de oliva", "1 L", "8,82 €"],
];

const BENEFITS = [
  ["🎤", "Habla o escribe", "«Paella para 4, tengo 35 €». OlivIA calcula ingredientes y cantidades."],
  ["🧮", "Optimizamos", "Comparamos precios y elegimos la mejor combinación de supermercados, contando el desplazamiento."],
  ["💶", "Ahorras", "Ves cuánto ahorras, cuánto te queda de presupuesto y dónde comprar cada cosa."],
];

// Peticiones de ejemplo de la cinta animada (al pulsarlas, OlivIA empieza con esa petición)
const IDEAS = [
  ["🥘", "Paella para 4 personas, 35 €"],
  ["🍝", "Pasta carbonara para 2"],
  ["🍲", "Lentejas para 3 con 10 €"],
  ["🥗", "Ensalada para una cena ligera"],
  ["🛒", "Leche, huevos, pan y café"],
  ["🌮", "Tacos para 6 amigos"],
  ["🍳", "Desayunos de la semana"],
  ["🥦", "Menú vegetariano para 2 días"],
];

/** Número que cuenta hacia arriba cuando entra en pantalla (sin animación si el usuario la reduce). */
function CountUp({ value, prefix = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) { setShown(value); return undefined; }
    let raf;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - start) / 1100);
        setShown(Math.round(value * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: .4 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);

  return <span ref={ref} aria-hidden="true">{prefix}{shown.toLocaleString("es-ES")}</span>;
}

/** Cifras reales del catálogo de demostración (se calculan con la API, no son inventadas). */
function useCatalogStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    Promise.all([api.products(), api.supermarkets()])
      .then(([products, stores]) => setStats({
        products: Object.keys(products).length,
        prices: Object.values(products).reduce((n, offers) => n + Object.keys(offers).length, 0),
        stores: stores.length,
      }))
      .catch(() => setStats(null));
  }, []);
  return stats;
}

export default function Home({ onStart, onBudget, onIdea }) {
  const stats = useCatalogStats();

  return (
    <div className="home-page">
      <section className="hero-section" aria-labelledby="home-title">
        <div className="hero-copy">
          <div className="tiny-label"><span className="green-spark" aria-hidden="true">✧</span>TU COMPRA, MÁS INTELIGENTE</div>
          <h1 id="home-title">Tu asistente para<br />comprar mejor<br /><em>y ahorrar.</em></h1>
          <p>
            Dime qué quieres cocinar y tu presupuesto. OlivIA prepara la lista y te dice
            en qué supermercados comprar cada cosa para pagar menos, contando también el desplazamiento.
          </p>
          <div className="hero-actions">
            <button className="btn primary" onClick={onStart}>Planificar mi compra <span className="arrow" aria-hidden="true">↗</span></button>
            <button className="btn ghost" onClick={onBudget}>Ver mi presupuesto <span className="arrow" aria-hidden="true">→</span></button>
          </div>
          <p className="cta-note">Gratis · Sin registro · Por voz o por texto</p>
          <div className="hero-trust">
            <div className="trust-avatars" aria-hidden="true"><span>🥦</span><span>🥑</span><span>🍋</span></div>
            <span>Pensada para todos: <strong>accesible y fácil de usar.</strong></span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="art-halo art-halo-1" />
          <div className="art-halo art-halo-2" />
          <div className="floating-tag tag-top">✧ Compra optimizada</div>
          <div className="floating-receipt">
            <div className="receipt-header">
              <div className="receipt-icon">🧺</div>
              <div><strong>Tu cesta ideal</strong><span>Comparativa orientativa</span></div>
              <span className="receipt-menu">•••</span>
            </div>
            {RECEIPT.map(([emoji, name, pack, price]) => (
              <div className="receipt-row" key={name}>
                <span className="grocery-emoji">{emoji}</span>
                <div><strong>{name}</strong><small>{pack}</small></div>
                <b>{price}</b>
              </div>
            ))}
            <div className="receipt-divider" />
            <div className="receipt-total"><span>Un ejemplo de ahorro</span><strong>– 3,20 €</strong></div>
            <div className="receipt-footer"><span className="small-circle" /> PRECIOS DE DEMOSTRACIÓN</div>
          </div>
          <div className="floating-tag tag-bottom">📍 Contando el desplazamiento</div>
        </div>
      </section>

      <section className="ideas-marquee" aria-label="Ideas para empezar">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <ul className="marquee-group" key={copy} aria-hidden={copy === 1 ? "true" : undefined}>
              {IDEAS.map(([emoji, text]) => (
                <li key={text}>
                  <button className="idea-chip" onClick={() => onIdea(text)} tabIndex={copy === 1 ? -1 : undefined}>
                    <span aria-hidden="true">{emoji}</span> {text} <span className="arrow" aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {stats && (
        <section className="stats-band" aria-labelledby="stats-title">
          <h2 id="stats-title">Comparamos de verdad, <em>no a ojo.</em></h2>
          <dl className="stats-row">
            <div><dt className="sr-only">Productos en el catálogo</dt>
              <dd><strong><CountUp value={stats.products} prefix="+" /><span className="sr-only">{stats.products}</span></strong>
                <span>productos en el catálogo</span></dd></div>
            <div><dt className="sr-only">Precios comparados</dt>
              <dd><strong><CountUp value={stats.prices} prefix="+" /><span className="sr-only">{stats.prices}</span></strong>
                <span>precios comparados</span></dd></div>
            <div><dt className="sr-only">Supermercados</dt>
              <dd><strong><CountUp value={stats.stores} /><span className="sr-only">{stats.stores}</span></strong>
                <span>supermercados en la demo</span></dd></div>
          </dl>
          <p className="stats-note">Datos del catálogo de demostración que usa la app ahora mismo.</p>
        </section>
      )}

      <section className="home-benefits" aria-label="Cómo funciona">
        {BENEFITS.map(([icon, title, text], i) => (
          <button className="benefit" key={title} onClick={onStart}>
            <span className="benefit-icon" aria-hidden="true">{icon}</span>
            <span className="benefit-title">{i + 1}. {title}</span>
            <span className="benefit-text">{text}</span>
            <span className="benefit-arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </section>

      <section className="home-bottom" aria-labelledby="closing-title">
        <span className="eyebrow">MÁS AHORRO, MENOS LÍO</span>
        <h2 id="closing-title">Tu próximo ticket<br /><em>puede sorprenderte.</em></h2>
        <div className="closing-actions">
          <button className="btn light" onClick={onStart}>Empezar ahora <span className="arrow" aria-hidden="true">→</span></button>
          <span>Sin registro. Tú decides siempre qué comprar.</span>
        </div>
      </section>
    </div>
  );
}
