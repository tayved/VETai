/**
 * Q&A Worker
 * Sorulara cevap verme — sohbet, akıl yürütme, özetleme.
 *
 * Bindings:
 *   AI — Workers AI (Llama 3.3 70B, Gemma 4, GPT-OSS, GLM-4.7, vb.)
 *
 * Kullanılabilir modeller:
 *   @cf/meta/llama-3.3-70b-instruct-fp8-fast  — Güçlü, çok dilli
 *   @cf/google/gemma-4-26b-a4b-it              — Çok modlu (vision), 140+ dil
 *   @cf/openai/gpt-oss-120b                    — Yüksek akıl yürütme
 *   @cf/zai-org/glm-4.7-flash                  — Hızlı, 100+ dil
 *   @cf/deepseek-ai/deepseek-r1-distill-qwen-32b — Akıl yürütme
 */

interface Env {
  AI: Ai;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
}

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const AVAILABLE_MODELS = [
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (önerilen)", capabilities: ["chat", "function-calling"] },
  { id: "@cf/google/gemma-4-26b-a4b-it", label: "Gemma 4 26B (çok modlu, vision)", capabilities: ["chat", "vision", "function-calling", "reasoning"] },
  { id: "@cf/openai/gpt-oss-120b", label: "GPT-OSS 120B (yüksek akıl yürütme)", capabilities: ["chat", "function-calling", "reasoning"] },
  { id: "@cf/zai-org/glm-4.7-flash", label: "GLM-4.7 Flash (hızlı, 100+ dil)", capabilities: ["chat", "function-calling", "reasoning"] },
  { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", label: "DeepSeek R1 (akıl yürütme)", capabilities: ["chat", "reasoning"] },
  { id: "@cf/meta/llama-3.2-3b-instruct", label: "Llama 3.2 3B (hafif, hızlı)", capabilities: ["chat"] },
];

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
      // --- Soru-Cevap (Tek seferlik) ---
      if (path === "/ask" && request.method === "POST") {
        const { question, model, systemPrompt, temperature, maxTokens } = await request.json() as {
          question: string;
          model?: string;
          systemPrompt?: string;
          temperature?: number;
          maxTokens?: number;
        };

        const selectedModel = model ?? DEFAULT_MODEL;

        const result = await env.AI.run(selectedModel, {
          messages: [
            { role: "system", content: systemPrompt ?? "Sen yardımsever bir AI asistanısın. Türkçe cevap ver." },
            { role: "user", content: question },
          ],
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 1024,
        }) as { response?: string };

        return Response.json({
          success: true,
          question,
          answer: result.response,
          model: selectedModel,
        });
      }

      // --- Sohbet (Çoklu mesaj) ---
      if (path === "/chat" && request.method === "POST") {
        const { messages, model, temperature, maxTokens, stream } = await request.json() as {
          messages: { role: "system" | "user" | "assistant"; content: string }[];
          model?: string;
          temperature?: number;
          maxTokens?: number;
          stream?: boolean;
        };

        const selectedModel = model ?? DEFAULT_MODEL;

        if (stream) {
          const streamResult = await env.AI.run(selectedModel, {
            messages,
            temperature: temperature ?? 0.7,
            max_tokens: maxTokens ?? 1024,
            stream: true,
          });

          return new Response(streamResult, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        }

        const result = await env.AI.run(selectedModel, {
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 1024,
        }) as { response?: string };

        return Response.json({
          success: true,
          answer: result.response,
          model: selectedModel,
        });
      }

      // --- Akıl Yürütme (Reasoning) ---
      if (path === "/reason" && request.method === "POST") {
        const { question, model } = await request.json() as {
          question: string;
          model?: string;
        };

        const selectedModel = model ?? "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

        const result = await env.AI.run(selectedModel, {
          prompt: question,
          stream: false,
        }) as { response?: string };

        return Response.json({
          success: true,
          question,
          answer: result.response,
          model: selectedModel,
          type: "reasoning",
        });
      }

      // --- Metin Özetleme ---
      if (path === "/summarize" && request.method === "POST") {
        const { text, max_length, model } = await request.json() as {
          text: string;
          max_length?: number;
          model?: string;
        };

        const selectedModel = model ?? "@cf/facebook/bart-large-cnn";

        const result = await env.AI.run(selectedModel, {
          input_text: text,
          max_length: max_length ?? 200,
        }) as { summary?: string };

        return Response.json({
          success: true,
          summary: result.summary,
          model: selectedModel,
        });
      }

      // --- Duygu Analizi ---
      if (path === "/sentiment" && request.method === "POST") {
        const { text } = await request.json() as { text: string };

        const result = await env.AI.run("@cf/huggingface/distilbert-sst-2-int8", {
          text,
        }) as { label?: string; score?: number };

        return Response.json({
          success: true,
          text,
          sentiment: result.label,
          confidence: result.score,
        });
      }

      // --- Yapılandırılmış Çıktı (JSON Mode) ---
      if (path === "/structured" && request.method === "POST") {
        const { prompt, schema, model } = await request.json() as {
          prompt: string;
          schema: Record<string, unknown>;
          model?: string;
        };

        const selectedModel = model ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

        const result = await env.AI.run(selectedModel, {
          messages: [
            {
              role: "system",
              content: `Aşağıdaki şemaya uygun JSON çıktısı üret. Şema: ${JSON.stringify(schema)}`,
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }) as { response?: string };

        let parsed: unknown;
        try {
          parsed = JSON.parse(result.response ?? "{}");
        } catch {
          parsed = result.response;
        }

        return Response.json({
          success: true,
          result: parsed,
          model: selectedModel,
        });
      }

      // --- Modelleri Listele ---
      if (path === "/models" && request.method === "GET") {
        return Response.json({
          models: AVAILABLE_MODELS,
          default: DEFAULT_MODEL,
        });
      }

      // --- Sağlık ---
      if (path === "/health") {
        return Response.json({ status: "ok", worker: "qa-worker" });
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
