/**
 * Media Worker
 * Resim, video, ses/müzik üretimi ve işleme.
 *
 * Bindings:
 *   AI     — Workers AI (FLUX, Veo, MeloTTS, Aura, Whisper)
 *   BUCKET — R2 bucket (medya dosyalarını saklar)
 *   STREAM — Cloudflare Stream (video yönetimi)
 */

interface Env {
  AI: Ai;
  BUCKET: R2Bucket;
  STREAM: StreamBucket;
  GOOGLE_AI_API_KEY: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS
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
      // --- Resim Üretimi (Text-to-Image) ---
      // Modeller: @cf/black-forest-labs/flux-1-schnell, @cf/stabilityai/stable-diffusion-xl-base-1.0
      if (path === "/image" && request.method === "POST") {
        const { prompt, model, width, height } = await request.json() as {
          prompt: string;
          model?: string;
          width?: number;
          height?: number;
        };

        const selectedModel = model ?? "@cf/black-forest-labs/flux-1-schnell";

        const result = await env.AI.run(selectedModel, {
          prompt,
          width: width ?? 1024,
          height: height ?? 1024,
        });

        // result.image base64 formatında gelir
        const imageData = (result as { image?: string; images?: string[] }).image
          ?? (result as { images?: string[] }).images?.[0];

        if (!imageData) {
          return Response.json({ error: "Resim üretilemedi" }, { status: 500 });
        }

        // R2'ye kaydet
        const imageBytes = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));
        const key = `images/${Date.now()}.png`;
        await env.BUCKET.put(key, imageBytes, {
          httpMetadata: { contentType: "image/png" },
        });

       
