const { MCR, Session } = require('../src/mcr');
const directToProlog = require('../src/translation/directToProlog');
const jsonToProlog = require('../src/translation/jsonToProlog');
const agenticReasoning = require('../src/translation/agenticReasoning');

// Mock the translation modules
jest.mock('../src/translation/directToProlog');
jest.mock('../src/translation/jsonToProlog');
jest.mock('../src/translation/agenticReasoning');

// Helper to mock a successful translation response
const mockTranslation = (result) => {
    return new Promise(resolve => setTimeout(() => resolve({
        choices: [{ message: { content: result } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }), 10));
};

// Helper to mock an agentic reasoning step response
const mockAgenticStep = (action) => ({
  ...action,
  response: {
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
  }
});


describe('MCR', () => {
  test('instantiates with config and OpenAI API key', () => {
    const config = { llm: { provider: 'openai', apiKey: 'test-key' } };
    const mcr = new MCR(config);
    expect(mcr.config).toEqual(config);
    expect(mcr.llmClient).toBeDefined(); // Should have an OpenAI client
    expect(mcr.getLlmMetrics()).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      calls: 0,
      totalLatencyMs: 0
    });
  });

  test('instantiates with custom LLM client', () => {
    const mockLlmClient = { chat: { completions: { create: jest.fn() } } };
    const config = { llm: { client: mockLlmClient } };
    const mcr = new MCR(config);
    expect(mcr.llmClient).toBe(mockLlmClient);
  });

  test('instantiates without LLM client if no config provided', () => {
    const mcr = new MCR({});
    expect(mcr.llmClient).toBeNull();
  });

  test('throws error for unsupported LLM provider', () => {
    const config = { llm: { provider: 'unsupported-provider', apiKey: 'test-key' } };
    expect(() => new MCR(config)).toThrow("Unsupported LLM provider: unsupported-provider. Please provide an 'llm.client' instance for custom providers.");
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

  // NEW TEST: MCR.getLlmMetrics
  test('getLlmMetrics returns global usage data', async () => {
    const mcrWithLLM = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
    const session1 = mcrWithLLM.createSession();
    const session2 = mcrWithLLM.createSession();

    // Mock the translation for two separate assert calls
    directToProlog
      .mockResolvedValueOnce(mockTranslation('bird(tweety).'))
      .mockResolvedValueOnce(mockTranslation('has_wings(X) :- bird(X).'));

    await session1.assert('Tweety is a bird');
    await session2.assert('All birds have wings');

    const globalMetrics = mcrWithLLM.getLlmMetrics();
    expect(globalMetrics.calls).toBe(2);
    expect(globalMetrics.totalTokens).toBe(30); // 2 calls * 15 tokens/call
    expect(globalMetrics.totalLatencyMs).toBeGreaterThan(0);
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

  // No longer need afterEach with jest.restoreAllMocks() as it's handled by Jest config,
  // but clearing the session manually is still good practice.
  afterEach(() => {
    if (session) {
      session.clear();
    }
  });

  describe('Prolog Syntax Validation (`_isValidPrologSyntax`)', () => {
    test('identifies valid Prolog fact', () => {
      expect(session._isValidPrologSyntax('bird(tweety).')).toBe(true);
    });

    test('identifies valid Prolog rule', () => {
      expect(session._isValidPrologSyntax('flies(X) :- bird(X).')).toBe(true);
    });

    test('identifies valid Prolog query', () => {
      expect(session._isValidPrologSyntax('bird(X)')).toBe(true);
    });

    test('identifies valid Prolog query with multiple clauses', () => {
      expect(session._isValidPrologSyntax('person(X), age(X, Y)')).toBe(true);
    });

    test('identifies invalid Prolog (malformed fact)', () => {
      expect(session._isValidPrologSyntax('bird(tweety')).toBe(false);
    });

    test('identifies invalid Prolog (malformed rule)', () => {
      expect(session._isValidPrologSyntax('flies(X) :- bird(X')).toBe(false);
    });

    test('identifies invalid Prolog (malformed query)', () => { // Corrected typo: _isValidPologSyntax to _isValidPrologSyntax
      expect(session._isValidPrologSyntax('bird(X')).toBe(false);
    });

    test('identifies empty string as invalid', () => {
      expect(session._isValidPrologSyntax('')).toBe(false);
    });

    test('identifies non-string as invalid', () => {
      expect(session._isValidPrologSyntax(123)).toBe(false);
      expect(session._isValidPrologSyntax(null)).toBe(false);
    });
  });

  // Test for new assertProlog method
  test('assertProlog directly adds a Prolog clause and consults it', async () => {
    const result = session.assertProlog('mammal(dog).');
    expect(result.success).toBe(true);
    expect(result.symbolicRepresentation).toBe('mammal(dog).');
    expect(session.getKnowledgeGraph('prolog')).toContain('mammal(dog).');

    const queryResult = await session.query('mammal(X).');
    expect(queryResult.success).toBe(true);
    expect(queryResult.bindings).toContain('X = dog');
  });

  test('assertProlog returns error report for invalid Prolog clause', () => {
    const result = session.assertProlog('invalid_clause');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid Prolog clause');
    expect(result.symbolicRepresentation).toBe('invalid_clause');
    expect(session.getKnowledgeGraph('prolog')).toBe('');
  });

  test('assertProlog returns error report if validation against ontology fails', () => {
    const ontologySession = mcr.createSession({
      ontology: { types: ['person'] }
    });
    const result = ontologySession.assertProlog('animal(cat).');
    expect(result.success).toBe(false);
    expect(result.error).toContain("Predicate 'animal' not in ontology.");
  });

  // Test for new retractProlog method
  test('retractProlog removes a Prolog clause', async () => {
    session.assertProlog('bird(tweety).');
    expect(session.getKnowledgeGraph('prolog')).toContain('bird(tweety).');

    const retractResult = session.retractProlog('bird(tweety).');
    expect(retractResult.success).toBe(true);
    expect(session.getKnowledgeGraph('prolog')).not.toContain('bird(tweety).');

    const queryResult = await session.query('bird(X).');
    expect(queryResult.success).toBe(false);
  });

  test('retractProlog returns false if clause not found', () => {
    session.assertProlog('bird(tweety).');
    const retractResult = session.retractProlog('mammal(dog).');
    expect(retractResult.success).toBe(false);
    expect(session.getKnowledgeGraph('prolog')).toContain('bird(tweety).'); // Should not change
  });

  // NEW TESTS for removeFact and removeRelationship
  test('removeFact removes a type fact from the knowledge graph', async () => {
    session.assertProlog('mammal(cat).');
    expect(session.getKnowledgeGraph('prolog')).toContain('mammal(cat).');

    const removeResult = session.removeFact('cat', 'mammal');
    expect(removeResult.success).toBe(true);
    expect(removeResult.message).toBe('Clause "mammal(cat)." retracted.');
    expect(session.getKnowledgeGraph('prolog')).not.toContain('mammal(cat).');
  });

  test('removeRelationship removes a relationship fact from the knowledge graph', async () => {
    session.assertProlog('parent(john, mary).');
    expect(session.getKnowledgeGraph('prolog')).toContain('parent(john, mary).');

    const removeResult = session.removeRelationship('john', 'parent', 'mary');
    expect(removeResult.success).toBe(true);
    expect(removeResult.message).toBe('Clause "parent(john, mary)." retracted.');
    expect(session.getKnowledgeGraph('prolog')).not.toContain('parent(john, mary).');
  });

  test('removeFact returns false if the fact does not exist', () => {
    session.assertProlog('bird(tweety).');
    const removeResult = session.removeFact('dog', 'mammal');
    expect(removeResult.success).toBe(false);
    expect(removeResult.message).toBe('Clause "mammal(dog)." not found.');
    expect(session.getKnowledgeGraph('prolog')).toContain('bird(tweety).'); // KB unchanged
  });

  test('removeRelationship returns false if the relationship does not exist', () => {
    session.assertProlog('likes(alice, bob).');
    const removeResult = session.removeRelationship('charlie', 'hates', 'david');
    expect(removeResult.success).toBe(false);
    expect(removeResult.message).toBe('Clause "hates(charlie, david)." not found.');
    expect(session.getKnowledgeGraph('prolog')).toContain('likes(alice, bob).'); // KB unchanged
  });

  // Test for modified assert (now uses assertProlog)
  test('assert translates and stores natural language using assertProlog', async () => {
    const assertPrologSpy = jest.spyOn(session, 'assertProlog');
    directToProlog.mockResolvedValueOnce(mockTranslation('bird(tweety).'));
    const report = await session.assert('Tweety is a bird');

    expect(directToProlog).toHaveBeenCalledWith(
      'Tweety is a bird',
      expect.anything(),
      expect.any(String),
      expect.any(Array),
      null, // Initial call, no feedback
      true // Expecting full response
    );
    expect(assertPrologSpy).toHaveBeenCalledWith('bird(tweety).');
    expect(report.success).toBe(true);
    expect(report.symbolicRepresentation).toBe('bird(tweety).');
    expect(session.getKnowledgeGraph('prolog')).toContain('bird(tweety).');
    assertPrologSpy.mockRestore();
  });

  test('assert returns failure report if translation results in query', async () => {
    directToProlog.mockResolvedValueOnce(mockTranslation('bird(tweety)')); // Mock returns a query, not a fact/rule
    const report = await session.assert('Is Tweety a bird?');
    expect(report.success).toBe(false);
    expect(report.error).toContain('Translation resulted in a query or invalid clause for assertion. Must be a fact or rule ending with a dot.');
    expect(report.symbolicRepresentation).toBe('bird(tweety)');
  });

  test('assert returns failure report if assertProlog fails (e.g., ontology violation)', async () => {
    const ontologySession = mcr.createSession({
      ontology: { types: ['bird'] }
    });
    directToProlog.mockResolvedValueOnce(mockTranslation('fish(nemo).')); // Valid Prolog, but violates ontology
    const report = await ontologySession.assert('Nemo is a fish');
    expect(report.success).toBe(false);
    expect(report.error).toContain("Predicate 'fish' not in ontology.");
    expect(report.symbolicRepresentation).toBe('fish(nemo).');
  });

  // Test for modified addFact (now uses assertProlog directly)
  test('addFact directly adds a fact bypassing LLM translation', async () => {
    const assertPrologSpy = jest.spyOn(session, 'assertProlog');
    const report = await session.addFact('tweety', 'bird');
    expect(assertPrologSpy).toHaveBeenCalledWith('bird(tweety).');
    expect(report.success).toBe(true);
    expect(report.symbolicRepresentation).toBe('bird(tweety).');
    expect(session.getKnowledgeGraph('prolog')).toContain('bird(tweety).');
    expect(directToProlog).not.toHaveBeenCalled(); // Crucial: ensures LLM is bypassed
    assertPrologSpy.mockRestore();
  });

  // Test for modified addRelationship (now uses assertProlog directly)
  test('addRelationship directly adds a relationship bypassing LLM translation', async () => {
    const assertPrologSpy = jest.spyOn(session, 'assertProlog');
    const report = await session.addRelationship('john', 'loves', 'mary');
    expect(assertPrologSpy).toHaveBeenCalledWith('loves(john, mary).');
    expect(report.success).toBe(true);
    expect(report.symbolicRepresentation).toBe('loves(john, mary).');
    expect(session.getKnowledgeGraph('prolog')).toContain('loves(john, mary).');
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
    directToProlog
      .mockResolvedValueOnce(mockTranslation('bird(tweety).'))
      .mockResolvedValueOnce(mockTranslation('canary(tweety).'));

    await session.assert('tweety is a bird');
    await session.assert('tweety is a canary');

    const kg = session.getKnowledgeGraph('prolog');
    expect(kg).toContain('bird(tweety).');
    expect(kg).toContain('canary(tweety).');
  });

  test('getKnowledgeGraph returns object with prolog string', () => {
    const kgString = session.getKnowledgeGraph('prolog');
    expect(typeof kgString).toBe('string');
    
    const kgJson = session.getKnowledgeGraph('json');
    expect(typeof kgJson).toBe('object');
    expect(kgJson).toHaveProperty('facts');
    expect(kgJson).toHaveProperty('rules');
  });
  
  test('nquery translates natural language and executes query', async () => {
    session.assertProlog('bird(tweety).');
    directToProlog.mockResolvedValueOnce(mockTranslation('bird(tweety)'));
    const result = await session.nquery('Is tweety a bird?');
    expect(result.success).toBe(true);
    expect(result.bindings).toContain('true'); // Prolog 'true'
    expect(result.prologQuery).toBe('bird(tweety)');
  });

  // Test for refactored reason method (agentic loop)
  test('reason uses agentic strategy for multi-step reasoning', async () => {
    session.assertProlog('bird(X) :- canary(X).'); // Add rule
    session.assertProlog('canary(tweety).'); // Add fact
    session.assertProlog('can_migrate(tweety).'); // Add fact directly to KB

    agenticReasoning
      .mockResolvedValueOnce(mockAgenticStep({ type: 'query', content: 'can_migrate(tweety)' }))
      .mockResolvedValueOnce(mockAgenticStep({ type: 'conclude', answer: 'Yes, Tweety can migrate.', explanation: 'Derived from previous queries.' }));

    const reasoning = await session.reason('Can tweety migrate?');
    
    expect(agenticReasoning).toHaveBeenCalledTimes(2);
    expect(agenticReasoning).toHaveBeenCalledWith(
        expect.any(String), expect.anything(), expect.any(String), expect.any(Array), 
        expect.any(Array), expect.any(Array), '', 2, 500, true
    );
    
    expect(reasoning.answer).toBe('Yes, Tweety can migrate.');
    expect(reasoning.steps).toEqual([
      'Agent Action (1): Type: query, Content: can_migrate(tweety)',
      'Query Result: Success: true, Bindings: true, Confidence: 1',
      'Agent Action (2): Type: conclude, Content: Yes, Tweety can migrate.',
    ]);
    expect(reasoning.confidence).toBe(1.0);
    const metrics = session.getLlmMetrics();
    expect(metrics.calls).toBe(2);
    expect(metrics.totalTokens).toBe(30);
  });

  test('reason handles assertion steps from agent', async () => {
    agenticReasoning
      .mockResolvedValueOnce(mockAgenticStep({ type: 'assert', content: 'new_fact(test).' }))
      .mockResolvedValueOnce(mockAgenticStep({ type: 'conclude', answer: 'New fact asserted.', explanation: 'Agent completed assertion.' }));

    const reasoning = await session.reason('Add a new fact');
    expect(reasoning.answer).toBe('New fact asserted.');
    expect(session.getKnowledgeGraph('prolog')).toContain('new_fact(test).');
    expect(reasoning.steps[0]).toContain('Agent Action (1): Type: assert, Content: new_fact(test).');
    expect(reasoning.steps[1]).toContain('Assertion Result: Success: true, Clause: new_fact(test).');
  });

  test('reason returns inconclusive if max steps reached without a conclusion', async () => {
    agenticReasoning.mockResolvedValue(mockAgenticStep({ type: 'query', content: 'some_query(X)' }));

    const reasoning = await session.reason('Reasoning max steps test', { maxSteps: 5 });

    expect(agenticReasoning).toHaveBeenCalledTimes(5);
    expect(reasoning.answer).toBe('Inconclusive');
    expect(reasoning.confidence).toBe(0.3);
    expect(reasoning.steps.length).toBe(11); // 5 agent actions + 5 query results + 1 final message
    expect(reasoning.steps[reasoning.steps.length - 1]).toContain('Reached maximum steps (5) without conclusion.');
  });

  test('reason handles a sequence of assert and query actions', async () => {
    agenticReasoning
      .mockResolvedValueOnce(mockAgenticStep({ type: 'assert', content: 'animal(cat).' }))
      .mockResolvedValueOnce(mockAgenticStep({ type: 'query', content: 'animal(X)' }))
      .mockResolvedValueOnce(mockAgenticStep({ type: 'conclude', answer: 'The animal is a cat.' }));

    const reasoning = await session.reason('Assert a cat and find out what animal it is');

    expect(agenticReasoning).toHaveBeenCalledTimes(3);
    expect(reasoning.answer).toBe('The animal is a cat.');
    expect(session.getKnowledgeGraph('prolog')).toContain('animal(cat).');
    expect(reasoning.steps[0]).toContain('Agent Action (1): Type: assert, Content: animal(cat).');
    expect(reasoning.steps[1]).toContain('Assertion Result: Success: true');
    expect(reasoning.steps[2]).toContain('Agent Action (2): Type: query, Content: animal(X)');
    expect(reasoning.steps[3]).toContain('Query Result: Success: true, Bindings: X = cat');
  });

  test('reason stops if agent returns an invalid action type', async () => {
    const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    session.logger = mockLogger;

    agenticReasoning.mockResolvedValueOnce(mockAgenticStep({ type: 'invalid_action', content: '...'}));

    const reasoning = await session.reason('Test invalid action');

    expect(agenticReasoning).toHaveBeenCalledTimes(1);
    expect(reasoning.answer).toBe('Reasoning error');
    expect(reasoning.steps[0]).toContain('Error:');
    expect(mockLogger.error).toHaveBeenCalledWith('Reasoning error:', expect.any(Error));
  });

  test('reason fails gracefully if agentic strategy throws an error', async () => {
    agenticReasoning.mockRejectedValue(new Error('LLM connection failed'));

    const reasoning = await session.reason('Test agent failure');

    expect(reasoning.answer).toBe('Reasoning error');
    expect(reasoning.steps[0]).toContain('Error: LLM connection failed');
  });

  test('assert rejects fact not in ontology', async () => {
    const ontologySession = mcr.createSession({
      ontology: {
        types: ['bird'],
        relationships: ['has_wings']
      }
    });
    
    directToProlog.mockResolvedValueOnce(mockTranslation('fish(nemo).'));
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
    
    directToProlog.mockResolvedValueOnce(mockTranslation('swim(X) :- fish(X).'));
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
    
    let result = await ontologySession.query('bird(X).');
    expect(result.success).toBe(true);

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
    expect(session.getKnowledgeGraph('prolog')).toContain('custom(tweety).');
  });

  test('uses custom logger', async () => {
    const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const session = mcr.createSession({ logger: mockLogger });
    
    directToProlog.mockRejectedValueOnce(new Error('forced translation error'));
    jsonToProlog.mockRejectedValueOnce(new Error('forced json error'));
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
      expect(newSession.getKnowledgeGraph('prolog')).toContain('bird(tweety).');
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

      expect(sessionWithOptions.getKnowledgeGraph('prolog')).toContain('bird(tweety).');
      expect(sessionWithOptions.getKnowledgeGraph('prolog')).not.toContain('fish(nemo).');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load clause "fish(nemo)." from state due to ontology violation'));
    });

    test('clear session', async () => {
      directToProlog.mockResolvedValueOnce(mockTranslation('bird(tweety).'));
      await session.assert('Tweety is a bird');
      session.clear();
      expect(session.getKnowledgeGraph('prolog')).toBe('');
      // Ensure ontology is reset if provided in options
      const sessionWithOntology = mcr.createSession({ ontology: { types: ['test'] } });
      expect(Array.from(sessionWithOntology.ontology.types)).toContain('test');
      sessionWithOntology.clear();
      expect(Array.from(sessionWithOntology.ontology.types)).toContain('test'); // Should reset to initial provided ontology
    });

    test('reload ontology revalidates existing program', async () => {
      const initialOntology = {
        types: ['animal'],
        relationships: []
      };
      const sessionWithReload = mcr.createSession({ ontology: initialOntology });
      sessionWithReload.assertProlog('animal(cat).');
      sessionWithReload.assertProlog('animal(dog).');
      expect(sessionWithReload.program).toEqual(['animal(cat).', 'animal(dog).']);

      const newOntology = {
        types: ['mammal'], // 'animal' is no longer a valid type
        relationships: []
      };
      const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
      sessionWithReload.logger = mockLogger;

      sessionWithReload.reloadOntology(newOntology);

      expect(sessionWithReload.program).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Ontology reload caused validation errors'),
        expect.any(Error)
      );
      expect(Array.from(sessionWithReload.ontology.types)).toEqual(['mammal']);
    });
  });

  describe('Translation Self-Correction and Fallback', () => {
    test('directToProlog attempts self-correction if initial output is invalid Prolog', async () => {
      const sessionForSelfCorrection = mcr.createSession({
        maxTranslationAttempts: 2,
        retryDelay: 10 
      });

      directToProlog
        .mockResolvedValueOnce(mockTranslation('malformed prolog response')) // Invalid
        .mockResolvedValueOnce(mockTranslation('valid_prolog(X).')); // Valid

      const report = await sessionForSelfCorrection.assert('Some complex input');
      
      expect(directToProlog).toHaveBeenCalledTimes(2);
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('valid_prolog(X).');
      expect(sessionForSelfCorrection.getKnowledgeGraph('prolog')).toContain('valid_prolog(X).');
    });

    test('directToProlog falls back to jsonToProlog after max self-correction attempts', async () => {
      const sessionForFallback = mcr.createSession({
        maxTranslationAttempts: 1,
        retryDelay: 10 
      });
      
      directToProlog.mockResolvedValueOnce(mockTranslation('invalid_direct_prolog'));
      jsonToProlog.mockResolvedValueOnce(mockTranslation('some_json_translated_prolog(X).'));
      
      const report = await sessionForFallback.assert('Complex natural language input');
      
      expect(directToProlog).toHaveBeenCalledTimes(1);
      expect(jsonToProlog).toHaveBeenCalledTimes(1);
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('some_json_translated_prolog(X).');
      expect(sessionForFallback.getKnowledgeGraph('prolog')).toContain('some_json_translated_prolog(X).');
    });

    test('translateWithRetry throws if all attempts and fallbacks fail', async () => {
      const sessionForFailure = mcr.createSession({ maxTranslationAttempts: 1, retryDelay: 10 });
      
      directToProlog.mockRejectedValue(new Error('Direct failed miserably'));
      jsonToProlog.mockRejectedValue(new Error('JSON failed miserably too'));
      
      const report = await sessionForFailure.assert('Un-translatable input');
      
      expect(report.success).toBe(false);
      expect(report.error).toContain('JSON failed miserably too');
      expect(directToProlog).toHaveBeenCalledTimes(1);
      expect(jsonToProlog).toHaveBeenCalledTimes(1);
    });

    test('session uses array of strategies in specified order', async () => {
      const sessionForStrategyOrder = mcr.createSession({
        translator: ['json', 'direct'],
        maxTranslationAttempts: 1, 
        retryDelay: 10 
      });

      jsonToProlog.mockRejectedValueOnce(new Error('JSON failed, try direct'));
      directToProlog.mockResolvedValueOnce(mockTranslation('direct_success(data).'));

      const report = await sessionForStrategyOrder.assert('Another complex input');
      
      expect(jsonToProlog).toHaveBeenCalledTimes(1);
      expect(directToProlog).toHaveBeenCalledTimes(1);
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('direct_success(data).');
      expect(sessionForStrategyOrder.getKnowledgeGraph('prolog')).toContain('direct_success(data).');
    });

    test('session uses single strategy from array without fallback if successful', async () => {
      const sessionForSingleStrategy = mcr.createSession({
        translator: ['json', 'direct'],
        maxTranslationAttempts: 1, 
        retryDelay: 10 
      });

      jsonToProlog.mockResolvedValueOnce(mockTranslation('json_only_success(data).'));

      const report = await sessionForSingleStrategy.assert('Yet another input');
      
      expect(jsonToProlog).toHaveBeenCalledTimes(1);
      expect(directToProlog).not.toHaveBeenCalled();
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('json_only_success(data).');
      expect(sessionForSingleStrategy.getKnowledgeGraph('prolog')).toContain('json_only_success(data).');
    });

    test('translateWithRetry throws if all strategies in array fail', async () => {
      const sessionForAllFail = mcr.createSession({
        translator: ['json', 'direct'], 
        maxTranslationAttempts: 1, 
        retryDelay: 10 
      });
      
      jsonToProlog.mockRejectedValue(new Error('JSON strategy failed'));
      directToProlog.mockRejectedValue(new Error('Direct strategy failed'));
      
      const report = await sessionForAllFail.assert('Completely untranslatable input');
      
      expect(report.success).toBe(false);
      expect(report.error).toContain('Direct strategy failed');
      expect(jsonToProlog).toHaveBeenCalledTimes(1);
      expect(directToProlog).toHaveBeenCalledTimes(1);
    });

    test('custom translator function is retried multiple times with feedback', async () => {
      const mockCustomTranslator = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockResolvedValueOnce('custom_success(data).');

      const sessionForCustom = mcr.createSession({
        translator: mockCustomTranslator, 
        maxTranslationAttempts: 2, 
        retryDelay: 10 
      });

      const report = await sessionForCustom.assert('Some input');

      expect(mockCustomTranslator).toHaveBeenCalledTimes(2);
      expect(mockCustomTranslator).toHaveBeenNthCalledWith(1, expect.any(String), expect.anything(), expect.any(String), expect.any(Array), null);
      expect(mockCustomTranslator).toHaveBeenNthCalledWith(2, expect.any(String), expect.anything(), expect.any(String), expect.any(Array), expect.stringContaining('Previous attempt failed with error: Attempt 1 failed.'));
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('custom_success(data).');
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

      directToProlog.mockResolvedValue(mockTranslation('...')); // Generic mock for all calls
      await session.assert('Tweety is a bird');
      const metricsAfterAssert = session.getLlmMetrics();
      expect(metricsAfterAssert.calls).toBe(1);
      expect(metricsAfterAssert.totalTokens).toBe(15);
      expect(metricsAfterAssert.totalLatencyMs).toBeGreaterThan(0);

      await session.nquery('Is tweety a bird?');
      const metricsAfterNQuery = session.getLlmMetrics();
      expect(metricsAfterNQuery.calls).toBe(2);
      expect(metricsAfterNQuery.totalTokens).toBe(30);

      session.assertProlog('can_migrate(tweety).');
      agenticReasoning
        .mockResolvedValueOnce(mockAgenticStep({ type: 'query', content: 'can_migrate(tweety)' }))
        .mockResolvedValueOnce(mockAgenticStep({ type: 'conclude', answer: 'Yes' }));
      await session.reason('Can tweety migrate?');
      const metricsAfterReason = session.getLlmMetrics();
      expect(metricsAfterReason.calls).toBe(4); // 2 previous + 2 from reason
      expect(metricsAfterReason.totalTokens).toBe(60); // 30 + (2 * 15)

      const querySession = mcr.createSession();
      querySession.prologSession.query = jest.fn((q) => {
        querySession.prologSession.answers = [false];
        querySession.prologSession.onAnswer(false);
      });
      // Mock the LLM client directly for the fallback
      mcr.llmClient.chat.completions.create = jest.fn().mockResolvedValue(mockTranslation('LLM fallback answer'));
      await querySession.query('some_unanswerable_query(X).', { allowSubSymbolicFallback: true });
      const metricsAfterFallback = querySession.getLlmMetrics();
      expect(metricsAfterFallback.calls).toBe(1);
      expect(metricsAfterFallback.totalTokens).toBe(15);
    });

    test('MCR totalLlmUsage accumulates metrics from all sessions', async () => {
      const session1 = mcr.createSession();
      const session2 = mcr.createSession();

      directToProlog.mockResolvedValue(mockTranslation('...'));

      await session1.assert('Tweety is a bird');
      expect(session1.getLlmMetrics().calls).toBe(1);
      expect(mcr.getLlmMetrics().calls).toBe(1);

      await session2.assert('All birds have wings');
      expect(session2.getLlmMetrics().calls).toBe(1);
      expect(mcr.getLlmMetrics().calls).toBe(2);

      await session1.nquery('Is tweety a bird?');
      expect(session1.getLlmMetrics().calls).toBe(2);
      expect(mcr.getLlmMetrics().calls).toBe(3);
      
      expect(mcr.getLlmMetrics().totalTokens).toBe(15 * 3);
    });
  });

  describe('Session Ontology Management Methods', () => {
    test('addType adds a type to the ontology', () => {
      session.addType('animal');
      expect(session.ontology.types.has('animal')).toBe(true);
    });

    test('defineRelationshipType adds a relationship type to the ontology', () => {
      session.defineRelationshipType('parent_of');
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
      expect(() => session.assertProlog('vehicle(honda).')).not.toThrow();

      session.defineRelationshipType('drives');
      expect(() => session.assertProlog('drives(john, honda).')).not.toThrow();
    });

    test('getOntology returns the current ontology state', () => {
      session.addType('person');
      session.defineRelationshipType('likes');
      session.addSynonym('human', 'person');

      const ontology = session.getOntology();

      expect(ontology).toEqual({
        types: ['person'],
        relationships: ['likes'],
        constraints: [],
        synonyms: { human: 'person' }
      });
    });
  });

  describe('Rule Management Methods', () => {
    test('addRule adds a Prolog rule to the knowledge graph', async () => {
      const rule = 'flies(X) :- bird(X).';
      const result = session.addRule(rule);
      expect(result.success).toBe(true);
      expect(result.symbolicRepresentation).toBe(rule);
      expect(session.getKnowledgeGraph('prolog')).toContain(rule);

      session.assertProlog('bird(tweety).');
      const queryResult = await session.query('flies(tweety).');
      expect(queryResult.success).toBe(true);
      expect(queryResult.bindings).toContain('true');
    });

    test('addRule returns error report for invalid rule format', () => {
      const result = session.addRule('invalid_rule');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Prolog rule. Must be a string ending with a dot and containing ":-".');
      expect(session.getKnowledgeGraph('prolog')).toBe('');
    });

    test('addRule returns error report if validation against ontology fails', () => {
      const ontologySession = mcr.createSession({
        ontology: { types: ['person'] }
      });
      const rule = 'flies(X) :- bird(X).';
      const result = ontologySession.addRule(rule);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Predicate 'flies' not defined in ontology.");
    });

    test('removeRule removes a specific Prolog rule', async () => {
      session.addRule('flies(X) :- bird(X).');
      session.assertProlog('bird(tweety).');
      expect(session.getKnowledgeGraph('prolog')).toContain('flies(X) :- bird(X).');
      
      const queryBeforeRetract = await session.query('flies(tweety).');
      expect(queryBeforeRetract.success).toBe(true);

      const removeResult = session.removeRule('flies(X) :- bird(X).');
      expect(removeResult.success).toBe(true);
      expect(removeResult.message).toBe('Clause "flies(X) :- bird(X)." retracted.');
      expect(session.getKnowledgeGraph('prolog')).not.toContain('flies(X) :- bird(X).');

      const queryAfterRetract = await session.query('flies(tweety).');
      expect(queryAfterRetract.success).toBe(false);
    });

    test('removeRule returns false if rule not found', () => {
      session.addRule('flies(X) :- bird(X).');
      const removeResult = session.removeRule('walks(X) :- mammal(X).');
      expect(removeResult.success).toBe(false);
      expect(removeResult.message).toBe('Clause "walks(X) :- mammal(X)." not found.');
      expect(session.getKnowledgeGraph('prolog')).toContain('flies(X) :- bird(X).');
    });

    test('removeRule returns error for invalid rule format', () => {
      session.addRule('flies(X) :- bird(X).');
      const result = session.removeRule('invalid_rule_format');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid Prolog rule format for removal.');
      expect(session.getKnowledgeGraph('prolog')).toContain('flies(X) :- bird(X).');
    });
  });
});
