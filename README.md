# 🫒 OlivIA — Compra mejor. Ahorra más.

**OlivIA** es un asistente de compra con IA para reducir el gasto en alimentación del hogar. El usuario dice, por voz o por texto, qué quiere cocinar o comprar y cuánto puede gastar. OlivIA:

1. **Entiende la petición** con Claude y la convierte en una lista de la compra con cantidades.
2. **Optimiza la compra** con un modelo matemático (MILP) que reparte los productos entre los 2–3 supermercados cercanos que elige el usuario, **contando también el coste del desplazamiento**.
3. **Presenta el resultado**: coste total, ahorro neto frente a comprar todo en un solo supermercado, presupuesto restante, qué comprar en cada sitio y la ruta a pie en un mapa.

> ⚠️ **Datos de demostración.** Los supermercados (SuperAhorro, MercaBarrio, FrescoMarket, DescuentoPlus e HiperOliva) son ficticios, situados en Leganés, y sus precios son inventados. El método es el mismo con precios reales.

**Contexto:** según el INE (Encuesta de Presupuestos Familiares 2025), cada hogar español gastó de media 5.626 € en alimentación y bebidas no alcohólicas, el 16 % de su presupuesto.

---

## Funcionalidades

| Función | Descripción |
|---|---|
| 🎤 **Petición por voz o texto** | «Paella para 4, tengo 35 €». También permite editar la lista hablando: «quita las gambas y pon calamar». |
| 🧠 **IA con salida estructurada** | Claude responde mediante *tool use* con un JSON validado con Pydantic. Solo puede elegir productos del catálogo y **nunca calcula precios**. |
| 📍 **Supermercados cercanos** | Ubicación por GPS, por dirección o con la ubicación de demo (Campus UC3M Leganés). Se preseleccionan el supermercado más cercano y el más barato. |
| 🧮 **Optimización MILP** | Elige dónde comprar cada producto para minimizar productos + desplazamiento, con un máximo de supermercados. |
| 🗺️ **Tu recorrido** | Mapa con la ruta a pie (OpenStreetMap + OSRM) y un botón para abrirla en Google Maps. |
| 💶 **Mi presupuesto** | Presupuesto restante, gasto por supermercado e historial de las compras confirmadas con el ahorro acumulado. |
| 🔊 **Respuestas habladas** | OlivIA lee en voz alta sus respuestas y el resumen de la compra (ElevenLabs). |
| ♿ **Accesibilidad** | Texto ampliable (A− / A+), modo de alto contraste (negro, blanco y verde), navegación con teclado y voz activable o desactivable. |

---

## Requisitos

- **Python 3.9 o superior**
- **Node.js 18 o superior** (incluye `npm`)
- Conexión a internet para la IA, la voz y los mapas
- Opcional: claves de API de **Anthropic** (Claude) y de **ElevenLabs** (voz)

> 💡 **Sin claves también funciona.** Sin `ANTHROPIC_API_KEY` la app arranca en **modo demo**: la IA devuelve una respuesta de ejemplo (una paella para 4) y todo lo demás —lista, optimizador, mapa y presupuesto— funciona igual. Sin la clave de ElevenLabs se puede usar la app escribiendo en lugar de hablar.

---

## Instalación y ejecución

### 1. Configuración (desde la raíz del proyecto)

```bash
cp .env.example .env
```

Abre `.env` y rellena lo que tengas:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `ANTHROPIC_API_KEY` | No (sin ella: modo demo) | Clave de la API de Claude |
| `OLIVIA_MODEL` | No | Modelo de Claude (por defecto `claude-sonnet-5-5`) |
| `OLIVIA_EFFORT` | No | Nivel de razonamiento: `low` (más rápido, por defecto), `medium` o `high` |
| `OLIVIA_AI_MOCK` | No | `1` = forzar el modo demo aunque haya clave, para desarrollar sin gastar |
| `ELEVENLABS_API_KEY` | No (sin ella: sin voz) | Clave de ElevenLabs |
| `ELEVENLABS_VOICE_ID` | No | Voz de OlivIA (por defecto, una voz multilingüe de ElevenLabs) |

Las claves también pueden ir en un archivo `.env.local`, que se lee antes que `.env`. **Ninguno de los dos se sube al repositorio**: ambos están en `.gitignore`.

### 2. Backend (terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Comprobación: http://localhost:8000/api/health debe responder `{"status":"ok"}`. La documentación interactiva de la API está en http://localhost:8000/docs.

### 3. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173** en Chrome o Safari.

### Recorrido de prueba (2 minutos)

1. **Planificar mi compra** → pulsa la sugerencia «Paella para 4 personas, 35 €…» o di la frase con 🎤 **Hablar**.
2. **Revisar mi lista** → pulsa **Campus UC3M Leganés (demo)**. Quedan preseleccionados el supermercado más cercano y el más barato.
3. **Optimizar mi compra** → aparecen el coste total, el **ahorro neto**, el presupuesto restante, qué comprar en cada supermercado y **Tu recorrido**.
4. **He hecho esta compra** → la compra se suma al historial de **Mi presupuesto**.

---

## Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

Hay 28 tests que cubren la API, el optimizador, el servicio de IA (con un cliente de Claude simulado), la geolocalización y las rutas (sin llamar a internet) y el historial de compras. **No gastan créditos de ninguna API.**

