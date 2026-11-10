export default function Home({ onStart, onBudget }) {
  return (
    <section className="home" aria-labelledby="home-title">
      <h2 id="home-title" className="hero-title">Tu asistente para comprar mejor y ahorrar</h2>
      <p className="hero-sub">
        Dime qué quieres cocinar y tu presupuesto. OlivIA prepara la lista y te dice
        en qué supermercados comprar cada cosa para pagar menos, contando también el desplazamiento.
      </p>

      <button className="btn primary big hero-cta" onClick={onStart}>🛒 Planificar mi compra</button>
      <p><button className="btn" onClick={onBudget}>💶 Ver mi presupuesto</button></p>

      <ol className="features">
        <li className="card feature">
          <span className="feature-icon" aria-hidden="true">🎤</span>
          <h3>1. Habla o escribe</h3>
          <p>«Paella para 4, tengo 35 €». OlivIA calcula ingredientes y cantidades.</p>
        </li>
        <li className="card feature">
          <span className="feature-icon" aria-hidden="true">🧮</span>
          <h3>2. Optimizamos</h3>
          <p>Comparamos precios y elegimos la mejor combinación de supermercados.</p>
        </li>
        <li className="card feature">
          <span className="feature-icon" aria-hidden="true">💶</span>
          <h3>3. Ahorras</h3>
          <p>Ves cuánto ahorras, cuánto te queda de presupuesto y dónde comprar cada cosa.</p>
        </li>
      </ol>
    </section>
  );
}
