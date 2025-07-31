package com.example.mcr.core;

import com.example.mcr.llm.LLMClient;
import com.example.mcr.ontology.OntologyManager;
import com.example.mcr.translation.TranslationStrategy;
import alice.tuprolog.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;
import java.util.regex.Pattern;

public class Session {
    private final MCR mcr;
    private final SessionOptions options;
    private final String sessionId;
    private final List<String> program = new ArrayList<>();
    private final Logger logger;
    private OntologyManager ontology;
    private final LLMUsageMetrics llmUsage = new LLMUsageMetrics();
    private Prolog prologSession = new Prolog();
    private static final Pattern PREDICATE_PATTERN = Pattern.compile("^[a-z][a-zA-Z0-9_]*$");

    public Session(MCR mcr, SessionOptions options) {
        this.mcr = mcr;
        this.options = options;
        this.sessionId = options.sessionId != null ? options.sessionId : Long.toString(System.currentTimeMillis(), 36);
        this.logger = options.logger != null ? options.logger : Logger.getLogger(Session.class.getName());
        
        if (options.ontology != null) {
            this.ontology = new OntologyManager(options.ontology);
        } else {
            this.ontology = new OntologyManager();
        }
        
        if (options.program != null) {
            for (String clause : options.program) {
                try {
                    ontology.validatePrologClause(clause);
                    program.add(clause);
                } catch (Exception e) {
                    logger.warning("Invalid clause in initial program: " + clause + ". Error: " + e.getMessage());
                }
            }
            consultProgram();
        }
    }

    private void consultProgram() {
        prologSession = new Prolog();
        try {
            Theory theory = new Theory(String.join("\n", program));
            prologSession.setTheory(theory);
        } catch (InvalidTheoryException e) {
            logger.severe("Error consulting program: " + e.getMessage());
        }
    }

