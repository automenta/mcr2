package main.java.com.example.mcr.translation;

import com.example.mcr.core.LLMClient;
import com.example.mcr.core.LLMUsageMetrics;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class JsonToProlog implements TranslationStrategy {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public CompletableFuture<TranslationResult> translate(String input, LLMClient llmClient, String model, List<String> ontologyTerms, String feedback, boolean returnFullResponse) {
        try {
            StringBuilder ontologyHint = new StringBuilder();
            if (ontologyTerms != null && !ontologyTerms.isEmpty()) {
                ontologyHint.append("\n\nAvailable ontology terms: ")
                        .append(String.join(", ", ontologyTerms));
            }

            StringBuilder feedbackHint = new StringBuilder();
            if (feedback != null && !feedback.isEmpty()) {
                feedbackHint.append("\n\nFeedback from previous attempt: ")
                        .append(feedback)
                        .append("\n\n");
            }

            String prompt = "Translate the following into JSON representation, then convert to Prolog.\n" +
                    ontologyHint.toString() +
                    feedbackHint.toString() +
                    "\nOutput ONLY valid JSON with:\n" +
                    "- \"type\" (\"fact\", \"rule\", or \"query\")\n" +
                    "- \"head\" with \"predicate\" and \"args\" array\n" +
                    "- \"body\" array (for rules only) with elements having \"predicate\" and \"args\"\n\n" +
                    "Examples:\n" +
                    "{\"type\":\"fact\",\"head\":{\"predicate\":\"bird\",\"args\":[\"tweety\"]}}\n" +
                    "{\"type\":\"rule\",\"head\":{\"predicate\":\"has_wings\",\"args\":[\"X\"]},\"body\":[{\"predicate\":\"bird\",\"args\":[\"X\"]}]}\n" +
                    "{\"type\":\"query\",\"head\":{\"predicate\":\"can_migrate\",\"args\":[\"tweety\"]}}\n" +
                    "\nInput: " + input + "\n" +
                    "Output:";

            // Simulate LLM response (in real implementation, this would call the LLM client)
            String mockResponse = "{\"type\":\"fact\",\"head\":{\"predicate\":\"bird\",\"args\":[\"tweety\"]}}";
            
            // In a real implementation:
            // CompletableFuture<LLMResponse> llmResponse = llmClient.chat().completions().create(model, prompt);
            
            // Parse JSON response
            JsonNode rootNode = objectMapper.readTree(mockResponse);
            String type = rootNode.get("type").asText();
            JsonNode headNode = rootNode.get("head");
            List<String> args = parseArgs(headNode.get("args"));
            
            // Convert to Prolog
            String prolog = convertJsonToProlog(type, headNode, rootNode.get("body"));
            
            TranslationResult result = new TranslationResult();
            result.setType(type);
            result.setContent(prolog);
            
            return CompletableFuture.completedFuture(result);
        } catch (JsonProcessingException e) {
            return CompletableFuture.failedFuture(new RuntimeException("JSON processing error", e));
        } catch (Exception e) {
            return CompletableFuture.failedFuture(e);
        }
    }

    private List<String> parseArgs(JsonNode argsNode) throws JsonProcessingException {
        List<String> args = new ArrayList<>();
        if (argsNode != null && argsNode.isArray()) {
            for (JsonNode arg : argsNode) {
                args.add(arg.asText());
            }
        }
        return args;
    }

    private String convertJsonToProlog(String type, JsonNode head, JsonNode body) {
        String predicate = head.get("predicate").asText();
        List<String> args = parseArgs(head.get("args"));
        
        StringBuilder prolog = new StringBuilder();
        prolog.append(predicate);
        prolog.append("(");
        prolog.append(String.join(", ", args));
        prolog.append(")");
        
        if (type.equals("rule") && body != null && body.isArray()) {
            prolog.append(" :- ");
            List<String> bodyClauses = new ArrayList<>();
            for (JsonNode clause : body) {
                String clausePredicate = clause.get("predicate").asText();
                List<String> clauseArgs = parseArgs(clause.get("args"));
                bodyClauses.add(clausePredicate + "(" + String.join(", ", clauseArgs) + ")");
            }
            prolog.append(String.join(", ", bodyClauses));
        }
        
        prolog.append(".");
        return prolog.toString();
    }

    public static class TranslationResult {
        private String type;
        private String content;
        
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}