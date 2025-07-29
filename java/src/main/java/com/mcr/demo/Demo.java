package com.mcr.demo;

import com.mcr.core.MCR;
import com.mcr.core.Session;

import java.util.Map;

public class Demo {

    public static void main(String[] args) throws Exception {
        System.out.println("🚀 MCR Demo: Illustrating Core Capabilities 🚀");
        System.out.println("--------------------------------------------------\n");

        // --- MCR Initialization ---
        System.out.println("--- MCR Initialization ---");
        MCR mcr = new MCR(new MCR.LLMConfig("openai", System.getenv("OPENAI_API_KEY"), "gpt-3.5-turbo"));
        System.out.println("MCR instance created with OpenAI LLM client.");

        Session session = mcr.createSession();
        System.out.println("\nNew Session created with ID: " + session.getSessionId());

        // --- Natural Language Assertion ---
        System.out.println("\n--- Natural Language Assertion (assert) ---");
        session.assertStatement("All canaries are birds.");
        session.assertStatement("All birds have wings.");
        session.assertStatement("Tweety is a canary.");
        System.out.println("Knowledge asserted via natural language.");
        System.out.println("Current Knowledge Graph (Prolog):\n" + session.getKnowledgeGraph());

        // --- Prolog Query ---
        System.out.println("\n--- Prolog Query (query) ---");
        Map<String, Object> prologResult = session.query("has_wings(tweety).");
        System.out.println("Query 'has_wings(tweety).':");
        System.out.println("  Prolog Answer: " + (prologResult.get("success").equals(true) ? "Yes" : "No"));

        // --- Natural Language Query ---
        System.out.println("\n--- Natural Language Query (nquery) ---");
        Map<String, Object> naturalResult = session.nquery("Does tweety have wings?");
        System.out.println("Natural language query 'Does tweety have wings?':");
        System.out.println("  Success: " + naturalResult.get("success"));
        System.out.println("  Translated Prolog: " + naturalResult.get("prologQuery"));
        System.out.println("  Bindings: " + naturalResult.get("bindings"));

        System.out.println("\n--------------------------------------------------");
        System.out.println("Demo Complete!");
    }
}
