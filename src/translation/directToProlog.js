const { createOntologyHint } = require('./translationUtils');

async function directToProlog(naturalLanguageText, llmClient, model, ontologyTerms = []) {
  try {
    if (!llmClient) return '';
    
    const ontologyHint = createOntologyHint(ontologyTerms);
    const prompt = `Translate to Prolog fact, rule or query. Only output valid Prolog.${ontologyHint}\n\nExamples:\n1. "All birds fly" → "flies(X) :- bird(X)."\n2. "Socrates is mortal" → "mortal(socrates)."\n3. "Does tweety fly?" → "flies(tweety)."\n\nInput: ${naturalLanguageText}\nOutput:`;
    
    const response = await llmClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      max_tokens: 200
    });
    
    return response.choices[0].message.content.trim().replace(/\.$/, '') + '.';
  } catch (error) {
    throw error; // Re-throw the error, translateWithRetry will handle retries/fallbacks
  }
}

module.exports = directToProlog;
