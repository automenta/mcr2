package com.mcr.translation;

import dev.langchain4j.model.chat.ChatLanguageModel;

import java.util.List;

public class DirectToProlog implements TranslationStrategy {

    @Override
    public String translate(String naturalLanguageText, Object llmClient, String model, List<String> ontologyTerms, String feedback) throws Exception {
        if (!(llmClient instanceof ChatLanguageModel)) {
            throw new IllegalArgumentException("DirectToProlog requires a ChatLanguageModel.");
        }
        ChatLanguageModel client = (ChatLanguageModel) llmClient;

        String ontologyHint = !ontologyTerms.isEmpty() ? "\n\nAvailable ontology terms: " + String.join(", ", ontologyTerms) : "";
        String feedbackHint = feedback != null ? "\n\nFeedback from previous attempt: " + feedback + "\n\n" : "";

        String prompt = "Translate to Prolog fact, rule or query. Only output valid Prolog.\n" +
                "Do NOT include any extra text, comments, or explanations, just the Prolog.\n" +
                "A fact or rule must end with a single dot. A query must NOT end with a dot.\n" +
                ontologyHint + feedbackHint +
                "Examples:\n" +
                "1. \"All birds fly\" -> \"flies(X) :- bird(X).\"\n" +
                "2. \"Socrates is mortal\" -> \"mortal(socrates).\"\n" +
                "3. \"Does tweety fly?\" -> \"flies(tweety)\"\n" +
                "4. \"Is Tweety a bird?\" -> \"bird(tweety)\"\n" +
                "5. \"What is the color of the car?\" -> \"has_color(car, Color)\"\n\n" +
                "Input: " + naturalLanguageText + "\n" +
                "Output:";

        return client.generate(prompt).trim();
    }
}
