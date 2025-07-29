package com.mcr.core;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class MCRTest {

    @Test
    void testCreateSession() {
        MCR mcr = new MCR(new MCR.LLMConfig("openai", "test-key", "gpt-3.5-turbo"));
        Session session = mcr.createSession();
        assertNotNull(session);
    }
}
