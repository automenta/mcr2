const { createOntologyHint } = require('./translationUtils');

async function directToProlog(naturalLanguageText, llmClient, model, ontologyTerms = [], feedback = null, returnFullResponse = false) {
  try {
    // REMOVED: if (!llmClient) return ''; as this is handled by translateWithRetry or agenticReasoning
    
    const ontologyHint = createOntologyHint(ontologyTerms);
    const feedbackHint = feedback ? `\n\nFeedback from previous attempt: ${feedback}\n\n` : '';

    const prompt = `Translate to Prolog fact, rule or query. Only output valid Prolog.
Do NOT include any extra text, comments, or explanations, just the Prolog.
A fact or rule must end with a single dot. A query must NOT end with a dot.
${ontologyHint}${feedbackHint}
Examples:
1. "All birds fly" -> "flies(X) :- bird(X)."
2. "Socrates is mortal" -> "mortal(socrates)."
3. "Does tweety fly?" -> "flies(tweety)"
4. "Is Tweety a bird?" -> "bird(tweety)"
5. "What is the color of the car?" -> "has_color(car, Color)"

Input: ${naturalLanguageText}
Output:`;
    
    const response = await llmClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      max_tokens: 200
    });
    
    // NEW: Return full response object if requested for metrics tracking
    return returnFullResponse ? response : response.choices[0].message.content.trim();
  } catch (error) {
    // Add raw output to error for better feedback in mcr.js translateWithRetry
    if (error.response && error.response.choices && error.response.choices[0] && error.response.choices[0].message) {
      error.rawOutput = error.response.choices[0].message.content.trim();
    }
    throw error; // Re-throw the error, translateWithRetry will handle retries/fallbacks
  }
}

module.exports = directToProlog;
