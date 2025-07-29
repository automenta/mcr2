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
        session.assertStatement("person(socrates).");
        Map<String, Object> result = session.query("person(socrates).");
        assertEquals(true, result.get("success"));
    }
}
