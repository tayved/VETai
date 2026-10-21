package com.aihub.app.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.aihub.app.ApiClient
import com.aihub.app.databinding.ActivityImageBinding
import kotlinx.coroutines.launch

class ImageActivity : AppCompatActivity() {

    private lateinit var binding: ActivityImageBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityImageBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "Resim Üret"

        binding.btnGenerate.setOnClickListener {
            val prompt = binding.etPrompt.text.toString().trim()
            if (prompt.isEmpty()) {
                binding.tvResult.text = "Lütfen bir prompt girin"
                return@setOnClickListener
            }

            binding.progressBar.visibility = android.view.View.VISIBLE
            binding.tvResult.text = "Resim üretiliyor..."
            binding.ivImage.setImageDrawable(null)

            lifecycleScope.launch {
                try {
                    val key = ApiClient.generateImage(prompt)
                    if (key.isNotEmpty()) {
                        val bytes = ApiClient.downloadBytes("/media/download/$key")
                        val bitmap: Bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        binding.ivImage.setImageBitmap(bitmap)
                        binding.tvResult.text = "✅ Resim oluşturuldu\nAnahtar: $key"
                    } else {
                        binding.tvResult.text = "❌ Resim üretilemedi"
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