---

## Arquitectura

```
                 ┌──────────────────────────────┐
  Usuario  ───▶  │ Frontend · React + Vite       │  Leaflet (mapa) · accesibilidad
 (voz/texto)     └──────────────┬───────────────┘
                                │  /api (proxy de Vite)
                 ┌──────────────▼───────────────┐
                 │ Backend · FastAPI (Python)    │
                 ├──────────────────────────────┤
                 │ ai_service.py    → Claude API (tool use → JSON validado con Pydantic)
                 │ voice_service.py → ElevenLabs (Scribe: voz→texto · TTS: texto→voz)
                 │ optimizer.py     → PuLP / CBC (MILP)
                 │ geo.py           → distancias (haversine), Nominatim, OSRM
                 │ catalog.py       → SQLite (catálogo, listas, resultados)
                 │ purchases.py     → SQLite (historial de compras confirmadas)
                 └──────────────────────────────┘
```

**Principio de diseño: la IA interpreta, el optimizador calcula y la app presenta.** Un modelo de lenguaje puede equivocarse con los números, así que la IA solo produce datos estructurados: el nombre de cada producto se valida contra el catálogo (`enum` en el esquema), y los precios y el ahorro los calcula siempre el optimizador.

**Robustez:** si falla un servicio externo, la app sigue funcionando. Si la ruta por calles no está disponible, se dibuja una ruta aproximada. Si falla la voz, se puede escribir. Sin clave de IA, funciona en modo demo.

### Modelo de optimización (MILP)

- Variables: `x[i,s] ∈ {0,1}` indica que el producto *i* se compra en el supermercado *s*; `y[s] ∈ {0,1}` indica que se visita *s*.
- Objetivo: minimizar `Σ envases(i,s)·precio(i,s)·x[i,s] + Σ desplazamiento(s)·y[s]`.
- Restricciones:
  - cada producto se compra en un solo supermercado: `Σ_s x[i,s] = 1`;
  - solo se compra en supermercados visitados: `x[i,s] ≤ y[s]`;
  - límite de supermercados: `Σ y[s] ≤ max_stores`;
  - solo se usan los supermercados que ha elegido el usuario.
- **Desplazamiento:** distancia desde la ubicación del usuario (haversine × 1,3 como corrección por calles) × ida y vuelta × 0,25 €/km.
- **Ahorro neto** = coste del mejor supermercado único que tenga todos los productos − coste optimizado. Los dos incluyen el desplazamiento.
- El presupuesto no es una restricción dura: si se supera, la app lo indica y propone ajustar la lista.

---

## Endpoints principales

| Método | Endpoint | Función |
|---|---|---|
| GET | `/api/health` | Estado del servidor |
| POST | `/api/ai/interpret` | Interpreta la petición y devuelve la lista estructurada |
| POST | `/api/voice/transcribe` | Audio → texto (ElevenLabs) |
| POST | `/api/voice/speak` | Texto → audio MP3 (ElevenLabs) |
| GET | `/api/products` · `/api/supermarkets` | Catálogo y supermercados |
| GET | `/api/location/demo` | Ubicación de demo (Campus UC3M Leganés) |
| GET | `/api/supermarkets/nearby?lat=&lon=` | Supermercados ordenados por distancia, con nivel de precio |
| GET | `/api/geocode?q=` | Dirección → coordenadas (Nominatim) |
| POST | `/api/optimize` | Optimiza la cesta (supermercados elegidos + ubicación) |
| POST | `/api/route` | Ruta a pie por los supermercados (OSRM, o estimación si no responde) |
| GET | `/api/results/{id}` | Resultado guardado |
| POST / PUT | `/api/shopping-list` · `/api/shopping-list/{id}` | Guardar o modificar la lista |
| GET / POST / DELETE | `/api/purchases` · `/api/purchases/{id}` | Historial de compras confirmadas |

---

## Estructura del proyecto

```
olivia/
├── backend/
│   ├── app/
│   │   ├── api/          # routes.py, purchases.py (endpoints)
│   │   ├── services/     # ai_service, voice_service, optimizer, geo
│   │   ├── schemas/      # modelos Pydantic (contratos de datos)
│   │   └── database/     # SQLite: catálogo e historial
│   ├── tests/            # pytest
│   └── requirements.txt
├── frontend/
│   ├── public/           # iconos de la app
│   └── src/              # pages/, components/, services/, styles/
├── data/
│   ├── products.csv      # 120 productos × 5 supermercados (demo)
│   └── supermarkets.csv  # 5 supermercados ficticios en Leganés
├── .env.example
└── README.md
```

---

## Limitaciones conocidas (MVP)

- Precios y supermercados de demostración: no hay conexión con precios reales.
- El catálogo es cerrado (120 productos). Si se pide algo que no está, OlivIA lo indica en vez de inventarlo.
- El coste de desplazamiento es una estimación sencilla (€/km).
- Los mapas, las rutas y la búsqueda de direcciones usan servicios públicos gratuitos de OpenStreetMap, pensados para demos y con límites de uso.

## Próximos pasos

- Precios reales mediante acuerdos con supermercados.
- Conexión con la cuenta bancaria para detectar el gasto real en alimentación.
- Planificación semanal de menús con alertas de presupuesto.

---

Proyecto desarrollado para la **Finance Hackathon de BEST UC3M (2026)**.
