package com.mcr.core;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.model.output.TokenUsage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class MCRTest {

    @Mock
    private ChatLanguageModel llmClient;

    private MCR mcr;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        MCR.LLMConfig llmConfig = new MCR.LLMConfig(llmClient, "gpt-3.5-turbo");
        mcr = new MCR(llmConfig);
    }

    @Test
    void testCreateSession() {
        Session session = mcr.createSession();
        assertNotNull(session);
    }

    @Test
    void testLlmMetrics() throws Exception {
        when(llmClient.generate(any(String.class))).thenReturn(Response.from("person(socrates).", new TokenUsage(10, 20)));

        Session session = mcr.createSession();
        session.assertStatement("Socrates is a person.");

        Map<String, Long> metrics = mcr.getLlmMetrics();
        assertEquals(1, metrics.get("calls"));
        assertEquals(10, metrics.get("promptTokens"));
        assertEquals(20, metrics.get("completionTokens"));
    }
}
