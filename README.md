multi-worker-ai-hub/
├── README.md
├── package.json
├── setup-secrets.sh
├── .dev.vars.example
├── .gitignore
├── .github/
│   ├── README_GITHUB.md
│   └── workflows/
│       ├── deploy-workers.yml
│       └── build-apk.yml
├── media-worker/          (3 dosya)
├── file-worker/           (3 dosya)
├── search-worker/         (3 dosya)
├── translate-worker/      (3 dosya)
├── qa-worker/             (3 dosya)
├── orchestrator/          (3 dosya)
└── android-app/           (29 dosya)
# Multi-Worker AI Hub

Birden fazla Worker'dan oluşan, AI destekli içerik üretim ve yönetim sistemi.

## Mimari

                ┌─────────────────────┐
                │  Orchestrator API   │  ← Ana giriş noktası
                │  (API Gateway)      │
                └──────────┬──────────┘
                           │
      ┌────────┬──────────┼──────────┬────────┐
      ▼        ▼          ▼          ▼        ▼
 ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
 │ Media  ││  File  ││ Search ││Translate││  Q&A   │
 │ Worker ││ Worker ││ Worker ││ Worker ││ Worker │
 └───────┘└────────┘└────────┘└────────┘└────────┘

## Worker'lar

| Worker | Görev | Kullanılan Cloudflare Ürünleri |
|--------|-------|-------------------------------|
| `media-worker` | Resim, video, müzik/ses üretimi | Workers AI (FLUX, Veo, MeloTTS, Aura), Stream, R2 |
| `file-worker` | Excel, Word, dosya oluşturma/kaydetme | R2, Workers AI (toMarkdown) |
| `search-worker` | İnternette arama yapma | Web Search API, Browser Run |
| `translate-worker` | Dil çevirisi | Workers AI (m2m100, LLM) |
| `qa-worker` | Sorulara cevap verme | Workers AI (LLM modelleri) |
| `orchestrator` | Tüm worker'ları koordine eden ana API | Service Bindings |

## Kurulum

```bash
cd media-worker && npm install && npx wrangler deploy
cd file-worker && npm install && npx wrangler deploy
cd search-worker && npm install && npx wrangler deploy
cd translate-worker && npm install && npx wrangler deploy
cd qa-worker && npm install && npx wrangler deploy
cd orchestrator && npm install && npx wrangler deploy

### `package.json`
```json
{
  "name": "multi-worker-ai-hub",
  "version": "1.0.0",
  "private": true,
  "description": "Birden fazla Worker'dan oluşan AI destekli içerik üretim ve yönetim sistemi",
  "scripts": {
    "deploy:all": "cd media-worker && npx wrangler deploy && cd ../file-worker && npx wrangler deploy && cd ../search-worker && npx wrangler deploy && cd ../translate-worker && npx wrangler deploy && cd ../qa-worker && npx wrangler deploy && cd ../orchestrator && npx wrangler deploy",
    "dev:all": "echo 'Her worker için ayrı terminalde wrangler dev çalıştırın'",
    "setup:r2": "npx wrangler r2 bucket create media-storage && npx wrangler r2 bucket create file-storage"
  }
}
