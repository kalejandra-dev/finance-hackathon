import { api } from "./api.js";

// Un único reproductor: si OlivIA empieza a hablar, se corta lo anterior.
let current = null;

export async function speak(text) {
  try {
    if (current) {
      current.pause();
      current = null;
    }
    const url = await api.speak(text);
    current = new Audio(url);
    await current.play();
  } catch {
    /* si la voz falla, el texto sigue en pantalla: la app nunca depende de la voz */
  }
}

export function stopSpeaking() {
  if (current) current.pause();
  current = null;
}

const eurosToWords = (n) => `${n.toFixed(2).replace(".", ",")} euros`;

/** Resumen hablado de los resultados de la optimización. */
export function resultSummary(result) {
  const { optimized, net_saving, within_budget, remaining_budget } = result;
  if (!optimized) return "No he podido encontrar una combinación de supermercados para tu lista.";
  const stores = optimized.stores.map((s) => s.name).join(" y ");
  let text = `Tu compra cuesta ${eurosToWords(optimized.total_cost)} en total, comprando en ${stores}.`;
  if (net_saving > 0) text += ` Ahorras ${eurosToWords(net_saving)} frente a comprarlo todo en un solo supermercado.`;
  if (within_budget === true) text += ` Te quedan ${eurosToWords(remaining_budget)} de presupuesto.`;
  if (within_budget === false) text += ` Te pasas del presupuesto en ${eurosToWords(-remaining_budget)}.`;
  return text;
}
