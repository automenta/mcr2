package com.mcr.core;

import com.mcr.ontology.OntologyManager;
import dev.langchain4j.model.chat.ChatLanguageModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class SessionTest {

    @Mock
    private ChatLanguageModel llmClient;

    private MCR.LLMConfig llmConfig;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        llmConfig = new MCR.LLMConfig(llmClient, "gpt-3.5-turbo");
    }

    @Test
    void testAssertStatement() throws Exception {
        when(llmClient.generate(anyString())).thenReturn("bird(tweety).");

        Map<String, Object> ontology = new HashMap<>();
        ontology.put("types", Arrays.asList("bird"));
        OntologyManager ontologyManager = new OntologyManager(ontology);

        Session session = new Session(ontologyManager, llmConfig, (metrics) -> {});
        Map<String, Object> result = session.assertStatement("Tweety is a bird");

        assertNotNull(result);
        assertEquals("bird(tweety).", result.get("prolog"));
    }

    @Test
    void testQuery() {
        Session session = new Session(llmConfig, (metrics) -> {});
        session.addFact("socrates", "person");
        Map<String, Object> result = session.query("person(socrates).");
        assertEquals(true, result.get("success"));
    }

    @Test
    void testSaveAndLoadState() {
        Session session = new Session(llmConfig, (metrics) -> {});
        session.addFact("socrates", "person");
        String state = session.saveState();

        Session newSession = new Session(llmConfig, (metrics) -> {});
        newSession.loadState(state);

        Map<String, Object> result = newSession.query("person(socrates).");
        assertEquals(true, result.get("success"));
    }

    @Test
    void testAddAndRemoveFact() {
        Session session = new Session(llmConfig, (metrics) -> {});
        session.addFact("socrates", "person");
        Map<String, Object> result = session.query("person(socrates).");
        assertEquals(true, result.get("success"));

        session.removeFact("socrates", "person");
        result = session.query("person(socrates).");
        assertEquals(false, result.get("success"));
    }

    @Test
    void testAddAndRemoveRelationship() {
        Session session = new Session(llmConfig, (metrics) -> {});
        session.addRelationship("socrates", "lives_in", "athens");
        Map<String, Object> result = session.query("lives_in(socrates, athens).");
        assertEquals(true, result.get("success"));

        session.removeRelationship("socrates", "lives_in", "athens");
        result = session.query("lives_in(socrates, athens).");
        assertEquals(false, result.get("success"));
    }

    @Test
    void testReason() throws Exception {
        when(llmClient.generate(anyString()))
                .thenReturn("{\"type\":\"query\",\"content\":\"can_fly(tweety).\"}")
                .thenReturn("{\"type\":\"conclude\",\"answer\":\"Yes, Tweety can fly.\"}");

        Map<String, Object> ontology = new HashMap<>();
        ontology.put("types", Arrays.asList("bird"));
        ontology.put("relationships", Arrays.asList("can_fly"));
        OntologyManager ontologyManager = new OntologyManager(ontology);

        Session session = new Session(ontologyManager, llmConfig, (metrics) -> {});
        session.addFact("tweety", "bird");
        session.assertStatement("can_fly(X) :- bird(X).");

        Map<String, Object> result = session.reason("Can Tweety fly?", new HashMap<>());

        assertNotNull(result);
        assertEquals("Yes, Tweety can fly.", result.get("answer"));
    }

    @Test
    void testLlmMetrics() throws Exception {
        when(llmClient.generate(any(String.class))).thenReturn(Response.from("person(socrates).", new TokenUsage(10, 20)));

        Session session = new Session(llmConfig, (metrics) -> {});
        session.assertStatement("Socrates is a person.");

        Map<String, Long> metrics = session.getLlmMetrics();
        assertEquals(1, metrics.get("calls"));
        assertEquals(10, metrics.get("promptTokens"));
        assertEquals(20, metrics.get("completionTokens"));
    }
}
