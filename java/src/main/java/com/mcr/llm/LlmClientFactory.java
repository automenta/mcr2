package com.mcr.llm;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;

import java.util.Map;

public class LlmClientFactory {

    public static ChatLanguageModel getLlmClient(Map<String, Object> llmConfig) {
        String provider = (String) llmConfig.getOrDefault("provider", "openai");
        String apiKey = (String) llmConfig.get("apiKey");
        String model = (String) llmConfig.get("model");

        if ("openai".equalsIgnoreCase(provider)) {
            if (apiKey == null) {
                throw new IllegalArgumentException("OpenAI API key is required.");
            }
            return OpenAiChatModel.builder()
                    .apiKey(apiKey)
                    .modelName(model)
                    .build();
        } else {
            throw new IllegalArgumentException("Unsupported LLM provider: " + provider);
        }
    }
}
