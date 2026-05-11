# Staffing Dashboard

Staffing Dashboard is a React/Vite and FastAPI application for exploring staffing analytics generated from JMP Pro modeling outputs and stored in SQLite. The frontend is hosted on Vercel, while the FastAPI backend serves read-only analytics endpoints for filters, KPIs, neighborhood summaries, trends, forecasts, and health checks.

## Project Structure

- `backend/main.py`: FastAPI API endpoints and SQLite queries
- `backend/requirements.txt`: backend dependencies
- `backend/staffing_analytics.db`: default local SQLite database path
- `frontend/`: React app built with Vite
- `vercel.json`: Vercel frontend build configuration

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Modeling | JMP Pro | Forecasting and staffing analytics model generation |
| Backend | Python / FastAPI | API for dashboard filters, KPIs, trends, forecasts, and health checks |
| Database | SQLite | Local analytics datastore used by the FastAPI API |
| Frontend | React / Vite | Interactive dashboard UI |
| Frontend hosting | Vercel | Static frontend deployment |
| Backend hosting | Railway | Python/FastAPI backend deployment |

## Run Locally

Run the backend and frontend in separate terminals from the repository root.

### Backend (FastAPI)

macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Windows PowerShell:

```powershell
cd "C:\Users\dylan\.vscode\datamining\Final\staffing-dashboard\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r "requirements.txt"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

By default, the backend reads `backend/staffing_analytics.db`. To use another SQLite file, set `DB_PATH` before starting the server.

macOS/Linux:

```bash
DB_PATH=/absolute/path/to/staffing_analytics.db python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Windows PowerShell:

```powershell
$env:DB_PATH="C:\absolute\path\to\staffing_analytics.db"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (React)

macOS/Linux:

```bash
cd frontend
npm install
npm run dev
```

Windows PowerShell:

```powershell
cd "C:\Users\dylan\.vscode\datamining\Final\staffing-dashboard\frontend"
npm install
npm run dev
```

Frontend default URL: `http://127.0.0.1:5173`  
Backend API docs: `http://127.0.0.1:8000/docs`  
Backend health check: `http://127.0.0.1:8000/health`

## Deploy Backend To Railway

1. Create or sign in to a Railway account at `https://railway.app`.
2. Choose **New Project** and deploy from the GitHub repository.
3. Set the Railway service root directory to `backend` so Railway uses `backend/requirements.txt`, `backend/Procfile`, `backend/runtime.txt`, and `backend/railway.json`.
4. Confirm Railway detects a Python service using Nixpacks.
5. If the SQLite database is committed at `backend/staffing_analytics.db`, no database environment variable is required. If the database lives somewhere else in the Railway container, add a `DB_PATH` variable pointing to that file.
6. Deploy the service.
7. After deployment, open the generated Railway domain and verify `/health` returns `{"status":"ok"}`.

Railway starts the backend with:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

## Connect Vercel Frontend To Railway Backend

1. Copy the public Railway backend URL, for example `https://your-service.up.railway.app`.
2. In the Vercel project settings for the frontend, add an environment variable named `VITE_API_BASE_URL`.
3. Set `VITE_API_BASE_URL` to the Railway backend URL.
4. Redeploy the Vercel frontend so Vite includes the new backend URL at build time.
5. Make sure `backend/main.py` includes the Vercel frontend URL in the CORS `allow_origins` list.

Production frontend origin currently allowed by the backend:

```text
https://dataminingfinal.vercel.app
```

## Implemented API Endpoints

- `GET /health`
- `GET /filters`
- `GET /kpis`
- `GET /neighborhood-summary`
- `GET /trend`
- `GET /extremes`
- `GET /forecast`
- `GET /forecast-trend`
- `GET /category-count-trend`
- `GET /category-all-count-trend`
- `GET /map-hotspots`

All analytic endpoints support year range filters and optional neighborhood/category filters where applicable.

## Team

- Dylan Thomas: backend and modeling
- Sambhav Lamichhane: frontend and UI
