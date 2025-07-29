package com.mcr.translation;

import dev.langchain4j.model.output.Response;
import dev.langchain4j.model.output.TokenUsage;

import java.util.List;
import java.util.Map;

public interface TranslationStrategy {
    Map<String, Object> translate(String naturalLanguageText, Object llmClient, String model, List<String> ontologyTerms, String feedback) throws Exception;

    default void updateMetrics(Response<?> response, Map<String, Object> result) {
        TokenUsage tokenUsage = response.tokenUsage();
        if (tokenUsage != null) {
            result.put("promptTokens", tokenUsage.inputTokenCount());
            result.put("completionTokens", tokenUsage.outputTokenCount());
        }
    }
}
