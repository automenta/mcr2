package com.mcr;

import com.google.gson.Gson;
import com.mcr.llm.LlmClientFactory;
import com.mcr.ontology.OntologyManager;
import com.mcr.translation.AgenticReasoning;
import com.mcr.translation.DirectToProlog;
import com.mcr.translation.JsonToProlog;
import com.mcr.translation.TranslationStrategy;
import dev.langchain4j.model.chat.ChatLanguageModel;
import it.unibo.tuprolog.core.Struct;
import it.unibo.tuprolog.core.Term;
import it.unibo.tuprolog.solve.Solution;
import it.unibo.tuprolog.solve.Solver;
import it.unibo.tuprolog.solve.classic.ClassicSolverFactory;
import org.jetbrains.annotations.NotNull;

import java.util.*;
import java.util.stream.Collectors;

public class MCR {

    private final Map<String, Object> config;
    private final ChatLanguageModel llmClient;
    private final String llmModel;
    private final Map<String, Long> totalLlmUsage;
    private final Map<String, TranslationStrategy> strategyRegistry;

    public MCR(Map<String, Object> config) {
        this.config = config;
        Map<String, Object> llmConfig = (Map<String, Object>) config.getOrDefault("llm", new HashMap<>());
        this.llmClient = llmConfig.containsKey("client") ? (ChatLanguageModel) llmConfig.get("client") : LlmClientFactory.getLlmClient(llmConfig);
        this.llmModel = (String) llmConfig.getOrDefault("model", "gpt-3.5-turbo");
        this.totalLlmUsage = new HashMap<>();
        this.totalLlmUsage.put("promptTokens", 0L);
        this.totalLlmUsage.put("completionTokens", 0L);
        this.totalLlmUsage.put("totalTokens", 0L);
        this.totalLlmUsage.put("calls", 0L);
        this.totalLlmUsage.put("totalLatencyMs", 0L);

        this.strategyRegistry = new HashMap<>();
        this.strategyRegistry.put("direct", new DirectToProlog());
        this.strategyRegistry.put("json", new JsonToProlog());
        this.strategyRegistry.put("agentic", new AgenticReasoning());
        if (config.containsKey("strategyRegistry")) {
            this.strategyRegistry.putAll((Map<String, TranslationStrategy>) config.get("strategyRegistry"));
        }
    }

    public Session createSession(Map<String, Object> options) {
        return new Session(this, options);
    }

    public void registerStrategy(String name, TranslationStrategy strategy) {
        if (strategy == null) {
            throw new IllegalArgumentException("Strategy must not be null");
        }
        this.strategyRegistry.put(name, strategy);
    }

    public Map<String, Long> getLlmMetrics() {
        return new HashMap<>(this.totalLlmUsage);
    }

    public static class Session {
        private final MCR mcr;
        private final Map<String, Object> options;
        private String sessionId;
        private List<String> program;
        private OntologyManager ontology;
        private Map<String, Long> llmUsage;
        private Solver prologSession;
        private final int maxAttempts;
        private final int retryDelay;

        public Session(MCR mcr, Map<String, Object> options) {
            this.mcr = mcr;
            this.options = new HashMap<>(options);
            this.options.putIfAbsent("retryDelay", 500);
            this.options.putIfAbsent("maxTranslationAttempts", 2);
            this.options.putIfAbsent("maxReasoningSteps", 5);

            this.sessionId = (String) this.options.getOrDefault("sessionId", String.valueOf(System.currentTimeMillis()));
            this.program = new ArrayList<>();
            this.ontology = new OntologyManager((Map<String, Object>) this.options.getOrDefault("ontology", new HashMap<>()));
            this.llmUsage = new HashMap<>();
            this.llmUsage.put("promptTokens", 0L);
            this.llmUsage.put("completionTokens", 0L);
            this.llmUsage.put("totalTokens", 0L);
            this.llmUsage.put("calls", 0L);
            this.llmUsage.put("totalLatencyMs", 0L);

            this.prologSession = ClassicSolverFactory.INSTANCE.solverOf();

            if (this.options.containsKey("program") && this.options.get("program") instanceof List) {
                for (String clause : (List<String>) this.options.get("program")) {
                    try {
                        this.ontology.validatePrologClause(clause);
                        this.program.add(clause);
                    } catch (Exception e) {
                        System.err.println("Invalid clause in initial program (skipped): " + clause + ". Error: " + e.getMessage());
                    }
                }
                consultProgram();
            }

            if (this.options.containsKey("translator") && !(this.options.get("translator") instanceof TranslationStrategy) && !(this.options.get("translator") instanceof String)) {
                throw new IllegalArgumentException("Translator option must be a TranslationStrategy or a string (strategy name).");
            }
            if (this.options.get("translator") instanceof String && !this.mcr.strategyRegistry.containsKey(this.options.get("translator"))) {
                throw new IllegalArgumentException("Unknown translation strategy: " + this.options.get("translator"));
            }

            this.maxAttempts = (int) this.options.get("maxTranslationAttempts");
            this.retryDelay = (int) this.options.get("retryDelay");
        }

        private void consultProgram() {
            this.prologSession = ClassicSolverFactory.INSTANCE.solverOf(Struct.parse(String.join("\n", this.program), prologSession.getOperators()));
        }

