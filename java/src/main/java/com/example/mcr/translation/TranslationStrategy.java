package com.example.mcr.translation;

import java.util.List;
import java.util.concurrent.CompletableFuture;

public interface TranslationStrategy {
    CompletableFuture<TranslationResult> translate(String input, Object llmClient, String model, List<String> ontologyTerms, String feedback, boolean returnFullResponse);
    
    class TranslationResult {
        private String type;
        private String content;
        private String answer;
        private String explanation;
        private int promptTokens;
        private int completionTokens;
        private int totalTokens;
        
        public TranslationResult(String content, int promptTokens, int completionTokens, int totalTokens) {
            this.content = content;
            this.promptTokens = promptTokens;
            this.completionTokens = completionTokens;
            this.totalTokens = totalTokens;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }

        public String getAnswer() { return answer; }
        public void setAnswer(String answer) { this.answer = answer; }

        public String getExplanation() { return explanation; }
        public void setExplanation(String explanation) { this.explanation = explanation; }

        public int getPromptTokens() { return promptTokens; }
        public void setPromptTokens(int promptTokens) { this.promptTokens = promptTokens; }

        public int getCompletionTokens() { return completionTokens; }
        public void setCompletionTokens(int completionTokens) { this.completionTokens = completionTokens; }

        public int getTotalTokens() { return totalTokens; }
        public void setTotalTokens(int totalTokens) { this.totalTokens = totalTokens; }
    }
}