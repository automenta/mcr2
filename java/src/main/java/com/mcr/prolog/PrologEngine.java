package com.mcr.prolog;

import com.mcr.ontology.OntologyManager;
import it.unibo.tuprolog.core.Clause;
import it.unibo.tuprolog.core.Struct;
import it.unibo.tuprolog.core.Term;
import it.unibo.tuprolog.core.Var;
import it.unibo.tuprolog.solve.Solution;
import it.unibo.tuprolog.solve.Solver;
import it.unibo.tuprolog.solve.classic.ClassicSolver;
import it.unibo.tuprolog.theory.Theory;
import it.unibo.tuprolog.unify.Unificator;

import java.util.HashMap;
import java.util.Map;

public class PrologEngine {

    private Solver solver;

    public PrologEngine() {
        this.solver = new ClassicSolver();
    }

    public void asserta(String clause) {
        solver.assertA(Clause.parse(clause, solver.getOperators()));
    }

    public void retract(String clause) {
        solver.retract(Clause.parse(clause, solver.getOperators()));
    }

    public Map<String, Object> query(String query) {
        Solution solution = solver.solveOnce(Struct.parse(query, solver.getOperators()));
        Map<String, Object> result = new HashMap<>();
        result.put("success", solution.isYes());
        if (solution.isYes()) {
            Map<String, String> bindings = new HashMap<>();
            for (Map.Entry<Var, Term> entry : solution.getSubstitution().getMap().entrySet()) {
                bindings.put(entry.getKey().getName(), entry.getValue().toString());
            }
            result.put("bindings", bindings);
        }
        return result;
    }

    public String getKnowledgeBase() {
        return solver.getTheory().toString();
    }

    public void clear() {
        solver.setTheory(Theory.Companion.getEMPTY());
    }

    public void reconsult(OntologyManager ontologyManager) {
        Theory theory = solver.getTheory();
        Theory newTheory = Theory.Companion.getEMPTY();
        for (it.unibo.tuprolog.core.Clause clause : theory.getClauses()) {
            try {
                ontologyManager.validatePrologClause(clause.toString());
                newTheory = newTheory.plus(clause);
            } catch (IllegalArgumentException e) {
                // Clause is no longer valid, so we don't add it to the new theory
            }
        }
        solver.setTheory(newTheory);
    }
}
