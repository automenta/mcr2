const { MCR, Session } = require('../src/mcr');
const directToProlog = require('../src/translation/directToProlog');
const jsonToProlog = require('../src/translation/jsonToProlog');
const agenticReasoning = require('../src/translation/agenticReasoning'); // NEW MOCK IMPORT

// Helper to simulate dynamic mock behavior with feedback and optional full response
const createMockTranslator = (responses) => {
  let callCount = 0;
  return jest.fn(async (text, llmClient, model, ontologyTerms, feedback, returnFullResponse = false) => {
    const currentResponse = responses[callCount++];
    let result;
    if (typeof currentResponse === 'function') {
      result = await currentResponse(feedback);
    } else if (currentResponse instanceof Error) {
      throw currentResponse;
    } else {
      result = currentResponse;
    }

    // Simulate OpenAI response structure for metrics tracking
    const mockOpenAIResponse = {
      choices: [{ message: { content: result } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } // Mock usage
    };

    return returnFullResponse ? mockOpenAIResponse : result;
  });
};

jest.mock('../src/translation/directToProlog', () => createMockTranslator([
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'bird(tweety).'; },
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'has_wings(X) :- bird(X).'; },
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'bird(tweety).'; }, // For 'Is tweety a bird?'
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'has_color(tweety, yellow).'; },
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'bird(X) :- canary(X).'; },
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'flies(tweety).'; }, // for 'Does tweety fly?'
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'can_migrate(tweety).'; }, // for 'Can tweety migrate?'
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'fish(nemo).'; }, // for assert rejects
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'swim(X) :- fish(X).'; }, // for assert rejects
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'bird(tweety).'; }, // for nquery (translation to fact)
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'malformed prolog'; }, // For self-correction test (1st call)
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'valid_prolog(X).'; }, // For self-correction test (2nd call)
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'bird(X).'; }, // for query validation
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'mammal(X).'; }, // for query validation
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'canary(tweety).'; }, // for reason test
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'bird(tweety).'; }, // for reason test
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'has_wings(tweety).'; }, // for reason test
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'true.'; }, // for query in reason
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'asserted_fact(foo).'; }, // for assert in reason
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'final_answer(yes).'; }, // for conclude in reason
]));

jest.mock('../src/translation/jsonToProlog', () => createMockTranslator([
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); return 'some_json_translated_prolog(X).'; },
  async (feedback) => { if (feedback && feedback.includes('invalid')) throw new Error('Simulated re-failure'); throw new Error('JSON failed miserably too'); }, // For self-correction failure
]));


// Mock agenticReasoning for specific reasoning flows
jest.mock('../src/translation/agenticReasoning', () => createMockTranslator([
  // Sequence for 'Can tweety migrate?'
  async (feedback) => {
    if (feedback) throw new Error('Agent mock received unexpected feedback'); // Agent mock does not expect feedback for this path
    return { type: 'query', content: 'can_migrate(tweety)' }; // Note: no dot for query in agentic
  },
  async (feedback) => {
    if (feedback) throw new Error('Agent mock received unexpected feedback');
    return { type: 'conclude', answer: 'Yes, Tweety can migrate.', explanation: 'Derived from previous queries.' };
  },
  // Sequence for 'Add a new fact'
  async (feedback) => {
    if (feedback) return { type: 'conclude', answer: 'New fact asserted after correction.', explanation: 'Corrected invalid JSON.' };
    return { type: 'assert', content: 'new_fact(test).' };
  },
  async (feedback) => {
    if (feedback) throw new Error('Agent mock received unexpected feedback');
    return { type: 'conclude', answer: 'New fact asserted.', explanation: 'Agent completed assertion.' };
  },
  // Sequence for 'Invalid JSON test'
  async (feedback) => { // Attempt 1 (initial)
    if (feedback) throw new Error('Agent mock received unexpected feedback');
    throw new SyntaxError('Unexpected token i in JSON at position 0'); // Simulate invalid JSON
  },
  async (feedback) => { // Attempt 2 (with feedback)
    if (feedback && feedback.includes('not valid JSON')) {
      return { type: 'conclude', answer: 'Agent fixed JSON output.', explanation: 'Agent self-corrected JSON.' };
    }
    throw new Error('Agent mock expected feedback for JSON correction.');
  },
]));


