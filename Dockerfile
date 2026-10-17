# Optional: for Railway / Hugging Face Spaces / any Docker host. Needs the same environment variables as
# render.yaml (APP_ENV, DATABASE_URL, SECRET_KEY, ENABLE_DEMO_MODE).
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python build.py && useradd --create-home --uid 10001 app && chown -R app /app
USER app
ENV PORT=8000 APP_ENV=production
EXPOSE 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
