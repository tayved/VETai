/**
 * File Worker
 * Excel, Word, PDF, CSV gibi dosya oluşturma, düzenleme ve kaydetme.
 *
 * Bindings:
 *   AI     — Workers AI (toMarkdown ile belge dönüştürme)
 *   BUCKET — R2 bucket (dosya saklama)
 *
 * Excel ve Word için saf JavaScript ile minimal format üretimi yapılır.
 * Daha gelişmiş formatlar için npm paketleri (exceljs, docx) eklenebilir.
 */

interface Env {
  AI: Ai;
  BUCKET: R2Bucket;
}

// --- Minimal CSV üretimi ---
function generateCSV(data: string[][]): string {
  return data
    .map((row) =>
      row
        .map((cell) => {
          const escaped = String(cell).replace(/"/g, '""');
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(","),
    )
    .join("\n");
}

// --- Minimal Excel (SpreadsheetML / .xml) üretimi ---
function generateExcelXML(sheets: { name: string; data: string[][] }[]): string {
  const worksheetXML = sheets
    .map(
      (sheet) => `
    <Worksheet ss:Name="${sheet.name}">
      <Table>
        ${sheet.data
          .map(
            (row) =>
              `<Row>${row
                .map((cell) => `<Cell><Data ss:Type="String">${String(cell).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`)
                .join("")}</Row>`,
          )
          .join("")}
      </Table>
    </Worksheet>`,
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${worksheetXML}
</Workbook>`;
}

// --- Minimal Word (.docx) için HTML tabanlı belge ---
function generateWordHTML(title: string, paragraphs: string[]): string {
  const body = paragraphs
    .map((p) => `<p style="margin-bottom:12pt;">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
}

// --- Minimal HTML rapor ---
function generateHTMLReport(title: string, sections: { heading: string; content: string }[]): string {
  const sectionsHTML = sections
    .map(
      (s) =>
        `<section><h2>${s.heading}</h2><div>${s.content}</div></section>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #F38020; }
    section { margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${sectionsHTML}
</body>
</html>`;
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
      // --- Excel Dosyası Oluştur ---
      if (path === "/excel" && request.method === "POST") {
        const { filename, sheets, format } = await request.json() as {
          filename: string;
          sheets: { name: string; data: string[][] }[];
          format?: "csv" | "xml";
        };

        const fileFormat = format ?? "csv";
        let content: string;
        let contentType: string;
        let ext: string;

        if (fileFormat === "csv") {
          content = generateCSV(sheets[0].data);
          contentType = "text/csv";
          ext = "csv";
        } else {
          content = generateExcelXML(sheets);
          contentType = "application/vnd.ms-excel";
          ext = "xls";
        }

        const key = `files/${filename}.${ext}`;
        await env.BUCKET.put(key, content, {
          httpMetadata: { contentType },
        });

        return Response.json({
          success: true,
          key,
          format: fileFormat,
          message: `Excel/${fileFormat.toUpperCase()} dosyası oluşturuldu`,
        });
      }

      // --- Word Dosyası Oluştur ---
      if (path === "/word" && request.method === "POST") {
        const { filename, title, paragraphs } = await request.json() as {
          filename: string;
          title: string;
          paragraphs: string[];
        };

        const content = generateWordHTML(title, paragraphs);
        const key = `files/${filename}.doc`;
        await env.BUCKET.put(key, content, {
          httpMetadata: { contentType: "application/msword" },
        });

        return Response.json({
          success: true,
          key,
          message: "Word belgesi oluşturuldu",
        });
      }

      // --- HTML Rapor Oluştur ---
      if (path === "/report" && request.method === "POST") {
        const { filename, title, sections } = await request.json() as {
          filename: string;
          title: string;
          sections: { heading: string; content: string }[];
        };

        const content = generateHTMLReport(title, sections);
        const key = `files/${filename}.html`;
        await env.BUCKET.put(key, content, {
          httpMetadata: { contentType: "text/html" },
        });

        return Response.json({
          success: true,
          key,
          message: "HTML rapor oluşturuldu",
        });
      }

      // --- AI ile İçerik Oluşturup Dosya Yap ---
      if (path === "/ai-generate" && request.method === "POST") {
        const { filename, topic, fileType, instructions } = await request.json() as {
          filename: string;
          topic: string;
          fileType: "excel" | "word" | "csv" | "html";
          instructions?: string;
        };

        const systemPrompt = `Sen bir içerik üreticisin. Verilen konu hakkında ${fileType} formatında içerik üret.
İçeriği JSON formatında döndür:
- Excel/CSV için: { "sheets": [{ "name": "Sayfa1", "data": [["Sütun1","Sütun2"], ["değer1","değer2"]] }] }
- Word için: { "title": "Başlık", "paragraphs": ["paragraf1", "paragraf2"] }
- HTML için: { "title": "Başlık", "sections": [{ "heading": "Bölüm", "content": "<p>içerik</p>" }] }`;

        const aiResult = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Konu: ${topic}\nTalimat: ${instructions ?? "Detaylı içerik üret"}` },
          ],
        }) as { response?: string };

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(aiResult.response ?? "{}");
        } catch {
          return Response.json({ error: "AI cevabı parse edilemedi", raw: aiResult.response }, { status: 500 });
        }

        let key: string;
        let content: string;
        let contentType: string;

        if (fileType === "csv" || fileType === "excel") {
          const sheets = (parsed.sheets as { name: string; data: string[][] }[]) ?? [{ name: "Sayfa1", data: [["İçerik"]] }];
          if (fileType === "csv") {
            content = generateCSV(sheets[0].data);
            contentType = "text/csv";
            key = `files/${filename}.csv`;
          } else {
            content = generateExcelXML(sheets);
            contentType = "application/vnd.ms-excel";
            key = `files/${filename}.xls`;
          }
        } else if (fileType === "word") {
          content = generateWordHTML(
            (parsed.title as string) ?? topic,
            (parsed.paragraphs as string[]) ?? ["İçerik bulunamadı"],
          );
          contentType = "application/msword";
          key = `files/${filename}.doc`;
        } else {
          content = generateHTMLReport(
            (parsed.title as string) ?? topic,
            (parsed.sections as { heading: string; content: string }[]) ?? [],
          );
          contentType = "text/html";
          key = `files/${filename}.html`;
        }

        await env.BUCKET.put(key, content, { httpMetadata: { contentType } });

        return Response.json({
          success: true,
          key,
          fileType,
          message: `AI tarafından ${fileType} dosyası oluşturuldu`,
        });
      }

      // --- Belgeyi Markdown'a Çevir (Workers AI toMarkdown) ---
      if (path === "/to-markdown" && request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        const result = await env.AI.toMarkdown({
          name: file.name,
          blob: new Blob([await file.arrayBuffer()]),
        });

        const markdownContent = result.map((r) => r.text).join("\n\n");
        const key = `files/${file.name}.md`;
        await env.BUCKET.put(key, markdownContent, {
          httpMetadata: { contentType: "text/markdown" },
        });

        return Response.json({
          success: true,
          key,
          markdown: markdownContent,
          message: "Belge Markdown'a çevrildi",
        });
      }

      // --- Dosya Listele ---
      if (path === "/list" && request.method === "GET") {
        const listed = await env.BUCKET.list({ prefix: "files/" });
        return Response.json({
          files: listed.objects.map((o) => ({
            key: o.key,
            size: o.size,
            uploaded: o.uploaded,
          })),
        });
      }

      // --- Dosya İndir ---
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

      // --- Dosya Sil ---
      if (path.startsWith("/delete/") && request.method === "DELETE") {
        const key = path.replace("/delete/", "");
        await env.BUCKET.delete(key);
        return Response.json({ success: true, message: "Dosya silindi", key });
      }

      // --- Sağlık ---
      if (path === "/health") {
        return Response.json({ status: "ok", worker: "file-worker" });
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
