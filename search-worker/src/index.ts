/**
 * Search Worker
 * İnternette arama yapma ve web içeriği çekme.
 *
 * Bindings:
 *   AI      — Workers AI (Web Search API: env.AI.websearch())
 *   BROWSER — Browser Run (web scraping, screenshot, crawl)
 *
 * Web Search API sağlayıcıları: ceramic, exa, linkup
 */

interface Env {
  AI: Ai;
  BROWSER: BrowserWorker;
  EXA_API_KEY?: string;
  CERAMIC_API_KEY?: string;
  LINKUP_API_KEY?: string;
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      // --- Web Arama (Web Search API) ---
      if (path === "/search" && request.method === "POST") {
        const { query, provider, limit, byokAlias } = await request.json() as {
          query: string;
          provider?: "ceramic" | "exa" | "linkup";
          limit?: number;
          byokAlias?: string;
        };

        const selectedProvider = provider ?? "exa";

        const searchParams: Record<string, unknown> = {
          gatewayId: "default",
          query,
          provider: selectedProvider,
          limit: limit ?? 5,
        };

        if (byokAlias) {
          searchParams.byokAlias = byokAlias;
        }

        const response = await env.AI.websearch(searchParams as Parameters<typeof env.AI.websearch>[0]);

        const results = await response.json() as { results?: SearchResult[] };

        return Response.json({
          success: true,
          query,
          provider: selectedProvider,
          results: results.results ?? [],
        });
      }

      // --- Arama + AI Özetleme ---
      if (path === "/search-and-summarize" && request.method === "POST") {
        const { query, provider, limit, byokAlias } = await request.json() as {
          query: string;
          provider?: "ceramic" | "exa" | "linkup";
          limit?: number;
          byokAlias?: string;
        };

        const selectedProvider = provider ?? "exa";

        const searchParams: Record<string, unknown> = {
          gatewayId: "default",
          query,
          provider: selectedProvider,
          limit: limit ?? 5,
        };

        if (byokAlias) {
          searchParams.byokAlias = byokAlias;
        }

        const searchResponse = await env.AI.websearch(searchParams as Parameters<typeof env.AI.websearch>[0]);

        const searchResults = await searchResponse.json() as { results?: SearchResult[] };
        const results = searchResults.results ?? [];

        if (results.length === 0) {
          return Response.json({ success: false, message: "Sonuç bulunamadı" });
        }

        const context = results
          .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`)
          .join("\n\n");

        const aiResult = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            {
              role: "system",
              content: "Sen bir araştırma asistanısın. Verilen web arama sonuçlarına dayanarak kullanıcının sorusunu cevapla. Cevabında kaynakları belirt.",
            },
            {
              role: "user",
              content: `Soru: ${query}\n\nWeb arama sonuçları:\n${context}`,
            },
          ],
        }) as { response?: string };

        return Response.json({
          success: true,
          query,
          answer: aiResult.response,
          sources: results.map((r) => ({ title: r.title, url: r.url })),
        });
      }

      // --- Web Sayfası İçeriğini Çek (Browser Run) ---
      if (path === "/scrape" && request.method === "POST") {
        const { targetUrl } = await request.json() as { targetUrl: string };

        const scrapeResult = await env.BROWSER.quickAction("scrape", {
          url: targetUrl,
          elements: [{ selector: "body" }],
        });

        return Response.json({
          success: true,
          url: targetUrl,
          content: scrapeResult,
        });
      }

      // --- Web Sayfasını Markdown'a Çevir (Browser Run) ---
      if (path === "/markdown" && request.method === "POST") {
        const { targetUrl } = await request.json() as { targetUrl: string };

        const markdownResult = await env.BROWSER.quickAction("markdown", {
          url: targetUrl,
        });

        return Response.json({
          success: true,
          url: targetUrl,
          markdown: markdownResult,
        });
      }

      // --- Ekran Görüntüsü Al (Browser Run) ---
      if (path === "/screenshot" && request.method === "POST") {
        const { targetUrl } = await request.json() as { targetUrl: string };

        const screenshotResult = await env.BROWSER.quickAction("screenshot", {
          url: targetUrl,
        });

        return new Response(screenshotResult, {
          headers: { "Content-Type": "image/png" },
        });
      }

      // --- Web Sitesini Tara (Crawl) ---
      if (path === "/crawl" && request.method === "POST") {
        const { targetUrl, limit } = await request.json() as {
          targetUrl: string;
          limit?: number;
        };

        const crawlResult = await env.BROWSER.quickAction("crawl", {
          url: targetUrl,
          limit: limit ?? 10,
        });

        return Response.json({
          success: true,
          url: targetUrl,
          result: crawlResult,
        });
      }

      // --- Sağlık ---
      if (path === "/health") {
        return Response.json({ status: "ok", worker: "search-worker" });
      }

      return Response.json({ error: "Geçersiz endpoint" }, { status: 404 });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Bilinmeyen hata" },
        { status: 500 },
      );
    }
  },
};
