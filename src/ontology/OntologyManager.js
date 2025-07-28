class OntologyManager {
  constructor(ontology = {}) {
    this.types = new Set(ontology.types || []);
    this.relationships = new Set(ontology.relationships || []);
    this.constraints = new Set(ontology.constraints || []);
    this.rules = ontology.rules || [];
  }

  validateFact(predicate) {
    if (!this.types.has(predicate) && !this.relationships.has(predicate)) {
      throw new Error(`Predicate '${predicate}' is not defined in ontology`);
    }
  }

  validateRule(head, bodyPredicates = []) {
    this.validateFact(head);
    bodyPredicates.forEach(p => this.validateFact(p));
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