describe('MCR', () => {
  test('instantiates with config', () => {
    const config = { llm: { provider: 'openai', apiKey: 'test-key' } };
    const mcr = new MCR(config);
    expect(mcr.config).toEqual(config);
    expect(mcr.totalLlmUsage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      calls: 0,
      totalLatencyMs: 0
    });
  });

  test('creates session instances', () => {
    const mcr = new MCR({});
    const session = mcr.createSession();
    expect(session).toBeInstanceOf(Session);
  });

  test('registers custom strategy', () => {
    const mcr = new MCR({});
    const mockStrategy = jest.fn();
    mcr.registerStrategy('custom', mockStrategy);
    expect(mcr.strategyRegistry.custom).toBe(mockStrategy);
  });

  test('MCR constructor accepts initial strategyRegistry', () => {
    const customStrategy = jest.fn();
    const config = { 
        llm: { provider: 'openai', apiKey: 'test-key' },
        strategyRegistry: { my_custom_strat: customStrategy }
    };
    const mcr = new MCR(config);
    expect(mcr.strategyRegistry.my_custom_strat).toBe(customStrategy);
    expect(mcr.strategyRegistry.direct).toBeDefined(); // Default strategies should still be there
  });
});

describe('Session', () => {
  let session;
  let mcr;

  beforeEach(() => {
    mcr = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
    session = mcr.createSession();
    // Reset mocks for each test
    directToProlog.mockClear();
    jsonToProlog.mockClear();
    agenticReasoning.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (session) {
      session.clear();
    }
    session = null;
  });

  // Test for new assertProlog method
  test('assertProlog directly adds a Prolog clause and consults it', async () => {
    const result = session.assertProlog('mammal(dog).');
    expect(result.success).toBe(true);
    expect(session.getKnowledgeGraph().prolog).toContain('mammal(dog).');

    const queryResult = await session.query('mammal(X).');
    expect(queryResult.success).toBe(true);
    expect(queryResult.bindings).toContain('X = dog');
  });

  test('assertProlog throws error for invalid Prolog clause', () => {
    expect(() => session.assertProlog('invalid_clause')).toThrow('Invalid Prolog clause');
    expect(session.getKnowledgeGraph().prolog).toBe('');
  });

  test('assertProlog validates against ontology', () => {
    const ontologySession = mcr.createSession({
      ontology: { types: ['person'] }
    });
    expect(() => ontologySession.assertProlog('animal(cat).')).toThrow("Predicate 'animal' not in ontology.");
  });

  // Test for new retractProlog method
  test('retractProlog removes a Prolog clause', async () => {
    session.assertProlog('bird(tweety).');
    expect(session.getKnowledgeGraph().prolog).toContain('bird(tweety).');

    const retractResult = session.retractProlog('bird(tweety).');
    expect(retractResult.success).toBe(true);
    expect(session.getKnowledgeGraph().prolog).not.toContain('bird(tweety).');

    const queryResult = await session.query('bird(X).');
    expect(queryResult.success).toBe(false);
  });

  test('retractProlog returns false if clause not found', () => {
    session.assertProlog('bird(tweety).');
    const retractResult = session.retractProlog('mammal(dog).');
    expect(retractResult.success).toBe(false);
    expect(session.getKnowledgeGraph().prolog).toContain('bird(tweety).'); // Should not change
  });

  // Test for modified assert (now uses assertProlog)
  test('assert translates and stores natural language using assertProlog', async () => {
    const assertPrologSpy = jest.spyOn(session, 'assertProlog');
    directToProlog.mockResolvedValueOnce('bird(tweety).'); // Ensure mock returns something for assert
    const report = await session.assert('Tweety is a bird');
    expect(directToProlog).toHaveBeenCalledWith(
      'Tweety is a bird',
      expect.anything(),
      expect.any(String),
      expect.any(Array)
    );
    expect(assertPrologSpy).toHaveBeenCalledWith('bird(tweety).');
    expect(report.symbolicRepresentation).toBe('bird(tweety).');
    expect(session.getKnowledgeGraph().prolog).toContain('bird(tweety).');
    assertPrologSpy.mockRestore();
  });

  // Test for modified addFact (now uses assertProlog directly)
  test('addFact directly adds a fact bypassing LLM translation', async () => {
    const assertPrologSpy = jest.spyOn(session, 'assertProlog');
    const report = await session.addFact('tweety', 'bird');
    expect(assertPrologSpy).toHaveBeenCalledWith('bird(tweety).');
    expect(report.success).toBe(true);
    expect(session.getKnowledgeGraph().prolog).toContain('bird(tweety).');
    expect(directToProlog).not.toHaveBeenCalled(); // Crucial: ensures LLM is bypassed
    assertPrologSpy.mockRestore();
  });

  // Test for modified addRelationship (now uses assertProlog directly)
  test('addRelationship directly adds a relationship bypassing LLM translation', async () => {
    const assertPrologSpy = jest.spyOn(session, 'assertProlog');
    const report = await session.addRelationship('john', 'loves', 'mary');
    expect(assertPrologSpy).toHaveBeenCalledWith('loves(john, mary).');
    expect(report.success).toBe(true);
    expect(session.getKnowledgeGraph().prolog).toContain('loves(john, mary).');
    expect(directToProlog).not.toHaveBeenCalled(); // Crucial: ensures LLM is bypassed
    assertPrologSpy.mockRestore();
  });

  test('query returns bindings and explanation for valid query', async () => {
    session.assertProlog('bird(tweety).'); // Use direct assertProlog for setup
    const result = await session.query('bird(X).');
    expect(result.success).toBe(true);
    expect(result.bindings).toContain('X = tweety');
    expect(result.explanation).toEqual(['Derived: X = tweety']); // Explanation now includes "Derived:"
  });

  test('query returns no bindings for invalid query', async () => {
    session.assertProlog('bird(tweety).');
    const result = await session.query('fish(X).');
    expect(result.success).toBe(false);
    expect(result.bindings).toBeNull();
  });

  test('multiple asserts build knowledge graph', async () => {
    session.assertProlog('bird(tweety).');
    session.assertProlog('canary(tweety).');
    const kg = session.getKnowledgeGraph().prolog;
    expect(kg).toContain('bird(tweety).');
    expect(kg).toContain('canary(tweety).');
  });

  test('getKnowledgeGraph returns object with prolog string', () => {
    const kg = session.getKnowledgeGraph();
    expect(kg).toHaveProperty('prolog');
    expect(typeof kg.prolog).toBe('string');
  });
  
  test('nquery translates natural language and executes query', async () => {
    session.assertProlog('bird(tweety).');
    directToProlog.mockResolvedValueOnce('bird(tweety).'); // Mock for nquery translation
    const result = await session.nquery('Is tweety a bird?');
    expect(result.success).toBe(true);
    expect(result.bindings).toContain('true'); // Prolog 'true'
  });

  // Test for refactored reason method (agentic loop)
  test('reason uses agentic strategy for multi-step reasoning', async () => {
    session.assertProlog('bird(X) :- canary(X).'); // Add rule
    session.assertProlog('canary(tweety).'); // Add fact

    // Agentic reasoning mock is set to first query 'can_migrate(tweety)'
    // then based on truth value, conclude.
    session.assertProlog('can_migrate(tweety).'); // Add fact directly to KB

    const reasoning = await session.reason('Can tweety migrate?');
    
    expect(agenticReasoning).toHaveBeenCalledTimes(2); // First for query, second for conclusion
    // Verify first call to agenticReasoning
    expect(agenticReasoning).toHaveBeenCalledWith(
        expect.any(String), expect.anything(), expect.any(String), expect.any(Array), 
        expect.any(Array), expect.any(Array), '', 2, 500, true // Expecting full response
    );
    // Verify second call to agenticReasoning based on the result of the query
    expect(agenticReasoning).toHaveBeenCalledWith(
        expect.any(String), expect.anything(), expect.any(String), expect.any(Array), 
        expect.any(Array), expect.arrayContaining(['Agent Action (1): Type: query, Content: can_migrate(tweety)', 'Query Result: Success: true, Bindings: true, Confidence: 1']), 
        'true', 2, 500, true // Expecting full response
    );

    expect(reasoning.answer).toBe('Yes, Tweety can migrate.');
    expect(reasoning.steps).toEqual([
      'Agent Action (1): Type: query, Content: can_migrate(tweety)',
      'Query Result: Success: true, Bindings: true, Confidence: 1', 
      'Agent Action (2): Type: conclude, Content: Yes, Tweety can migrate.'
    ]);
    expect(reasoning.confidence).toBe(1.0);
  });

  test('reason handles assertion steps from agent', async () => {
    // Mock the agentic reasoning to first assert, then conclude
    agenticReasoning.mockImplementationOnce(async () => ({ type: 'assert', content: 'new_fact(test).' }));
    agenticReasoning.mockImplementationOnce(async () => ({ type: 'conclude', answer: 'New fact asserted.' }));

    const reasoning = await session.reason('Add a new fact');
    expect(reasoning.answer).toBe('New fact asserted.');
    expect(session.getKnowledgeGraph().prolog).toContain('new_fact(test).');
    expect(reasoning.steps[0]).toContain('Agent Action (1): Type: assert, Content: new_fact(test).');
    expect(reasoning.steps[1]).toContain('Assertion Result: Success: true, Clause: new_fact(test).');
  });

  test('assert rejects fact not in ontology', async () => {
    // Session is created with ontology
    const ontologySession = mcr.createSession({
      ontology: {
        types: ['bird'],
        relationships: ['has_wings']
      }
    });
    
    // Mock translation to a fact that is not in ontology
    directToProlog.mockResolvedValueOnce('fish(nemo).');
    const report = await ontologySession.assert('Nemo is a fish');
    expect(report.success).toBe(false);
    expect(report.error).toContain("Predicate 'fish' not in ontology.");
  });

  test('assert rejects rule with invalid predicate', async () => {
    const ontologySession = mcr.createSession({
      ontology: {
        types: ['bird'],
        relationships: ['has_wings']
      }
    });
    
    // Mock translation to a rule with a predicate not in ontology
    directToProlog.mockResolvedValueOnce('swim(X) :- fish(X).');
    const report = await ontologySession.assert('All fish can swim');
    expect(report.success).toBe(false);
    expect(report.error).toContain("Predicate 'fish' not in ontology.");
  });

  test('query validates predicates against ontology (isDefined)', async () => {
    const ontologySession = mcr.createSession({
      ontology: {
        types: ['bird'],
        relationships: ['flies']
      }
    });
    
    ontologySession.assertProlog('bird(tweety).');
    
    // Query with a defined predicate (bird) - should succeed
    let result = await ontologySession.query('bird(X).');
    expect(result.success).toBe(true);

    // Query with an undefined predicate (mammal) - should fail due to ontology validation
    result = await ontologySession.query('mammal(X).');
    expect(result.success).toBe(false);
    expect(result.explanation[0]).toContain("Query predicate 'mammal' not defined in ontology.");
  });


  test('uses custom translation strategy', async () => {
    const customTranslator = jest.fn().mockResolvedValue('custom(tweety).');
    const mcr = new MCR({});
    mcr.registerStrategy('custom', customTranslator);
    const session = mcr.createSession({ translator: 'custom' });
    
    await session.assert('Test input');
    expect(customTranslator).toHaveBeenCalledWith(
      'Test input', 
      expect.anything(), 
      expect.any(String), 
      expect.any(Array), 
      null // Initial call, no feedback
    );
    expect(session.getKnowledgeGraph().prolog).toContain('custom(tweety).');
  });

  test('uses custom logger', async () => {
    const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const mcr = new MCR({});
    const session = mcr.createSession({ logger: mockLogger });
    
    // Mock to cause a translation error, triggering logger.error
    directToProlog.mockImplementationOnce(() => { throw new Error('forced translation error'); }); 
    jsonToProlog.mockImplementationOnce(() => { throw new Error('forced json error'); }); // ensure all fail
    await session.assert('Invalid input');
    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  describe('Session State Management', () => {
    test('save and load state', () => {
      session.assertProlog('bird(tweety).');
      const state = session.saveState();
      const newSession = mcr.createSession();
      newSession.loadState(state);
      expect(newSession.getKnowledgeGraph().prolog).toContain('bird(tweety).');
      // Ensure ontology is loaded
      expect(Array.from(newSession.ontology.types)).toEqual([]); // Default empty ontology
    });

    test('load state with initial program containing ontology violations should warn and skip', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
      const config = { types: ['bird'] };
      const savedState = JSON.stringify({
        program: ['bird(tweety).', 'fish(nemo).'], // fish(nemo) violates ontology
        sessionId: 'test1234',
        ontology: config
      });

      const sessionWithOptions = mcr.createSession({ 
          ontology: config,
          logger: mockLogger
      });
      sessionWithOptions.loadState(savedState);

      expect(sessionWithOptions.getKnowledgeGraph().prolog).toContain('bird(tweety).');
      expect(sessionWithOptions.getKnowledgeGraph().prolog).not.toContain('fish(nemo).');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load clause "fish(nemo)." from state due to ontology violation'));
    });

    test('clear session', async () => {
      session.assertProlog('Tweety is a bird');
      session.clear();
      expect(session.getKnowledgeGraph().prolog).toBe('');
      // Ensure ontology is reset if provided in options
      const sessionWithOntology = mcr.createSession({ ontology: { types: ['test'] } });
      expect(Array.from(sessionWithOntology.ontology.types)).toContain('test');
      sessionWithOntology.clear();
      expect(Array.from(sessionWithOntology.ontology.types)).toContain('test'); // Should reset to initial provided ontology
    });

    test('reload ontology revalidates existing program', async () => {
      // Setup session with initial ontology and program
      const initialOntology = {
        types: ['animal'],
        relationships: []
      };
      const sessionWithReload = mcr.createSession({ ontology: initialOntology });
      sessionWithReload.assertProlog('animal(cat).');
      sessionWithReload.assertProlog('animal(dog).');
      expect(sessionWithReload.program).toEqual(['animal(cat).', 'animal(dog).']);

      // Reload with new ontology that restricts 'animal' and adds 'mammal'
      const newOntology = {
        types: ['mammal'], // 'animal' is no longer a valid type
        relationships: []
      };
      const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
      sessionWithReload.logger = mockLogger; // Inject mock logger for this test

      sessionWithReload.reloadOntology(newOntology);

      // Program should now only contain clauses valid against the new ontology.
      // Since 'animal' is no longer a type, existing clauses should be removed.
      expect(sessionWithReload.program).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Ontology reload caused validation errors'),
        expect.any(Error)
      );
      expect(Array.from(sessionWithReload.ontology.types)).toEqual(['mammal']);
    });
  });

  describe('Translation Fallback', () => {
  describe('Translation Self-Correction and Fallback', () => {
    test('directToProlog attempts self-correction if initial output is invalid Prolog', async () => {
      const mcrForSelfCorrection = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
      const sessionForSelfCorrection = mcrForSelfCorrection.createSession({ 
        maxTranslationAttempts: 2, // Allow 2 attempts for direct
        retryDelay: 10 
      });

      // Mock directToProlog: 1st call returns invalid, 2nd call (with feedback) returns valid
      directToProlog.mockImplementationOnce(async (text, llmClient, model, ontologyTerms, feedback, returnFullResponse) => {
        const result = 'malformed prolog response'; // Invalid Prolog
        const mockOpenAIResponse = {
          choices: [{ message: { content: result } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };
        return returnFullResponse ? mockOpenAIResponse : result;
      }).mockImplementationOnce(async (text, llmClient, model, ontologyTerms, feedback, returnFullResponse) => {
        expect(feedback).toContain('The output was not valid Prolog syntax');
        const result = 'valid_prolog(X).'; // Valid Prolog
        const mockOpenAIResponse = {
          choices: [{ message: { content: result } }],
          usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 }
        };
        return returnFullResponse ? mockOpenAIResponse : result;
      });

      const report = await sessionForSelfCorrection.assert('Some complex input');
      
      expect(directToProlog).toHaveBeenCalledTimes(2); // Retried internally by translateWithRetry
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('valid_prolog(X).');
      expect(sessionForSelfCorrection.getKnowledgeGraph().prolog).toContain('valid_prolog(X).');
    });

    test('directToProlog falls back to jsonToProlog after max self-correction attempts', async () => {
      const mcrForFallback = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
      const sessionForFallback = mcrForFallback.createSession({ 
        maxTranslationAttempts: 1, // Only 1 attempt for direct strategy before moving to next
        retryDelay: 10 
      });
      
      // Force directToProlog to return invalid Prolog. It will fail after 1 attempt
      directToProlog.mockImplementationOnce(async (text, llmClient, model, ontologyTerms, feedback, returnFullResponse) => {
        const result = 'invalid_direct_prolog';
        const mockOpenAIResponse = {
          choices: [{ message: { content: result } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };
        return returnFullResponse ? mockOpenAIResponse : result;
      });
      // Force jsonToProlog to succeed
      jsonToProlog.mockImplementationOnce(async (text, llmClient, model, ontologyTerms, feedback, returnFullResponse) => {
        const result = 'some_json_translated_prolog(X).';
        const mockOpenAIResponse = {
          choices: [{ message: { content: result } }],
          usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 }
        };
        return returnFullResponse ? mockOpenAIResponse : result;
      });
      
      const report = await sessionForFallback.assert('Complex natural language input');
      
      expect(directToProlog).toHaveBeenCalledTimes(1); // Only one attempt (which fails syntax validation)
      expect(jsonToProlog).toHaveBeenCalledTimes(1); // json strategy should be called
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('some_json_translated_prolog(X).');
      expect(sessionForFallback.getKnowledgeGraph().prolog).toContain('some_json_translated_prolog(X).');
    });

    test('translateWithRetry throws if all attempts and fallbacks fail', async () => {
      const mcrForFailure = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
      const sessionForFailure = mcrForFailure.createSession({ maxTranslationAttempts: 1, retryDelay: 10 });
      
      directToProlog.mockImplementationOnce(() => { throw new Error('Direct failed miserably'); });
      jsonToProlog.mockImplementationOnce(() => { throw new Error('JSON failed miserably too'); });
      
      const report = await sessionForFailure.assert('Un-translatable input');
      
      expect(report.success).toBe(false);
      expect(report.error).toContain('JSON failed miserably too'); // Last error should be propagated
      expect(directToProlog).toHaveBeenCalledTimes(1);
      expect(jsonToProlog).toHaveBeenCalledTimes(1);
    });

    test('custom translator function is retried multiple times with feedback', async () => {
      const mockCustomTranslator = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockResolvedValueOnce('custom_success(data).'); // Succeeds on second attempt

      const mcrForCustom = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
      const sessionForCustom = mcrForCustom.createSession({ 
        translator: mockCustomTranslator, 
        maxTranslationAttempts: 2, 
        retryDelay: 10 
      });

      const report = await sessionForCustom.assert('Some input');

      expect(mockCustomTranslator).toHaveBeenCalledTimes(2); // Retried once
      expect(mockCustomTranslator).toHaveBeenNthCalledWith(1, expect.any(String), expect.anything(), expect.any(String), expect.any(Array), null);
      expect(mockCustomTranslator).toHaveBeenNthCalledWith(2, expect.any(String), expect.anything(), expect.any(String), expect.any(Array), expect.stringContaining('Previous attempt failed with error: Attempt 1 failed.'));
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('custom_success(data).');
    });
  });

  describe('Agentic Reasoning Robustness', () => {
    test('agenticReasoning retries if LLM returns invalid JSON', async () => {
      // agenticReasoning mock sequence for 'Invalid JSON test'
      const reasoning = await session.reason('Invalid JSON test');

      expect(agenticReasoning).toHaveBeenCalledTimes(2); // First failed, second succeeded after feedback
      // Check first call did not have feedback
      expect(agenticReasoning).toHaveBeenNthCalledWith(1,
        expect.any(String), expect.anything(), expect.any(String), expect.any(Array),
        expect.any(Array), '', 2, 500, true // Expecting full response
      );
      // Check second call received feedback about JSON error
      expect(agenticReasoning).toHaveBeenNthCalledWith(2,
        expect.any(String), expect.anything(), expect.any(String), expect.any(Array),
        expect.any(Array), expect.any(String), expect.stringContaining('The previous output was not valid JSON'), 2, 500, true // Expecting full response
      );
      expect(reasoning.answer).toBe('Agent fixed JSON output.');
      expect(reasoning.steps).toEqual([
        'Agent Action (1): Type: query, Content: Invalid JSON test', // Initial mock behavior
        'Agent Action (2): Type: conclude, Content: Agent fixed JSON output. (Explanation: Agent self-corrected JSON.)'
      ]);
      expect(reasoning.confidence).toBe(1.0);
    });
  });

  describe('LLM Usage Metrics', () => {
    test('session.getLlmMetrics returns correct usage data', async () => {
      const initialMetrics = session.getLlmMetrics();
      expect(initialMetrics).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        calls: 0,
        totalLatencyMs: 0
      });

      // Assert will call translateWithRetry -> directToProlog (1 call)
      await session.assert('Tweety is a bird');
      const metricsAfterAssert = session.getLlmMetrics();
      expect(metricsAfterAssert.calls).toBe(1);
      expect(metricsAfterAssert.totalTokens).toBe(15); // From mock
      expect(metricsAfterAssert.totalLatencyMs).toBeGreaterThan(0);

      // NQuery will call translateWithRetry -> directToProlog (1 call)
      // Then query calls LLM if fallback is true. Mock query does not call LLM directly.
      // The current directToProlog mock for 'Is tweety a bird?' returns 'bird(tweety).',
      // which is a fact, causing nquery to fail. Let's make it return a query.
      directToProlog.mockImplementationOnce(async (text, llmClient, model, ontologyTerms, feedback, returnFullResponse) => {
        const result = 'bird(tweety)'; // Returns a query (no dot)
        const mockOpenAIResponse = {
          choices: [{ message: { content: result } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };
        return returnFullResponse ? mockOpenAIResponse : result;
      });
      await session.nquery('Is tweety a bird?');
      const metricsAfterNQuery = session.getLlmMetrics();
      expect(metricsAfterNQuery.calls).toBe(2); // 1 from assert + 1 from nquery translation
      expect(metricsAfterNQuery.totalTokens).toBe(30); // 15 + 15

      // Reason will call agenticReasoning (2 calls from mock sequence)
      session.assertProlog('can_migrate(tweety).'); // Ensure the fact exists for the agent's query
      await session.reason('Can tweety migrate?');
      const metricsAfterReason = session.getLlmMetrics();
      expect(metricsAfterReason.calls).toBe(4); // 2 previous + 2 from reason's agentic calls
      expect(metricsAfterReason.totalTokens).toBe(60); // 30 + (2 * 15)

      // Test sub-symbolic fallback in query
      const querySession = mcr.createSession();
      // Force query to fail symbolically, triggering fallback
      querySession.prologSession.query = jest.fn((q) => {
        querySession.prologSession.answers = [false]; // No symbolic answer
        querySession.prologSession.onAnswer(false);
      });
      await querySession.query('some_unanswerable_query(X).', { allowSubSymbolicFallback: true });
      const metricsAfterFallback = querySession.getLlmMetrics();
      expect(metricsAfterFallback.calls).toBe(1); // One call for fallback
      expect(metricsAfterFallback.totalTokens).toBe(15); // Mock usage for fallback
    });

    test('MCR totalLlmUsage accumulates metrics from all sessions', async () => {
      const session1 = mcr.createSession();
      const session2 = mcr.createSession();

      // Session 1: 1 assert call
      await session1.assert('Tweety is a bird');
      expect(session1.getLlmMetrics().calls).toBe(1);
      expect(mcr.totalLlmUsage.calls).toBe(1);

      // Session 2: 1 assert call
      await session2.assert('All birds have wings');
      expect(session2.getLlmMetrics().calls).toBe(1);
      expect(mcr.totalLlmUsage.calls).toBe(2); // MCR total should be 2 now

      // Session 1: 1 nquery call (translates only)
      directToProlog.mockImplementationOnce(async (text, llmClient, model, ontologyTerms, feedback, returnFullResponse) => {
        const result = 'bird(tweety)'; // Returns a query (no dot)
        const mockOpenAIResponse = {
          choices: [{ message: { content: result } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };
        return returnFullResponse ? mockOpenAIResponse : result;
      });
      await session1.nquery('Is tweety a bird?');
      expect(session1.getLlmMetrics().calls).toBe(2);
      expect(mcr.totalLlmUsage.calls).toBe(3); // MCR total should be 3 now
      
      expect(mcr.totalLlmUsage.totalTokens).toBe(15 * 3); // 3 calls * 15 tokens/call
    });
  });

  describe('Session Ontology Management Methods', () => {
    test('addType adds a type to the ontology', () => {
      session.addType('animal');
      expect(session.ontology.types.has('animal')).toBe(true);
    });

    test('addRelationship adds a relationship to the ontology', () => {
      session.addRelationship('parent_of');
      expect(session.ontology.relationships.has('parent_of')).toBe(true);
    });

    test('addConstraint adds a constraint to the ontology', () => {
      session.addConstraint('unique_id');
      expect(session.ontology.constraints.has('unique_id')).toBe(true);
    });

    test('addSynonym adds a synonym to the ontology', () => {
      session.addSynonym('canary', 'yellow_bird');
      expect(session.ontology.synonyms['canary']).toBe('yellow_bird');
    });

    test('added ontology elements are used in validation', () => {
      session.addType('vehicle');
      expect(() => session.assertProlog('car(honda).')).not.toThrow();
      expect(session.getKnowledgeGraph().prolog).toContain('car(honda).');

      session.addRelationship('drives');
      expect(() => session.assertProlog('drives(john, car).')).not.toThrow();
      expect(session.getKnowledgeGraph().prolog).toContain('drives(john, car).');
    });
  });
});
