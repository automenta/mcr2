const pl = require('tau-prolog');
const OntologyManager = require('./ontology/OntologyManager');
const agenticReasoning = require('./translation/agenticReasoning');
const { getLlmClient } = require('./llm');

class MCR {
  constructor(config) {
    this.config = config;
    const llmConfig = config.llm || {};
    this.llmClient = null;
    this.llmModel = llmConfig.model || 'gpt-3.5-turbo';
    // NEW: Initialize global LLM usage tracking
    this.totalLlmUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      calls: 0,
      totalLatencyMs: 0,
    };
    // Allow initial strategies to be passed or use defaults
    this.strategyRegistry = {
      direct: require('./translation/directToProlog'),
      json: require('./translation/jsonToProlog'),
      agentic: agenticReasoning, // NEW STRATEGY ADDED
      ...(config.strategyRegistry || {}), // Merge custom strategies if provided
    };

    // MODIFIED: Flexible LLM client instantiation
    if (llmConfig.client) {
      this.llmClient = llmConfig.client;
    } else if (llmConfig.provider) {
      this.llmClient = getLlmClient(llmConfig);
    }
    // If no client or API key for OpenAI is provided, this.llmClient remains null,
    // allowing MCR to be used for symbolic-only operations.
  }

  createSession(options = {}) {
    return new Session(this, options);
  }

  registerStrategy(name, strategyFn) {
    if (typeof strategyFn !== 'function') {
      throw new Error('Strategy must be a function');
    }
    this.strategyRegistry[name] = strategyFn;
  }
  saveState() {
    throw new Error('MCR instance does not manage session state. Use session.saveState() instead.');
  }

  loadState(state) {
    throw new Error('MCR instance does not manage session state. Use session.loadState() instead.');
  }

  // NEW METHOD: Get total LLM usage metrics across all sessions
  getLlmMetrics() {
    return { ...this.totalLlmUsage };
  }
}

class Session {
  constructor(mcr, options = {}) {
    this.mcr = mcr;
    this.options = {
      retryDelay: 500,
      maxTranslationAttempts: 2,
      maxReasoningSteps: 5, // NEW OPTION
      ...options
    };
    this.sessionId = options.sessionId || Date.now().toString(36);
    this.program = [];
    this.logger = options.logger || console;
    this.ontology = new OntologyManager(this.options.ontology); // Initialize ontology first
    // NEW: Initialize session-specific LLM usage tracking
    this.llmUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      calls: 0,
      totalLatencyMs: 0
    };

    this.prologSession = pl.create(); // Create initial Prolog session
    // If an initial program is provided (e.g., from loadState), consult it
    if (options.program && Array.isArray(options.program)) {
      options.program.forEach(clause => {
        try {
          this.ontology.validatePrologClause(clause); // Validate initial program against ontology
          this.program.push(clause);
        } catch (e) {
          this.logger.warn(`Invalid clause in initial program (skipped): ${clause}. Error: ${e.message}`);
        }
      });
      this._consultProgram(); // Consult the valid part of the initial program
    }
    
    if (options.translator && typeof options.translator !== 'function' && typeof options.translator !== 'string') {
      throw new Error('Translator option must be a function or a string (strategy name).');
    }
    if (typeof options.translator === 'string' && !this.mcr.strategyRegistry[options.translator]) {
      throw new Error(`Unknown translation strategy: ${options.translator}`);
    }
    
