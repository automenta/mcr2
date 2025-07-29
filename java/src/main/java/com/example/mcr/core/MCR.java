package com.example.mcr.core;

import com.example.mcr.llm.LLMClientFactory;
import com.example.mcr.ontology.OntologyManager;
import com.example.mcr.session.Session;
import com.example.mcr.translation.AgenticReasoning;
import com.example.mcr.translation.DirectToProlog;
import com.example.mcr.translation.JsonToProlog;
import com.example.mcr.translation.TranslationStrategy;
import dev.langchain4j.model.chat.ChatLanguageModel;
import java.util.HashMap;
import java.util.Map;

public class MCR {
    private final MCRConfig config;
    private ChatLanguageModel llmClient;
    private final String llmModel;
    private final Map<String, TranslationStrategy> strategyRegistry = new HashMap<>();
    private final LLMUsageMetrics totalLlmUsage = new LLMUsageMetrics();

    public MCR(MCRConfig config) {
        this.config = config;
        LLMConfig llmConfig = config.getLlmConfig();
        
        // Initialize LLM client
        if (llmConfig.getClient() != null) {
            this.llmClient = llmConfig.getClient();
        } else if (llmConfig.getProvider() != null) {
            this.llmClient = LLMClientFactory.getLlmClient(llmConfig);
        }
        this.llmModel = llmConfig.getModel() != null ? llmConfig.getModel() : "gpt-3.5-turbo";
        
        // Initialize strategies
        strategyRegistry.put("direct", new DirectToProlog());
        strategyRegistry.put("json", new JsonToProlog());
        strategyRegistry.put("agentic", new AgenticReasoning());
        
        // Add custom strategies
        if (config.getStrategyRegistry() != null) {
            strategyRegistry.putAll(config.getStrategyRegistry());
        }
    }

    public Session createSession(SessionConfig options) {
        return new Session(this, options);
    }

    public void registerStrategy(String name, TranslationStrategy strategy) {
        if (strategy == null) {
            throw new IllegalArgumentException("Strategy must not be null");
        }
        strategyRegistry.put(name, strategy);
    }

    public TranslationStrategy getStrategy(String name) {
        return strategyRegistry.get(name);
    }

    public LLMUsageMetrics getLlmMetrics() {
        return new LLMUsageMetrics(totalLlmUsage);
    }

    // Configuration classes
    public static class MCRConfig {
        private LLMConfig llmConfig;
        private Map<String, TranslationStrategy> strategyRegistry;

        // Getters and setters
        public LLMConfig getLlmConfig() { return llmConfig; }
        public void setLlmConfig(LLMConfig llmConfig) { this.llmConfig = llmConfig; }
        public Map<String, TranslationStrategy> getStrategyRegistry() { return strategyRegistry; }
        public void setStrategyRegistry(Map<String, TranslationStrategy> strategyRegistry) { 
            this.strategyRegistry = strategyRegistry; 
        }
    }

    public static class LLMConfig {
        private String provider;
        private String model;
        private String apiKey;
        private ChatLanguageModel client;

        // Getters and setters
        public String getProvider() { return provider; }
        public void setProvider(String provider) { this.provider = provider; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public ChatLanguageModel getClient() { return client; }
        public void setClient(ChatLanguageModel client) { this.client = client; }
    }

    public static class LLMUsageMetrics {
        private long promptTokens;
        private long completionTokens;
        private long totalTokens;
        private int calls;
        private long totalLatencyMs;

        // Constructor for copying
        public LLMUsageMetrics(LLMUsageMetrics other) {
            this.promptTokens = other.promptTokens;
            this.completionTokens = other.completionTokens;
            this.totalTokens = other.totalTokens;
            this.calls = other.calls;
            this.totalLatencyMs = other.totalLatencyMs;
        }

        public LLMUsageMetrics() {} // Default constructor

        // Getters
        public long getPromptTokens() { return promptTokens; }
        public long getCompletionTokens() { return completionTokens; }
        public long getTotalTokens() { return totalTokens; }
        public int getCalls() { return calls; }
        public long getTotalLatencyMs() { return totalLatencyMs; }

        // Method to add usage
        public void addUsage(LLMUsageMetrics usage) {
            this.promptTokens += usage.getPromptTokens();
            this.completionTokens += usage.getCompletionTokens();
            this.totalTokens += usage.getTotalTokens();
            this.calls += usage.getCalls();
            this.totalLatencyMs += usage.getTotalLatencyMs();
        }
    }
}