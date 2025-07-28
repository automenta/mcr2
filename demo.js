require('dotenv').config(); // Load environment variables from .env file
const { MCR } = require('./src/mcr'); // Import the MCR class
const { OpenAI } = require('openai'); // Import OpenAI client if using it directly

async function main() {
  console.log('🚀 MCR Demo: Illustrating Core Capabilities 🚀');
  console.log('--------------------------------------------------\n');

  // --- MCR Initialization ---
  console.log('--- MCR Initialization ---');
  // Option 1: Configure MCR with API Key (Recommended for OpenAI)
  // This will internally create an OpenAI client.
  const mcr = new MCR({
    llm: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
  });
  console.log('MCR instance created with OpenAI LLM client.');

  // Option 2: Provide a pre-initialized LLM client (for any provider conforming to OpenAI\'s chat API)
  // const customLlmClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const mcr = new MCR({
  //   llm: { client: customLlmClient, model: 'gpt-4o-mini' } // Specify model if not 'gpt-3.5-turbo'
  // });
  // console.log('MCR instance created with a custom LLM client.');

  // Option 3: Use MCR without LLM capabilities (for symbolic reasoning only)
  // const mcr = new MCR({});
  // console.log('MCR instance created for symbolic reasoning only (no LLM).');
  
  const session = mcr.createSession();
  console.log(`\nNew Session created with ID: ${session.sessionId}`);

  // --- Natural Language Assertion ---
  console.log('\n--- Natural Language Assertion (assert) ---');
  // This uses an LLM to translate natural language into Prolog facts/rules.
  await session.assert('All canaries are birds.');
  await session.assert('All birds have wings.');
  await session.assert('Tweety is a canary.');
  console.log('Knowledge asserted via natural language.');
  // MODIFIED: Use new getKnowledgeGraph call
  console.log(`Current Knowledge Graph (Prolog):\n${session.getKnowledgeGraph('prolog')}`);

  // --- Prolog Query ---
  console.log('\n--- Prolog Query (query) ---');
  // Direct Prolog queries for precise symbolic reasoning.
  const prologResult = await session.query('has_wings(tweety).');
  console.log(`Query 'has_wings(tweety).':`);
  console.log(`  Prolog Answer: ${prologResult.success ? 'Yes' : 'No'}`);
  console.log(`  Confidence: ${prologResult.confidence}`);
  console.log(`  Explanation: ${prologResult.explanation.join('\n    ')}`);
  
  // --- Natural Language Query ---
  console.log('\n--- Natural Language Query (nquery) ---');
  // This uses an LLM to translate natural language questions into Prolog queries.
  // `allowSubSymbolicFallback: true` means if Prolog can't answer, LLM will try.
  const naturalResult = await session.nquery('Does tweety have wings?', { allowSubSymbolicFallback: true });
  console.log(`Natural language query 'Does tweety have wings?':`);
  console.log(`  Success: ${naturalResult.success}`);
  // NEW: Log the translated query
  console.log(`  Translated Prolog: ${naturalResult.prologQuery}`);
  console.log(`  Bindings: ${naturalResult.bindings ? naturalResult.bindings.join(', ') : 'None'}`);
  console.log(`  Explanation: ${naturalResult.explanation.join('\n    ')}`);
  console.log(`  Confidence: ${naturalResult.confidence}`);
  
  // --- Direct Prolog Management (assertProlog, retractProlog) ---
  console.log('\n--- Direct Prolog Management ---');
  // Programmatic assertion of raw Prolog clauses, with ontology validation.
  const assertPrologResult = session.assertProlog('mammal(elephant).');
  console.log(`Direct Assert 'mammal(elephant).': Success: ${assertPrologResult.success}`);
  let directQueryResult = await session.query('mammal(X).');
  console.log(`Query 'mammal(X).': Bindings: ${directQueryResult.bindings ? directQueryResult.bindings.join(', ') : 'None'}`);

  // Programmatic retraction of raw Prolog clauses.
  const retractPrologResult = session.retractProlog('mammal(elephant).');
  console.log(`Direct Retract 'mammal(elephant).': Success: ${retractPrologResult.success}`);
  directQueryResult = await session.query('mammal(X).');
  console.log(`Query 'mammal(X).': Bindings: ${directQueryResult.bindings ? directQueryResult.bindings.join(', ') : 'None'}`); // Should be None

  // --- High-Level Fact, Relationship, and Rule Management ---
  console.log('\n--- High-Level Fact/Relationship/Rule Management ---');
  // These methods abstract Prolog syntax, offering a more intuitive API.
  // First, add types to ontology for validation.
  // Note: The session was created without an initial ontology, so we add terms dynamically.
  session.addType('person');
  session.defineRelationshipType('likes');
  session.addType('food');
  session.addSynonym('human', 'person');
  console.log('Ontology terms added: person (type), likes (relationship), food (type), human (synonym for person).');

  const addFactResult = session.addFact('alice', 'person');
  console.log(`Add Fact 'alice is a person': Success: ${addFactResult.success}`);
  const addRelationshipResult = session.addRelationship('alice', 'likes', 'pizza');
  console.log(`Add Relationship 'alice likes pizza': Success: ${addRelationshipResult.success}`);
  const addRuleResult = session.addRule('eats_pizza(X) :- person(X), likes(X, pizza).');
  console.log(`Add Rule 'eats_pizza(X) :- ...': Success: ${addRuleResult.success}`);

  // MODIFIED: Use new getKnowledgeGraph call
  let kgCurrent = session.getKnowledgeGraph('prolog');
  console.log(`Current KG (excerpt):\n${kgCurrent.split('\n').filter(l => l.includes('alice') || l.includes('pizza') || l.includes('eats_pizza')).join('\n')}`);

  let queryPizza = await session.query('eats_pizza(alice).');
  console.log(`Query 'eats_pizza(alice).': Success: ${queryPizza.success}`);

  const removeRelationshipResult = session.removeRelationship('alice', 'likes', 'pizza');
  console.log(`Remove Relationship 'alice likes pizza': Success: ${removeRelationshipResult.success}`);
  queryPizza = await session.query('eats_pizza(alice).');
  console.log(`Query 'eats_pizza(alice).': Success after removal: ${queryPizza.success}`); // Should be false

  const removeFactResult = session.removeFact('alice', 'person');
  console.log(`Remove Fact 'alice is a person': Success: ${removeFactResult.success}`);

  const removeRuleResult = session.removeRule('eats_pizza(X) :- person(X), likes(X, pizza).');
  console.log(`Remove Rule 'eats_pizza(X) :- ...': Success: ${removeRuleResult.success}`);

  // --- Ontology Management (beyond initial setup) ---
  console.log('\n--- Ontology Management ---');
  session.addConstraint('unique_name');
  console.log(`Added constraint 'unique_name'. Current constraints: ${Array.from(session.ontology.constraints).join(', ')}`);
  
  // NEW: Demonstrate getOntology()
  const currentOntology = session.getOntology();
  console.log(`Current ontology retrieved via getOntology():`);
  console.log(JSON.stringify(currentOntology, null, 2));

  // --- Session State Management ---
  console.log('\n--- Session State Management ---');
  session.clear(); // Clears the current knowledge base and Prolog session
  // MODIFIED: Use new getKnowledgeGraph call
  console.log(`Session cleared. KG empty: ${session.getKnowledgeGraph('prolog') === ''}`);

  const dogAssertResult = await session.assert('The dog is happy.'); // Add a fact after clearing
  // MODIFIED: Use new getKnowledgeGraph call
  console.log(`KG after assert: ${session.getKnowledgeGraph('prolog')}`);
  
  const savedState = session.saveState(); // Save the current session state
  console.log(`Session state saved. Length: ${savedState.length} characters.`);

  const loadedSession = mcr.createSession(); // Create a new, empty session
  loadedSession.loadState(savedState); // Load the saved state into the new session
  // MODIFIED: Use new getKnowledgeGraph call
  console.log(`State loaded into new session. KG: ${loadedSession.getKnowledgeGraph('prolog')}`);

  // --- Ontology Reload and Program Revalidation ---
  console.log('\n--- Ontology Reload and Revalidation ---');
  session.addType('animal'); // Add 'animal' type to allow asserting 'animal(cat).'
  session.assertProlog('animal(cat).');
  // MODIFIED: Use new getKnowledgeGraph call
  console.log(`KG before ontology reload: ${session.getKnowledgeGraph('prolog')}`);
  
  // Reload ontology with new definitions, existing facts/rules will be revalidated
  session.reloadOntology({
    types: ['pet'], // 'animal' is removed, 'pet' is new
    relationships: [],
    constraints: [],
    synonyms: {}
  });
  // MODIFIED: Use new getKnowledgeGraph call
  console.log(`KG after ontology reload (animal(cat) should be gone due to revalidation): ${session.getKnowledgeGraph('prolog') === '' ? 'empty' : session.getKnowledgeGraph('prolog')}`); // Should be empty
  console.log(`New ontology types: ${Array.from(session.ontology.types).join(', ')}`);

  // --- Agentic Reasoning ---
  console.log('\n--- Agentic Reasoning (reason) ---');
  // The 'reason' method allows the MCR to perform multi-step reasoning.
  // It uses an internal agentic loop to decide next actions (query, assert, conclude).
  // This example assumes 'can_migrate(tweety)' has been asserted or can be deduced by the LLM (via fallback).
  session.assertProlog('can_migrate(tweety).'); // Ensure the fact exists for the agent's query
  const reasoning = await session.reason('Determine if Tweety can migrate.', { allowSubSymbolicFallback: true });
  console.log(`Reasoning Task Result:`);
  console.log(`  Answer: ${reasoning.answer}`);
  console.log(`  Steps:\n    ${reasoning.steps.join('\n    ')}`);
  console.log(`  Confidence: ${reasoning.confidence}`);

  // --- Knowledge Graph Export Formats ---
  console.log('\n--- Knowledge Graph Export Formats ---');
  // Get the knowledge graph in Prolog format (default)
  // MODIFIED: Use new getKnowledgeGraph call
  const kgProlog = session.getKnowledgeGraph('prolog');
  console.log('Knowledge Graph (Prolog format):');
  console.log(kgProlog);

  // Get the knowledge graph in JSON format
  const kgJson = session.getKnowledgeGraph('json');
  console.log('\nKnowledge Graph (JSON format):');
  console.log(JSON.stringify(kgJson, null, 2));

  // --- LLM Usage Metrics ---
  console.log('\n--- LLM Usage Metrics ---');
  // Get LLM usage metrics specific to this session
  const sessionLlmMetrics = session.getLlmMetrics();
  console.log(`Session LLM Calls: ${sessionLlmMetrics.calls}`);
  console.log(`Session LLM Prompt Tokens: ${sessionLlmMetrics.promptTokens}`);
  console.log(`Session LLM Completion Tokens: ${sessionLlmMetrics.completionTokens}`);
  console.log(`Session LLM Latency (ms): ${sessionLlmMetrics.totalLatencyMs}`);

  // Get aggregated LLM usage metrics across all sessions from the MCR instance
  const globalLlmMetrics = mcr.getLlmMetrics();
  console.log(`\nTotal LLM Calls (across all sessions): ${globalLlmMetrics.calls}`);
  console.log(`Total LLM Prompt Tokens: ${globalLlmMetrics.promptTokens}`);
  console.log(`Total LLM Completion Tokens: ${globalLlmMetrics.completionTokens}`);
  console.log(`Total LLM Latency (ms): ${globalLlmMetrics.totalLatencyMs}`);

  console.log('\n--------------------------------------------------');
  console.log('Demo Complete!');
}

main().catch(console.error);
