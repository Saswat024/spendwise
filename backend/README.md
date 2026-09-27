# SpendWise Backend

FastAPI + MongoDB (Motor) backend for SpendWise. The chatbot uses Groq's
OpenAI-compatible API with the `openai/gpt-oss-120b` model and tool-calling
over MongoDB aggregation pipelines.

## Requirements

- Python 3.12+
- A MongoDB Atlas cluster (or any MongoDB 5+)
- A Groq API key (https://console.groq.com)

## Environment variables

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string (include the database name, e.g. `...mongodb.net/spendwise`) |
| `JWT_SECRET` | Long random string used to sign JWTs |
| `LLM_API_KEY` | Groq API key (`gsk_...`) |
| `LLM_MODEL` | Optional, defaults to `openai/gpt-oss-120b` |
| `LLM_BASE_URL` | Optional, defaults to `https://api.groq.com/openai/v1` |
| `FRONTEND_ORIGIN` | Optional CORS origin, defaults to `*` |

Copy `.env.example` to `.env` and fill in your values.

## Run locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Run with Docker

```bash
cd backend
docker build -t spendwise-backend .
docker run -p 8000:8000 \
  -e MONGODB_URI="..." -e JWT_SECRET="..." -e LLM_API_KEY="..." \
  spendwise-backend
```

## Deploy

Any container host works (Render, Railway, Fly.io, Cloud Run, ECS...):

1. Push this `backend/` folder to a repo.
2. Create a service from the Dockerfile.
3. Set the three required environment variables.
4. Point the frontend at the deployed URL via `VITE_API_BASE`.

## API overview

- `POST /auth/signup`, `POST /auth/login` — JWT issue, bcrypt password hashing
- `GET/POST/PUT/DELETE /transactions` — filters (category, type, date range, search), pagination
- `GET /transactions/summary?month=YYYY-MM` — category breakdown + income vs expense totals
- `GET /transactions/trend?months=6` — monthly income/expense trend
- `GET/POST/DELETE /budgets` — per-category limits with computed spent-so-far and over-budget flag
- `POST /chat` — `{message, session_id}`, SSE stream of `token` / `chart` / `done` events
- `GET /chat/history?session_id=...` — persisted chat history

All endpoints except `/auth/*` and `/health` require `Authorization: Bearer <jwt>`.

## Data model

- `users`: `{email, name, password_hash}`
- `transactions`: `{user_id, amount, type: income|expense, category, merchant, note, date}`
- `budgets`: `{user_id, category, limit}` (unique per user+category)
- `chat_sessions`: `{user_id, session_id, messages[]}`
