# 🧠 MCR: The Neurosymbolic Reasoning Core

**Model Context Reasoner (MCR)** is a library designed to be the foundation for the next generation of AI systems. It fuses the perceptual power of Large Language Models (LLMs) with the rigorous logic of symbolic reasoners, creating a hybrid system that is both intuitive and verifiable.

This is not just a tool; it is the starting point for building the ultimate neurosymbolic reasoner—an AI that can understand the world, reason about it with logical precision, and explain its conclusions.

## 🏛️ Core Principles

MCR is built on a foundation designed for limitless growth.

1.  **Symbolic Core, Neural Interface:** At its heart is a deterministic, verifiable logic engine (Prolog). LLMs act as a fluid, intuitive interface, translating the unstructured, ambiguous human world into the structured, logical core.
2.  **Explainable by Design:** Every conclusion can be traced back to the specific facts and rules that produced it. The system can always "show its work," providing a level of transparency impossible with purely neural systems.
3.  **Dynamic Knowledge Graph:** The knowledge base is not a static set of facts but a living, dynamic graph that is continuously updated and refined through interaction.
4.  **Evolvable Reasoning:** The methods for translating language to logic (**Translation Strategies**) are designed to be pluggable, comparable, and ultimately, evolvable. The system is built to learn and improve its own reasoning processes over time.

## ✨ Features (The Foundation)

*   **Library-First API**: A clean, modern `async/await` API that integrates directly into your application.
*   **Stateful Reasoning Sessions**: Create isolated reasoning contexts, each with its own independent, persistent knowledge graph.
*   **Pluggable LLMs & Strategies**: Swap LLM providers and reasoning strategies with configuration changes.
*   **Direct & Hybrid Reasoning**: Execute pure symbolic logic for speed and precision, or allow the system to fall back to the LLM for sub-symbolic queries when formal deduction yields no answer.
*   **Rich, Explainable Outputs**: Queries don't just return an answer; they return the answer *and* the logical steps used to reach it, along with confidence scores.

## 🏗️ Ontology Support

MCR now supports ontologies to constrain your knowledge graph:

```javascript
const session = mcr.createSession({
  ontology: {
    types: ['bird', 'canary'],
    relationships: ['has_wings', 'can_fly']
  }
});

// This will succeed
await session.assert('Tweety is a bird');

// This will fail - 'fish' not in ontology
await session.assert('Nemo is a fish');
```

The ontology ensures your knowledge graph maintains semantic consistency by:
- Validating all asserted facts and rules
- Preventing undefined predicates
- Maintaining type consistency

## 🚀 Quick Start

**1. Install:**

```bash
npm install model-context-reasoner
```

**2. Configure:**

Create a `.env` file with your LLM API key.

```dotenv
# .env
OPENAI_API_KEY="sk-..."
```

**3. Build a Reasoner:**

The core workflow is to create a session, populate its knowledge graph, and then ask it to reason about that knowledge.

