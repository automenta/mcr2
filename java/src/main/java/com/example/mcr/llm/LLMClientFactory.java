package com.example.mcr.llm;

import com.example.mcr.core.MCR.LlmConfig;

public class LLMClientFactory {
    public static LLMClient getLlmClient(LlmConfig config) {
        String provider = config.provider.toLowerCase();
        String model = config.model;
        String apiKey = config.apiKey;

        return new LLMClient(provider, model, apiKey);
    }
}