#!/usr/bin/env bash
set -euo pipefail

echo "[demo] Iniciando entorno para demo local"

# 1) Arrancar MongoDB (Docker si está disponible)
if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    echo "[demo] Levantando Mongo con 'docker compose'..."
    docker compose up -d mongo
  else
    echo "[demo] Levantando Mongo con 'docker-compose'..."
    docker-compose up -d mongo
  fi

  echo "[demo] Esperando a que Mongo escuche en 27017..."
  for i in {1..30}; do
    if nc -z localhost 27017 >/dev/null 2>&1; then
      echo "[demo] Mongo está listo"
      break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
      echo "[demo] Aviso: no se detectó Mongo en 27017 tras 30s. Continuo igualmente."
    fi
  done
else
  echo "[demo] Docker no encontrado. Asumo que tienes MongoDB local escuchando en 27017."
fi

# 2) Semillas de datos
echo "[demo] Lanzando semillas de demo (usuarios, propiedades, servicios)..."
npm run seed || true
npm run seed:services || true

echo "[demo] Detectando IP local para acceso desde móvil/otro PC..."
# Heurística multi-OS para IP local
LOCAL_IP=""
if command -v ipconfig >/dev/null 2>&1; then
  # macOS: Wi‑Fi suele ser en0; Ethernet en1
  LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || true)
  if [ -z "$LOCAL_IP" ]; then LOCAL_IP=$(ipconfig getifaddr en1 2>/dev/null || true); fi
fi
if [ -z "$LOCAL_IP" ] && command -v hostname >/dev/null 2>&1; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$LOCAL_IP" ] && command -v ip >/dev/null 2>&1; then
  LOCAL_IP=$(ip -4 addr show | awk '/inet / && $2 !~ /^127\./ {print $2}' | cut -d/ -f1 | head -n1)
fi

if [ -n "$LOCAL_IP" ]; then
  echo "[demo] IP local detectada: $LOCAL_IP"
  echo "[demo] Preparando variables para compartir en la red local..."
  # CRA: servir en todas las interfaces
  export HOST=0.0.0.0
  # Front consumirá la API en la IP del host
  export REACT_APP_API_URL="http://$LOCAL_IP:3000"
  # Backend permitirá CORS desde localhost y desde la IP del host
  if [ -z "${CORS_ORIGIN:-}" ]; then
    export CORS_ORIGIN="http://localhost:3001,http://$LOCAL_IP:3001"
  else
    export CORS_ORIGIN="$CORS_ORIGIN,http://$LOCAL_IP:3001"
  fi
  echo "[demo] CORS_ORIGIN=$CORS_ORIGIN"
else
  echo "[demo] No se pudo detectar IP local automáticamente."
  echo "[demo] Si necesitas acceso desde móvil/otro PC, usa la IP de tu equipo y ajusta:"
  echo "       HOST=0.0.0.0 REACT_APP_API_URL=http://<TU_IP>:3000 CORS_ORIGIN=...,http://<TU_IP>:3001"
fi

echo "[demo] Listo. Arrancando backend + frontend (puertos 3000 y 3001)."
echo "[demo] - API (local):      http://localhost:3000/health"
echo "[demo] - Frontend (local): http://localhost:3001"
if [ -n "$LOCAL_IP" ]; then
  echo "[demo] - API (red):        http://$LOCAL_IP:3000/health"
  echo "[demo] - Frontend (red):   http://$LOCAL_IP:3001"
fi

# 3) Ejecutar ambos en paralelo (ver package.json: dev:all)
npm run dev:all
