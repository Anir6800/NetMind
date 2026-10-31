FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/ ./backend/
RUN pip install --no-cache-dir ./backend 'uvicorn>=0.30,<1'
COPY data/ ./data/
COPY --from=frontend /app/frontend/dist ./frontend/dist
WORKDIR /app/backend
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
