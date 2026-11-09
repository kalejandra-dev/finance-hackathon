# 🫒 OlivIA — Compra mejor. Ahorra más.

Asistente de compra con IA: el usuario dice qué quiere cocinar o comprar (por texto o voz), **Claude** lo convierte en una lista estructurada y un **optimizador matemático (MILP)** reparte los productos entre supermercados para minimizar el coste total, incluido el desplazamiento.

> ⚠️ Los precios de `data/` son **datos de demostración**, no precios reales.

## Arquitectura

```
Frontend (React + Vite)  ──/api──▶  Backend (FastAPI)
                                     ├─ ai_service.py    → Claude API (tool use → JSON validado con Pydantic)
                                     ├─ voice_service.py → ElevenLabs (speech-to-text / text-to-speech)
                                     ├─ optimizer.py     → PuLP (MILP)
                                     └─ catalog.py       → SQLite (catálogo, listas, resultados)
```

**La IA interpreta; el optimizador calcula; la aplicación presenta.** La IA solo puede usar productos del catálogo (se le pasan como `enum` en el esquema) y no calcula precios.

### Modelo de optimización
- `x[i,s] ∈ {0,1}`: el producto *i* se compra en el súper *s*; `y[s] ∈ {0,1}`: se visita *s*.
- Minimizar `Σ envases(i)·precio(i,s)·x[i,s] + Σ desplazamiento(s)·y[s]`
- s.a. cada producto en un súper, `x[i,s] ≤ y[s]`, `Σ y[s] ≤ max_stores`.
- Se compara con el mejor supermercado único → **ahorro neto**.
- Simplificación del MVP: el desplazamiento es un coste fijo por supermercado visitado (`data/supermarkets.csv`).

## Requisitos
- Python 3.10+
- Node.js 18+
- Clave de API de Anthropic (Claude) y de ElevenLabs (opcional: sin ellas funciona en modo demo)

## Instalación y ejecución

```bash
# 1. Configuración
cp .env.example .env        # y rellena las claves

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Documentación interactiva de la API: http://localhost:8000/docs

# 3. Frontend (en otra terminal)
cd frontend
npm install
npm run dev
# Abre http://localhost:5173
```

## Tests
```bash
cd backend
pytest
```

## Endpoints
| Método | Endpoint | Función |
|---|---|---|
| POST | `/api/ai/interpret` | Interpreta la petición (texto) y devuelve lista estructurada |
| GET | `/api/products` | Catálogo |
| GET | `/api/supermarkets` | Supermercados |
| POST | `/api/shopping-list` · PUT `/api/shopping-list/{id}` | Guardar / modificar lista |
| POST | `/api/optimize` | Ejecuta el optimizador |
| GET | `/api/results/{id}` | Resultado guardado |
| POST | `/api/voice/transcribe` | Audio → texto (ElevenLabs) |
| POST | `/api/voice/speak` | Texto → audio (ElevenLabs) |

## Estructura
```
olivia/
├── backend/app/{api,services,schemas,database}/ · backend/tests/
├── frontend/src/{pages,components,services,styles}/
├── data/products.csv · data/supermarkets.csv
└── docs/
```
