package com.mcr.core;

import com.mcr.ontology.OntologyManager;
import com.mcr.translation.DirectToProlog;
import com.mcr.translation.JsonToProlog;
import com.mcr.translation.TranslationStrategy;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class MCR {

    private final Map<String, TranslationStrategy> strategies = new HashMap<>();
    private final LLMConfig llmConfig;

    private final AtomicInteger totalLlmCalls = new AtomicInteger(0);
    private final AtomicLong totalLlmPromptTokens = new AtomicLong(0);
    private final AtomicLong totalLlmCompletionTokens = new AtomicLong(0);
    private final AtomicLong totalLlmLatencyMs = new AtomicLong(0);


    public MCR(LLMConfig llmConfig) {
        this.llmConfig = llmConfig;
        registerStrategy("direct", new DirectToProlog());
        registerStrategy("json", new JsonToProlog());
    }

    public Session createSession() {
        return new Session(llmConfig, this::updateLlmMetrics);
    }

    public Session createSession(Map<String, Object> ontology) {
        return new Session(new OntologyManager(ontology), llmConfig, this::updateLlmMetrics);
    }

    public void registerStrategy(String name, TranslationStrategy strategy) {
        strategies.put(name, strategy);
    }

    public TranslationStrategy getStrategy(String name) {
        return strategies.get(name);
    }

    public Map<String, Long> getLlmMetrics() {
        Map<String, Long> metrics = new HashMap<>();
        metrics.put("calls", (long) totalLlmCalls.get());
        metrics.put("promptTokens", totalLlmPromptTokens.get());
        metrics.put("completionTokens", totalLlmCompletionTokens.get());
        metrics.put("totalLatencyMs", totalLlmLatencyMs.get());
        return metrics;
    }

    void updateLlmMetrics(Session.LlmMetrics metrics) {
        this.totalLlmCalls.addAndGet(metrics.calls);
        this.totalLlmPromptTokens.addAndGet(metrics.promptTokens);
        this.totalLlmCompletionTokens.addAndGet(metrics.completionTokens);
        this.totalLlmLatencyMs.addAndGet(metrics.latencyMs);
    }


    public static class LLMConfig {
        private final String provider;
        private final String apiKey;
        private final String model;
        private final ChatLanguageModel client;

        public LLMConfig(String provider, String apiKey, String model) {
            this.provider = provider;
            this.apiKey = apiKey;
            this.model = model;
            this.client = null;
        }

        public LLMConfig(ChatLanguageModel client, String model) {
            this.client = client;
            this.model = model;
            this.provider = null;
            this.apiKey = null;
        }

        public ChatLanguageModel getClient() {
            if (client != null) {
                return client;
            }
            if ("openai".equals(provider)) {
                return OpenAiChatModel.withApiKey(apiKey);
            }
            return null;
        }

        public String getModel() {
            return model;
        }
    }
}
