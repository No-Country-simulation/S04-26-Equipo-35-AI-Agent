#!/usr/bin/env bash
# Demo ConversaAI: mini corpus → pipeline → dashboard Next.js
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Qdrant (opcional, para --use-db)"
docker compose -f docker-compose.yml up -d 2>/dev/null || true

echo "==> Pipeline (mini corpus)"
cd Agentes
if [[ ! -f data/raw/test_mini.csv ]]; then
  echo "Generando test_mini.csv..."
  uv run python scripts/generate_demo_corpus.py 2>/dev/null || true
fi

uv run python -m src.cli ingest \
  --corpus data/raw/test_mini.csv \
  --use-db \
  --smart-recommendations

echo "==> Evaluación rápida"
uv run python -m src.cli evaluate --corpus data/raw/test_mini.csv || true

cd "$ROOT"
echo ""
echo "Demo lista. Inicia el dashboard:"
echo "  npm run dev"
echo "Abre http://localhost:3000 y prueba el Copiloto Analítico."
