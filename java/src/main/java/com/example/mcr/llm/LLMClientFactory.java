package com.example.mcr.llm;

import com.example.mcr.core.MCR.LLMConfig;
import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.googlepalm.GooglePalmChatModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;

public class LLMClientFactory {
    public static ChatLanguageModel getLlmClient(LLMConfig config) {
        String provider = config.getProvider().toLowerCase();
        String model = config.getModel();
        String apiKey = config.getApiKey();

        switch (provider) {
            case "ollama":
                return OllamaChatModel.builder()
                    .modelName(model)
                    .baseUrl("http://localhost:11434")
                    .build();
                    
            case "google":
                if (apiKey == null) {
                    throw new IllegalArgumentException("Google provider requires an apiKey");
                }
                return GooglePalmChatModel.builder()
                    .modelName(model)
                    .apiKey(apiKey)
                    .build();
                    
            case "anthropic":
                if (apiKey == null) {
                    throw new IllegalArgumentException("Anthropic provider requires an apiKey");
                }
                return AnthropicChatModel.builder()
                    .modelName(model)
                    .apiKey(apiKey)
                    .build();
                    
            case "openai":
                if (apiKey == null) {
                    throw new IllegalArgumentException("OpenAI provider requires an apiKey");
                }
                return OpenAiChatModel.builder()
                    .modelName(model)
                    .apiKey(apiKey)
                    .build();
                    
            default:
                throw new IllegalArgumentException("Unsupported LLM provider: " + provider);
        }
    }
}