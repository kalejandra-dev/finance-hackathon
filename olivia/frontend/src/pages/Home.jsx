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

export default function Home({ onStart, onBudget }) {
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
            <button className="btn primary" onClick={onStart}>Planificar mi compra ↗</button>
            <button className="btn ghost" onClick={onBudget}>Ver mi presupuesto →</button>
          </div>
          <div className="hero-trust">
            <div className="trust-avatars" aria-hidden="true"><span>🥦</span><span>🥑</span><span>🍋</span></div>
            <span>Por voz o por texto. <strong>Pensada para todos.</strong></span>
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

      <section className="home-benefits" aria-label="Cómo funciona">
        {BENEFITS.map(([icon, title, text], i) => (
          <div className="benefit" key={title}>
            <div className="benefit-icon" aria-hidden="true">{icon}</div>
            <h2>{i + 1}. {title}</h2>
            <p>{text}</p>
          </div>
        ))}
      </section>

      <section className="home-bottom" aria-label="Empezar">
        <div>
          <span className="eyebrow">MÁS AHORRO, MENOS LÍO</span>
          <h2>El próximo ticket<br /><em>puede sorprenderte.</em></h2>
        </div>
        <button className="btn light" onClick={onStart}>Empezar ahora →</button>
      </section>
    </div>
  );
}
