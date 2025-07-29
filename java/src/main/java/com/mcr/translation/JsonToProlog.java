package com.mcr.translation;

import com.google.gson.Gson;
import dev.langchain4j.model.chat.ChatLanguageModel;

import java.util.List;
import java.util.Map;

public class JsonToProlog implements TranslationStrategy {

    @Override
    public String translate(String naturalLanguageText, Object llmClient, String model, List<String> ontologyTerms, String feedback) throws Exception {
        if (!(llmClient instanceof ChatLanguageModel)) {
            throw new IllegalArgumentException("JsonToProlog requires a ChatLanguageModel.");
        }
        ChatLanguageModel client = (ChatLanguageModel) llmClient;

        String ontologyHint = !ontologyTerms.isEmpty() ? "\n\nAvailable ontology terms: " + String.join(", ", ontologyTerms) : "";
        String feedbackHint = feedback != null ? "\n\nFeedback from previous attempt: " + feedback + "\n\n" : "";

        String prompt = "Translate the following into JSON representation, then convert to Prolog." + ontologyHint + feedbackHint +
                "Output ONLY valid JSON with:\n" +
                "- \"type\" (\"fact\"/\"rule\"/\"query\")\n" +
                "- \"head\" with \"predicate\" and \"args\" array\n" +
                "- \"body\" array (for rules only) with elements having \"predicate\" and \"args\"\n\n" +
                "Examples:\n" +
                "{\"type\":\"fact\",\"head\":{\"predicate\":\"bird\",\"args\":[\"tweety\"]}}\n" +
                "{\"type\":\"rule\",\"head\":{\"predicate\":\"has_wings\",\"args\":[\"X\"]},\"body\":[{\"predicate\":\"bird\",\"args\":[\"X\"]}]}\n" +
                "{\"type\":\"query\",\"head\":{\"predicate\":\"can_migrate\",\"args\":[\"tweety\"]}}\n\n" +
                "Input: " + naturalLanguageText + "\n" +
                "Output:";

        String jsonOutput = client.generate(prompt).trim();
        return convertJsonToProlog(new Gson().fromJson(jsonOutput, Map.class));
    }

    private String convertJsonToProlog(Map<String, Object> jsonOutput) {
        String type = (String) jsonOutput.get("type");
        Map<String, Object> head = (Map<String, Object>) jsonOutput.get("head");
        String headPredicate = (String) head.get("predicate");
        List<String> headArgs = (List<String>) head.get("args");

        if ("fact".equals(type)) {
            return headPredicate + "(" + String.join(", ", headArgs) + ").";
        } else if ("rule".equals(type)) {
            List<Map<String, Object>> body = (List<Map<String, Object>>) jsonOutput.get("body");
            StringBuilder bodyStr = new StringBuilder();
            for (Map<String, Object> cond : body) {
                String pred = (String) cond.get("predicate");
                List<String> args = (List<String>) cond.get("args");
                bodyStr.append(pred).append("(").append(String.join(", ", args)).append("), ");
            }
            bodyStr.setLength(bodyStr.length() - 2); // Remove trailing ", "
            return headPredicate + "(" + String.join(", ", headArgs) + ") :- " + bodyStr + ".";
        } else if ("query".equals(type)) {
            return headPredicate + "(" + String.join(", ", headArgs) + ")";
        }
        return "";
    }
}
