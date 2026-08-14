#!/usr/bin/env bash
set -euo pipefail

# One-time local road-network preparation for NRW. It keeps all routing data
# on the developer machine; no VROOM demo service is used.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT_DIR/data/osrm"
PBF="$DATA_DIR/nordrhein-westfalen-latest.osm.pbf"
BASE_URL="https://download.geofabrik.de/europe/germany/nordrhein-westfalen-latest.osm.pbf"

mkdir -p "$DATA_DIR"
if [ ! -f "$PBF" ]; then
  curl --fail --location --progress-bar "$BASE_URL" --output "$PBF"
fi

docker run --rm -t -v "$DATA_DIR:/data" ghcr.io/project-osrm/osrm-backend:v5.27.1 \
  osrm-extract -p /opt/car.lua /data/nordrhein-westfalen-latest.osm.pbf
docker run --rm -t -v "$DATA_DIR:/data" ghcr.io/project-osrm/osrm-backend:v5.27.1 \
  osrm-partition /data/nordrhein-westfalen-latest.osrm
docker run --rm -t -v "$DATA_DIR:/data" ghcr.io/project-osrm/osrm-backend:v5.27.1 \
  osrm-customize /data/nordrhein-westfalen-latest.osrm

cd "$ROOT_DIR"
docker compose -f docker-compose.vroom.yml up -d
