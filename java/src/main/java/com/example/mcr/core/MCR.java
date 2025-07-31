package com.example.mcr.core;

import com.example.mcr.llm.LLMClient;
import com.example.mcr.translation.TranslationStrategy;
import com.example.mcr.translation.DirectToProlog;
import com.example.mcr.translation.JsonToProlog;
import com.example.mcr.translation.AgenticReasoning;
import com.example.mcr.core.Session;
import java.util.HashMap;
import java.util.Map;

public class MCR {
    private final Config config;
    private LLMClient llmClient;
    private final String llmModel;
    private final Map<String, TranslationStrategy> strategyRegistry;
    private final LLMUsageMetrics totalLlmUsage;

    public MCR(Config config) {
        this.config = config;
        this.llmModel = config.llm != null ? config.llm.model : "gpt-3.5-turbo";
        this.strategyRegistry = new HashMap<>();
        this.strategyRegistry.put("direct", new DirectToProlog());
        this.strategyRegistry.put("json", new JsonToProlog());
        this.strategyRegistry.put("agentic", new AgenticReasoning());
        if (config.strategyRegistry != null) {
            this.strategyRegistry.putAll(config.strategyRegistry);
        }
        this.totalLlmUsage = new LLMUsageMetrics();
        
        if (config.llm != null && config.llm.provider != null) {
            this.llmClient = getLlmClient(config.llm);
        } else {
            // Default to OpenAI if no config provided
            try {
                this.llmClient = new LLMClient("openai", "gpt-3.5-turbo", null);
            } catch (IllegalArgumentException e) {
                throw new RuntimeException("Failed to create default LLM client", e);
            }
        }
        private LLMClient getLlmClient(LlmConfig llmConfig) {
            if (llmConfig == null) {
                throw new IllegalArgumentException("LLM config cannot be null");
            }
            
            try {
                return new LLMClient(
                    llmConfig.provider,
                    llmConfig.model,
                    llmConfig.apiKey
                );
            } catch (IllegalArgumentException e) {
                throw new RuntimeException("Invalid LLM configuration: " + e.getMessage(), e);
            }
        }
        }
    }

    public Session createSession(SessionOptions options) {
        return new Session(this, options);
    }

    public void registerStrategy(String name, TranslationStrategy strategy) {
        if (strategy == null) {
            throw new IllegalArgumentException("Strategy cannot be null");
        }
        this.strategyRegistry.put(name, strategy);
    }

    public LLMUsageMetrics getLlmMetrics() {
        return new LLMUsageMetrics(totalLlmUsage);
    }

    // Assuming getLlmClient is implemented elsewhere
    private LLMClient getLlmClient(LlmConfig llmConfig) {
        if (llmConfig == null) {
            throw new IllegalArgumentException("LLM config cannot be null");
        }
        
        try {
            return new LLMClient(
                llmConfig.provider,
                llmConfig.model,
                llmConfig.apiKey
            );
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid LLM configuration: " + e.getMessage(), e);
        }
    }

    public static class Config {
        public LlmConfig llm;
        public Map<String, TranslationStrategy> strategyRegistry;
        
        public Config() {}
    }

    public static class LlmConfig {
        public String provider;
        public String apiKey;
        public String model;
        
        public LlmConfig() {}
    }

    public static class SessionOptions {
        public long retryDelay = 500;
        public int maxTranslationAttempts = 2;
        public int maxReasoningSteps = 5;
        public Object ontology;
        public java.util.logging.Logger logger;
        public String translator;
        
        public SessionOptions() {}
    }

    public static class LLMUsageMetrics {
        public long promptTokens;
        public long completionTokens;
        public long totalTokens;
        public int calls;
        public long totalLatencyMs;
        
        public LLMUsageMetrics() {}
        
        public LLMUsageMetrics(LLMUsageMetrics source) {
            this.promptTokens = source.promptTokens;
            this.completionTokens = source.completionTokens;
            this.totalTokens = source.totalTokens;
            this.calls = source.calls;
            this.totalLatencyMs = source.totalLatencyMs;
        }
    }
}