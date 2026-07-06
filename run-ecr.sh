#!/usr/bin/env bash
# Run the full WealthOrbit stack from the ECR images.
#
# This handles the three things that broke after switching from `build:`
# to ECR `image:` references:
#   1. ECR is private  -> logs Docker in first (token expires every 12h)
#   2. images are multi-arch now -> Docker auto-picks amd64 or arm64
#   3. always pulls :latest so you never run a stale cached image
#
# Usage:  ./run-ecr.sh          (login + pull + up)
#         ./run-ecr.sh down     (stop and remove)
set -euo pipefail

REGION="ap-south-1"
REGISTRY="566739890498.dkr.ecr.ap-south-1.amazonaws.com"

cd "$(dirname "$0")"

if [[ "${1:-}" == "down" ]]; then
  docker compose down
  exit 0
fi

echo "==> Logging in to ECR ($REGISTRY)"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "==> Pulling latest images"
docker compose pull

echo "==> Starting stack"
docker compose up -d

echo "==> Waiting for backend health..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:5000/api/health >/dev/null 2>&1; then
    echo "    backend OK"
    break
  fi
  sleep 2
done

echo
echo "Frontend: http://localhost:8080"
echo "Backend : http://localhost:5000/api/health"
docker compose ps
