#!/bin/bash
set -e

echo "🔑 Multi-Worker AI Hub — Anahtar Bağlama"
echo "============================================"
echo ""

# 1. MEDIA WORKER
echo "📁 media-worker anahtarları bağlanıyor..."
cd "$(dirname "$0")/media-worker"

echo "  → GOOGLE_AI_API_KEY (Veo video üretimi için — zorunlu)"
echo -n "    Anahtarı girin: "
read -r GOOGLE_AI_KEY
echo "$GOOGLE_AI_KEY" | npx wrangler secret put GOOGLE_AI_API_KEY

echo "  → OPENAI_API_KEY (opsiyonel)"
echo -n "    Anahtarı girin: "
read -r OPENAI_KEY
if [ -n "$OPENAI_KEY" ]; then
  echo "$OPENAI_KEY" | npx wrangler secret put OPENAI_API_KEY
fi

echo "  → ANTHROPIC_API_KEY (opsiyonel)"
echo -n "    Anahtarı girin: "
read -r ANTHROPIC_KEY
if [ -n "$ANTHROPIC_KEY" ]; then
  echo "$ANTHROPIC_KEY" | npx wrangler secret put ANTHROPIC_API_KEY
fi

# 2. SEARCH WORKER
echo "🔍 search-worker anahtarları bağlanıyor..."
cd "$(dirname "$0")/search-worker"

echo "  → EXA_API_KEY (opsiyonel)"
echo -n "    Anahtarı girin: "
read -r EXA_KEY
if [ -n "$EXA_KEY" ]; then
  echo "$EXA_KEY" | npx wrangler secret put EXA_API_KEY
fi

echo "  → CERAMIC_API_KEY (opsiyonel)"
echo -n "    Anahtarı girin: "
read -r CERAMIC_KEY
if [ -n "$CERAMIC_KEY" ]; then
  echo "$CERAMIC_KEY" | npx wrangler secret put CERAMIC_API_KEY
fi

echo "  → LINKUP_API_KEY (opsiyonel)"
echo -n "    Anahtarı girin: "
read -r LINKUP_KEY
if [ -n "$LINKUP_KEY" ]; then
  echo "$LINKUP_KEY" | npx wrangler secret put LINKUP_API_KEY
fi

# 3. QA WORKER
echo "💬 qa-worker anahtarları bağlanıyor..."
cd "$(dirname "$0")/qa-worker"

echo "  → OPENAI_API_KEY (opsiyonel)"
echo -n "    Anahtarı girin: "
read -r QA_OPENAI_KEY
if [ -n "$QA_OPENAI_KEY" ]; then
  echo "$QA_OPENAI_KEY" | npx wrangler secret put OPENAI_API_KEY
fi

echo "  → ANTHROPIC_API_KEY (opsiyonel)"
echo -n "    Anahtarı girin: "
read -r QA_ANTHROPIC_KEY
if [ -n "$QA_ANTHROPIC_KEY" ]; then
  echo "$QA_ANTHROPIC_KEY" | npx wrangler secret put ANTHROPIC_API_KEY
fi

echo "  → GOOGLE_AI_API_KEY (opsiyonel)"
echo -n "    Anahtarı girin: "
read -r QA_GOOGLE_KEY
if [ -n "$QA_GOOGLE_KEY" ]; then
  echo "$QA_GOOGLE_KEY" | npx wrangler secret put GOOGLE_AI_API_KEY
fi

echo ""
echo "✅ Tüm anahtarlar bağlandı!"
