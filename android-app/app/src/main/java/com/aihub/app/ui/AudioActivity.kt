package com.aihub.app.ui

import android.media.MediaPlayer
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.aihub.app.ApiClient
import com.aihub.app.databinding.ActivityAudioBinding
import kotlinx.coroutines.launch

class AudioActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAudioBinding
    private var mediaPlayer: MediaPlayer? = null
    private var audioKey: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAudioBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "Ses Üret"

        binding.btnGenerate.setOnClickListener {
            val text = binding.etText.text.toString().trim()
            if (text.isEmpty()) {
                binding.tvResult.text = "Lütfen metin girin"
                return@setOnClickListener
            }

            val voice = binding.spinnerVoice.selectedItem.toString()

            binding.progressBar.visibility = android.view.View.VISIBLE
            binding.tvResult.text = "Ses üretiliyor..."

            lifecycleScope.launch {
                try {
                    audioKey = ApiClient.generateAudio(text, voice)
                    if (audioKey.isNotEmpty()) {
                        binding.tvResult.text = "✅ Ses oluşturuldu\nAnahtar: $audioKey"
                        binding.btnPlay.visibility = android.view.View.VISIBLE
                    } else {
                        binding.tvResult.text = "❌ Ses üretilemedi"
                    }
                } catch (e: Exception) {
                    binding.tvResult.text = "❌ Hata: ${e.message}"
                } finally {
                    binding.progressBar.visibility = android.view.View.GONE
                }
            }
        }

        binding.btnPlay.setOnClickListener {
            if (audioKey.isNotEmpty()) {
                val audioUrl = ApiClient.getImageUrl(audioKey)
                mediaPlayer?.release()
                mediaPlayer = MediaPlayer().apply {
                    setDataSource(audioUrl)
                    setOnPreparedListener { start() }
                    setOnErrorListener { _, _, _ ->
                        binding.tvResult.text = "❌ Ses çalınamadı"
                        true
                    }
                    prepareAsync()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        mediaPlayer?.release()
    }
}
