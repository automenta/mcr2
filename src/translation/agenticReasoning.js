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
async function agenticReasoning(taskDescription, llmClient, model, sessionProgram, ontologyTerms, previousSteps, accumulatedBindings) {
  if (!llmClient) throw new Error('LLM client not configured for agentic reasoning.');

  const ontologyHint = createOntologyHint(ontologyTerms);
  const programHint = sessionProgram.length > 0 ? `\n\nCurrent Knowledge Base:\n${sessionProgram.join('\n')}` : '';
  const previousStepsHint = previousSteps.length > 0 ? `\n\nPrevious Reasoning Steps:\n${previousSteps.join('\n')}` : '';
  const bindingsHint = accumulatedBindings ? `\n\nAccumulated Bindings: ${accumulatedBindings}` : '';

  const prompt = `You are an expert Prolog reasoner and agent. Your goal is to break down a complex task into discrete Prolog queries or assertions, or to reach a conclusion.
Your output must be a JSON object with a "type" field ("query", "assert", or "conclude") and a "content" field (Prolog clause for query/assert, or natural language answer for conclude).

${programHint}${previousStepsHint}${bindingsHint}${ontologyHint}

Original Task: "${taskDescription}"

Examples:
- To query: {"type": "query", "content": "can_fly(X)."}
- To assert: {"type": "assert", "content": "bird(tweety)."}
- To conclude: {"type": "conclude", "answer": "Yes, Tweety can fly.", "explanation": "Because all canaries are birds and Tweety is a canary."}

If you have sufficient information to answer the original task, or if a query results in 'true' or 'false' which directly answers the task, use "conclude". Provide a clear, concise natural language answer and a brief explanation in the "conclude" type.

What is the next logical step to address the original task?
Output:`;

  const response = await llmClient.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.0,
    response_format: { type: "json_object" }
  });

  const jsonOutput = JSON.parse(response.choices[0].message.content.trim());

  if (!['query', 'assert', 'conclude'].includes(jsonOutput.type)) {
    throw new Error(`Agentic reasoning strategy returned invalid action type: ${jsonOutput.type}. Content: ${jsonOutput.content}`);
  }

  return jsonOutput;
}

module.exports = agenticReasoning;
