package com.mcr;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class Demo {

    public static void main(String[] args) {
        // This is a placeholder for the demo.
        // In a real application, you would get the API key from a secure source.
        String apiKey = System.getenv("OPENAI_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) {
            System.err.println("OPENAI_API_KEY environment variable not set.");
            return;
        }

        Map<String, Object> llmConfig = new HashMap<>();
        llmConfig.put("provider", "openai");
        llmConfig.put("apiKey", apiKey);

        Map<String, Object> mcrConfig = new HashMap<>();
        mcrConfig.put("llm", llmConfig);

        MCR mcr = new MCR(mcrConfig);

        Map<String, Object> sessionOptions = new HashMap<>();
        Map<String, Object> ontology = new HashMap<>();
        ontology.put("types", Arrays.asList("bird", "canary"));
        ontology.put("relationships", Arrays.asList("has_wings", "can_fly"));
        sessionOptions.put("ontology", ontology);

        MCR.Session session = mcr.createSession(sessionOptions);

        session.assertStatement("All canaries are birds.");
        session.assertStatement("All birds have wings.");
        session.assertStatement("Tweety is a canary.");

        System.out.println("Prolog answer: " + session.query("has_wings(tweety)", new HashMap<>()));
        System.out.println("Natural language query result: " + session.nquery("Does tweety have wings?", new HashMap<>()));

        // The following is a placeholder for the rest of the demo.
        // The full functionality will be implemented in the next steps.
        System.out.println("\n--- High-Level Fact/Relationship/Rule Management ---");
        System.out.println("\n--- Ontology Management ---");
        System.out.println("\n--- Session State Management ---");
        System.out.println("\n--- Ontology Reload and Revalidation ---");
        System.out.println("\n--- Session LLM Metrics ---");
    }
}
