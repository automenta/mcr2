const { createOntologyHint, convertJsonToProlog } = require('./translationUtils');

async function jsonToProlog(naturalLanguageText, llmClient, model = 'gpt-3.5-turbo', ontologyTerms = []) {
  if (!llmClient) return '';
  
  try {
    const ontologyHint = createOntologyHint(ontologyTerms);
    const prompt = `Translate the following into JSON representation, then convert to Prolog.${ontologyHint}
Output ONLY valid JSON with: 
- "type" ("fact"/"rule"/"query")
- "head" with "predicate" and "args" array
- "body" array (for rules only) with elements having "predicate" and "args"

Examples:
{"type":"fact","head":{"predicate":"bird","args":["tweety"]}}
{"type":"rule","head":{"predicate":"has_wings","args":["X"]},"body":[{"predicate":"bird","args":["X"]}]}

Input: ${naturalLanguageText}
Output:`;
    
    const response = await llmClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      response_format: { type: "json_object" }
    });
    
    const jsonOutput = JSON.parse(response.choices[0].message.content.trim());
    return convertJsonToProlog(jsonOutput);
  } catch (error) {
    throw error;
  }
}

module.exports = jsonToProlog;
