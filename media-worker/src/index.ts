/**
 * Media Worker (R2 yok)
 * Resim, video, ses üretimi — dosyalar base64 olarak döner.
 */

interface Env {
  AI: Ai;
  STREAM: StreamBucket;
  GOOGLE_AI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
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
      // --- Resim Üretimi ---
      if (path === "/image" && request.method === "POST") {
        const { prompt, model, width, height } = await request.json() as {
          prompt: string; model?: string; width?: number; height?: number;
        };

        const selectedModel = model ?? "@cf/black-forest-labs/flux-1-schnell";
        const result = await env.AI.run(selectedModel, {
          prompt, width: width ?? 1024, height: height ?? 1024,
        });

        const imageData = (result as { image?: string; images?: string[] }).image
          ?? (result as { images?: string[] }).images?.[0];

        if (!imageData) {
          return Response.json({ error: "Resim üretilemedi" }, { status: 500 });
        }

        return Response.json({
          success: true, image: imageData, model: selectedModel,
          message: "Resim oluşturuldu (base64)",
        });
      }

      // --- Video Üretimi ---
      if (path === "/video" && request.method === "POST") {
        const { prompt, duration, aspect_ratio, resolution, generate_audio } = await request.json() as {
          prompt: string; duration?: string; aspect_ratio?: string; resolution?: string; generate_audio?: boolean;
        };

        const aiResponse = await env.AI.run("google/veo-3.1", {
          prompt, duration: duration ?? "10s", aspect_ratio: aspect_ratio ?? "16:9",
          resolution: resolution ?? "1080p", generate_audio: generate_audio ?? true,
        }, { gateway: { id: "default" } }) as { result?: { video?: string } };

        const videoUrl = aiResponse.result?.video;
        if (!videoUrl) {
          return Response.json({ error: "Video üretilemedi" }, { status: 500 });
        }

        return Response.json({ success: true, videoUrl, message: "Video oluşturuldu" });
      }

      // --- Ses Üretimi ---
      if (path === "/audio" && request.method === "POST") {
        const { text, model, voice } = await request.json() as {
          text: string; model?: string; voice?: string;
        };

        const selectedModel = model ?? "@cf/myshell-ai/melotts";
        const result = await env.AI.run(selectedModel, {
          text, voice: voice ?? "asteria",
        }) as { audio?: string };

        if (!result.audio) {
          return Response.json({ error: "Ses üretilemedi" }, { status: 500 });
        }

        return Response.json({
          success: true, audio: result.audio, model: selectedModel,
          message: "Ses oluşturuldu (base64)",
        });
      }

      // --- Konuşmayı Metne Çevirme ---
      if (path === "/transcribe" && request.method === "POST") {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File;
        const model = (formData.get("model") as string) ?? "@cf/openai/whisper-large-v3-turbo";

        const audioBuffer = await audioFile.arrayBuffer();
        const result = await env.AI.run(model, {
          audio: [...new Uint8Array(audioBuffer)],
        }) as { text?: string };

        return Response.json({ success: true, transcript: result.text, model });
      }

      // --- Sağlık ---
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

