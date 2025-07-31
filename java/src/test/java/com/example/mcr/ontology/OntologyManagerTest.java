package com.example.mcr.ontology;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.util.Arrays;
import java.util.HashSet;

public class OntologyManagerTest {
    private OntologyManager ontologyManager;

    @BeforeEach
    void setUp() {
        ontologyManager = new OntologyManager();
        ontologyManager.addType("bird");
        ontologyManager.addType("animal");
        ontologyManager.defineRelationshipType("has_wings");
    }

    @Test
    void shouldValidateFactWithExistingType() {
        assertTrue(ontologyManager.isValidFact("bird", "tweety"));
    }

    @Test
    void shouldRejectFactWithMissingType() {
        assertFalse(ontologyManager.isValidFact("fish", "nemo"));
    }

    @Test
    void shouldValidateRelationshipWithExistingType() {
        assertTrue(ontologyManager.isValidRelationship("has_wings", "tweety", "true"));
    }

    @Test
    void shouldRejectRelationshipWithMissingType() {
        assertFalse(ontologyManager.isValidRelationship("swims", "nemo", "true"));
    }

    @ParameterizedTest
    @CsvSource({
        "bird(tweety)., true",
        "fish(nemo)., false",
        "has_wings(tweety, true)., true",
        "swims(nemo, true)., false"
    })
    void shouldValidatePrologClauseAgainstOntology(String clause, boolean expected) {
        assertEquals(expected, ontologyManager.isValidPrologClause(clause));
    }

    @Test
    void shouldReloadOntologyAndRevalidate() {
        ontologyManager.reloadOntology(new OntologyManager.OntologyConfig(
            new HashSet<>(Arrays.asList("mammal")),
            new HashSet<>(Arrays.asList("eats")),
            new HashSet<>(),
            null
        ));
        
        assertFalse(ontologyManager.isValidFact("bird", "tweety"));
        assertTrue(ontologyManager.isValidFact("mammal", "dog"));
    }

    @Test
    void shouldAddAndRetrieveSynonyms() {
        ontologyManager.addSynonym("canary", "bird");
        assertEquals("bird", ontologyManager.getSynonym("canary"));
    }
}