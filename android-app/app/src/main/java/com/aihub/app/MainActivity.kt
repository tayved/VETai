package com.aihub.app

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.aihub.app.databinding.ActivityMainBinding
import com.aihub.app.ui.*

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.cardImage.setOnClickListener { startActivity(Intent(this, ImageActivity::class.java)) }
        binding.cardVideo.setOnClickListener { startActivity(Intent(this, VideoActivity::class.java)) }
        binding.cardAudio.setOnClickListener { startActivity(Intent(this, AudioActivity::class.java)) }
        binding.cardFile.setOnClickListener { startActivity(Intent(this, FileActivity::class.java)) }
        binding.cardSearch.setOnClickListener { startActivity(Intent(this, SearchActivity::class.java)) }
        binding.cardTranslate.setOnClickListener { startActivity(Intent(this, TranslateActivity::class.java)) }
        binding.cardChat.setOnClickListener { startActivity(Intent(this, ChatActivity::class.java)) }
    }
}
