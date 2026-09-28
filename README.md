# SpendWise

SpendWise is a personal finance tracker with automated analytics, budget tracking, and an AI spending assistant powered by Groq (`openai/gpt-oss-120b`) and MongoDB.

## Features

- **Dashboard**: Monthly spending overview, expense breakdown by category, and multi-month trend charts.
- **Transactions**: Add, filter, search, paginate, and track income and expenses.
- **Budgets**: Set and monitor category-level monthly budgets with visual progress indicators.
- **AI Assistant**: Natural language chat interface with tool calling and markdown-formatted advice to answer spending questions and suggest savings.

## Tech Stack

- **Frontend**: TanStack Start / React 19, Vite, Tailwind CSS v4, Lucide React, Recharts.
- **Backend**: FastAPI, MongoDB (Motor), Pydantic v2, Python-Jose (JWT auth), Passlib (Bcrypt), Groq LLM API.

## Getting Started

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/` based on `.env.example`:

```ini
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=Cluster0
JWT_SECRET=your-secret-key-here
LLM_API_KEY=gsk_...
```

Start the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

In the project root:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.
