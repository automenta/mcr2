package com.mcr.translation;

import com.google.gson.Gson;
import dev.langchain4j.model.chat.ChatLanguageModel;

import java.util.List;
import java.util.Map;

public class AgenticReasoning implements TranslationStrategy {

    @Override
    public String translate(String naturalLanguageText, Object llmClient, String model, List<String> ontologyTerms, String feedback) throws Exception {
        if (!(llmClient instanceof ChatLanguageModel)) {
            throw new IllegalArgumentException("AgenticReasoning requires a ChatLanguageModel.");
        }
        ChatLanguageModel client = (ChatLanguageModel) llmClient;

        String ontologyHint = !ontologyTerms.isEmpty() ? "\n\nAvailable ontology terms: " + String.join(", ", ontologyTerms) : "";
        String programHint = ""; // In a real implementation, the program would be passed in.
        String previousStepsHint = ""; // In a real implementation, previous steps would be passed in.
        String bindingsHint = ""; // In a real implementation, bindings would be passed in.
        String feedbackHint = feedback != null ? "\n\nFeedback from previous attempt: " + feedback + "\n\n" : "";

        String prompt = "You are an expert Prolog reasoner and agent. Your goal is to break down a complex task into discrete, logical steps using Prolog assertions, queries, or by concluding the task.\n" +
                "You have access to a Prolog knowledge base and can perform actions.\n" +
                ontologyHint + programHint + previousStepsHint + bindingsHint + feedbackHint +
                "\nYour output must be a JSON object with a \"type\" field (\"query\", \"assert\", or \"conclude\") and a \"content\" field (Prolog clause/query string) or an \"answer\" field (natural language conclusion).\n" +
                "If type is \"conclude\", also include an optional \"explanation\" field (natural language string).\n" +
                "Ensure all Prolog outputs are syntactically valid and conform to the ontology if applicable.\n" +
                "Do not include any other text outside the JSON object.\n\n" +
                "Examples:\n" +
                "To assert a fact: {\"type\":\"assert\",\"content\":\"bird(tweety).\"}\n" +
                "To assert a rule: {\"type\":\"assert\",\"content\":\"flies(X) :- bird(X).\"}\n" +
                "To query the knowledge base: {\"type\":\"query\",\"content\":\"has_wings(tweety).\"}\n" +
                "To conclude the task: {\"type\":\"conclude\",\"answer\":\"Yes, Tweety can fly.\",\"explanation\":\"Derived from bird(tweety) and flies(X) :- bird(X).\"}\n\n" +
                "Given the task: \"" + naturalLanguageText + "\"\n" +
                "What is your next logical step?";

        String jsonOutput = client.generate(prompt).trim();
        Map<String, Object> agentAction = new Gson().fromJson(jsonOutput, Map.class);

        // In a real implementation, we would return the structured action, not just a string.
        // For now, we'll just return the JSON string.
        return jsonOutput;
    }
}
