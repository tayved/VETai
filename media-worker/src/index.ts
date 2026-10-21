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

        return Response.json({
          success: true,
          key,
          model: selectedModel,
          message: "Resim oluşturuldu ve R2'ye kaydedildi",
        });
      }

      // --- Video Üretimi (Text-to-Video) ---
      // Model: google/veo-3.1 (AI Gateway üzerinden)
      if (path === "/video" && request.method === "POST") {
        const { prompt, duration, aspect_ratio, resolution, generate_audio } = await request.json() as {
          prompt: string;
          duration?: string;
          aspect_ratio?: string;
          resolution?: string;
          generate_audio?: boolean;
        };

        const aiResponse = await env.AI.run(
          "google/veo-3.1",
          {
            prompt,
            duration: duration ?? "10s",
            aspect_ratio: aspect_ratio ?? "16:9",
            resolution: resolution ?? "1080p",
            generate_audio: generate_audio ?? true,
          },
          { gateway: { id: "default" } },
        ) as { result?: { video?: string } };

        const videoUrl = aiResponse.result?.video;

        if (!videoUrl) {
          return Response.json({ error: "Video üretilemedi" }, { status: 500 });
        }

        // Stream'e yükle
        const streamVideo = await env.STREAM.upload(videoUrl);

        return Response.json({
          success: true,
          videoUrl,
          streamVideo,
          message: "Video oluşturuldu ve Stream'e yüklendi",
        });
      }

      // --- Ses/Müzik Üretimi (Text-to-Speech) ---
      // Modeller: @cf/myshell-ai/melotts, @cf/deepgram/aura-1, @cf/deepgram/aura-2-en
      if (path === "/audio" && request.method === "POST") {
        const { text, model, voice } = await request.json() as {
          text: string;
          model?: string;
          voice?: string;
        };

        const selectedModel = model ?? "@cf/myshell-ai/melotts";

        const result = await env.AI.run(selectedModel, {
          text,
          voice: voice ?? "asteria",
        }) as { audio?: string };

        const audioData = result.audio;

        if (!audioData) {
          return Response.json({ error: "Ses üretilemedi" }, { status: 500 });
        }

        // R2'ye kaydet
        const audioBytes = Uint8Array.from(atob(audioData), (c) => c.charCodeAt(0));
        const key = `audio/${Date.now()}.mp3`;
        await env.BUCKET.put(key, audioBytes, {
          httpMetadata: { contentType: "audio/mpeg" },
        });

        return Response.json({
          success: true,
          key,
          model: selectedModel,
          message: "Ses oluşturuldu ve R2'ye kaydedildi",
        });
      }

      // --- Konuşmayı Metne Çevirme (Speech-to-Text) ---
      // Modeller: @cf/openai/whisper-large-v3-turbo, @cf/deepgram/nova-3
      if (path === "/transcribe" && request.method === "POST") {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File;
        const model = (formData.get("model") as string) ?? "@cf/openai/whisper-large-v3-turbo";

        const audioBuffer = await audioFile.arrayBuffer();

        const result = await env.AI.run(model, {
          audio: [...new Uint8Array(audioBuffer)],
        }) as { text?: string };

        return Response.json({
          success: true,
          transcript: result.text,
          model,
        });
      }

      // --- Resim Analizi (Image-to-Text) ---
      // Model: @cf/meta/llama-3.2-11b-vision-instruct
      if (path === "/analyze-image" && request.method === "POST") {
        const { imageUrl, question } = await request.json() as {
          imageUrl: string;
          question?: string;
        };

        // R2'den resmi al
        const key = imageUrl.replace("images/", "");
        const object = await env.BUCKET.get(`images/${key}`);

        if (!object) {
          return Response.json({ error: "Resim bulunamadı" }, { status: 404 });
        }

        const imageBytes = new Uint8Array(await object.arrayBuffer());

        const result = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: question ?? "Bu resmi detaylı açıkla" },
                { type: "image_url", image_url: { url: `data:image/png;base64,${btoa(String.fromCharCode(...imageBytes))}` } },
              ],
            },
          ],
        }) as { response?: string };

        return Response.json({
          success: true,
          analysis: result.response,
        });
      }

      // --- Dosya İndirme (R2'den) ---
      if (path.startsWith("/download/") && request.method === "GET") {
        const key = path.replace("/download/", "");
        const object = await env.BUCKET.get(key);

        if (!object) {
          return Response.json({ error: "Dosya bulunamadı" }, { status: 404 });
        }

        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
            "Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
          },
        });
      }

      // --- Sağlık Kontrolü ---
      if (path === "/health") {
        return Response.json({ status: "ok", worker: "media-worker" });
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
