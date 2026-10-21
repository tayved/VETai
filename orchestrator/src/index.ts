/**
 * Orchestrator Worker
 * Tüm worker'ları koordine eden ana API gateway.
 *
 * Service Bindings:
 *   MEDIA     → media-worker   (resim, video, ses)
 *   FILES     → file-worker    (Excel, Word, dosya)
 *   SEARCH    → search-worker  (internet arama, scraping)
 *   TRANSLATE → translate-worker (dil çevirisi)
 *   QA        → qa-worker      (soru-cevap, sohbet)
 */

interface Env {
  MEDIA: Fetcher;
  FILES: Fetcher;
  SEARCH: Fetcher;
  TRANSLATE: Fetcher;
  QA: Fetcher;
}

async function callService(
  service: Fetcher,
  path: string,
  method: string,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return service.fetch(`https://internal${path}`, init);
}

async function callServiceFormData(
  service: Fetcher,
  path: string,
  formData: FormData,
): Promise<Response> {
  return service.fetch(`https://internal${path}`, {
    method: "POST",
    body: formData,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    try {
      // MEDYA ROUTES
      if (path.startsWith("/media/")) {
        const mediaPath = path.replace("/media", "");
        const isFormData = request.headers.get("Content-Type")?.includes("multipart/form-data");

        let response: Response;
        if (isFormData) {
          const formData = await request.formData();
          response = await callServiceFormData(env.MEDIA, mediaPath, formData);
        } else {
          const body = request.method === "POST" ? await request.json() : undefined;
          response = await callService(env.MEDIA, mediaPath, request.method, body);
        }
        return new Response(response.body, { headers: { ...response.headers, ...corsHeaders } });
      }

      // DOSYA ROUTES
      if (path.startsWith("/files/")) {
        const filePath = path.replace("/files", "");
        const body = request.method === "POST" ? await request.json() : undefined;
        const response = await callService(env.FILES, filePath, request.method, body);
        return new Response(response.body, { headers: { ...response.headers, ...corsHeaders } });
      }

      // ARAMA ROUTES
      if (path.startsWith("/search")) {
        const searchPath = path === "/search" ? "/search" : path.replace("/search", "");
        const body = request.method === "POST" ? await request.json() : undefined;
        const response = await callService(env.SEARCH, searchPath, request.method, body);
        return new Response(response.body, { headers: { ...response.headers, ...corsHeaders } });
      }

      // ÇEVİRİ ROUTES
      if (path.startsWith("/translate")) {
        const translatePath = path === "/translate" ? "/translate" : path.replace("/translate", "");
        const body = request.method === "POST" ? await request.json() : undefined;
        const response = await callService(env.TRANSLATE, translatePath, request.method, body);
        return new Response(response.body, { headers: { ...response.headers, ...corsHeaders } });
      }

      // SORU-CEVAP ROUTES
      if (path.startsWith("/qa")) {
        const qaPath = path === "/qa" ? "/ask" : path.replace("/qa", "");
        const body = request.method === "POST" ? await request.json() : undefined;
        const response = await callService(env.QA, qaPath, request.method, body);
        return new Response(response.body, { headers: { ...response.headers, ...corsHeaders } });
      }

      // WORKFLOW: Ara → Çevir → Dosya Oluştur
      if (path === "/workflow/search-translate-file" && request.method === "POST") {
        const { query, targetLang, fileType, filename } = await request.json() as {
          query: string; targetLang: string; fileType: "excel" | "word" | "csv" | "html"; filename: string;
        };

        const searchRes = await callService(env.SEARCH, "/search-and-summarize", "POST", { query, limit: 5 });
        const searchData = await searchRes.json() as { answer?: string; sources?: { title: string; url: string }[] };

        const translateRes = await callService(env.TRANSLATE, "/translate", "POST", {
          text: searchData.answer ?? "", source: "auto", target: targetLang, method: "llm",
        });
        const translateData = await translateRes.json() as { translated?: string };

        const fileRes = await callService(env.FILES, "/ai-generate", "POST", {
          filename, topic: query, fileType,
          instructions: `Aşağıdaki içerik ${targetLang} dilinde dosya olarak hazırla:\n${translateData.translated ?? searchData.answer}`,
        });
        const fileData = await fileRes.json() as { key?: string };

        return Response.json({
          success: true, workflow: "search → translate → file",
          steps: {
            search: { answer: searchData.answer, sources: searchData.sources },
            translate: { translated: translateData.translated },
            file: { key: fileData.key },
          },
        }, { headers: corsHeaders });
      }

      // WORKFLOW: Resim Üret → Analiz Et → Çevir → Word
      if (path === "/workflow/image-analyze-translate-doc" && request.method === "POST") {
        const { prompt, targetLang, filename } = await request.json() as {
          prompt: string; targetLang: string; filename: string;
        };

        const imageRes = await callService(env.MEDIA, "/image", "POST", { prompt });
        const imageData = await imageRes.json() as { key?: string };

        const analyzeRes = await callService(env.MEDIA, "/analyze-image", "POST", {
          imageUrl: imageData.key ?? "", question: "Bu resmi detaylı açıkla",
        });
        const analyzeData = await analyzeRes.json() as { analysis?: string };

        const translateRes = await callService(env.TRANSLATE, "/translate", "POST", {
          text: analyzeData.analysis ?? "", source: "auto", target: targetLang, method: "llm",
        });
        const translateData = await translateRes.json() as { translated?: string };

        const fileRes = await callService(env.FILES, "/word", "POST", {
          filename, title: `Resim Analizi — ${prompt}`,
          paragraphs: [translateData.translated ?? analyzeData.analysis ?? ""],
        });
        const fileData = await fileRes.json() as { key?: string };

        return Response.json({
          success: true, workflow: "image → analyze → translate → word",
          steps: {
            image: { key: imageData.key },
            analysis: analyzeData.analysis,
            translation: translateData.translated,
            document: { key: fileData.key },
          },
        }, { headers: corsHeaders });
      }

      // ANA SAYFA — API dokümantasyonu
      if (path === "/" || path === "") {
        return new Response(
          JSON.stringify({
            name: "Multi-Worker AI Hub",
            version: "1.0.0",
            endpoints: {
              media: {
                "POST /media/image": "Resim üret (Text-to-Image)",
                "POST /media/video": "Video üret (Text-to-Video)",
                "POST /media/audio": "Ses üret (Text-to-Speech)",
                "POST /media/transcribe": "Konuşmayı metne çevir",
                "POST /media/analyze-image": "Resim analizi",
                "GET /media/download/:key": "Medya indir",
              },
              files: {
                "POST /files/excel": "Excel/CSV oluştur",
                "POST /files/word": "Word oluştur",
                "POST /files/report": "HTML rapor",
                "POST /files/ai-generate": "AI ile dosya",
                "POST /files/to-markdown": "Markdown'a çevir",
                "GET /files/list": "Dosyaları listele",
                "GET /files/download/:key": "Dosya indir",
                "DELETE /files/delete/:key": "Dosya sil",
              },
              search: {
                "POST /search": "İnternette ara",
                "POST /search/search-and-summarize": "Ara + özetle",
                "POST /search/scrape": "Web sayfası çek",
                "POST /search/markdown": "Markdown'a çevir",
                "POST /search/screenshot": "Ekran görüntüsü",
                "POST /search/crawl": "Site tara",
              },
              translate: {
                "POST /translate": "Dil çevirisi",
                "POST /translate/translate-batch": "Toplu çeviri",
                "POST /translate/auto-translate": "Otomatik çeviri",
                "GET /translate/languages": "Diller",
              },
              qa: {
                "POST /qa": "Soru sor",
                "POST /qa/chat": "Sohbet",
                "POST /qa/reason": "Akıl yürütme",
                "POST /qa/summarize": "Özetle",
                "POST /qa/sentiment": "Duygu analizi",
                "POST /qa/structured": "JSON çıktı",
                "GET /qa/models": "Modeller",
              },
              workflows: {
                "POST /workflow/search-translate-file": "Ara → Çevir → Dosya",
                "POST /workflow/image-analyze-translate-doc": "Resim → Analiz → Çevir → Word",
              },
            },
          }, null, 2),
          { headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      // Sağlık
      if (path === "/health") {
        const checks = await Promise.all([
          callService(env.MEDIA, "/health", "GET").then((r) => r.json()).catch(() => ({ status: "error" })),
          callService(env.FILES, "/health", "GET").then((r) => r.json()).catch(() => ({ status: "error" })),
          callService(env.SEARCH, "/health", "GET").then((r) => r.json()).catch(() => ({ status: "error" })),
          callService(env.TRANSLATE, "/health", "GET").then((r) => r.json()).catch(() => ({ status: "error" })),
          callService(env.QA, "/health", "GET").then((r) => r.json()).catch(() => ({ status: "error" })),
        ]);

        return Response.json({
          orchestrator: "ok",
          services: { media: checks[0], files: checks[1], search: checks[2], translate: checks[3], qa: checks[4] },
        }, { headers: corsHeaders });
      }

      return Response.json({ error: "Geçersiz endpoint" }, { status: 404, headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Bilinmeyen hata" },
        { status: 500, headers: corsHeaders },
      );
    }
  },
};
