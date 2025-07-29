package com.mcr.translation;

import dev.langchain4j.model.chat.ChatLanguageModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

class TranslationStrategyTest {

    @Mock
    private ChatLanguageModel llmClient;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testDirectToProlog() throws Exception {
        DirectToProlog strategy = new DirectToProlog();
        String naturalLanguageText = "Socrates is a man.";
        String expectedProlog = "man(socrates).";
        String prompt = "Translate to Prolog fact, rule or query. Only output valid Prolog.\n" +
                "Do NOT include any extra text, comments, or explanations, just the Prolog.\n" +
                "A fact or rule must end with a single dot. A query must NOT end with a dot.\n" +
                "\n\nAvailable ontology terms: person, city, lives_in, works_at" +
                "\n\n" +
                "Examples:\n" +
                "1. \"All birds fly\" -> \"flies(X) :- bird(X).\"\n" +
                "2. \"Socrates is mortal\" -> \"mortal(socrates).\"\n" +
                "3. \"Does tweety fly?\" -> \"flies(tweety)\"\n" +
                "4. \"Is Tweety a bird?\" -> \"bird(tweety)\"\n" +
                "5. \"What is the color of the car?\" -> \"has_color(car, Color)\"\n\n" +
                "Input: " + naturalLanguageText + "\n" +
                "Output:";
        when(llmClient.generate(prompt)).thenReturn(expectedProlog);

        List<String> ontologyTerms = Arrays.asList("person", "city", "lives_in", "works_at");
        Map<String, Object> result = strategy.translate(naturalLanguageText, llmClient, "gpt-3.5-turbo", ontologyTerms, null);
        assertEquals(expectedProlog, result.get("prolog"));
    }

    @Test
    void testJsonToProlog() throws Exception {
        JsonToProlog strategy = new JsonToProlog();
        String naturalLanguageText = "Socrates is a man.";
        String llmResponse = "{\"type\":\"fact\",\"head\":{\"predicate\":\"man\",\"args\":[\"socrates\"]}}";
        String expectedProlog = "man(socrates).";
        String prompt = "Translate the following into JSON representation, then convert to Prolog.\n\nAvailable ontology terms: person, city, lives_in, works_at" + "\n\n" +
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
        when(llmClient.generate(prompt)).thenReturn(llmResponse);

        List<String> ontologyTerms = Arrays.asList("person", "city", "lives_in", "works_at");
        Map<String, Object> result = strategy.translate(naturalLanguageText, llmClient, "gpt-3.5-turbo", ontologyTerms, null);
        assertEquals(expectedProlog, result.get("prolog"));
    }
}
