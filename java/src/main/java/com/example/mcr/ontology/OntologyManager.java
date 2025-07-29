package com.example.mcr.ontology;

import java.util.*;
import java.util.regex.*;

public class OntologyManager {
    private final Set<String> types = new HashSet<>();
    private final Set<String> relationships = new HashSet<>();
    private final Set<String> constraints = new HashSet<>();
    private final List<String> rules = new ArrayList<>();
    private final Map<String, String> synonyms = new HashMap<>();

    public OntologyManager(Ontology ontology) {
        if (ontology != null) {
            this.types.addAll(ontology.getTypes());
            this.relationships.addAll(ontology.getRelationships());
            this.constraints.addAll(ontology.getConstraints());
            this.rules.addAll(ontology.getRules());
            this.synonyms.putAll(ontology.getSynonyms());
        }
    }

    public String resolveSynonym(String term) {
        return synonyms.getOrDefault(term, term);
    }

    public boolean isValidPredicate(String predicate) {
        return predicate != null && predicate.trim().matches("^[a-z][a-zA-Z0-9_]*$");
    }

    public boolean isDefined(String predicate) {
        String resolved = resolveSynonym(predicate);
        return types.contains(resolved) || relationships.contains(resolved);
    }

    public String getSuggestions(String predicate) {
        List<String> allTerms = new ArrayList<>();
        allTerms.addAll(types);
        allTerms.addAll(relationships);
        allTerms.addAll(synonyms.keySet());
        
        List<String> similar = new ArrayList<>();
        for (String term : allTerms) {
            if (term.startsWith(predicate.substring(0, 3)) || term.contains(predicate)) {
                similar.add(term);
            }
        }
        
        return similar.isEmpty() ? "No similar terms found" : "Did you mean: " + String.join(", ", similar) + "?";
    }

    public void validateFact(String predicate, List<String> args) throws IllegalArgumentException {
        predicate = resolveSynonym(predicate);
        
        if (!isValidPredicate(predicate)) {
            throw new IllegalArgumentException("Invalid predicate: " + predicate + ". Must follow Prolog naming conventions");
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

    public void validatePrologClause(String prologClause) throws IllegalArgumentException {
        String[] parts = prologClause.split(":-");
        String head = parts[0].trim();
        String body = parts.length > 1 ? parts[1].replaceAll("\\.$", "").trim() : null;
        
        Map<String, Object> headMatch = parsePredicate(head);
        if (headMatch == null) {
            throw new IllegalArgumentException("Invalid Prolog head format: " + head);
        }
        
        String headPredicate = (String) headMatch.get("predicate");
        List<String> headArgs = (List<String>) headMatch.get("args");
        
        validateFact(headPredicate, headArgs);
        
        if (body != null && !body.isEmpty()) {
            if (body.trim().isEmpty()) {
                throw new IllegalArgumentException("Rule body cannot be empty.");
            }
            
            String[] bodyPredicates = body.split(",");
            for (String p : bodyPredicates) {
                String trimmedPredicate = p.trim();
                Map<String, Object> predMatch = parsePredicate(trimmedPredicate);
                if (predMatch == null) {
                    throw new IllegalArgumentException("Invalid Prolog body predicate format: " + trimmedPredicate);
                }
                
                String predName = (String) predMatch.get("predicate");
                if (!isDefined(predName)) {
                    throw new IllegalArgumentException("Rule body predicate '" + predName + "' not defined in ontology. " + getSuggestions(predName));
                }
            }
        }
    }

    private Map<String, Object> parsePredicate(String predicateStr) {
        Pattern pattern = Pattern.compile("^(?<predicate>[a-z][a-zA-Z0-9_]*)\\((?<args>[^)]*)\\)$");
        Matcher matcher = pattern.matcher(predicateStr.trim());
        
        if (!matcher.matches()) {
            return null;
        }
        
        String predicate = matcher.group("predicate");
        String[] args = matcher.group("args").isEmpty() ? new String[0] : matcher.group("args").split(",");
        
        Map<String, Object> result = new HashMap<>();
        result.put("predicate", predicate);
        result.put("args", Arrays.stream(args).map(String::trim).toList());
        return result;
    }

    public void addRule(String rule) {
        // This method is for structured rule objects, not raw prolog clauses
        validatePrologClause(rule);
        this.rules.add(rule);
    }

    public void addType(String type) {
        this.types.add(type);
    }

    public void defineRelationshipType(String relationship) {
        this.relationships.add(relationship);
    }

    public void addConstraint(String constraint) {
        this.constraints.add(constraint);
    }

    public void addSynonym(String originalTerm, String synonym) {
        this.synonyms.put(originalTerm, synonym);
    }

    public static class Ontology {
        private final Set<String> types;
        private final Set<String> relationships;
        private final Set<String> constraints;
        private final Map<String, String> synonyms;
        
        public Ontology() {
            this.types = new HashSet<>();
            this.relationships = new HashSet<>();
            this.constraints = new HashSet<>();
            this.synonyms = new HashMap<>();
        }
        
        public Set<String> getTypes() { return types; }
        public Set<String> getRelationships() { return relationships; }
        public Set<String> getConstraints() { return constraints; }
        public Map<String, String> getSynonyms() { return synonyms; }
    }
}