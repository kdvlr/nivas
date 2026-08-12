# ---- frontend build ----
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --outDir /build/dist --emptyOutDir

# ---- airplay2-rs build ----
FROM rust:alpine AS airplay2-builder
WORKDIR /build
RUN apk add --no-cache alsa-lib-dev musl-dev gcc g++ pkgconfig
COPY airplay2-rs-repo ./
RUN cargo build --release -p airplay-client --example play_audio

# ---- Python dependency wheels ----
# miniaudio builds from source on some architectures. Keep that compiler out
# of the final always-on image by producing all wheels in a dedicated stage.
FROM python:3.12-slim AS python-deps
WORKDIR /build
RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ \
    && rm -rf /var/lib/apt/lists/*
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip wheel --no-cache-dir --wheel-dir /wheels .

# ---- backend runtime ----
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    DATA_DIR=/data \
    AIRPLAY_IDENTITY_DIR=/data/airplay-identities \
    STATIC_DIR=/app/static

# Install only runtime audio dependencies.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=python-deps /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels family-dashboard \
    && rm -rf /wheels
COPY --from=frontend /build/dist ./static
COPY --from=airplay2-builder /build/target/release/examples/play_audio /usr/local/bin/airplay-play-audio

VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
