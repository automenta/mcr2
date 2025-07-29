package com.mcr.core;

import com.mcr.ontology.OntologyManager;
import com.mcr.prolog.PrologEngine;
import com.mcr.translation.TranslationStrategy;

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
