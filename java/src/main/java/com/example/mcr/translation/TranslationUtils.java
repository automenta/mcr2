package com.example.mcr.translation;

import java.util.List;

/**
 * Utility class for translation-related operations.
 */
public class TranslationUtils {

    /**
     * Creates an ontology hint string from a list of ontology terms.
     * 
     * @param ontologyTerms List of ontology terms
     * @return Formatted hint string or empty string if no terms provided
     */
    public static String createOntologyHint(List<String> ontologyTerms) {
        return ontologyTerms != null && !ontologyTerms.isEmpty() ? 
            "\n\nAvailable ontology terms: " + String.join(", ", ontologyTerms) : 
            "";
    }

    /**
     * Converts JSON output to Prolog format.
     * 
     * @param jsonOutput JSON structure containing Prolog elements
     * @return Prolog representation of the input
     */
    public static String convertJsonToProlog(JsonOutput jsonOutput) {
        if (jsonOutput == null) return "";
        
        switch (jsonOutput.type) {
            case "fact":
                return String.format("%s(%s).", 
                    jsonOutput.head.predicate, 
                    String.join(", ", jsonOutput.head.args));
                    
            case "rule":
                StringBuilder bodyBuilder = new StringBuilder();
                for (int i = 0; i < jsonOutput.body.size(); i++) {
                    Condition cond = jsonOutput.body.get(i);
                    bodyBuilder.append(cond.predicate)
                               .append("(")
                               .append(String.join(", ", cond.args))
                               .append(")");
                    if (i < jsonOutput.body.size() - 1) {
                        bodyBuilder.append(", ");
                    }
                }
                return String.format("%s(%s) :- %s.", 
                    jsonOutput.head.predicate, 
                    String.join(", ", jsonOutput.head.args),
                    bodyBuilder.toString());
                    
            case "query":
                return String.format("%s(%s)", 
                    jsonOutput.head.predicate, 
                    String.join(", ", jsonOutput.head.args));
                    
            default:
                return "";
        }
    }

    // Supporting classes for JSON structure
    public static class JsonOutput {
        public String type;
        public Head head;
        public List<Condition> body;
    }

    public static class Head {
        public String predicate;
        public List<String> args;
    }

    public static class Condition {
        public String predicate;
        public List<String> args;
    }
}