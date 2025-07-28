class OntologyManager {
  constructor(ontology = {}) {
    this.types = new Set(ontology.types || []);
    this.relationships = new Set(ontology.relationships || []);
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

  addType(type) {
    this.types.add(type);
  }

  addRelationship(relationship) {
    this.relationships.add(relationship);
  }
}

module.exports = OntologyManager;
