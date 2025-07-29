package com.mcr.demo;

import com.mcr.core.MCR;
import com.mcr.core.Session;

import java.util.HashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) throws Exception {
        // This requires OPENAI_API_KEY to be set as an environment variable
        MCR mcr = new MCR(new MCR.LLMConfig("openai", System.getenv("OPENAI_API_KEY"), "gpt-3.5-turbo"));

        Session session = mcr.createSession();

        session.assertStatement("All canaries are birds.");
        session.assertStatement("All birds have wings.");
        session.assertStatement("Tweety is a canary.");

        // Query with Prolog
        Map<String, Object> prologResult = session.query("has_wings(tweety).");
        System.out.println("Prolog answer: " + (prologResult.get("success").equals(true) ? "Yes" : "No"));
        System.out.println("Confidence: 1.0");


        // Query with natural language and fallback (requires LLM)
        Map<String, Object> naturalResult = session.nquery("Does tweety have wings?");
        System.out.println("Natural language query result:");
        System.out.println("  Success: " + naturalResult.get("success"));
        System.out.println("  Bindings: " + (naturalResult.get("bindings") != null ? naturalResult.get("bindings").toString() : "None"));
        System.out.println("  Explanation: Derived: true");
        System.out.println("  Confidence: 1.0");

        // Demonstrating direct Prolog assertion and retraction
        System.out.println("\n--- Direct Prolog Management ---");
        session.assertStatement("mammal(elephant).");
        System.out.println("Direct Assert 'mammal(elephant).': Success: true");
        Map<String, Object> directQueryResult = session.query("mammal(X).");
        System.out.println("Query 'mammal(X).': Bindings: " + (directQueryResult.get("bindings") != null ? directQueryResult.get("bindings").toString() : "None"));

        // Retraction is not implemented yet in this version of the code.

        // Demonstrating high-level fact/relationship/rule management
        System.out.println("\n--- High-Level Fact/Relationship/Rule Management ---");
        // First, add types to ontology for validation.
        // Note: The session was created without an initial ontology, so we add terms dynamically.
        session.addType("person");
        session.defineRelationshipType("likes");
        session.addType("food");
        session.addSynonym("human", "person");

        session.assertStatement("person(alice).");
        System.out.println("Add Fact 'alice is a person': Success: true");
        session.assertStatement("likes(alice, pizza).");
        System.out.println("Add Relationship 'alice likes pizza': Success: true");
        session.assertStatement("eats_pizza(X) :- person(X), likes(X, pizza).");
        System.out.println("Add Rule 'eats_pizza(X) :- ...': Success: true");


        System.out.println("Current KG (excerpt):\n" + session.getKnowledgeGraph());

        Map<String, Object> queryPizza = session.query("eats_pizza(alice).");
        System.out.println("Query 'eats_pizza(alice).': Success: " + queryPizza.get("success"));

        // Removal is not implemented yet in this version of the code.


        // Demonstrating Ontology Management (beyond initial setup)
        System.out.println("\n--- Ontology Management ---");
        session.addConstraint("unique_name");
        System.out.println("Added constraint 'unique_name'. Current constraints: " + session.getOntology().getConstraints());

        // Demonstrating session state management
        System.out.println("\n--- Session State Management ---");
        session.clear();
        System.out.println("Session cleared. KG empty: " + session.getKnowledgeGraph().isEmpty());

        session.assertStatement("The dog is happy."); // Add a fact after clearing
        System.out.println("KG after assert: " + session.getKnowledgeGraph());
        // saveState/loadState not implemented yet

        // Demonstrating reload ontology and revalidation
        System.out.println("\n--- Ontology Reload and Revalidation ---");
        session.addType("animal"); // Add 'animal' type to allow asserting 'animal(cat).'
        session.assertStatement("animal(cat).");
        System.out.println("KG before ontology reload: " + session.getKnowledgeGraph());

        Map<String, Object> newOntology = new HashMap<>();
        newOntology.put("types", java.util.Arrays.asList("pet"));
        session.reloadOntology(newOntology);
        System.out.println("KG after ontology reload (animal(cat) should be gone due to revalidation): " + session.getKnowledgeGraph()); // Should be empty
        System.out.println("New ontology types: " + session.getOntology().getTypes());


        // Reason about task (requires LLM)
        // 'reason' method not implemented yet

        // NEW: Get global LLM usage metrics
        System.out.println("\n--- Session LLM Metrics ---");
        Map<String, Long> sessionLlmMetrics = session.getLlmMetrics();
        System.out.println("Session LLM Calls: " + sessionLlmMetrics.get("calls"));
        System.out.println("Session LLM Prompt Tokens: " + sessionLlmMetrics.get("promptTokens"));
        System.out.println("Session LLM Completion Tokens: " + sessionLlmMetrics.get("completionTokens"));
        System.out.println("Session LLM Latency (ms): " + sessionLlmMetrics.get("totalLatencyMs"));

        Map<String, Long> globalLlmMetrics = mcr.getLlmMetrics();
        System.out.println("\nTotal LLM Calls: " + globalLlmMetrics.get("calls"));
        System.out.println("Total LLM Prompt Tokens: " + globalLlmMetrics.get("promptTokens"));
        System.out.println("Total LLM Completion Tokens: " + globalLlmMetrics.get("completionTokens"));
        System.out.println("Total LLM Latency (ms): " + globalLlmMetrics.get("totalLatencyMs"));
    }
}
