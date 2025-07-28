const { createOntologyHint, convertJsonToProlog } = require('./translationUtils');

async function jsonToProlog(naturalLanguageText, llmClient, model = 'gpt-3.5-turbo', ontologyTerms = [], feedback = null, returnFullResponse = false) {
  try {
    // REMOVED: if (!llmClient) return '';
    
    const ontologyHint = createOntologyHint(ontologyTerms);
    const feedbackHint = feedback ? `\n\nFeedback from previous attempt: ${feedback}\n\n` : '';

    const prompt = `Translate the following into JSON representation, then convert to Prolog.${ontologyHint}${feedbackHint}
Output ONLY valid JSON with: 
- "type" ("fact"/"rule"/"query")
- "head" with "predicate" and "args" array
- "body" array (for rules only) with elements having "predicate" and "args"

Examples:
{"type":"fact","head":{"predicate":"bird","args":["tweety"]}}
{"type":"rule","head":{"predicate":"has_wings","args":["X"]},"body":[{"predicate":"bird","args":["X"]}]}
{"type":"query","head":{"predicate":"can_migrate","args":["tweety"]}}

Input: ${naturalLanguageText}
Output:`;
    
    const response = await llmClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      response_format: { type: "json_object" }
    });
    
    const jsonOutput = JSON.parse(response.choices[0].message.content.trim());
    const prologResult = convertJsonToProlog(jsonOutput);

    // NEW: Return full response object if requested for metrics tracking
    return returnFullResponse ? { ...response, choices: [{ ...response.choices[0], message: { content: prologResult } }] } : prologResult;
  } catch (error) {
    // Add raw output to error for better feedback in mcr.js translateWithRetry
    if (error.response && error.response.choices && error.response.choices[0] && error.response.choices[0].message) {
      error.rawOutput = error.response.choices[0].message.content.trim();
    }
    throw error;
  }
}

module.exports = jsonToProlog;
