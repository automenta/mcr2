package com.example.mcr.translation;

import com.google.gson.Gson;
import dev.langchain4j.model.chat.ChatLanguageModel;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class AgenticReasoning implements TranslationStrategy {
    private final ChatLanguageModel llmClient;
    private final String model;

    public AgenticReasoning() {
        this(null, "gpt-4");
    }

    public AgenticReasoning(ChatLanguageModel llmClient, String model) {
        this.llmClient = llmClient;
        this.model = model;
    }

    @Override
    public CompletableFuture<String> translate(String text, List<String> ontologyTerms, String feedback) {
        return CompletableFuture.supplyAsync(() -> {
            if (llmClient == null) {
                throw new IllegalStateException("LLM client not configured for agentic reasoning");
            }
            
            String prompt = "You are an agentic reasoning system. Break down the task: \"" + text + "\"";
            if (feedback != null) {
                prompt += "\n\nFeedback: " + feedback;
            }
            if (!ontologyTerms.isEmpty()) {
                prompt += "\n\nOntology terms: " + String.join(", ", ontologyTerms);
            }
            prompt += "\n\nOutput JSON with 'type' (query/assert/conclude) and 'content' or 'answer'";
            
            String jsonOutput = llmClient.generate(prompt);
            return new Gson().fromJson(jsonOutput, AgentAction.class).getContent();
        });
    }
    
    private static class AgentAction {
        private String type;
        private String content;
        private String answer;
        
        public String getContent() {
            if (type.equals("conclude")) {
                return answer;
            }
            return content;
        }
    }
}