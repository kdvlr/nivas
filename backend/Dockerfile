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
RUN cargo build --release --example play_audio

# ---- backend runtime ----
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 DATA_DIR=/data

# Install ffmpeg and runtime audio dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install --no-cache-dir .
COPY --from=frontend /build/dist ./static
COPY --from=airplay2-builder /build/target/release/examples/play_audio /usr/local/bin/airplay-play-audio

VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
