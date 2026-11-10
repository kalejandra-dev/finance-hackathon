async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res;
}

export const api = {
  interpret: async (body) => (await request("/ai/interpret", { method: "POST", body: JSON.stringify(body) })).json(),
  optimize: async (body) => (await request("/optimize", { method: "POST", body: JSON.stringify(body) })).json(),
  products: async () => (await request("/products")).json(),
  confirmPurchase: async (resultId) =>
    (await request("/purchases", { method: "POST", body: JSON.stringify({ result_id: resultId }) })).json(),
  purchases: async () => (await request("/purchases")).json(),
  deletePurchase: async (id) => { await request(`/purchases/${id}`, { method: "DELETE" }); },
  transcribe: async (blob, filename = "audio.webm") => {
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "No se pudo transcribir el audio");
    }
    return (await res.json()).text;
  },
  speak: async (text) => {
    const res = await request("/voice/speak", { method: "POST", body: JSON.stringify({ text }) });
    return URL.createObjectURL(await res.blob());
  },
};
