FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY core/ core/
COPY templates/ templates/
COPY static/ static/
COPY docx_templates/ docx_templates/

RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p output data \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

CMD ["python", "app.py"]
