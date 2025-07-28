const jsonToProlog = require('./jsonToProlog');

async function directToProlog(naturalLanguageText, llmClient, model = 'gpt-3.5-turbo', ontologyTerms = []) {
  if (!llmClient) return '';

  const ontologyHint = ontologyTerms.length ? 
    `\n\nAvailable ontology terms: ${ontologyTerms.join(', ')}` : 
    '';
    
  try {
    const prompt = `Translate to Prolog fact, rule or query. Only output valid Prolog.${ontologyHint}\n\nExamples:\n1. "All birds fly" → "flies(X) :- bird(X)."\n2. "Socrates is mortal" → "mortal(socrates)."\n3. "Does tweety fly?" → "flies(tweety)."\n\nInput: ${naturalLanguageText}\nOutput:`;
    
    const response = await llmClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      max_tokens: 200
    });
    
    return response.choices[0].message.content.trim().replace(/\.$/, '') + '.';
  } catch (error) {
    return await jsonToProlog(naturalLanguageText, llmClient, model, ontologyTerms);
  }
}

module.exports = directToProlog;
