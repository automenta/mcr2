async function jsonToProlog(naturalLanguageText, llmClient) {
  if (!llmClient) return '';
  
  try {
    const prompt = `Translate the following into JSON representation, then convert to Prolog.
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
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      response_format: { type: "json_object" }
    });
    
    const jsonOutput = JSON.parse(response.choices[0].message.content.trim());
    
    // Convert JSON to Prolog
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
  } catch (error) {
    console.error('JSON translation error:', error);
    throw error;
  }
}

module.exports = jsonToProlog;
