package com.aihub.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.aihub.app.ApiClient
import com.aihub.app.databinding.ActivitySearchBinding
import kotlinx.coroutines.launch
import org.json.JSONArray

class SearchActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySearchBinding
    private val adapter = SearchResultAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySearchBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "İnternette Ara"

        binding.rvResults.layoutManager = LinearLayoutManager(this)
        binding.rvResults.adapter = adapter

        binding.btnSearch.setOnClickListener {
            val query = binding.etQuery.text.toString().trim()
            if (query.isEmpty()) return@setOnClickListener

            binding.progressBar.visibility = android.view.View.VISIBLE
            binding.tvSummary.visibility = android.view.View.GONE

            if (binding.checkboxSummarize.isChecked) {
                lifecycleScope.launch {
                    try {
                        val result = ApiClient.searchAndSummarize(query)
                        val answer = result.optString("answer", "")
                        val sources = result.optJSONArray("sources")
                        binding.tvSummary.text = "📝 $answer"
                        binding.tvSummary.visibility = android.view.View.VISIBLE

                        val searchResults = mutableListOf<SearchResult>()
                        for (i in 0 until (sources?.length() ?: 0)) {
                            val source = sources!!.getJSONObject(i)
                            searchResults.add(SearchResult(source.optString("title", ""), source.optString("url", ""), ""))
                        }
                        adapter.updateResults(searchResults)
                    } catch (e: Exception) {
                        binding.tvSummary.text = "❌ Hata: ${e.message}"
                        binding.tvSummary.visibility = android.view.View.VISIBLE
                    } finally { binding.progressBar.visibility = android.view.View.GONE }
                }
            } else {
                lifecycleScope.launch {
                    try {
                        val results: JSONArray = ApiClient.search(query)
                        val searchResults = mutableListOf<SearchResult>()
                        for (i in 0 until results.length()) {
                            val item = results.getJSONObject(i)
                            searchResults.add(SearchResult(item.optString("title", ""), item.optString("url", ""), item.optString("description", "")))
                        }
                        adapter.updateResults(searchResults)
                        if (searchResults.isEmpty()) {
                            binding.tvSummary.text = "Sonuç bulunamadı"
                            binding.tvSummary.visibility = android.view.View.VISIBLE
                        }
                    } catch (e: Exception) {
                        binding.tvSummary.text = "❌ Hata: ${e.message}"
                        binding.tvSummary.visibility = android.view.View.VISIBLE
                    } finally { binding.progressBar.visibility = android.view.View.GONE }
                }
            }
        }
    }
}