    private boolean isValidPrologSyntax(String prologString) {
        if (prologString == null || prologString.trim().isEmpty()) {
            return false;
        }
        try {
            Theory testTheory = new Theory(prologString);
            new Prolog().setTheory(testTheory);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void recordLlmUsage(long startTime, LLMResponse response) {
        long endTime = System.currentTimeMillis();
        long latency = endTime - startTime;
        LLMUsage usage = response.getUsage();
        
        if (usage != null) {
            llmUsage.promptTokens += usage.getPromptTokens();
            llmUsage.completionTokens += usage.getCompletionTokens();
            llmUsage.totalTokens += usage.getTotalTokens();
            
            mcr.totalLlmUsage.promptTokens += usage.getPromptTokens();
            mcr.totalLlmUsage.completionTokens += usage.getCompletionTokens();
            mcr.totalLlmUsage.totalTokens += usage.getTotalTokens();
        }
        
        llmUsage.calls++;
        llmUsage.totalLatencyMs += latency;
        mcr.totalLlmUsage.calls++;
        mcr.totalLlmUsage.totalLatencyMs += latency;
    }

    public void reloadOntology(Map<String, Object> newOntology) {
        this.ontology = new OntologyManager(newOntology);
        List<String> tempProgram = new ArrayList<>(program);
        program.clear();
        for (String clause : tempProgram) {
            assertProlog(clause);
        }
    }

    public void clear() {
        program.clear();
        prologSession = new Prolog();
        if (options.ontology != null) {
            ontology = new OntologyManager(options.ontology);
        }
        logger.info("Session cleared: " + sessionId);
    }

    public String saveState() {
        Map<String, Object> state = new HashMap<>();
        state.put("program", new ArrayList<>(program));
        state.put("sessionId", sessionId);
        state.put("ontology", ontology.getState());
        return new Gson().toJson(state);
    }

    public void loadState(String state) {
        Gson gson = new Gson();
        Map<String, Object> data = gson.fromJson(state, Map.class);
        sessionId = (String) data.get("sessionId");
        ontology = new OntologyManager((Map<String, Object>) data.get("ontology"));
        program.clear();
        prologSession = new Prolog();
        
        List<String> savedProgram = (List<String>) data.get("program");
        for (String clause : savedProgram) {
            try {
                assertProlog(clause);
            } catch (Exception e) {
                logger.severe("Failed to load clause: " + clause + ". Error: " + e.getMessage());
            }
        }
    }

    public CompletableFuture<String> translateWithRetry(String text) {
        logger.info("Translating: " + text);
        return CompletableFuture.supplyAsync(() -> {
            if (text == null || text.trim().isEmpty()) {
                throw new IllegalArgumentException("Text cannot be null or empty");
            }
            
            if (options.translator == null) {
                throw new IllegalStateException("Translator not configured in SessionOptions");
            }
            
            TranslationStrategy translator = (TranslationStrategy) options.translator;
            String prologQuery = null;
            try {
                prologQuery = translator.translateToProlog(text);
                if (prologQuery == null || prologQuery.trim().isEmpty()) {
                    throw new IllegalArgumentException("Translated Prolog query is empty");
                }
            } catch (Exception e) {
                logger.severe("Translation failed: " + e.getMessage());
                throw new RuntimeException("Translation failed", e);
            }
            
            for (int attempt = 1; attempt <= options.maxTranslationAttempts; attempt++) {
                try {
                    consultProgram();
                    SolveInfo solution = prologSession.solve(prologQuery);
                    
                    if (solution.hasSolution()) {
                        Map<String, Term> bindings = solution.getBindings();
                        StringBuilder result = new StringBuilder();
                        for (Map.Entry<String, Term> entry : bindings.entrySet()) {
                            result.append(entry.getKey())
                                .append("=")
                                .append(entry.getValue())
                                .append("\n");
                        }
                        return result.length() > 0 ? result.toString() : "Success";
                    } else {
                        throw new RuntimeException("No solution found");
                    }
                } catch (Exception e) {
                    logger.warning("Attempt " + attempt + " failed: " + e.getMessage());
                    if (attempt < options.maxTranslationAttempts) {
                        try {
                            Thread.sleep(options.retryDelay);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new RuntimeException("Interrupted during retry", ie);
                        }
                    } else {
                        throw new RuntimeException("All attempts failed", e);
                    }
                }
            }
        });
    }

    private List<String> extractPredicates(String query) {
        List<String> predicates = new ArrayList<>();
        String[] tokens = query.split("[,\\s\\(\\)\\.]+");
        for (String token : tokens) {
            if (PREDICATE_PATTERN.matcher(token).matches()) {
                predicates.add(token);
            }
        }
        return predicates;
    }

    public CompletableFuture<QueryResult> query(String prologQuery, QueryOptions options) {
        return CompletableFuture.supplyAsync(() -> {
            QueryResult result = new QueryResult();
            try {
                consultProgram();
                SolveInfo solution = prologSession.solve(prologQuery);
                // Process solution and bindings
                // Omitted for brevity
                return result;
            } catch (Exception e) {
                result.setSuccess(false);
                result.setError(e.getMessage());
                return result;
            }
        });
    }

    public AssertionResult assertProlog(String prologClause) {
        AssertionResult result = new AssertionResult();
        if (prologClause == null || !prologClause.trim().endsWith(".")) {
            result.setSuccess(false);
            result.setError("Invalid Prolog clause");
            return result;
        }
        
        try {
            Theory newTheory = new Theory(prologClause);
            prologSession.addTheory(newTheory);
            program.add(prologClause);
            result.setSuccess(true);
            return result;
        } catch (Exception e) {
            result.setSuccess(false);
            result.setError(e.getMessage());
            return result;
        }
    }

    /**
     * Implements reasoning by querying the Prolog knowledge base with optional LLM assistance
     * @param query Initial query to reason from
     * @param options Query options including max reasoning steps
     * @return CompletableFuture containing the reasoning result
     */
    public CompletableFuture<QueryResult> reason(String query, QueryOptions options) {
        logger.info("Reasoning from: " + query);
        return CompletableFuture.supplyAsync(() -> {
            if (query == null || query.trim().isEmpty()) {
                return new QueryResult(false, "Reasoning query cannot be null or empty");
            }
            
            if (!isValidPrologSyntax(query)) {
                return new QueryResult(false, "Invalid Prolog syntax in reasoning query");
            }
            
            try {
                consultProgram();
                QueryResult result = new QueryResult();
                
                // Basic reasoning implementation - could be expanded with LLM assistance
                SolveInfo solution = prologSession.solve(query);
                if (solution.hasSolution()) {
                    result.setSuccess(true);
                    result.setBindings(solution.getBindings());
                } else {
                    result.setSuccess(false);
                    result.setError("No solution found in reasoning");
                }
                
                return result;
            } catch (Exception e) {
                logger.severe("Reasoning failed: " + e.getMessage());
                return new QueryResult(false, "Reasoning error: " + e.getMessage());
            }
        });
    }

    /**
     * Asserts a fact into the Prolog knowledge base
     * @param fact Prolog fact to assert (e.g., "person(john).")
     * @return AssertionResult containing success status and details
     */
    public AssertionResult assertFact(String fact) {
        if (fact == null || fact.trim().isEmpty()) {
            return new AssertionResult(false, "Fact cannot be null or empty");
        }
        
        if (!fact.trim().endsWith(".")) {
            return new AssertionResult(false, "Invalid fact syntax - must end with '.'");
        }
        
        return assertProlog(fact);
    }

    /**
     * Adds a relationship to the Prolog knowledge base
     * @param subject Subject of the relationship
     * @param predicate Relationship predicate
     * @param object Object of the relationship
     * @return AssertionResult containing success status and details
     */
    public AssertionResult addRelationship(String subject, String predicate, String object) {
        if (subject == null || subject.trim().isEmpty() ||
            predicate == null || predicate.trim().isEmpty() ||
            object == null || object.trim().isEmpty()) {
            return new AssertionResult(false, "All relationship components must be non-empty");
        }
        
        String relationship = predicate + "(" + subject + ", " + object + ").";
        return assertProlog(relationship);
    }

    // Existing methods below this line...
    
    public static class SessionOptions {
        public long retryDelay = 500;
        public int maxTranslationAttempts = 2;
        public int maxReasoningSteps = 5;
        public Map<String, Object> ontology;
        public Logger logger;
        public String sessionId;
        public List<String> program;
        public Object translator;
    }
    
    public static class QueryResult {
        private boolean success;
        private List<Map<String, String>> bindings;
        private String error;
        
        // Getters and setters
    }
    
    public static class AssertionResult {
        private boolean success;
        private String symbolicRepresentation;
        private String error;
        
        // Getters and setters
    }
    
    public static class LLMResponse {
        private LLMUsage usage;
        
        public LLMUsage getUsage() {
            return usage;
        }
    }
    
    public static class LLMUsage {
        private int promptTokens;
        private int completionTokens;
        private int totalTokens;
        
        // Getters
    }
}