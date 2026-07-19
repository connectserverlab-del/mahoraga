# Mahoraga HTTP service image.
#
# Ships the browser-automation engine + FastAPI service. By default it drives a
# BrowserOS kernel over CDP (BROWSEROS_CDP_URL), so this image does NOT need a
# bundled browser. If you run without a kernel, install a Chromium in a derived
# image and set MAHORAGA_CHROMIUM_PATH.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY mahoraga ./mahoraga

RUN pip install --upgrade pip && pip install .

EXPOSE 8080

# Drive the BrowserOS kernel by default; override via env at run time.
ENV MAHORAGA_HEADLESS=true

CMD ["mahoraga", "serve", "--host", "0.0.0.0", "--port", "8080"]
