/** Cabecera de cada pantalla: etiqueta pequeña, título con una palabra en cursiva, descripción y acción opcional. */
export default function PageHeading({ id, eyebrow, title, em, desc, right }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 id={id}>{title} {em && <em>{em}</em>}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {right && <div className="section-right">{right}</div>}
    </div>
  );
}
