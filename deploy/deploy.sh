#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load deploy config
if [[ ! -f "$SCRIPT_DIR/.env.deploy" ]]; then
  echo "Error: $SCRIPT_DIR/.env.deploy not found"
  exit 1
fi
source "$SCRIPT_DIR/.env.deploy"

# Get current git commit SHA
COMMIT_SHA=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)
IMAGE_BASE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_REPOSITORY}/${APP_NAME}"

echo "Deploying ${APP_NAME} @ ${COMMIT_SHA}"

# Build for linux/amd64
echo "Building image..."
docker build --platform linux/amd64 -t "${APP_NAME}:latest" -f "$SCRIPT_DIR/Dockerfile" "$PROJECT_ROOT"

# Tag with latest and commit SHA
echo "Tagging..."
docker tag "${APP_NAME}:latest" "${IMAGE_BASE}:latest"
docker tag "${APP_NAME}:latest" "${IMAGE_BASE}:${COMMIT_SHA}"

# Push both tags
echo "Pushing..."
docker push "${IMAGE_BASE}:latest"
docker push "${IMAGE_BASE}:${COMMIT_SHA}"

# Update deployment image
echo "Updating deployment..."
kubectl set image "deployment/${APP_NAME}-deployment" \
  "${APP_NAME}=${IMAGE_BASE}:${COMMIT_SHA}" \
  -n "${K8S_NAMESPACE}"

# Label deployment with commit SHA
kubectl label "deployment/${APP_NAME}-deployment" \
  "commit=${COMMIT_SHA}" --overwrite \
  -n "${K8S_NAMESPACE}"

# Wait for rollout
echo "Waiting for rollout..."
kubectl rollout status "deployment/${APP_NAME}-deployment" \
  -n "${K8S_NAMESPACE}" --timeout=120s

echo "Deploy complete: ${APP_NAME} @ ${COMMIT_SHA}"
