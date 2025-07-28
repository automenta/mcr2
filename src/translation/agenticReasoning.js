const { createOntologyHint } = require('./translationUtils');

/**
 * An LLM-based strategy for generating the next step in a multi-step reasoning task.
 * It prompts the LLM to decide whether to perform a Prolog query, an assertion, or to conclude the task,
 * returning a structured JSON response.
 *
 * @param {string} taskDescription - The original high-level task to be reasoned about.
 * @param {object} llmClient - The LLM client instance (e.g., OpenAI).
 * @param {string} model - The LLM model to use (e.g., 'gpt-4').
 * @param {string[]} sessionProgram - The current Prolog program (knowledge base) as an array of clauses.
 * @param {string[]} ontologyTerms - A list of all known ontology terms (types, relationships, synonyms).
 * @param {string[]} previousSteps - A history of natural language descriptions of previous reasoning steps.
 * @param {string} accumulatedBindings - A string representing all bindings accumulated from previous queries.
 * @returns {Promise<object>} A promise that resolves to a JSON object like `{ type: 'query', content: 'prolog_query' }`
 *                            or `{ type: 'assert', content: 'prolog_fact.' }` or `{ type: 'conclude', answer: '...' }`.
 * @throws {Error} If the LLM client is not configured or if the LLM returns an invalid action type.
 */
async function agenticReasoning(taskDescription, llmClient, model, sessionProgram, ontologyTerms, previousSteps, accumulatedBindings, maxAttempts = 2, retryDelay = 500, returnFullResponse = false) {
  // REMOVED: if (!llmClient) throw new Error('LLM client not configured for agentic reasoning.');

  const ontologyHint = createOntologyHint(ontologyTerms);
  const programHint = sessionProgram.length > 0 ? `\n\nCurrent Knowledge Base:\n${sessionProgram.join('\n')}` : '';
  const previousStepsHint = previousSteps.length > 0 ? `\n\nPrevious Reasoning Steps:\n${previousSteps.join('\n')}` : '';
  const bindingsHint = accumulatedBindings ? `\n\nAccumulated Bindings: ${accumulatedBindings}` : '';

  let lastError;
  let feedback = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const feedbackHint = feedback ? `\n\nFeedback from previous attempt: ${feedback}\n\n` : '';

    const prompt = `You are an expert Prolog reasoner and agent. Your goal is to break down a complex task into discrete, logical steps using Prolog assertions, queries, or by concluding the task.
You have access to a Prolog knowledge base and can perform actions.
${ontologyHint}${programHint}${previousStepsHint}${bindingsHint}${feedbackHint}

Your output must be a JSON object with a "type" field ("query", "assert", or "conclude") and a "content" field (Prolog clause/query string) or an "answer" field (natural language conclusion).
If type is "conclude", also include an optional "explanation" field (natural language string).
Ensure all Prolog outputs are syntactically valid and conform to the ontology if applicable.
Do not include any other text outside the JSON object.

Examples:
To assert a fact: {"type":"assert","content":"bird(tweety)."}
To assert a rule: {"type":"assert","content":"flies(X) :- bird(X)."}
To query the knowledge base: {"type":"query","content":"has_wings(tweety)."}
To conclude the task: {"type":"conclude","answer":"Yes, Tweety can fly.","explanation":"Derived from bird(tweety) and flies(X) :- bird(X)."}

Given the task: "${taskDescription}"
What is your next logical step?`;

    try {
      const response = await llmClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        response_format: { type: "json_object" }
      });
      
      const rawContent = response.choices[0].message.content.trim();
      const agentAction = JSON.parse(rawContent);

      // Basic validation of the agent's response structure
      if (!['query', 'assert', 'conclude'].includes(agentAction.type)) {
        throw new Error(`Invalid action type: ${agentAction.type}. Must be 'query', 'assert', or 'conclude'.`);
      }
      if (agentAction.type !== 'conclude' && (!agentAction.content || typeof agentAction.content !== 'string')) {
        throw new Error(`Action type '${agentAction.type}' requires a 'content' field as a string.`);
      }
      if (agentAction.type === 'conclude' && (!agentAction.answer || typeof agentAction.answer !== 'string')) {
        throw new Error(`Action type 'conclude' requires an 'answer' field as a string.`);
      }
      
      // NEW: Attach full response if requested for metrics tracking
      if (returnFullResponse) {
        agentAction.response = response;
      }
      return agentAction;

    } catch (error) {
      lastError = error;
      feedback = `The previous output was invalid. Error: ${error.message}. Please provide valid JSON with correct structure and content. Raw output was: ${error.rawOutput || 'N/A'}`;
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        feedback = `The previous output was not valid JSON. Please ensure your response is ONLY a JSON object and nothing else. Error: ${error.message}. Raw output was: ${error.rawOutput || 'N/A'}`;
      }
      
      // Attach raw output if available for better debugging in feedback
      if (error.response && error.response.choices && error.response.choices[0] && error.response.choices[0].message) {
        lastError.rawOutput = error.response.choices[0].message.content.trim();
        feedback = `The previous output was invalid. Error: ${error.message}. Raw output was: ${lastError.rawOutput}. Please correct it.`;
      }
      
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  throw lastError; // Re-throw if all attempts fail
}

module.exports = agenticReasoning;
