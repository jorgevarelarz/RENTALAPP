#!/usr/bin/env bash
set -euo pipefail

echo "[tunnel] Iniciando demo con URL públicas (LocalTunnel)"

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[tunnel] Necesito '$1' en PATH"; exit 1; }; }

need_cmd node
need_cmd npx

# Generador robusto de sufijos (evita 'tr: Illegal byte sequence' en macOS)
RND() {
  node -e "console.log(require('crypto').randomBytes(4).toString('hex').slice(0,6))" 2>/dev/null || \
  node -e "console.log(Math.random().toString(36).slice(2,8))" 2>/dev/null || \
  echo $RANDOM | LC_ALL=C tr -dc 'a-z0-9' | head -c 6
}
SUB_API="${LT_SUB_API:-raapi-$(RND)}"
SUB_FRONT="${LT_SUB_FRONT:-rafront-$(RND)}"

API_TUN_URL="https://${SUB_API}.loca.lt"
FRONT_TUN_URL="https://${SUB_FRONT}.loca.lt"

echo "[tunnel] Subdominios propuestos:"
echo "         API:   ${SUB_API} -> ${API_TUN_URL}"
echo "         Front: ${SUB_FRONT} -> ${FRONT_TUN_URL}"

# 0) Mongo via Docker (si existe), si no asumimos Mongo local
if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    echo "[tunnel] Levantando Mongo con docker compose..."
    docker compose up -d mongo
  else
    echo "[tunnel] Levantando Mongo con docker-compose..."
    docker-compose up -d mongo || true
  fi
else
  echo "[tunnel] Docker no encontrado. Asumo MongoDB local en 27017."
fi

# 1) Semillas de demo (si fallan, continuamos)
echo "[tunnel] Ejecutando seeds de demo..."
npm run seed || true
npm run seed:services || true

# 2) Arrancar backend con CORS permitiendo el front público
echo "[tunnel] Arrancando backend..."
export CORS_ORIGIN="http://localhost:3001,${FRONT_TUN_URL}"
export FRONTEND_URL="${FRONT_TUN_URL}"
(
  npm run dev
) &
BACK_PID=$!

cleanup() {
  echo "\n[tunnel] Terminando procesos..."
  set +e
  [ -n "${TUN_API_PID:-}" ] && kill ${TUN_API_PID} 2>/dev/null || true
  [ -n "${TUN_FRONT_PID:-}" ] && kill ${TUN_FRONT_PID} 2>/dev/null || true
  [ -n "${BACK_PID:-}" ] && kill ${BACK_PID} 2>/dev/null || true
  [ -n "${FRONT_PID:-}" ] && kill ${FRONT_PID} 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait_port() {
  local host=$1 port=$2 name=${3:-svc}
  for i in {1..60}; do
    if nc -z "$host" "$port" >/dev/null 2>&1; then
      echo "[tunnel] $name listo en ${host}:${port}"
      return 0
    fi
    sleep 1
  done
  echo "[tunnel] Timeout esperando ${name} en ${host}:${port}" >&2
  return 1
}

wait_port localhost 3000 API || true

# 3) Crear túnel público para la API
echo "[tunnel] Creando túnel API → ${API_TUN_URL}"
(
  npx localtunnel --port 3000 --subdomain "${SUB_API}"
) &
TUN_API_PID=$!
sleep 2
if ! kill -0 ${TUN_API_PID} >/dev/null 2>&1; then
  echo "[tunnel] Error creando túnel API (subdominio quizá ocupado)." >&2
  echo "[tunnel] Prueba manual: npx localtunnel --port 3000"
  exit 1
fi

# 4) Arrancar frontend apuntando al túnel de API
echo "[tunnel] Arrancando frontend (CRA) apuntando a la API pública..."
export HOST=0.0.0.0
export PORT=3001
export BROWSER=none
export REACT_APP_API_URL="${API_TUN_URL}"
(
  npm --prefix frontend start
) &
FRONT_PID=$!

wait_port localhost 3001 Frontend || true

# 5) Crear túnel público para el Frontend
echo "[tunnel] Creando túnel Front → ${FRONT_TUN_URL}"
(
  npx localtunnel --port 3001 --subdomain "${SUB_FRONT}"
) &
TUN_FRONT_PID=$!
sleep 2
if ! kill -0 ${TUN_FRONT_PID} >/dev/null 2>&1; then
  echo "[tunnel] Error creando túnel Front (subdominio quizá ocupado)." >&2
  echo "[tunnel] Prueba manual: npx localtunnel --port 3001"
  exit 1
fi

echo ""
echo "[tunnel] ✅ Listo para compartir"
echo "        Front público: ${FRONT_TUN_URL}"
echo "        API pública:   ${API_TUN_URL}"
echo "        (Mantén esta terminal abierta durante la demo)"
echo ""

# 6) Mantener procesos vivos hasta Ctrl+C
wait
