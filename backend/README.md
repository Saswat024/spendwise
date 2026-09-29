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
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

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

- `POST /auth/signup`, `POST /auth/login` — JWT issuance and authentication
- `GET /transactions` — filter by category, type, date range (`start`, `end`), search; sort by `sort_by` (`date`, `amount`) & `sort_order` (`asc`, `desc`); pagination (`page`, `page_size`)
- `POST /transactions` — create a new transaction
- `PUT /transactions/{tx_id}` — update an existing transaction
- `DELETE /transactions/{tx_id}` — delete a specific transaction
- `DELETE /transactions` or `DELETE /transactions/all` — delete all transactions for the authenticated user
- `GET /transactions/summary?month=YYYY-MM` — category breakdown + income vs expense totals
- `GET /transactions/trend?months=6` — monthly income/expense trend
- `GET /budgets` — list category budgets with current month spent-so-far and over-budget status
- `POST /budgets` — create or update a monthly budget for a category
- `DELETE /budgets/{budget_id}` — delete a category budget
- `POST /chat` — `{message, session_id}`, SSE stream of `token` / `chart` / `done` / `error` events
- `GET /chat/sessions` — list all saved chat conversations with titles and timestamps
- `DELETE /chat/sessions/{session_id}` — delete a conversation session
- `GET /chat/history?session_id=...` — fetch persisted chat messages for a session
- `GET /health` — health check status

All endpoints except `/auth/*` and `/health` require `Authorization: Bearer <jwt>`.

## Data model

- `users`: `{email, name, password_hash}`
- `transactions`: `{user_id, amount, type: income|expense, category, merchant, note, date}`
- `budgets`: `{user_id, category, limit}` (unique index per user + category)
- `chat_sessions`: `{user_id, session_id, title, created_at, updated_at, messages: [{role, content}]}`
