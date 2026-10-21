package com.aihub.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.aihub.app.ApiClient
import com.aihub.app.databinding.ActivityVideoBinding
import kotlinx.coroutines.launch

class VideoActivity : AppCompatActivity() {

    private lateinit var binding: ActivityVideoBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityVideoBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "Video Üret"

        binding.btnGenerate.setOnClickListener {
            val prompt = binding.etPrompt.text.toString().trim()
            if (prompt.isEmpty()) {
                binding.tvResult.text = "Lütfen bir prompt girin"
                return@setOnClickListener
            }

            val duration = binding.etDuration.text.toString().trim().ifEmpty { "10s" }

            binding.progressBar.visibility = android.view.View.VISIBLE
            binding.tvResult.text = "Video üretiliyor (bu işlem birkaç dakika sürebilir)..."

            lifecycleScope.launch {
                try {
                    val videoUrl = ApiClient.generateVideo(prompt, duration)
                    if (videoUrl.isNotEmpty()) {
                        binding.tvResult.text = "✅ Video oluşturuldu\nURL: $videoUrl"
                        binding.btnOpenUrl.visibility = android.view.View.VISIBLE
                        binding.btnOpenUrl.setOnClickListener {
                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(videoUrl))
                            startActivity(intent)
                        }
                    } else {
                        binding.tvResult.text = "❌ Video üretilemedi"
                    }
                } catch (e: Exception) {
                    binding.tvResult.text = "❌ Hata: ${e.message}"
                } finally {
                    binding.progressBar.visibility = android.view.View.GONE
                }
            }
        }
    }
}
