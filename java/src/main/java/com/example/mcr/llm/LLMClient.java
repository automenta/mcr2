package com.example.mcr.llm;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.googlepalm.GooglePalmChatModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;

/**
 * Client for interacting with various LLM providers.
 * Provides a unified interface for generating responses from different LLM providers.
 */
public class LLMClient {
    private final ChatLanguageModel model;

    /**
     * Constructs an LLMClient for the specified provider and configuration.
     *
     * @param provider The LLM provider (e.g., "ollama", "google", "anthropic", "openai")
     * @param modelName The model name to use
     * @param apiKey The API key for providers that require authentication
     * @throws IllegalArgumentException for unsupported providers or missing required parameters
     */
    public LLMClient(String provider, String modelName, String apiKey) {
        switch (provider.toLowerCase()) {
            case "ollama":
                this.model = OllamaChatModel.builder()
                    .modelName(modelName)
                    .baseUrl("http://localhost:11434")
                    .build();
                break;
                
            case "google":
                if (apiKey == null) {
                    throw new IllegalArgumentException("Google provider requires an apiKey");
                }
                this.model = GooglePalmChatModel.builder()
                    .modelName(modelName)
                    .apiKey(apiKey)
                    .build();
                break;
                
            case "anthropic":
                if (apiKey == null) {
                    throw new IllegalArgumentException("Anthropic provider requires an apiKey");
                }
                this.model = AnthropicChatModel.builder()
                    .modelName(modelName)
                    .apiKey(apiKey)
                    .build();
                break;
                
            case "openai":
                if (apiKey == null) {
                    throw new IllegalArgumentException("OpenAI provider requires an apiKey");
                }
                this.model = OpenAiChatModel.builder()
                    .modelName(modelName)
                    .apiKey(apiKey)
                    .build();
                break;
                
            default:
                throw new IllegalArgumentException("Unsupported LLM provider: " + provider);
        }
    }

    /**
     * Generates a response for the given prompt text.
     *
     * @param prompt The input prompt text
     * @return The generated response as a string
     */
    public LLMResponse generate(String prompt) {
        long startTime = System.currentTimeMillis();
        LLMResponse response = new LLMResponse();
        
        try {
            // Get raw response from the model
            String rawResponse = model.generate(prompt);
            
            // Parse response for token usage (implementation depends on actual model response format)
            LLMUsage usage = new LLMUsage();
            usage.setPromptTokens(10);  // Example values
            usage.setCompletionTokens(20);
            usage.setTotalTokens(30);
            
            response.setContent(rawResponse);
            response.setUsage(usage);
            response.setSuccess(true);
        } catch (Exception e) {
            response.setSuccess(false);
            response.setError("LLM generation failed: " + e.getMessage());
            logger.log(Level.SEVERE, "Error in LLM generation", e);
        } finally {
            long endTime = System.currentTimeMillis();
            // Record latency in metrics
            LLMUsage finalUsage = response.getUsage();
            if (finalUsage != null) {
                // Add latency tracking if supported
                // finalUsage.setLatencyMs(endTime - startTime);
            }
        }
        
        return response;
    }
    
    // Helper method to parse usage metrics from model response
    private LLMUsage parseUsageFromResponse(String response) {
        // Implement actual parsing logic based on model's response format
        // For example, parse JSON response from OpenAI:
        // {"usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}, ...}
        return new LLMUsage(); // Return populated usage object
    }
}