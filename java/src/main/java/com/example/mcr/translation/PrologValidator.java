package com.example.mcr.translation;

import java.util.List;

public class PrologValidator {

    /**
     * Validates a Prolog fact or rule syntax.
     * @param prologClause Prolog clause to validate
     * @return True if valid, false otherwise
     */
    public boolean isValidPrologClause(String prologClause) {
        if (prologClause == null || prologClause.isEmpty()) {
            return false;
        }
        
        // Basic structure check: predicate(args).
        if (!prologClause.endsWith(".")) {
            return false;
        }
        
        String body = prologClause.substring(0, prologClause.length() - 1).trim();
        
        // Check for predicate structure
        int predicateEnd = body.indexOf('(');
        if (predicateEnd == -1) return false;
        
        String predicate = body.substring(0, predicateEnd).trim();
        String argsPart = body.substring(predicateEnd + 1);
        
        // Check arguments structure
        if (argsPart.isEmpty()) return false;
        
        // Simple check for comma-separated arguments without nested structures
        for (char c : argsPart.toCharArray()) {
            if (!Character.isLetterOrDigit(c) && c != ',' && c != ' ') {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Validates a Prolog rule structure.
     * @param head Prolog head clause
     * @param body List of Prolog body clauses
     * @return True if valid, false otherwise
     */
    public boolean isValidPrologRule(String head, List<String> body) {
        if (head == null || body == null || body.isEmpty()) {
            return false;
        }
        
        if (!head.endsWith(".")) {
            return false;
        }
        
        for (String clause : body) {
            if (!isValidPrologClause(clause)) {
                return false;
            }
        }
        
        return true;
    }
}