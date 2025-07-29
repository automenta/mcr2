package com.example.mcr.translation;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import dev.langchain4j.model.chat.ChatLanguageModel;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class JsonToProlog implements TranslationStrategy {
    private final ChatLanguageModel llmClient;
    private final String model;

    public JsonToProlog() {
        this(null, "gpt-3.5-turbo");
    }

    public JsonToProlog(ChatLanguageModel llmClient, String model) {
        this.llmClient = llmClient;
        this.model = model;
    }

    @Override
    public CompletableFuture<String> translate(String text, List<String> ontologyTerms, String feedback) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // First convert natural language to JSON
                String jsonPrompt = "Convert to JSON: " + text;
                if (feedback != null) {
                    jsonPrompt += "\n\nPrevious error: " + feedback;
                }
                String jsonOutput = llmClient.generate(jsonPrompt);
                
                // Convert JSON to Prolog
                JsonObject jsonObject = new Gson().fromJson(jsonOutput, JsonObject.class);
                return convertJsonToProlog(jsonObject, ontologyTerms);
            } catch (Exception e) {
                throw new RuntimeException("JSON to Prolog translation failed", e);
            }
        });
    }
    
    private String convertJsonToProlog(JsonObject json, List<String> ontologyTerms) {
        // Simplified conversion logic
        StringBuilder prolog = new StringBuilder();
        for (String key : json.keySet()) {
            String value = json.get(key).getAsString();
            if (ontologyTerms.contains(key)) {
                prolog.append(key).append("(").append(value).append(").\n");
            }
        }
        return prolog.toString();
    }
}