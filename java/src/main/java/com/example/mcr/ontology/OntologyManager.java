package com.example.mcr.ontology;

import java.util.*;
import java.util.regex.Pattern;

public class OntologyManager {
    private final Set<String> types;
    private final Set<String> relationships;
    private final Set<String> constraints;
    private final Map<String, String> synonyms;
    private final Pattern predicatePattern = Pattern.compile("^[a-z][a-zA-Z0-9_]*$");
    
    public OntologyManager(Map<String, Object> ontology) {
        this.types = new HashSet<>((List<String>) ontology.getOrDefault("types", new ArrayList<>()));
        this.relationships = new HashSet<>((List<String>) ontology.getOrDefault("relationships", new ArrayList<>()));
        this.constraints = new HashSet<>((List<String>) ontology.getOrDefault("constraints", new ArrayList<>()));
        this.synonyms = (Map<String, String>) ontology.getOrDefault("synonyms", new HashMap<>());
    }
    
    public String resolveSynonym(String term) {
        return synonyms.getOrDefault(term, term);
    }
    
    public boolean isValidPredicate(String predicate) {
        return predicatePattern.matcher(predicate).matches();
    }
    
    public boolean isDefined(String predicate) {
        String resolved = resolveSynonym(predicate);
        return types.contains(resolved) || relationships.contains(resolved);
    }
    
    public void validateFact(String predicate, List<String> args) {
        predicate = resolveSynonym(predicate);
        
        if (!isValidPredicate(predicate)) {
            throw new IllegalArgumentException("Invalid predicate: " + predicate + 
                ". Must follow Prolog naming conventions");
        }
        
        if (types.contains(predicate)) {
            if (args.size() != 1) {
                throw new IllegalArgumentException(predicate + " expects 1 argument, got " + args.size());
            }
        } else if (relationships.contains(predicate)) {
            if (args.size() < 2) {
                throw new IllegalArgumentException(predicate + " expects at least 2 arguments, got " + args.size());
            }
        }
        
        if (!isDefined(predicate)) {
            throw new IllegalArgumentException("Predicate '" + predicate + "' not in ontology. " + getSuggestions(predicate));
        }
    }
    
    public String getSuggestions(String predicate) {
        List<String> allTerms = new ArrayList<>();
        allTerms.addAll(types);
        allTerms.addAll(relationships);
        allTerms.addAll(synonyms.keySet());
        
        List<String> similar = new ArrayList<>();
        for (String term : allTerms) {
            if (term.startsWith(predicate.substring(0, Math.min(3, predicate.length()))) {
                similar.add(term);
            }
        }
        
        return similar.isEmpty() ? "No similar terms found" : "Did you mean: " + String.join(", ", similar);
    }
    
    // Other methods: validatePrologClause, addType, addRelationship, etc.
}