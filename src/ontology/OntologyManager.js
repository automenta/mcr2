class OntologyManager {
  constructor(ontology = {}) {
    this.types = new Set(ontology.types || []);
    this.relationships = new Set(ontology.relationships || []);
    this.constraints = new Set(ontology.constraints || []);
    this.rules = ontology.rules || [];
    this.synonyms = ontology.synonyms || {};
  }

  resolveSynonym(term) {
    return this.synonyms[term] || term;
  }

  isValidPredicate(predicate) {
    return /^[a-z][a-zA-Z0-9_]*$/.test(predicate);
  }

  isDefined(predicate) {
    // Check if the predicate is directly defined or can be resolved via synonym
    const resolvedPredicate = this.resolveSynonym(predicate);
    return this.types.has(resolvedPredicate) || this.relationships.has(resolvedPredicate);
  }

  validateFact(predicate, args = []) {
    predicate = this.resolveSynonym(predicate);
    
    if (!this.isValidPredicate(predicate)) {
      throw new Error(`Invalid predicate: ${predicate}. Must follow Prolog naming conventions`);
    }
    
    if (this.types.has(predicate)) {
      if (args.length !== 1) {
        throw new Error(`${predicate} expects 1 argument, got ${args.length}`);
      }
    } else if (this.relationships.has(predicate)) {
      // Relationships typically expect 2 arguments (subject, object) but allow more for flexibility
      if (args.length < 2) {
        throw new Error(`${predicate} expects at least 2 arguments, got ${args.length}`);
      }
    }
    
    if (!this.isDefined(predicate)) {
      const suggestions = this.getSuggestions(predicate);
      throw new Error(`Predicate '${predicate}' not in ontology. ${suggestions}`);
    }
  }
  
  validatePrologClause(prologClause) {
    const parts = prologClause.split(':-');
    const head = parts[0].trim();
    const body = parts.length > 1 ? parts[1].replace(/\.\s*$/, '').trim() : null;

    const headMatch = head.match(/^([a-z][a-zA-Z0-9_]+)(?:\(([^)]+)\))?$/);
    if (!headMatch) {
      throw new Error(`Invalid Prolog head format: ${head}`);
    }

    const headPredicate = headMatch[1];
    const headArgs = headMatch[2] ? headMatch[2].split(',').map(a => a.trim()) : [];

    this.validateFact(headPredicate, headArgs);

    if (body) {
      if (body.trim() === '') {
        throw new Error('Rule body cannot be empty.');
      }
      const bodyPredicates = body.split(',');
      bodyPredicates.forEach(p => {
        const trimmedPredicate = p.trim();
        const predMatch = trimmedPredicate.match(/^([a-z][a-zA-Z0-9_]+)(?:\(([^)]+)\))?$/);
        if (!predMatch) {
          throw new Error(`Invalid Prolog body predicate format: ${trimmedPredicate}`);
        }
        const predName = predMatch[1];
        if (!this.isDefined(predName)) {
          const suggestions = this.getSuggestions(predName);
          throw new Error(`Rule body predicate '${predName}' not defined in ontology. ${suggestions}`);
        }
      });
    }
  }

  getSuggestions(predicate) {
    const allTerms = [...this.types, ...this.relationships, ...Object.keys(this.synonyms)]; // Include synonyms for suggestions
    const similar = allTerms.filter(term => 
      term.startsWith(predicate.substring(0, 3)) || 
      term.includes(predicate)
    );
    return similar.length ? `Did you mean: ${similar.join(', ')}?` : 'No similar terms found';
  }
  
  addRule(rule) {
    // This method is for structured rule objects, not raw prolog clauses
    // Rule validation logic should be consistent with validatePrologClause
    this.validateRuleHead(rule.head);
    rule.body.forEach(pred => this.validateRulePredicate(pred));
    this.rules.push(rule);
  }

  validateRuleHead(head) {
    head = this.resolveSynonym(head);
    // For a rule head, we just need to know if the predicate is defined
    if (!this.isDefined(head)) { // Use isDefined instead of checking types/relationships directly
      const suggestions = this.getSuggestions(head);
      throw new Error(`Rule head '${head}' not defined in ontology. ${suggestions}`);
    }
  }

  validateRulePredicate(predicate) {
    predicate = this.resolveSynonym(predicate);
    if (!this.isDefined(predicate)) { // Use isDefined
      const suggestions = this.getSuggestions(predicate);
      throw new Error(`Rule predicate '${predicate}' not defined in ontology. ${suggestions}`);
    }
  }

  validateConstraint(constraint) {
    constraint = this.resolveSynonym(constraint);
    if (!this.constraints.has(constraint)) {
      throw new Error(`Constraint '${constraint}' is not defined in ontology`);
    }
  }

  addType(type) {
    this.types.add(type);
  }

  addRelationship(relationship) {
    this.relationships.add(relationship);
  }

  addConstraint(constraint) {
    this.constraints.add(constraint);
  }

  addSynonym(originalTerm, synonym) {
    this.synonyms[originalTerm] = synonym;
  }
}

module.exports = OntologyManager;
