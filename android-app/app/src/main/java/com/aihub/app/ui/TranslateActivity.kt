package com.aihub.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.aihub.app.ApiClient
import com.aihub.app.databinding.ActivityTranslateBinding
import kotlinx.coroutines.launch

class TranslateActivity : AppCompatActivity() {

    private lateinit var binding: ActivityTranslateBinding

    private val languages = arrayOf(
        "auto", "tr", "en", "de", "fr", "es", "it", "ru", "ar", "zh",
        "ja", "ko", "nl", "pt", "az", "kk", "uz", "fa", "hi", "ur", "pl", "sv"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTranslateBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "Dil Çevirisi"

        binding.spinnerSource.adapter = android.widget.ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, languages)
        binding.spinnerTarget.adapter = android.widget.ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, languages)
        binding.spinnerSource.setSelection(0)
        binding.spinnerTarget.setSelection(1)

        binding.btnTranslate.setOnClickListener {
            val text = binding.etInput.text.toString().trim()
            if (text.isEmpty()) return@setOnClickListener
            val source = binding.spinnerSource.selectedItem.toString()
            val target = binding.spinnerTarget.selectedItem.toString()
            val method = if (binding.checkboxLlm.isChecked) "llm" else "m2m100"

            binding.progressBar.visibility = android.view.View.VISIBLE
            binding.tvOutput.text = "Çevriliyor..."

            lifecycleScope.launch {
                try {
                    val translated = ApiClient.translate(text, source, target, method)
                    binding.tvOutput.text = translated
                } catch (e: Exception) { binding.tvOutput.text = "❌ Hata: ${e.message}" }
                finally { binding.progressBar.visibility = android.view.View.GONE }
            }
        }

        binding.btnSwap.setOnClickListener {
            val srcPos = binding.spinnerSource.selectedItemPosition
            val tgtPos = binding.spinnerTarget.selectedItemPosition
            binding.spinnerSource.setSelection(tgtPos)
            binding.spinnerTarget.setSelection(srcPos)
        }
    }
}
