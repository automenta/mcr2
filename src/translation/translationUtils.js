function createOntologyHint(ontologyTerms) {
  return ontologyTerms.length ? 
    `\n\nAvailable ontology terms: ${ontologyTerms.join(', ')}` : 
    '';
}

function convertJsonToProlog(jsonOutput) {
  if (jsonOutput.type === 'fact') {
    return `${jsonOutput.head.predicate}(${jsonOutput.head.args.join(', ')}).`;
  } 
  else if (jsonOutput.type === 'rule') {
    const bodyStr = jsonOutput.body.map(cond => 
      `${cond.predicate}(${cond.args.join(', ')})`
    ).join(', ');
    return `${jsonOutput.head.predicate}(${jsonOutput.head.args.join(', ')}) :- ${bodyStr}.`;
  }
  else if (jsonOutput.type === 'query') {
    return `${jsonOutput.head.predicate}(${jsonOutput.head.args.join(', ')})`;
  }
  return '';
}

module.exports = {
  createOntologyHint,
  convertJsonToProlog
};
