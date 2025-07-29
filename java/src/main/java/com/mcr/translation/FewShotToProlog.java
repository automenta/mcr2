package com.mcr.translation;

import dev.langchain4j.model.chat.ChatLanguageModel;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class FewShotToProlog implements TranslationStrategy {

    @Override
    public Map<String, Object> translate(String naturalLanguageText, Object llmClient, String model, List<String> ontologyTerms, String feedback) throws Exception {
        ChatLanguageModel chatModel = (ChatLanguageModel) llmClient;

        String prompt = "Translate to Prolog fact, rule or query. Only output valid Prolog.\n" +
                "Do NOT include any extra text, comments, or explanations, just the Prolog.\n" +
                "A fact or rule must end with a single dot. A query must NOT end with a dot.\n" +
                "\n\nAvailable ontology terms: " + String.join(", ", ontologyTerms) +
                "\n\n" +
                "Examples:\n" +
                "1. \"All birds fly\" -> \"flies(X) :- bird(X).\"\n" +
                "2. \"Socrates is mortal\" -> \"mortal(socrates).\"\n" +
                "3. \"Does tweety fly?\" -> \"flies(tweety)\"\n" +
                "4. \"Is Tweety a bird?\" -> \"bird(tweety)\"\n" +
                "5. \"What is the color of the car?\" -> \"has_color(car, Color)\"\n\n" +
                "Input: " + naturalLanguageText + "\n" +
                "Output:";

        long startTime = System.currentTimeMillis();
        String prolog = chatModel.generate(prompt);
        long endTime = System.currentTimeMillis();

        Map<String, Object> result = new HashMap<>();
        result.put("prolog", prolog);
        result.put("promptTokens", 0L);
        result.put("completionTokens", 0L);
        result.put("latencyMs", endTime - startTime);
        return result;
    }
}
