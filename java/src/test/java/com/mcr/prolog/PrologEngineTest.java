package com.mcr.prolog;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PrologEngineTest {

    private PrologEngine prologEngine;

    @BeforeEach
    void setUp() {
        prologEngine = new PrologEngine();
    }

    @Test
    void testAssertAndQuery() {
        prologEngine.asserta("person(socrates).");
        Map<String, Object> result = prologEngine.query("person(socrates).");
        assertTrue((Boolean) result.get("success"));
    }

    @Test
    void testRetract() {
        prologEngine.asserta("person(socrates).");
        prologEngine.retract("person(socrates).");
        Map<String, Object> result = prologEngine.query("person(socrates).");
        assertFalse((Boolean) result.get("success"));
    }

    @Test
    void testClear() {
        prologEngine.asserta("person(socrates).");
        prologEngine.clear();
        assertTrue(prologEngine.getKnowledgeBase().isEmpty());
    }
}
