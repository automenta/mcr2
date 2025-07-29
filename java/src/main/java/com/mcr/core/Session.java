package com.mcr.core;

import com.google.gson.Gson;
import com.mcr.ontology.OntologyManager;
import com.mcr.prolog.PrologEngine;
import com.mcr.translation.AgenticReasoning;
import com.mcr.translation.TranslationStrategy;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

public class Session {

    private OntologyManager ontologyManager;
    private final MCR.LLMConfig llmConfig;
    private final PrologEngine prologEngine;
    private final Consumer<LlmMetrics> metricsUpdater;


    private final AtomicInteger sessionLlmCalls = new AtomicInteger(0);
    private final AtomicLong sessionLlmPromptTokens = new AtomicLong(0);
    private final AtomicLong sessionLlmCompletionTokens = new AtomicLong(0);
    private final AtomicLong sessionLlmLatencyMs = new AtomicLong(0);


    public Session(MCR.LLMConfig llmConfig, Consumer<LlmMetrics> metricsUpdater) {
        this.ontologyManager = new OntologyManager(new HashMap<>());
        this.llmConfig = llmConfig;
        this.prologEngine = new PrologEngine();
        this.metricsUpdater = metricsUpdater;
    }

    public Session(OntologyManager ontologyManager, MCR.LLMConfig llmConfig, Consumer<LlmMetrics> metricsUpdater) {
        this.ontologyManager = ontologyManager;
        this.llmConfig = llmConfig;
        this.prologEngine = new PrologEngine();
        this.metricsUpdater = metricsUpdater;
    }

    public Map<String, Object> assertStatement(String naturalLanguageText) throws Exception {
        return assertStatement(naturalLanguageText, "direct");
    }

    public Map<String, Object> assertStatement(String naturalLanguageText, String strategyName) throws Exception {
        TranslationStrategy strategy = getStrategy(strategyName);
        Map<String, Object> translationResult = strategy.translate(naturalLanguageText, llmConfig.getClient(), llmConfig.getModel(), getOntologyTerms(), null);
        String prolog = (String) translationResult.get("prolog");
        ontologyManager.validatePrologClause(prolog);
        prologEngine.asserta(prolog);
        updateLlmMetrics(1, (long) translationResult.get("promptTokens"), (long) translationResult.get("completionTokens"), (long) translationResult.get("latencyMs"));
        return translationResult;
    }

    public Map<String, Object> query(String prologQuery) {
        return prologEngine.query(prologQuery);
    }

    public Map<String, Object> nquery(String naturalLanguageQuery) throws Exception {
        return nquery(naturalLanguageQuery, "direct");
    }

    public Map<String, Object> nquery(String naturalLanguageQuery, String strategyName) throws Exception {
        TranslationStrategy strategy = getStrategy(strategyName);
        Map<String, Object> translationResult = strategy.translate(naturalLanguageQuery, llmConfig.getClient(), llmConfig.getModel(), getOntologyTerms(), null);
        String prologQuery = (String) translationResult.get("prolog");
        Map<String, Object> queryResult = prologEngine.query(prologQuery);
        queryResult.put("prologQuery", prologQuery);
        updateLlmMetrics(1, (long) translationResult.get("promptTokens"), (long) translationResult.get("completionTokens"), (long) translationResult.get("latencyMs"));
        return queryResult;
    }


    public void addType(String type) {
        ontologyManager.addType(type);
    }

    public void defineRelationshipType(String relationship) {
        ontologyManager.addRelationship(relationship);
    }

    public void addConstraint(String constraint) {
        ontologyManager.addConstraint(constraint);
    }

    public void addSynonym(String originalTerm, String synonym) {
        ontologyManager.addSynonym(originalTerm, synonym);
    }