        private boolean isValidPrologSyntax(String prologString) {
            if (prologString == null || prologString.trim().isEmpty()) {
                return false;
            }
            try {
                ClassicSolverFactory.INSTANCE.solverOf(Struct.parse(prologString.trim(), prologSession.getOperators()));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        public Map<String, Object> assertProlog(String prologClause) {
            Map<String, Object> result = new HashMap<>();
            if (prologClause == null || !prologClause.trim().endsWith(".")) {
                result.put("success", false);
                result.put("symbolicRepresentation", prologClause);
                result.put("error", "Invalid Prolog clause. Must be a string ending with a dot.");
                return result;
            }
            String normalizedClause = prologClause.trim();

            try {
                this.ontology.validatePrologClause(normalizedClause);
                this.program.add(normalizedClause);
                consultProgram();
                result.put("success", true);
                result.put("symbolicRepresentation", normalizedClause);
            } catch (Exception error) {
                System.err.println("Prolog assertion error: " + error);
                result.put("success", false);
                result.put("symbolicRepresentation", normalizedClause);
                result.put("error", error.getMessage());
            }
            return result;
        }

        public String getKnowledgeGraph(String format) {
            if ("json".equals(format)) {
                Map<String, Object> kg = new HashMap<>();
                kg.put("facts", this.program.stream().filter(c -> !c.contains(":-")).collect(Collectors.toList()));
                kg.put("rules", this.program.stream().filter(c -> c.contains(":-")).collect(Collectors.toList()));
                kg.put("entities", new ArrayList<>(this.ontology.getTypes()));
                kg.put("relationships", new ArrayList<>(this.ontology.getRelationships()));
                kg.put("constraints", new ArrayList<>(this.ontology.getConstraints()));
                return new Gson().toJson(kg);
            }
            return String.join("\n", this.program);
        }

        public Map<String, Object> query(String prologQuery, Map<String, Object> options) {
            Map<String, Object> result = new HashMap<>();
            boolean allowSubSymbolicFallback = (boolean) options.getOrDefault("allowSubSymbolicFallback", false);

            try {
                consultProgram();
                // Ontology validation would go here

                List<String> bindings = new ArrayList<>();
                List<String> proofSteps = new ArrayList<>();

                for (Solution solution : prologSession.solve(Struct.parse(prologQuery, prologSession.getOperators()))) {
                    if (solution.isYes()) {
                        bindings.add(solution.getSubstitution().toString());
                        proofSteps.add("Derived: " + solution.getSubstitution().toString());
                    }
                }

                boolean success = !bindings.isEmpty();
                result.put("success", success);
                result.put("bindings", success ? bindings : null);
                result.put("explanation", proofSteps.isEmpty() ? (success ? Collections.singletonList("Directly proven from knowledge graph.") : Collections.singletonList("No direct proof found in knowledge graph.")) : proofSteps);
                result.put("confidence", success ? 1.0 : 0.0);

                if (!success && allowSubSymbolicFallback && mcr.llmClient != null) {
                    // LLM fallback logic would go here
                }

            } catch (Exception e) {
                System.err.println("Query error: " + e);
                result.put("success", false);
                result.put("bindings", null);
                result.put("explanation", Collections.singletonList("Error: " + e.getMessage()));
                result.put("confidence", 0.0);
            }
            return result;
        }

        public Map<String, Object> nquery(String naturalLanguageQuery, Map<String, Object> options) {
            Map<String, Object> result = new HashMap<>();
            String prologQuery = null;
            try {
                prologQuery = translateWithRetry(naturalLanguageQuery);
                if (prologQuery == null || prologQuery.trim().endsWith(".")) {
                    result.put("success", false);
                    result.put("prologQuery", prologQuery);
                    result.put("bindings", null);
                    result.put("explanation", Collections.singletonList("Translation resulted in a fact/rule or invalid clause for query."));
                    result.put("confidence", 0.0);
                    return result;
                }
                result = query(prologQuery, options);
                result.put("prologQuery", prologQuery);
            } catch (Exception e) {
                System.err.println("Natural query error: " + e);
                result.put("success", false);
                result.put("prologQuery", prologQuery);
                result.put("bindings", null);
                result.put("explanation", Collections.singletonList("Translation failed: " + e.getMessage()));
                result.put("confidence", 0.0);
            }
            return result;
        }

        public Map<String, Object> assertStatement(String naturalLanguageText) {
            Map<String, Object> result = new HashMap<>();
            try {
                String prologClause = translateWithRetry(naturalLanguageText);
                if (prologClause == null || !prologClause.trim().endsWith(".")) {
                    result.put("success", false);
                    result.put("symbolicRepresentation", prologClause);
                    result.put("originalText", naturalLanguageText);
                    result.put("error", "Translation resulted in a query or invalid clause for assertion.");
                    return result;
                }
                return assertProlog(prologClause);
            } catch (Exception e) {
                System.err.println("Assertion error: " + e);
                result.put("success", false);
                result.put("symbolicRepresentation", null);
                result.put("originalText", naturalLanguageText);
                result.put("error", e.getMessage());
                return result;
            }
        }

        private String translateWithRetry(String text) throws Exception {
            // This is a simplified version. A full implementation would handle retries and strategy fallback.
            TranslationStrategy translator = mcr.strategyRegistry.get("direct");
            List<String> ontologyTerms = new ArrayList<>();
            ontologyTerms.addAll(ontology.getTypes());
            ontologyTerms.addAll(ontology.getRelationships());
            return translator.translate(text, mcr.llmClient, mcr.llmModel, ontologyTerms, null);
        }
    }
}
