#!/usr/bin/env bash
set -euo pipefail

echo "[setup] Bootstrap para macOS — RENTALAPP"

need_cmd() { command -v "$1" >/dev/null 2>&1 || return 1; }

if [ "${OSTYPE:-}" != "darwin" ] && ! uname | grep -qi darwin; then
  echo "[setup] Este script está pensado para macOS." >&2
  exit 1
fi

echo "[setup] Comprobando Homebrew..."
if ! need_cmd brew; then
  echo "[setup] Instalando Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
  eval "$($(which brew) shellenv)"
fi

echo "[setup] Instalando dependencias base..."
brew update || true
brew install git node@20 jq >/dev/null || true
brew link --overwrite --force node@20 >/dev/null || true

echo "[setup] Comprobando Docker Desktop (opcional para Mongo en contenedor)..."
if ! [ -d "/Applications/Docker.app" ]; then
  echo "[setup] Puedes instalar Docker Desktop con: brew install --cask docker"
  echo "        Abre Docker.app manualmente después para completar permisos."
fi

echo "[setup] Node version: $(node -v || echo 'no instalado')"
echo "[setup] NPM version:  $(npm -v || echo 'no instalado')"

echo "[setup] Copiando .env si no existe..."
[ -f .env ] || cp -v .env.example .env || true
[ -f frontend/.env ] || cp -v frontend/.env.example frontend/.env || true

echo "[setup] Instalando dependencias (root y frontend)..."
npm ci || npm install
npm ci --prefix frontend || npm install --prefix frontend

cat <<'NEXT'

[setup] ✅ Listo

Opciones para arrancar en local:
- Opción rápida (con hot reload y Mongo via Docker si disponible):
  npm run demo

- Arrancar backend + frontend en paralelo:
  npm run dev:all

- Arranque con Docker Compose (API + Mongo): revisa README, sección
  "Arranque local con Docker Compose (API + Mongo)" y ejecuta:
  docker compose up -d --build

Puntos de verificación:
- API:      http://localhost:3000/health
- Frontend: http://localhost:3001

NEXT

