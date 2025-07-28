class OntologyManager {
  constructor(ontology = {}) {
    this.types = new Set(ontology.types || []);
    this.relationships = new Set(ontology.relationships || []);
    this.constraints = new Set(ontology.constraints || []);
    this.rules = ontology.rules || [];
  }

  validateFact(predicate, args = []) {
    if (predicate === '' || predicate.startsWith('_') || !/^[a-z][a-zA-Z0-9_]*$/.test(predicate)) {
      throw new Error(`Invalid predicate name: ${predicate}. Must start with lowercase letter and contain only alphanumeric characters`);
    }
    
    if (!this.types.has(predicate) && !this.relationships.has(predicate)) {
      const suggestions = this.getSuggestions(predicate);
      throw new Error(`Predicate '${predicate}' not in ontology. ${suggestions}`);
    }
  }
  
  getSuggestions(predicate) {
    const allTerms = [...this.types, ...this.relationships];
    const similar = allTerms.filter(term => 
      term.startsWith(predicate.substring(0, 3)) || 
      term.includes(predicate)
    );
    return similar.length ? `Did you mean: ${similar.join(', ')}?` : 'No similar terms found';
  }
  
  addRule(rule) {
    // Validate head predicate
    this.validateRuleHead(rule.head);
    
    // Validate all body predicates
    rule.body.forEach(pred => this.validateRulePredicate(pred));
    
    this.rules.push(rule);
  }

  validateRuleHead(head) {
    if (!this.types.has(head) && !this.relationships.has(head)) {
      throw new Error(`Rule head '${head}' not defined in ontology`);
    }
  }

  validateRulePredicate(predicate) {
    if (!this.types.has(predicate) && !this.relationships.has(predicate)) {
      throw new Error(`Rule predicate '${predicate}' not defined in ontology`);
    }
  }

  validateConstraint(constraint) {
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
}

module.exports = OntologyManager;
