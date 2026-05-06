# Staffing Dashboard

React + FastAPI dashboard connected to `Final/staffing_analytics.db` for real-time query views.

## Project Structure

- `backend/main.py`: FastAPI API endpoints and SQLite queries
- `backend/requirements.txt`: backend dependencies
- `frontend/`: React app (Vite)

## Backend (FastAPI)

```powershell
cd "C:\Users\dylan\.vscode\datamining\Final\staffing-dashboard\backend"
python -m pip install -r "requirements.txt"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Frontend (React)

```powershell
cd "C:\Users\dylan\.vscode\datamining\Final\staffing-dashboard\frontend"
npm install
npm run dev
```

Frontend default URL: `http://127.0.0.1:5173`  
Backend API docs: `http://127.0.0.1:8000/docs`

## Implemented API Endpoints

- `GET /health`
- `GET /filters`
- `GET /kpis`
- `GET /neighborhood-summary`
- `GET /trend`
- `GET /extremes`

All analytic endpoints support year range filters and optional neighborhood/category filters where applicable.