    this.maxAttempts = this.options.maxTranslationAttempts;
    this.retryDelay = this.options.retryDelay;
  }
  
  // NEW: Internal helper to consult the current program into the Prolog session
  _consultProgram() {
    this.prologSession = pl.create(); // Re-create session to clear previous state
    this.prologSession.consult(this.program.join('\n'));
  }

  _isValidPrologSyntax(prologString) {
    if (typeof prologString !== 'string' || prologString.trim() === '') {
        return false;
    }
    const trimmedProlog = prologString.trim();
    const session = pl.create();
    try {
        // Tau Prolog's `consult` and `query` methods can throw errors for invalid syntax.
        // We can use this to our advantage to validate the syntax.
        if (trimmedProlog.endsWith('.')) {
            session.consult(trimmedProlog);
        } else {
            session.query(trimmedProlog);
        }
        // If no error is thrown, the syntax is considered valid.
        return true;
    } catch (e) {
        // An error was thrown, so the syntax is invalid.
        return false;
    }
  }

  // NEW HELPER: Records LLM usage metrics
  _recordLlmUsage(startTime, response) {
    const endTime = Date.now();
    const latency = endTime - startTime;
    const usage = response.usage;

    if (usage) {
      this.llmUsage.promptTokens += usage.prompt_tokens || 0;
      this.llmUsage.completionTokens += usage.completion_tokens || 0;
      this.llmUsage.totalTokens += usage.total_tokens || 0;
      // Update MCR-level total usage
      this.mcr.totalLlmUsage.promptTokens += usage.prompt_tokens || 0;
      this.mcr.totalLlmUsage.completionTokens += usage.completion_tokens || 0;
      this.mcr.totalLlmUsage.totalTokens += usage.total_tokens || 0;
    }
    this.llmUsage.calls++;
    this.llmUsage.totalLatencyMs += latency;
    this.mcr.totalLlmUsage.calls++;
    this.mcr.totalLlmUsage.totalLatencyMs += latency;
  }

  reloadOntology(newOntology) {
    this.ontology = new OntologyManager(newOntology);
    // Revalidate existing program with new ontology
    try {
      const tempProgram = [...this.program];
      this.program = []; // Clear program to re-add validated clauses
      for (const clause of tempProgram) {
        this.assertProlog(clause); // Use assertProlog for re-assertion and re-validation
      }
    } catch (error) {
      this.logger.warn('Ontology reload caused validation errors, some clauses might be removed.', error);
    }
  }

  clear() {
    this.program = [];
    this.prologSession = pl.create();
    if (this.options.ontology) { // Re-initialize ontology if it was provided in options
      this.ontology = new OntologyManager(this.options.ontology);
    }
    this.logger.debug(`[${new Date().toISOString()}] [${this.sessionId}] Session cleared`);
  }

  saveState() {
    return JSON.stringify({
      program: this.program,
      sessionId: this.sessionId,
      ontology: {
        types: Array.from(this.ontology.types),
        relationships: Array.from(this.ontology.relationships),
        constraints: Array.from(this.ontology.constraints),
        synonyms: this.ontology.synonyms
      }
    });
  }

  loadState(state) {
    const data = JSON.parse(state);
    this.sessionId = data.sessionId;
    this.ontology = new OntologyManager(data.ontology);
    this.program = []; // Clear current program
    this.prologSession = pl.create(); // Create new Prolog session
    // Re-assert program to ensure validation and correct state
    data.program.forEach(clause => {
      try {
        this.assertProlog(clause); // Use assertProlog to load state with validation
      } catch (e) {
        this.logger.error(`Failed to load clause "${clause}" from state due to ontology violation: ${e.message}`);
      }
    });
  }
  
  async translateWithRetry(text) {
    this.logger.debug(`[${new Date().toISOString()}] [${this.sessionId}] translateWithRetry: "${text}"`);
    let lastError;
    
    const ontologyTerms = [
      ...this.ontology.types, 
      ...this.ontology.relationships,
      ...Object.keys(this.ontology.synonyms)
    ];

    // If a custom translator function is provided, handle its retries internally
    if (typeof this.options.translator === 'function') {
      let feedback = null;
      for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
        try {
          const startTime = Date.now(); // Start timer
          const result = await this.options.translator(text, this.mcr.llmClient, this.mcr.llmModel, ontologyTerms, feedback);
          // NEW: Custom translator results don't have usage, so we mock a minimal usage for tracking calls and latency.
          this._recordLlmUsage(startTime, { usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } });
          if (!this._isValidPrologSyntax(result)) {
            feedback = `The previous output was not valid Prolog syntax: "${result}". Please ensure it is a valid Prolog clause or query.`;
            lastError = new Error('Translator produced invalid Prolog syntax.');
            this.logger.warn(`Custom translator produced invalid Prolog. Retrying with feedback.`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay)); // Add delay for internal retries
            continue; // Retry this strategy with feedback
          }
          return result;
        } catch (error) {
          lastError = error;
          feedback = `Previous attempt failed with error: ${error.message}. Please correct the issue and provide valid Prolog output.`;
          this.logger.warn(`Custom translator failed on attempt ${attempt + 1}. Retrying with feedback.`);
          if (attempt < this.maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          }
        }
      }
      throw lastError; // All attempts for custom translator failed
    }

    let strategiesToAttempt;

    if (Array.isArray(this.options.translator)) {
      strategiesToAttempt = this.options.translator;
    } else if (typeof this.options.translator === 'string') {
      strategiesToAttempt = [this.options.translator];
    } else {
      // Default fallback chain if no specific translator is defined
      strategiesToAttempt = ['direct', 'json'];
    }

    for (const strategyName of strategiesToAttempt) {
      const currentTranslator = this.mcr.strategyRegistry[strategyName];
      if (!currentTranslator) continue;

      let feedback = null;
      for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
        try {
          const startTime = Date.now(); // Start timer
          const response = await currentTranslator(text, this.mcr.llmClient, this.mcr.llmModel, ontologyTerms, feedback, true); // Pass true to get full response
          this._recordLlmUsage(startTime, response); // Record usage from full response
          const result = response.choices[0].message.content.trim(); // Extract content here

          // Basic validation of the LLM's Prolog output for syntax correctness
          if (!this._isValidPrologSyntax(result)) {
            feedback = `The output was not valid Prolog syntax: "${result}". Please ensure it is a valid Prolog clause (ending with a dot) or a valid Prolog query (not ending with a dot and without ':-').`;
            lastError = new Error('LLM produced invalid Prolog syntax.');
            this.logger.warn(`Translation strategy '${strategyName}' produced invalid Prolog. Retrying with feedback.`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay)); // Add delay for internal retries
            continue; // Retry this strategy with feedback
          }
          return result; // Successfully translated and validated
        } catch (error) {
          lastError = error;
          feedback = `Previous attempt failed with error: ${error.message}. Please correct the issue and provide valid Prolog output.`;
          this.logger.warn(`Translation strategy '${strategyName}' failed on attempt ${attempt + 1}: ${error.message}. Retrying with feedback.`);
          if (attempt < this.maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          }
        }
      }
    }
    throw lastError;
  }

  // NEW METHOD: Directly assert a Prolog clause with ontology validation
  assertProlog(prologClause) {
    if (typeof prologClause !== 'string' || !prologClause.trim().endsWith('.')) {
      return { success: false, symbolicRepresentation: prologClause, error: 'Invalid Prolog clause. Must be a string ending with a dot.' };
    }
    const normalizedClause = prologClause.trim();

    try {
      // Use tau-prolog's parser to validate the syntax
      const session = pl.create();
      session.consult(normalizedClause);
      this.program.push(normalizedClause);
      this._consultProgram(); // Re-consult the entire program
      return { success: true, symbolicRepresentation: normalizedClause };
    } catch (error) {
      this.logger.error('Prolog assertion error:', error);
      return { success: false, symbolicRepresentation: normalizedClause, error: error.message };
    }
  }

  // NEW METHOD: Retract a Prolog clause
  retractProlog(prologClause) {
    const initialLength = this.program.length;
    this.program = this.program.filter(clause => clause !== prologClause);
    if (this.program.length < initialLength) {
      this._consultProgram(); // Re-consult the program if changes were made
      return { success: true, message: `Clause "${prologClause}" retracted.` };
    } else {
      return { success: false, message: `Clause "${prologClause}" not found.` };
    }
  }

  async assert(naturalLanguageText) {
    this.logger.debug(`[${new Date().toISOString()}] assert called for: "${naturalLanguageText}"`);
    try {
      const prologClause = await this.translateWithRetry(naturalLanguageText);
      // Ensure the translated result is a fact or rule (ends with a dot) for assertion
      if (typeof prologClause !== 'string' || !prologClause.trim().endsWith('.')) {
        return { 
          success: false, 
          symbolicRepresentation: prologClause, 
          originalText: naturalLanguageText, 
          error: 'Translation resulted in a query or invalid clause for assertion. Must be a fact or rule ending with a dot.' 
        };
      }
      
      // Use the new assertProlog method for validation and program update
      const assertResult = this.assertProlog(prologClause);

      if (!assertResult.success) {
        // If assertProlog failed (e.g., due to ontology), propagate its error
        return { 
          success: false, 
          symbolicRepresentation: assertResult.symbolicRepresentation, 
          originalText: naturalLanguageText, 
          error: assertResult.error 
        };
      }

      return { 
        success: true, 
        symbolicRepresentation: assertResult.symbolicRepresentation,
        originalText: naturalLanguageText 
      };
    } catch (error) {
      this.logger.error('Assertion error:', error);
      return { 
        success: false, 
        symbolicRepresentation: null,
        originalText: naturalLanguageText,
        error: error.message
      };
    }
  }

  extractPredicates(query) {
    return query
      .split(/[,\s\(\)\.]+/)
      .filter(token => /^[a-z][a-zA-Z0-9_]*$/.test(token));
  }

  async query(prologQuery, options = {}) {
    this.logger.debug(`[${new Date().toISOString()}] [${this.sessionId}] query: "${prologQuery}"`);
    const { allowSubSymbolicFallback = false } = options;
    try {
      this._consultProgram(); // Ensure the latest program is consulted
      if (this.options.ontology) {
        const predicates = this.extractPredicates(prologQuery);
        predicates.forEach(p => {
          // Validate that predicates are defined in the ontology, but don't enforce arity rules for queries
          if (!this.ontology.isDefined(p)) {
            const suggestions = this.ontology.getSuggestions(p);
            throw new Error(`Query predicate '${p}' not defined in ontology. ${suggestions}`);
          }
        });
      }
      return new Promise((resolve, reject) => {
        const bindings = [];
        const proofSteps = [];
        const onAnswer = (answer) => {
          if (answer === false) {
            const success = bindings.length > 0;
            resolve({
              success,
              bindings: success ? bindings : null,
              explanation: proofSteps.length > 0 ? proofSteps : (success ? ['Directly proven from knowledge graph.'] : ['No direct proof found in knowledge graph.']),
              confidence: success ? 1.0 : 0.0
            });
          } else {
            const formatted = pl.format_answer(answer);
            bindings.push(formatted);
            proofSteps.push(`Derived: ${formatted}`);
            this.prologSession.answer(onAnswer);
          }
        };
        this.prologSession.query(prologQuery);
        this.prologSession.answer(onAnswer);
      }).then(async (result) => {
        if (!result.success && allowSubSymbolicFallback && this.mcr.llmClient) {
          const startTime = Date.now(); // Start timer for LLM fallback
          const llmAnswer = await this.mcr.llmClient.chat.completions.create({
            model: this.mcr.llmModel,
            messages: [{ 
              role: 'user', 
              content: `Given the Prolog query "${prologQuery}", and the current knowledge graph:\n${this.program.join('\n')}\n\nWhat would be a natural language answer?` +
                       `\n\nAvailable ontology terms: ${[...this.ontology.types, ...this.ontology.relationships, ...Object.keys(this.ontology.synonyms)].join(', ')}` +
                       `\n\nAnswer:` 
            }],
            temperature: 0.0,
          });
          this._recordLlmUsage(startTime, llmAnswer); // Record usage for fallback
          const answer = llmAnswer.choices[0].message.content.trim();
          return { 
            success: true, 
            bindings: [answer], 
            explanation: ['Sub-symbolic fallback used. LLM provided the answer based on provided context and its general knowledge.'], 
            confidence: 0.7 
          };
        }
        return result;
      });
    } catch (error) {
      this.logger.error('Query error:', error);
      return { 
        success: false, 
        bindings: null, 
        explanation: [`Error: ${error.message}`], 
        confidence: 0.0 
      };
    }
  }


  async nquery(naturalLanguageQuery, options = {}) {
    this.logger.debug(`[${new Date().toISOString()}] nquery called for: "${naturalLanguageQuery}"`);
    let prologQuery; // NEW: Define prologQuery in the outer scope
    try {
      prologQuery = await this.translateWithRetry(naturalLanguageQuery);
      // Ensure the translated result is a query (does not end with a dot)
      if (typeof prologQuery !== 'string' || prologQuery.trim().endsWith('.')) {
        return { 
          success: false, 
          prologQuery, // NEW: Include the invalid query
          bindings: null, 
          explanation: [`Translation resulted in a fact/rule or invalid clause for query. Must be a query (not ending with a dot).`], 
          confidence: 0.0 
        };
      }
      // MODIFIED: Attach prologQuery to the final result
      return await this.query(prologQuery, options)
        .then(result => ({ ...result, prologQuery }));
    } catch (error) {
      this.logger.error('Natural query error:', error);
      return { 
        success: false, 
        prologQuery, // NEW: Include the query if it was translated before the error
        bindings: null, 
        explanation: [`Translation failed: ${error.message}`], 
        confidence: 0.0 
      };
    }
  }

  // REFACTORED METHOD: reason
  async reason(taskDescription, options = {}) {
    this.logger.debug(`[${new Date().toISOString()}] reason called for: "${taskDescription}"`);
    try {
      const steps = [];
      let accumulatedBindings = '';
      const maxSteps = options.maxSteps || this.options.maxReasoningSteps;
      const allowSubSymbolicFallback = options.allowSubSymbolicFallback || false;
      const agenticStrategy = this.mcr.strategyRegistry.agentic;

      if (!agenticStrategy) {
        throw new Error('Agentic reasoning strategy not registered. Please ensure "agenticReasoning.js" is correctly configured.');
      }
      
      for (let step = 0; step < maxSteps; step++) {
        this.logger.debug(`[${new Date().toISOString()}] [${this.sessionId}] Reasoning step ${step + 1}`);
        
        // Use the agentic strategy to determine the next action
        const ontologyTerms = [
          ...this.ontology.types, 
          ...this.ontology.relationships,
          ...Object.keys(this.ontology.synonyms)
        ];

        const startTime = Date.now(); // Start timer for agentic strategy call
        const agentAction = await agenticStrategy(
          taskDescription, 
          this.mcr.llmClient, 
          this.mcr.llmModel, 
          this.program, 
          ontologyTerms, 
          steps, 
          accumulatedBindings,
          this.maxAttempts, // Pass max attempts for internal retries
          this.retryDelay, // Pass retry delay for internal retries
          true // Pass true to get full response for metrics
        );
        this._recordLlmUsage(startTime, agentAction.response); // Record usage from full response
        delete agentAction.response; // Remove the full response from the returned object

        steps.push(`Agent Action (${step + 1}): Type: ${agentAction.type}, Content: ${agentAction.content || agentAction.answer}`);

        if (agentAction.type === 'query') {
          const queryResult = await this.query(agentAction.content, { allowSubSymbolicFallback });
          steps.push(`Query Result: Success: ${queryResult.success}, Bindings: ${queryResult.bindings ? queryResult.bindings.join(', ') : 'None'}, Confidence: ${queryResult.confidence}`);
          
          if (queryResult.success && queryResult.bindings) {
            accumulatedBindings = accumulatedBindings 
              ? `${accumulatedBindings}, ${queryResult.bindings.join(', ')}`
              : queryResult.bindings.join(', ');
          }
          // Check if the query itself is a final conclusion (e.g., a true/false query)
          // or if the agent explicitly signals conclusion
          if (queryResult.success && queryResult.bindings && (queryResult.bindings.some(b => ['true', 'false', 'yes', 'no'].some(term => b.includes(term))) || agentAction.concludes)) {
            return {
              answer: queryResult.bindings.includes('true') || queryResult.bindings.includes('yes') ? 'Yes' : 'No',
              steps,
              confidence: queryResult.confidence
            };
          }

        } else if (agentAction.type === 'assert') {
          const assertResult = this.assertProlog(agentAction.content);
          steps.push(`Assertion Result: Success: ${assertResult.success}, Clause: ${assertResult.symbolicRepresentation}` + (assertResult.error ? `, Error: ${assertResult.error}` : ''));
          if (!assertResult.success) {
            // If assertion failed, decide whether to continue or terminate.
            // For now, we'll let the agent try to recover or eventually reach max steps.
            this.logger.warn(`Agent attempted assertion failed: ${assertResult.error}`);
          }
        } else if (agentAction.type === 'conclude') {
          return {
            answer: agentAction.answer,
            steps: [...steps, `Conclusion: ${agentAction.answer}` + (agentAction.explanation ? ` (Explanation: ${agentAction.explanation})` : '')],
            confidence: 1.0 // Agent concluded, assuming high confidence in its decision
          };
        }
      }
      
      // If max steps reached without a 'conclude' action
      return {
        answer: 'Inconclusive',
        steps: [...steps, `Reached maximum steps (${maxSteps}) without conclusion. Current bindings: ${accumulatedBindings || 'None'}`],
        confidence: 0.3
      };
    } catch (error) {
      this.logger.error('Reasoning error:', error);
      return { 
        answer: 'Reasoning error', 
        steps: [`Error: ${error.message}`],
        confidence: 0.0
      };
    }
  }

  // REMOVED: isFinalResult - Logic handled by agentic strategy's 'conclude' type
  // REMOVED: generateNextStep - Logic handled by agentic strategy

  getKnowledgeGraph(format = 'prolog') {
    if (format === 'json') {
      return {
        facts: this.program.filter(clause => !clause.includes(':-')),
        rules: this.program.filter(clause => clause.includes(':-')),
        entities: Array.from(this.ontology.types),
        relationships: Array.from(this.ontology.relationships),
        constraints: Array.from(this.ontology.constraints)
      };
    }
    
    // MODIFIED: Return the prolog string directly for 'prolog' format
    return this.program.join('\n');
  }
  
  // NEW METHOD: Get the session's ontology
  getOntology() {
    return {
      types: Array.from(this.ontology.types),
      relationships: Array.from(this.ontology.relationships),
      constraints: Array.from(this.ontology.constraints),
      synonyms: { ...this.ontology.synonyms }
    };
  }

  // MODIFIED: addFact to use assertProlog directly
  addFact(entity, type) {
    const prologFact = `${this.ontology.resolveSynonym(type)}(${this.ontology.resolveSynonym(entity)}).`;
    return this.assertProlog(prologFact); // assertProlog now returns the report object directly
  }
  
  // MODIFIED: addRelationship to use assertProlog directly
  addRelationship(subject, relation, object) {
    const prologRelationship = `${this.ontology.resolveSynonym(relation)}(${this.ontology.resolveSynonym(subject)}, ${this.ontology.resolveSynonym(object)}).`;
    return this.assertProlog(prologRelationship); // assertProlog now returns the report object directly
  }

  removeFact(entity, type) {
    const prologFact = `${this.ontology.resolveSynonym(type)}(${this.ontology.resolveSynonym(entity)}).`;
    return this.retractProlog(prologFact);
  }

  removeRelationship(subject, relation, object) {
    const prologRelationship = `${this.ontology.resolveSynonym(relation)}(${this.ontology.resolveSynonym(subject)}, ${this.ontology.resolveSynonym(object)}).`;
    return this.retractProlog(prologRelationship);
  }

  addRule(prologRule) {
    if (typeof prologRule !== 'string' || !prologRule.trim().endsWith('.') || !prologRule.includes(':-')) {
      return { success: false, symbolicRepresentation: prologRule, error: 'Invalid Prolog rule. Must be a string ending with a dot and containing ":-".' };
    }
    return this.assertProlog(prologRule);
  }

  removeRule(prologRule) {
    if (typeof prologRule !== 'string' || !prologRule.trim().endsWith('.') || !prologRule.includes(':-')) {
      return { success: false, message: 'Invalid Prolog rule format for removal. Must be a string ending with a dot and containing ":-".' };
    }
    return this.retractProlog(prologRule);
  }

  // NEW: Direct ontology management methods for Session
  addType(type) {
    this.ontology.addType(type);
  }

  // RENAMED: was `addRelationship(relationship)` which conflicted with the one above
  defineRelationshipType(relationship) {
    this.ontology.addRelationship(relationship);
  }

  addConstraint(constraint) {
    this.ontology.addConstraint(constraint);
  }

  addSynonym(originalTerm, synonym) {
    this.ontology.addSynonym(originalTerm, synonym);
  }

  // NEW: Get LLM usage metrics for the session
  getLlmMetrics() {
    return { ...this.llmUsage };
  }
}

module.exports = { MCR, Session };
