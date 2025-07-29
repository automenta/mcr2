package com.mcr.ontology;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OntologyManagerTest {

    private OntologyManager ontologyManager;

    @BeforeEach
    void setUp() {
        Map<String, Object> ontology = new HashMap<>();
        ontology.put("types", Arrays.asList("person", "city"));
        ontology.put("relationships", Arrays.asList("lives_in", "works_at"));
        ontology.put("synonyms", new HashMap<String, String>() {{
            put("human", "person");
        }});
        ontologyManager = new OntologyManager(ontology);
    }

    @Test
    void testResolveSynonym() {
        assertEquals("person", ontologyManager.resolveSynonym("human"));
        assertEquals("city", ontologyManager.resolveSynonym("city"));
    }

    @Test
    void testIsValidPredicate() {
        assertTrue(ontologyManager.isValidPredicate("valid_predicate"));
        assertFalse(ontologyManager.isValidPredicate("InvalidPredicate"));
    }

    @Test
    void testIsDefined() {
        assertTrue(ontologyManager.isDefined("person"));
        assertTrue(ontologyManager.isDefined("lives_in"));
        assertTrue(ontologyManager.isDefined("human"));
        assertFalse(ontologyManager.isDefined("undefined_predicate"));
    }

    @Test
    void testValidateFact() {
        assertDoesNotThrow(() -> ontologyManager.validateFact("person", Arrays.asList("socrates")));
        assertThrows(IllegalArgumentException.class, () -> ontologyManager.validateFact("person", Arrays.asList("socrates", "athens")));
        assertDoesNotThrow(() -> ontologyManager.validateFact("lives_in", Arrays.asList("socrates", "athens")));
        assertThrows(IllegalArgumentException.class, () -> ontologyManager.validateFact("undefined_predicate", Arrays.asList("arg1")));
    }

    @Test
    void testValidatePrologClause() {
        assertDoesNotThrow(() -> ontologyManager.validatePrologClause("person(socrates)."));
        assertDoesNotThrow(() -> ontologyManager.validatePrologClause("lives_in(socrates, athens)."));
        assertDoesNotThrow(() -> ontologyManager.validatePrologClause("mortal(X) :- person(X)."));
        assertThrows(IllegalArgumentException.class, () -> ontologyManager.validatePrologClause("undefined_predicate(socrates)."));
        assertThrows(IllegalArgumentException.class, () -> ontologyManager.validatePrologClause("mortal(X) :- undefined_predicate(X)."));
    }
}
