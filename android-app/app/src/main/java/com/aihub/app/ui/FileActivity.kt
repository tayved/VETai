package com.aihub.app.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.aihub.app.ApiClient
import com.aihub.app.databinding.ActivityFileBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class FileActivity : AppCompatActivity() {

    private lateinit var binding: ActivityFileBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityFileBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "Dosya Oluştur"

        binding.tabLayout.addOnTabSelectedListener(object : com.google.android.material.tabs.TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: com.google.android.material.tabs.TabLayout.Tab) {
                when (tab.position) {
                    0 -> { binding.layoutExcel.visibility = android.view.View.VISIBLE; binding.layoutWord.visibility = android.view.View.GONE; binding.layoutAi.visibility = android.view.View.GONE }
                    1 -> { binding.layoutExcel.visibility = android.view.View.GONE; binding.layoutWord.visibility = android.view.View.VISIBLE; binding.layoutAi.visibility = android.view.View.GONE }
                    2 -> { binding.layoutExcel.visibility = android.view.View.GONE; binding.layoutWord.visibility = android.view.View.GONE; binding.layoutAi.visibility = android.view.View.VISIBLE }
                }
            }
            override fun onTabUnselected(tab: com.google.android.material.tabs.TabLayout.Tab) {}
            override fun onTabReselected(tab: com.google.android.material.tabs.TabLayout.Tab) {}
        })

        binding.btnCreateExcel.setOnClickListener {
            val filename = binding.etExcelFilename.text.toString().trim().ifEmpty { "rapor" }
            val csvData = binding.etExcelData.text.toString().trim()
            if (csvData.isEmpty()) { binding.tvFileResult.text = "Lütfen veri girin"; return@setOnClickListener }

            binding.progressBarFile.visibility = android.view.View.VISIBLE
            lifecycleScope.launch {
                try {
                    val rows = csvData.split("\n").map { it.split(",").map { c -> c.trim() } }
                    val dataArray = JSONArray()
                    rows.forEach { row -> dataArray.put(JSONArray(row)) }
                    val sheets = JSONArray().put(JSONObject().put("name", "Sayfa1").put("data", dataArray))
                    val key = ApiClient.createExcel(filename, sheets)
                    binding.tvFileResult.text = "✅ Excel oluşturuldu\nAnahtar: $key"
                    binding.btnDownloadFile.visibility = android.view.View.VISIBLE
                    binding.btnDownloadFile.setOnClickListener {
                        startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(ApiClient.getFileUrl(key))))
                    }
                } catch (e: Exception) { binding.tvFileResult.text = "❌ Hata: ${e.message}" }
                finally { binding.progressBarFile.visibility = android.view.View.GONE }
            }
        }

        binding.btnCreateWord.setOnClickListener {
            val filename = binding.etWordFilename.text.toString().trim().ifEmpty { "belge" }
            val title = binding.etWordTitle.text.toString().trim().ifEmpty { "Başlık" }
            val content = binding.etWordContent.text.toString().trim()
            if (content.isEmpty()) { binding.tvFileResult.text = "Lütfen içerik girin"; return@setOnClickListener }

            binding.progressBarFile.visibility = android.view.View.VISIBLE
            lifecycleScope.launch {
                try {
                    val paragraphs = content.split("\n")
                    val key = ApiClient.createWord(filename, title, paragraphs)
                    binding.tvFileResult.text = "✅ Word oluşturuldu\nAnahtar: $key"
                    binding.btnDownloadFile.visibility = android.view.View.VISIBLE
                    binding.btnDownloadFile.setOnClickListener {
                        startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(ApiClient.getFileUrl(key))))
                    }
                } catch (e: Exception) { binding.tvFileResult.text = "❌ Hata: ${e.message}" }
                finally { binding.progressBarFile.visibility = android.view.View.GONE }
            }
        }

        binding.btnAiGenerate.setOnClickListener {
            val filename = binding.etAiFilename.text.toString().trim().ifEmpty { "ai-dosya" }
            val topic = binding.etAiTopic.text.toString().trim()
            if (topic.isEmpty()) { binding.tvFileResult.text = "Lütfen konu girin"; return@setOnClickListener }

            val fileType = when (binding.spinnerFileType.selectedItem.toString()) {
                "Excel" -> "excel"; "Word" -> "word"; "CSV" -> "csv"; else -> "html"
            }

            binding.progressBarFile.visibility = android.view.View.VISIBLE
            lifecycleScope.launch {
                try {
                    val key = ApiClient.aiGenerateFile(filename, topic, fileType)
                    binding.tvFileResult.text = "✅ AI dosyası oluşturuldu\nAnahtar: $key"
                    binding.btnDownloadFile.visibility = android.view.View.VISIBLE
                    binding.btnDownloadFile.setOnClickListener {
                        startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(ApiClient.getFileUrl(key))))
                    }
                } catch (e: Exception) { binding.tvFileResult.text = "❌ Hata: ${e.message}" }
                finally { binding.progressBarFile.visibility = android.view.View.GONE }
            }
        }
    }
}