```javascript
// main.js
require('dotenv').config();
const { MCR } = require('model-context-reasoner');
const { OpenAI } = require('openai'); // NEW: Import OpenAI client if using it directly

async function main() {
  // Option 1: Configure MCR with API Key (Recommended for OpenAI)
  const mcr = new MCR({
    llm: { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
  });

  // Option 2: Provide a pre-initialized LLM client (for any provider conforming to OpenAI's chat API)
  // const customLlmClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Example for OpenAI
  // const mcr = new MCR({
  //   llm: { client: customLlmClient, model: 'gpt-4o-mini' } // Specify model if not 'gpt-3.5-turbo'
  // });

  // Option 3: Use MCR without LLM capabilities (for symbolic reasoning only)
  // const mcr = new MCR({});
  
  const session = mcr.createSession();
  
  await session.assert('All canaries are birds.');
  await session.assert('All birds have wings.');
  await session.assert('Tweety is a canary.');
  
  // Query with Prolog
  const prologResult = await session.query('has_wings(tweety)');
  console.log(`Prolog answer: ${prologResult.success ? 'Yes' : 'No'}`);
  console.log(`Confidence: ${prologResult.confidence}`);
  
  // Query with natural language and fallback (requires LLM)
  // Note: if mcr was initialized without an LLM, this will fail or return default
  const naturalResult = await session.nquery('Does tweety fly?', { allowSubSymbolicFallback: true });
  console.log(`Natural language answer: ${naturalResult.success ? 'Yes' : 'No'`);
  console.log(`Confidence: ${naturalResult.confidence}`);
  
  // Reason about task (requires LLM)
  const reasoning = await session.reason('Can tweety migrate?', { allowSubSymbolicFallback: true });
  console.log(`Reasoning: ${reasoning.answer}`);
  console.log(`Steps: ${reasoning.steps.join('\n')}`);
  console.log(`Confidence: ${reasoning.confidence}`);

  // NEW: Get global LLM usage metrics
  const globalLlmMetrics = mcr.getLlmMetrics();
  console.log(`\nTotal LLM Calls: ${globalLlmMetrics.calls}`);
  console.log(`Total LLM Prompt Tokens: ${globalLlmMetrics.promptTokens}`);
  console.log(`Total LLM Completion Tokens: ${globalLlmMetrics.completionTokens}`);
  console.log(`Total LLM Latency (ms): ${globalLlmMetrics.totalLatencyMs}`);
}

main().catch(console.error);
```

**Expected Output:**

```
Prolog answer: Yes
Confidence: 1
Natural language answer: Yes
Confidence: 0.7
Reasoning: Yes
Steps:
Translated: can_migrate(tweety)
Executed: can_migrate(tweety)
Result: true
Confidence: 1
```

## 📦 API Reference

### `MCR` Class

*   `new MCR(config)`: Creates a new MCR instance.
    *   `config.llm.apiKey` (string): API key for supported providers (e.g., OpenAI).
    *   `config.llm.provider` (string, optional): 'openai'. If not 'openai', requires `llm.client`.
    *   `config.llm.client` (object, optional): A pre-initialized LLM client instance (e.g., `new OpenAI()`). Overrides `apiKey` and `provider`.
    *   `config.llm.model` (string, optional): LLM model name (default: 'gpt-3.5-turbo').
*   `createSession(options)`: Creates and returns a new `Session` object.
*   `getLlmMetrics()`: Returns aggregated LLM usage metrics across all sessions created by this MCR instance.
    *   **Returns**: An object containing:
        *   `promptTokens`: Total tokens sent in prompts.
        *   `completionTokens`: Total tokens received in completions.
        *   `totalTokens`: Sum of prompt and completion tokens.
        *   `calls`: Total number of LLM API calls.
        *   `totalLatencyMs`: Total time spent waiting for LLM responses.

---

### `Session` Class

Represents an isolated reasoning context and its knowledge graph.

*   `async assert(naturalLanguageText)`: Translates a statement into a symbolic representation and integrates it into the knowledge graph. Returns an `integrationReport` detailing what was added.
    *   **Returns**: An object containing:
        *   `success`: A boolean indicating whether the assertion succeeded
        *   `symbolicRepresentation`: The Prolog clause added
        *   `originalText`: The original natural language input
*   `async query(prologQuery, options)`: Executes a Prolog query against the knowledge graph.
    *   **Options**: 
        *   `allowSubSymbolicFallback` (boolean): Enable fallback to LLM if symbolic query fails
    *   **Returns**: An object containing:
        *   `success`: Boolean indicating query success
        *   `bindings`: Variable bindings or LLM response
        *   `explanation`: Array of Prolog queries used
        *   `confidence`: Numerical confidence score (0.0-1.0)
*   `async nquery(naturalLanguageQuery, options)`: Translates natural language question to Prolog and executes query.
    *   **Returns**: Same object as `query()`
*   `async reason(taskDescription, options)`: Uses translation and query to provide natural language reasoning.
    *   **Returns**: An object containing:
        *   `answer`: 'Yes' or 'No' based on query result
        *   `steps`: Array of reasoning steps
        *   `confidence`: Numerical confidence score
*   `getKnowledgeGraph()`: Returns the entire knowledge graph as a Prolog string.

## 🔄 Session Management

MCR supports advanced session management:

```javascript
// Save session state
const savedState = session.saveState();

// Create new session with saved state
const newSession = mcr.createSession();
newSession.loadState(savedState);

// Clear session knowledge
session.clear();

// Update ontology dynamically
session.reloadOntology({
  types: ['mammal', 'bird'],
  relationships: ['eats', 'flies']
});
```

## 🧩 Translation Strategies

MCR uses a tiered translation approach:
1. Direct-to-Prolog: Simple LLM prompt for conversion
2. JSON-to-Prolog: Structured intermediate representation
3. Auto-fallback: Automatically retries with JSON on failure

## 🧠 Core Concepts: The Path to AGI

The simple API above is the interface to a powerful set of underlying concepts designed for future growth.

### Translation Strategies

A Translation Strategy is a "pluggable mind" for the reasoner. It defines how to convert between the neural and symbolic worlds. The initial library will include basic strategies (e.g., "Direct-to-Prolog"), but the architecture is designed for advanced strategies that can:

*   Use a **Structured Intermediate Representation** (e.g., JSON) to eliminate LLM syntax errors.
*   Perform **self-correction** by re-prompting the LLM upon failure.
*   Query **external tools and APIs** to gather new knowledge before asserting it.

### The Dynamic Knowledge Graph

The "KB" is more than a static database. It's a graph that can be actively shaped and constrained by **ontologies**. You can provide an ontology that defines the "shape" of the world—the types of entities and relationships they can have. This allows the reasoner to:

*   Identify and reject nonsensical assertions ("Socrates is a color").
*   Ask clarifying questions when faced with ambiguity.
*   Infer missing information based on the defined structure of the world.

### The Hybrid Reasoning Engine

MCR is designed for **hybrid reasoning**. While the Prolog core provides speed and verifiability, some questions are inherently sub-symbolic ("What is the sentiment of this sentence?"). The `query` method's `allowSubSymbolicFallback` option is the entry point to this hybrid capability, allowing the system to seamlessly choose the right tool for the job.

## 🛣️ The Road Ahead: Future Directions

MCR is architected to evolve. The foundational features are the launchpad for a system that will progressively gain more advanced, autonomous capabilities.

*   **Strategy Evolution**: The system will log the performance (latency, accuracy, cost) of its Translation Strategies. This data will be used to create a feedback loop, allowing an "optimizer" process to critique, refine, and generate new, more effective strategies automatically.
*   **Automated Knowledge Acquisition**: Future versions will be able to ingest and understand unstructured documents, websites, or API documentation, automatically building and updating their own knowledge graphs.
*   **Multi-Modal Reasoning**: The architecture is designed to support future strategies that can translate inputs from other modalities—such as image recognition or data streams—into the symbolic core, enabling reasoning across different types of information.
*   **Goal-Oriented Agency**: The `reason()` method will evolve into a true agentic loop, capable of breaking down complex goals into smaller, solvable steps of assertion and querying.
``` ```

test/mcr.test.js
