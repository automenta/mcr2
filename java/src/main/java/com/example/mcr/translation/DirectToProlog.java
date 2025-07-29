package com.example.mcr.translation;

import dev.langchain4j.model.chat.ChatLanguageModel;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class DirectToProlog implements TranslationStrategy {
    private final ChatLanguageModel llmClient;
    private final String model;

    public DirectToProlog() {
        this(null, "gpt-3.5-turbo");
    }

    public DirectToProlog(ChatLanguageModel llmClient, String model) {
        this.llmClient = llmClient;
        this.model = model;
    }

    @Override
    public CompletableFuture<String> translate(String text, List<String> ontologyTerms, String feedback) {
        return CompletableFuture.supplyAsync(() -> {
            if (llmClient == null) {
                throw new IllegalStateException("LLM client not configured for direct translation");
            }
            
            String prompt = "Translate the following English text to Prolog: \"" + text + "\"";
            if (feedback != null) {
                prompt += "\n\nPrevious error: " + feedback;
            }
            if (!ontologyTerms.isEmpty()) {
                prompt += "\n\nUse these ontology terms: " + String.join(", ", ontologyTerms);
            }
            
            return llmClient.generate(prompt);
        });
    }
}