    public Map<String, Object> addFact(String entity, String type) {
        String prolog = String.format("%s(%s).", type, entity);
        try {
            ontologyManager.validatePrologClause(prolog);
            prologEngine.asserta(prolog);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("symbolicRepresentation", prolog);
            return result;
        } catch (IllegalArgumentException e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> addRelationship(String subject, String relation, String object) {
        String prolog = String.format("%s(%s, %s).", relation, subject, object);
        try {
            ontologyManager.validatePrologClause(prolog);
            prologEngine.asserta(prolog);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("symbolicRepresentation", prolog);
            return result;
        } catch (IllegalArgumentException e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> removeFact(String entity, String type) {
        String prolog = String.format("%s(%s).", type, entity);
        prologEngine.retract(prolog);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    public Map<String, Object> removeRelationship(String subject, String relation, String object) {
        String prolog = String.format("%s(%s, %s).", relation, subject, object);
        prologEngine.retract(prolog);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        return result;
    }

    public String getKnowledgeGraph() {
        return prologEngine.getKnowledgeBase();
    }

    public OntologyManager getOntology() {
        return ontologyManager;
    }

    public void clear() {
        prologEngine.clear();
    }

    public void reloadOntology(Map<String, Object> newOntology) {
        this.ontologyManager = new OntologyManager(newOntology);
        prologEngine.reconsult(ontologyManager);
    }

    public String saveState() {
        Map<String, Object> state = new HashMap<>();
        state.put("knowledgeGraph", prologEngine.getKnowledgeBase());
        state.put("ontology", ontologyManager);
        return new Gson().toJson(state);
    }

    public void loadState(String jsonState) {
        Map<String, Object> state = new Gson().fromJson(jsonState, Map.class);
        this.ontologyManager = new Gson().fromJson(new Gson().toJson(state.get("ontology")), OntologyManager.class);
        prologEngine.setKnowledgeBase((String) state.get("knowledgeGraph"));
    }


    public Map<String, Long> getLlmMetrics() {
        Map<String, Long> metrics = new HashMap<>();
        metrics.put("calls", (long) sessionLlmCalls.get());
        metrics.put("promptTokens", sessionLlmPromptTokens.get());
        metrics.put("completionTokens", sessionLlmCompletionTokens.get());
        metrics.put("totalLatencyMs", sessionLlmLatencyMs.get());
        return metrics;
    }

    private List<String> getOntologyTerms() {
        return Arrays.asList(
                ontologyManager.getTypes().toString(),
                ontologyManager.getRelationships().toString(),
                ontologyManager.getConstraints().toString()
        );
    }

    private TranslationStrategy getStrategy(String name) {
        if ("direct".equals(name)) {
            return new com.mcr.translation.DirectToProlog();
        }
        if ("json".equals(name)) {
            return new com.mcr.translation.JsonToProlog();
        }
        throw new IllegalArgumentException("Unknown strategy: " + name);
    }

    private void updateLlmMetrics(int calls, long promptTokens, long completionTokens, long latencyMs) {
        this.sessionLlmCalls.addAndGet(calls);
        this.sessionLlmPromptTokens.addAndGet(promptTokens);
        this.sessionLlmCompletionTokens.addAndGet(completionTokens);
        this.sessionLlmLatencyMs.addAndGet(latencyMs);
        metricsUpdater.accept(new LlmMetrics(calls, promptTokens, completionTokens, latencyMs));
    }


    public String getSessionId() {
        return null;
    }

    public Map<String, Object> reason(String taskDescription, Map<String, Object> options) throws Exception {
        int maxSteps = (int) options.getOrDefault("maxSteps", 5);
        boolean allowSubSymbolicFallback = (boolean) options.getOrDefault("allowSubSymbolicFallback", false);

        AgenticReasoning agent = new AgenticReasoning();
        Map<String, Object> agentResult = new HashMap<>();
        List<String> steps = new ArrayList<>();
        String feedback = null;

        for (int i = 0; i < maxSteps; i++) {
            agentResult = agent.translate(taskDescription, llmConfig.getClient(), llmConfig.getModel(), getOntologyTerms(), feedback);
            String type = (String) agentResult.get("type");

            if ("conclude".equals(type)) {
                steps.add("Agent concludes: " + agentResult.get("answer"));
                agentResult.put("steps", steps);
                return agentResult;
            }

            if ("assert".equals(type)) {
                String prolog = (String) agentResult.get("content");
                try {
                    ontologyManager.validatePrologClause(prolog);
                    prologEngine.asserta(prolog);
                    steps.add("Agent asserts: " + prolog);
                    feedback = "Assertion successful.";
                } catch (IllegalArgumentException e) {
                    feedback = "Assertion failed: " + e.getMessage();
                }
            } else if ("query".equals(type)) {
                String prologQuery = (String) agentResult.get("content");
                Map<String, Object> queryResult = prologEngine.query(prologQuery);
                steps.add("Agent queries: " + prologQuery + " -> " + queryResult.get("success"));
                feedback = "Query result: " + queryResult.get("success") + ", Bindings: " + queryResult.get("bindings");
            }
        }

        agentResult.put("answer", "Inconclusive");
        agentResult.put("steps", steps);
        return agentResult;
    }

    public static class LlmMetrics {
        public final int calls;
        public final long promptTokens;
        public final long completionTokens;
        public final long latencyMs;

        public LlmMetrics(int calls, long promptTokens, long completionTokens, long latencyMs) {
            this.calls = calls;
            this.promptTokens = promptTokens;
            this.completionTokens = completionTokens;
            this.latencyMs = latencyMs;
        }
    }
}
