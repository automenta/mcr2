package com.example.mcr.core;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class SessionTest {
    
    private Session session;
    
    @BeforeEach
    void setUp() {
        session = new Session(new Session.SessionOptions());
    }
    
    @Test
    void testTranslationMethods() {
        // Test translation from natural language to Prolog
        String input = "The cat is on the mat";
        String expected = "on(mat, cat)";
        String result = session.translate(input);
        assertEquals(expected, result);
        
        // Test translation with multiple relationships
        input = "John loves Mary and hates Bob";
        expected = "loves(john, mary), hates(john, bob)";
        result = session.translate(input);
        assertEquals(expected, result);
    }
    
    @Test
    void testFactAssertion() {
        session.assertFact("parent(john, mary)");
        assertTrue(session.get Facts().contains("parent(john, mary)"));
    }
    
    @Test
    void testRelationshipHandling() {
        session.assertRelationship("father", "john", "mary");
        assertTrue(session.getRelationships().contains("father(john, mary)"));
    }
    
    @Test
    void testErrorScenarios() {
        assertThrows(Exception.class, () -> session.translate(null));
        assertThrows(Exception.class, () -> session.assertFact(null));
    }
}