package com.mcr.ontology;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public class OntologyManager {

    private Set<String> types;
    private Set<String> relationships;
    private Set<String> constraints;
    private List<Object> rules;
    private Map<String, String> synonyms;

    public OntologyManager(Map<String, Object> ontology) {
        this.types = new HashSet<>((List<String>) ontology.getOrDefault("types", Arrays.asList()));
        this.relationships = new HashSet<>((List<String>) ontology.getOrDefault("relationships", Arrays.asList()));
        this.constraints = new HashSet<>((List<String>) ontology.getOrDefault("constraints", Arrays.asList()));
        this.rules = (List<Object>) ontology.getOrDefault("rules", Arrays.asList());
        this.synonyms = (Map<String, String>) ontology.getOrDefault("synonyms", new HashMap<>());
    }

    public String resolveSynonym(String term) {
        return synonyms.getOrDefault(term, term);
    }

    public boolean isValidPredicate(String predicate) {
        return predicate.matches("^[a-z][a-zA-Z0-9_]*$");
    }

    public boolean isDefined(String predicate) {
        String resolvedPredicate = resolveSynonym(predicate);
        return types.contains(resolvedPredicate) || relationships.contains(resolvedPredicate);
    }

    public void validateFact(String predicate, List<String> args) {
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
            String suggestions = getSuggestions(predicate);
            throw new IllegalArgumentException("Predicate '" + predicate + "' not in ontology. " + suggestions);
        }
    }

    public void validatePrologClause(String prologClause) {
        String[] parts = prologClause.split(":-");
        String head = parts[0].trim();
        String body = parts.length > 1 ? parts[1].replaceAll("\\.\\s*$", "").trim() : null;

        java.util.regex.Matcher headMatcher = java.util.regex.Pattern.compile("^([a-z][a-zA-Z0-9_]+)(?:\\(([^)]+)\\))?$").matcher(head);
        if (!headMatcher.matches()) {
            throw new IllegalArgumentException("Invalid Prolog head format: " + head);
        }

        String headPredicate = headMatcher.group(1);
        List<String> headArgs = headMatcher.group(2) != null ? Arrays.asList(headMatcher.group(2).split(",")).stream().map(String::trim).collect(Collectors.toList()) : Arrays.asList();

        validateFact(headPredicate, headArgs);

        if (body != null) {
            if (body.trim().isEmpty()) {
                throw new IllegalArgumentException("Rule body cannot be empty.");
            }
            String[] bodyPredicates = body.split(",");
            for (String p : bodyPredicates) {
                String trimmedPredicate = p.trim();
                java.util.regex.Matcher predMatcher = java.util.regex.Pattern.compile("^([a-z][a-zA-Z0-9_]+)(?:\\(([^)]+)\\))?$").matcher(trimmedPredicate);
                if (!predMatcher.matches()) {
                    throw new IllegalArgumentException("Invalid Prolog body predicate format: " + trimmedPredicate);
                }
                String predName = predMatcher.group(1);
                if (!isDefined(predName)) {
                    String suggestions = getSuggestions(predName);
                    throw new IllegalArgumentException("Rule body predicate '" + predName + "' not defined in ontology. " + suggestions);
                }
            }
        }
    }

    public String getSuggestions(String predicate) {
        Set<String> allTerms = new HashSet<>();
        allTerms.addAll(types);
        allTerms.addAll(relationships);
        allTerms.addAll(synonyms.keySet());

        List<String> similar = allTerms.stream()
                .filter(term -> term.startsWith(predicate.substring(0, Math.min(predicate.length(), 3))) || term.contains(predicate))
                .collect(Collectors.toList());

        return similar.isEmpty() ? "No similar terms found" : "Did you mean: " + String.join(", ", similar) + "?";
    }

    public void addType(String type) {
        types.add(type);
    }

    public void addRelationship(String relationship) {
        relationships.add(relationship);
    }

    public void addConstraint(String constraint) {
        constraints.add(constraint);
    }

    public void addSynonym(String originalTerm, String synonym) {
.put(originalTerm, synonym);
    }

    public Set<String> getTypes() {
        return types;
    }

    public Set<String> getRelationships() {
        return relationships;
    }

    public Set<String> getConstraints() {
        return constraints;
    }

    public Map<String, String> getSynonyms() {
        return synonyms;
    }
}
