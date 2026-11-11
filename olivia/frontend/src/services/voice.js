import { api } from "./api.js";

/*
 * Voz de OlivIA: un único reproductor para toda la app.
 * - stopSpeaking() corta lo que suena Y cancela lo que se está generando (token),
 *   para que un audio que llega tarde no empiece a sonar después de pulsar «parar».
 * - prepareSpeech() genera el audio antes de enseñar el texto, así texto y voz salen a la vez.
 */
let current = null; // Audio que está sonando
let currentText = null; // texto que está sonando (para el botón play/stop)
let token = 0; // cada stop o nueva petición invalida las anteriores
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn(currentText));

/** Suscribirse a cambios (devuelve la función para desuscribirse). Recibe el texto que suena o null. */
export function onSpeakingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function stopSpeaking() {
  token++;
  if (current) {
    current.pause();
    current.removeAttribute("src");
  }
  current = null;
  currentText = null;
  notify();
}

function play(audio, text) {
  if (current && current !== audio) current.pause();
  current = audio;
  currentText = text;
  audio.onended = () => {
    if (current === audio) {
      current = null;
      currentText = null;
      notify();
    }
  };
  audio.play().catch(() => {});
  notify();
}

/**
 * Genera el audio y devuelve una función para reproducirlo (o null si falla o se ha cancelado).
 * Espera como mucho `timeoutMs`; si tarda más, devuelve null y el texto se enseña sin voz.
 */
export async function prepareSpeech(text, timeoutMs = 3000) {
  const my = ++token;
  if (current) current.pause();
  try {
    const url = await Promise.race([
      api.speak(text),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    if (my !== token) return null; // alguien pulsó parar o pidió otro audio
    const audio = new Audio(url);
    return () => { if (my === token) play(audio, text); };
  } catch {
    return null; // si la voz falla, el texto sigue en pantalla: la app nunca depende de la voz
  }
}

/** Habla ya (sin esperar a sincronizar con texto). */
export async function speak(text) {
  const start = await prepareSpeech(text, 15000);
  if (start) start();
}

/** Para el botón 🔊 de cada mensaje: si ese texto está sonando, lo para; si no, lo lee. */
export function toggleSpeak(text) {
  if (currentText === text) stopSpeaking();
  else speak(text);
}

export const isSpeaking = (text) => currentText === text;

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
