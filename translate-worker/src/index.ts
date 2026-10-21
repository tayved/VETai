/**
 * Translate Worker
 * Dil çevirisi yapma.
 *
 * Bindings:
 *   AI — Workers AI
 *
 * Çeviri modelleri:
 *   @cf/meta/m2m100-1.2b — Çok dilli çeviri (100+ dil)
 *   LLM tabanlı çeviri — Daha doğal çeviriler için
 */

interface Env {
  AI: Ai;
}

// m2m100 desteklenen diller (kısmi liste)
const M2M100_LANGS: Record<string, string> = {
  tr: "tr", en: "en", de: "de", fr: "fr", es: "es", it: "it",
  ru: "ru", ar: "ar", zh: "zh", ja: "ja", ko: "ko", nl: "nl",
  pt: "pt", az: "az", kk: "kk", uz: "uz", fa: "fa", hi: "hi",
  ur: "ur", pl: "pl", sv: "sv",
};

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
      // --- Çeviri (m2m100 modeli) ---
      if (path === "/translate" && request.method === "POST") {
        const { text, source, target, method } = await request.json() as {
          text: string;
          source: string;
          target: string;
          method?: "m2m100" | "llm";
        };

        const useMethod = method ?? "m2m100";

        if (useMethod === "m2m100") {
          const srcLang = M2M100_LANGS[source] ?? source;
          const tgtLang = M2M100_LANGS[target] ?? target;

          const result = await env.AI.run("@cf/meta/m2m100-1.2b", {
            text,
            source_lang: srcLang,
            target_lang: tgtLang,
          }) as { translated_text?: string };

          return Response.json({
            success: true,
            original: text,
            translated: result.translated_text,
            source, target,
            method: "m2m100",
          });
        } else {
          const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
            messages: [
              {
                role: "system",
                content: `Sen profesyonel bir çevirmensin. Verilen metni ${source} dilinden ${target} diline çevir. Sadece çeviriyi döndür, açıklama yapma.`,
              },
              { role: "user", content: text },
            ],
          }) as { response?: string };

          return Response.json({
            success: true,
            original: text,
            translated: result.response,
            source, target,
            method: "llm",
          });
        }
      }

      // --- Toplu Çeviri ---
      if (path === "/translate-batch" && request.method === "POST") {
        const { texts, source, target, method } = await request.json() as {
          texts: string[];
          source: string;
          target: string;
          method?: "m2m100" | "llm";
        };

        const useMethod = method ?? "m2m100";
        const translations: string[] = [];

        for (const text of texts) {
          if (useMethod === "m2m100") {
            const result = await env.AI.run("@cf/meta/m2m100-1.2b", {
              text,
              source_lang: M2M100_LANGS[source] ?? source,
              target_lang: M2M100_LANGS[target] ?? target,
            }) as { translated_text?: string };
            translations.push(result.translated_text ?? "");
          } else {
            const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
              messages: [
                { role: "system", content: `Çevir: ${source} → ${target}. Sadece çeviriyi döndür.` },
                { role: "user", content: text },
              ],
            }) as { response?: string };
            translations.push(result.response ?? "");
          }
        }

        return Response.json({
          success: true,
          source, target,
          method: useMethod,
          results: texts.map((original, i) => ({ original, translated: translations[i] })),
        });
      }

      // --- Otomatik Dil Algılama + Çeviri ---
      if (path === "/auto-translate" && request.method === "POST") {
        const { text, target } = await request.json() as { text: string; target: string };

        const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            {
              role: "system",
              content: `Sen bir çeviri asistanısın. Önce metnin dilini algıla, sonra ${target} diline çevir. JSON formatında cevap ver: {"detected_language": "kod", "translated": "çeviri"}`,
            },
            { role: "user", content: text },
          ],
        }) as { response?: string };

        let parsed: { detected_language?: string; translated?: string };
        try {
          parsed = JSON.parse(result.response ?? "{}");
        } catch {
          parsed = { translated: result.response };
        }

        return Response.json({
          success: true,
          original: text,
          detected_language: parsed.detected_language,
          translated: parsed.translated,
          target,
        });
      }

      // --- Desteklenen Diller ---
      if (path === "/languages" && request.method === "GET") {
        return Response.json({
          languages: Object.keys(M2M100_LANGS),
          count: Object.keys(M2M100_LANGS).length,
          note: "m2m100 modeli tarafından desteklenen diller",
        });
      }

      // --- Sağlık ---
      if (path === "/health") {
        return Response.json({ status: "ok", worker: "translate-worker" });
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
