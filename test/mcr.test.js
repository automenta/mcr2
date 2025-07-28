const { MCR, Session } = require('../src/mcr');
const directToProlog = require('../src/translation/directToProlog');
const jsonToProlog = require('../src/translation/jsonToProlog');
const agenticReasoning = require('../src/translation/agenticReasoning'); // NEW MOCK IMPORT

jest.mock('../src/translation/directToProlog', () => jest.fn().mockImplementation(async (text, llmClient, model, ontologyTerms) => {
  if (text.includes('All birds have wings')) return 'has_wings(X) :- bird(X).';
  if (text.includes('Tweety is a bird')) return 'bird(tweety).';
  if (text.includes('Tweety is a canary')) return 'canary(tweety).';
  if (text.includes('have wings?')) return 'has_wings(tweety).';
  if (text === 'Is tweety a bird?') return 'bird(tweety).';
  if (text.includes('Tweety has color yellow')) return 'has_color(tweety, yellow).';
  if (text.includes('All canaries are birds')) return 'bird(X) :- canary(X).'; // Added for specific test
  if (text.includes('Does tweety fly?')) return 'flies(tweety).';
  if (text.includes('Can tweety migrate?')) return 'can_migrate(tweety).';
  return '';
}));

// Mock agenticReasoning for specific reasoning flows
jest.mock('../src/translation/agenticReasoning', () => jest.fn().mockImplementation(async (taskDescription, llmClient, model, sessionProgram, ontologyTerms, previousSteps, accumulatedBindings) => {
  // Simple mock: if task includes 'migrate', simulate a query then a conclusion
  if (taskDescription.includes('Can tweety migrate?')) {
    if (previousSteps.length === 0) {
      return { type: 'query', content: 'can_migrate(tweety).' };
    } else if (accumulatedBindings.includes('true')) {
      return { type: 'conclude', answer: 'Yes, Tweety can migrate.', explanation: 'Derived from previous queries.' };
    }
  }
  // Another example: if task is 'prove bird(X) from canary(X)'
  if (taskDescription.includes('prove bird(X) from canary(X)')) {
    if (previousSteps.length === 0) {
      return { type: 'query', content: 'canary(X).' };
    } else if (accumulatedBindings.includes('X = tweety') && sessionProgram.includes('bird(X) :- canary(X).')) {
      return { type: 'query', content: 'bird(tweety).' };
    } else if (accumulatedBindings.includes('true')) {
        return { type: 'conclude', answer: 'Yes, Tweety is a bird.', explanation: 'Based on rule and fact.'};
    }
  }
  return { type: 'conclude', answer: 'Inconclusive from mock agent.', explanation: '' };
}));


describe('MCR', () => {
  test('instantiates with config', () => {
    const config = { llm: { provider: 'openai', apiKey: 'test-key' } };
    const mcr = new MCR(config);
    expect(mcr.config).toEqual(config);
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
    const reasoning = await session.reason('Can tweety migrate?');
    
    expect(agenticReasoning).toHaveBeenCalledTimes(2); // First for query, second for conclusion
    expect(reasoning.answer).toBe('Yes, Tweety can migrate.');
    expect(reasoning.steps).toEqual([
      'Agent Action (1): Type: query, Content: can_migrate(tweety).',
      'Query Result: Success: true, Bindings: true, Confidence: 1', // Assuming mock for has_wings returns true
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
    expect(customTranslator).toHaveBeenCalled();
    expect(session.getKnowledgeGraph().prolog).toContain('custom(tweety).');
  });

  test('uses custom logger', async () => {
    const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const mcr = new MCR({});
    const session = mcr.createSession({ logger: mockLogger });
    
    directToProlog.mockRejectedValueOnce(new Error('forced error')); // Make assert fail
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
    test('directToProlog falls back to jsonToProlog after max attempts', async () => {
      // Setup the session for default direct/json fallback
      const mcrForFallback = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
      const sessionForFallback = mcrForFallback.createSession({ maxTranslationAttempts: 1, retryDelay: 10 });
      
      // Force directToProlog to fail
      directToProlog.mockImplementationOnce(() => { throw new Error('Direct failed'); });
      // Force jsonToProlog to succeed after direct fails
      jsonToProlog.mockImplementationOnce(async () => 'some_json_translated_prolog(X).');
      
      const report = await sessionForFallback.assert('Complex natural language input');
      
      expect(directToProlog).toHaveBeenCalledTimes(1); // Only one attempt for direct strategy
      expect(jsonToProlog).toHaveBeenCalledTimes(1); // json strategy should be called
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('some_json_translated_prolog(X).');
      expect(sessionForFallback.getKnowledgeGraph().prolog).toContain('some_json_translated_prolog(X).');
    });

    test('custom translator function is retried multiple times', async () => {
      const mockCustomTranslator = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockResolvedValueOnce('custom_success(data).');

      const mcrForCustom = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
      const sessionForCustom = mcrForCustom.createSession({ 
        translator: mockCustomTranslator, 
        maxTranslationAttempts: 2, 
        retryDelay: 10 
      });

      const report = await sessionForCustom.assert('Some input');

      expect(mockCustomTranslator).toHaveBeenCalledTimes(2); // Retried once
      expect(report.success).toBe(true);
      expect(report.symbolicRepresentation).toBe('custom_success(data).');
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
  });
});
