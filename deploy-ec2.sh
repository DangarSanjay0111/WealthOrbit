#!/usr/bin/env bash
# Update & run WealthOrbit on the EC2 server from the ECR images.
#
# IMPORTANT: with ECR, the app CODE lives inside the images, NOT on this box.
# So `git pull` here only refreshes docker-compose.yml. The actual app update
# happens when we PULL the new image that GitHub Actions built and pushed.
#
# Prereqs on EC2 (one-time): docker, docker compose, awscli installed, and
# either an IAM instance role with ECR read access OR `aws configure` done.
#
# Usage:  ./deploy-ec2.sh
set -euo pipefail

REGION="ap-south-1"
REGISTRY="566739890498.dkr.ecr.ap-south-1.amazonaws.com"

cd "$(dirname "$0")"

echo "==> Pulling latest compose file / config"
git pull origin main

echo "==> Logging in to ECR"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "==> Pulling new images from ECR"
docker compose pull

echo "==> Recreating changed containers"
docker compose up -d

echo "==> Cleaning up old image layers"
docker image prune -f

echo "==> Status"
docker compose ps
