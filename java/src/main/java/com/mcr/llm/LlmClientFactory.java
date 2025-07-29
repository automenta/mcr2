package com.mcr.llm;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;

import java.util.Map;

public class LlmClientFactory {

    public static ChatLanguageModel getLlmClient(Map<String, Object> llmConfig) {
        String provider = (String) llmConfig.get("provider");
        if (provider == null) {
            throw new IllegalArgumentException("LLM provider must be specified.");
        }

        switch (provider.toLowerCase()) {
            case "openai":
                String apiKey = (String) llmConfig.get("apiKey");
                if (apiKey == null) {
                    throw new IllegalArgumentException("OpenAI provider requires an apiKey.");
                }
                return OpenAiChatModel.withApiKey(apiKey);
            // Other providers can be added here
            default:
                throw new IllegalArgumentException("Unsupported LLM provider: " + provider);
        }
    }
}
