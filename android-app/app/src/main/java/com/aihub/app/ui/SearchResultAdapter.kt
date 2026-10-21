package com.aihub.app.ui

import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.aihub.app.databinding.ItemSearchResultBinding

data class SearchResult(val title: String, val url: String, val description: String)

class SearchResultAdapter : RecyclerView.Adapter<SearchResultAdapter.ViewHolder>() {

    private var results: List<SearchResult> = emptyList()

    fun updateResults(newResults: List<SearchResult>) {
        results = newResults
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSearchResultBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) { holder.bind(results[position]) }
    override fun getItemCount() = results.size

    inner class ViewHolder(private val binding: ItemSearchResultBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(result: SearchResult) {
            binding.tvTitle.text = result.title
            binding.tvUrl.text = result.url
            binding.tvDescription.text = result.description
            binding.root.setOnClickListener {
                binding.root.context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(result.url)))
            }
        }
    }
}
