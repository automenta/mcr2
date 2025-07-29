package com.mcr.translation;

import com.google.gson.Gson;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class JsonToProlog implements TranslationStrategy {
    @Override
    public Map<String, Object> translate(String naturalLanguageText, Object llmClient, String model, List<String> ontologyTerms, String feedback) throws Exception {
        ChatLanguageModel chatModel = (ChatLanguageModel) llmClient;
        String prompt = "Translate the following into JSON representation, then convert to Prolog.\n\nAvailable ontology terms: " + String.join(", ", ontologyTerms) + "\n\n" +
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

        long startTime = System.currentTimeMillis();
        String jsonResponse = chatModel.generate(prompt);
        long endTime = System.currentTimeMillis();

        Gson gson = new Gson();
        Map<String, Object> jsonMap = gson.fromJson(jsonResponse, Map.class);
        String prolog = jsonToProlog(jsonMap);


        Map<String, Object> result = new HashMap<>();
        result.put("prolog", prolog);
        result.put("json", jsonResponse);
        result.put("promptTokens", 0L);
        result.put("completionTokens", 0L);
        result.put("latencyMs", endTime - startTime);

        return result;
    }

    private String jsonToProlog(Map<String, Object> jsonMap) {
        String type = (String) jsonMap.get("type");
        Map<String, Object> head = (Map<String, Object>) jsonMap.get("head");
        String headPredicate = (String) head.get("predicate");
        List<String> headArgs = (List<String>) head.get("args");
        String headArgsString = String.join(", ", headArgs);
        String prolog = headPredicate + "(" + headArgsString + ")";

        if ("rule".equals(type)) {
            List<Map<String, Object>> body = (List<Map<String, Object>>) jsonMap.get("body");
            String bodyString = body.stream().map(p -> {
                String pred = (String) p.get("predicate");
                List<String> args = (List<String>) p.get("args");
                return pred + "(" + String.join(", ", args) + ")";
            }).collect(Collectors.joining(", "));
            prolog += " :- " + bodyString;
        }

        if ("fact".equals(type) || "rule".equals(type)) {
            prolog += ".";
        }

        return prolog;
    }
}
