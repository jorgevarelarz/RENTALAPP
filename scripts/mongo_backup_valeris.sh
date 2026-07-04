#!/usr/bin/env bash
set -euo pipefail

SERVER="${VALERIS_SSH_HOST:-valeris-vps}"
OUT_DIR="${BACKUP_OUT_DIR:-backups/mongo}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REMOTE="/tmp/rentalapp-mongo-${STAMP}.archive.gz"
LOCAL="${OUT_DIR}/rentalapp-mongo-${STAMP}.archive.gz"

mkdir -p "$OUT_DIR"
ssh "$SERVER" "docker exec rental_mongo mongodump --archive='${REMOTE}' --gzip --db rentalapp"
scp "$SERVER:${REMOTE}" "$LOCAL"
ssh "$SERVER" "rm -f '${REMOTE}'"

echo "$LOCAL"
