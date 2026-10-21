package com.aihub.app.ui

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.aihub.app.ApiClient
import com.aihub.app.databinding.ActivityChatBinding
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class ChatActivity : AppCompatActivity() {

    private lateinit var binding: ActivityChatBinding
    private val messages = JSONArray()
    private val chatHistory = StringBuilder()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityChatBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "Sohbet"

        binding.btnSend.setOnClickListener {
            val userMessage = binding.etMessage.text?.toString()?.trim() ?: ""
            if (userMessage.isEmpty()) return@setOnClickListener

            appendToChat("🧑 Siz: $userMessage\n\n")

            messages.put(JSONObject().put("role", "user").put("content", userMessage))
            binding.etMessage.text?.clear()
            binding.btnSend.isEnabled = false
            binding.progressBar.visibility = View.VISIBLE

            lifecycleScope.launch {
                try {
                    val answer = ApiClient.chat(messages)
                    messages.put(JSONObject().put("role", "assistant").put("content", answer))
                    appendToChat("🤖 AI: $answer\n\n")
                } catch (e: Exception) {
                    appendToChat("❌ Hata: ${e.message}\n\n")
                } finally {
                    binding.btnSend.isEnabled = true
                    binding.progressBar.visibility = View.GONE
                }
            }
        }

        binding.btnAsk.setOnClickListener {
            val question = binding.etMessage.text?.toString()?.trim() ?: ""
            if (question.isEmpty()) return@setOnClickListener

            appendToChat("🧑 Siz: $question\n\n")
            binding.etMessage.text?.clear()
            binding.progressBar.visibility = View.VISIBLE

            lifecycleScope.launch {
                try {
                    val answer = ApiClient.ask(question)
                    appendToChat("🤖 AI: $answer\n\n")
                } catch (e: Exception) {
                    appendToChat("❌ Hata: ${e.message}\n\n")
                } finally {
                    binding.progressBar.visibility = View.GONE
                }
            }
        }

        binding.btnSummarize.setOnClickListener {
            val text = binding.etMessage.text?.toString()?.trim() ?: ""
            if (text.isEmpty()) return@setOnClickListener

            appendToChat("🧑 Özetlenecek metin: ${text.take(50)}...\n\n")
            binding.etMessage.text?.clear()
            binding.progressBar.visibility = View.VISIBLE

            lifecycleScope.launch {
                try {
                    val summary = ApiClient.summarize(text)
                    appendToChat("📝 Özet: $summary\n\n")
                } catch (e: Exception) {
                    appendToChat("❌ Hata: ${e.message}\n\n")
                } finally {
                    binding.progressBar.visibility = View.GONE
                }
            }
        }
    }

    private fun appendToChat(text: String) {
        chatHistory.append(text)
        binding.tvChat.text = chatHistory.toString()
        binding.scrollView.post {
            binding.scrollView.fullScroll(View.FOCUS_DOWN)
        }
    }
}
