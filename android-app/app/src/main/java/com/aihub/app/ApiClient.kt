package com.aihub.app

import com.aihub.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object ApiClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val baseUrl = BuildConfig.API_BASE_URL

    suspend fun post(path: String, jsonBody: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val body = jsonBody.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url("$baseUrl$path").post(body).build()
        client.newCall(request).execute().use { response ->
            JSONObject(response.body?.string() ?: "{}")
        }
    }

    suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("$baseUrl$path").get().build()
        client.newCall(request).execute().use { response -> response.body?.string() ?: "" }
    }

    suspend fun downloadBytes(path: String): ByteArray = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("$baseUrl$path").get().build()
        client.newCall(request).execute().use { response -> response.body?.bytes() ?: ByteArray(0) }
    }

    // MEDYA
    suspend fun generateImage(prompt: String, width: Int = 1024, height: Int = 1024): String {
        val body = JSONObject().apply { put("prompt", prompt); put("width", width); put("height", height) }
        return post("/media/image", body).optString("key", "")
    }

    suspend fun generateVideo(prompt: String, duration: String = "10s"): String {
        val body = JSONObject().apply { put("prompt", prompt); put("duration", duration) }
        return post("/media/video", body).optString("videoUrl", "")
    }

    suspend fun generateAudio(text: String, voice: String = "asteria"): String {
        val body = JSONObject().apply { put("text", text); put("voice", voice) }
        return post("/media/audio", body).optString("key", "")
    }

    fun getImageUrl(key: String): String = "$baseUrl/media/download/$key"

    // DOSYA
    suspend fun createExcel(filename: String, sheets: JSONArray): String {
        val body = JSONObject().apply { put("filename", filename); put("sheets", sheets); put("format", "csv") }
        return post("/files/excel", body).optString("key", "")
    }

    suspend fun createWord(filename: String, title: String, paragraphs: List<String>): String {
        val body = JSONObject().apply { put("filename", filename); put("title", title); put("paragraphs", JSONArray(paragraphs)) }
        return post("/files/word", body).optString("key", "")
    }

    suspend fun aiGenerateFile(filename: String, topic: String, fileType: String): String {
        val body = JSONObject().apply { put("filename", filename); put("topic", topic); put("fileType", fileType) }
        return post("/files/ai-generate", body).optString("key", "")
    }

    suspend fun listFiles(): JSONArray {
        return JSONObject(get("/files/list")).optJSONArray("files") ?: JSONArray()
    }

    fun getFileUrl(key: String): String = "$baseUrl/files/download/$key"

    // ARAMA
    suspend fun search(query: String, limit: Int = 5): JSONArray {
        val body = JSONObject().apply { put("query", query); put("limit", limit) }
        return post("/search", body).optJSONArray("results") ?: JSONArray()
    }

    suspend fun searchAndSummarize(query: String): JSONObject {
        val body = JSONObject().apply { put("query", query); put("limit", 5) }
        return post("/search/search-and-summarize", body)
    }

    // ÇEVİRİ
    suspend fun translate(text: String, source: String, target: String, method: String = "llm"): String {
        val body = JSONObject().apply { put("text", text); put("source", source); put("target", target); put("method", method) }
        return post("/translate", body).optString("translated", "")
    }

    // SORU-CEVAP
    suspend fun ask(question: String, model: String? = null): String {
        val body = JSONObject().apply { put("question", question); if (model != null) put("model", model) }
        return post("/qa", body).optString("answer", "")
    }

    suspend fun chat(messages: JSONArray): String {
        val body = JSONObject().apply { put("messages", messages) }
        return post("/qa/chat", body).optString("answer", "")
    }

    suspend fun summarize(text: String): String {
        val body = JSONObject().apply { put("text", text) }
        return post("/qa/summarize", body).optString("summary", "")
    }
}
