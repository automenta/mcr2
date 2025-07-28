const { MCR, Session } = require('../src/mcr');

jest.mock('../src/translation/directToProlog', () => jest.fn().mockImplementation(async (text, llmClient, model, ontologyTerms) => {
  if (text.includes('All birds have wings')) return 'has_wings(X) :- bird(X).';
  if (text.includes('Tweety is a bird')) return 'bird(tweety).';
  if (text.includes('Tweety is a canary')) return 'canary(tweety).';
  if (text.includes('have wings?')) return 'has_wings(tweety).';
  if (text === 'Is tweety a bird?') return 'bird(tweety).';
  if (text.includes('Tweety has color yellow')) return 'has_color(tweety, yellow).';
  return '';
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
});

describe('Session', () => {
  let session;
  let mcr;

  beforeEach(() => {
    mcr = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
    session = mcr.createSession();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (session) {
      session.clear();
    }
    session = null;
  });

  test('assert translates and stores natural language', async () => {
    const report = await session.assert('Tweety is a bird');
    expect(report.symbolicRepresentation).toBe('bird(tweety).');
    expect(session.getKnowledgeGraph().prolog).toContain('bird(tweety).');
  });

  test('query returns bindings and explanation for valid query', async () => {
    await session.assert('Tweety is a bird');
    const result = await session.query('bird(X).');
    expect(result.success).toBe(true);
    expect(result.bindings).toContain('X = tweety');
    expect(result.explanation).toEqual(['bird(X).']);
  });

  test('query returns no bindings for invalid query', async () => {
    await session.assert('Tweety is a bird');
    const result = await session.query('fish(X).');
    expect(result.success).toBe(false);
    expect(result.bindings).toBeNull();
  });

  test('multiple asserts build knowledge graph', async () => {
    await session.assert('Tweety is a bird');
    await session.assert('Tweety is a canary');
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
    await session.assert('Tweety is a bird');
    const result = await session.nquery('Is tweety a bird?');
    expect(result.success).toBe(true);
    expect(result.bindings).toBe('true');
  });

  test('reason returns explanation steps', async () => {
    await session.assert('All birds have wings');
    await session.assert('Tweety is a bird');
    const reasoning = await session.reason('Does tweety have wings?');
    expect(reasoning.answer).toBe('Yes');
    expect(reasoning.steps).toEqual([
      'Translated: has_wings(tweety).',
      'Executed: has_wings(tweety).',
      'Result: true'
    ]);
  });

  test('assert rejects fact not in ontology', async () => {
    const session = mcr.createSession({
      ontology: {
        types: ['bird'],
        relationships: ['has_wings']
      }
    });
    
    const report = await session.assert('Tweety is a fish');
    expect(report.success).toBe(false);
    expect(report.error).toContain('not defined in ontology');
  });

  test('assert rejects rule with invalid predicate', async () => {
    const session = mcr.createSession({
      ontology: {
        types: ['bird'],
        relationships: ['has_wings']
      }
    });
    
    const report = await session.assert('All fish can swim');
    expect(report.success).toBe(false);
    expect(report.error).toContain('not defined in ontology');
  });

  describe('Session State Management', () => {
    test('save and load state', () => {
      session.program = ['bird(tweety).'];
      const state = session.saveState();
      const newSession = mcr.createSession();
      newSession.loadState(state);
      expect(newSession.getKnowledgeGraph().prolog).toContain('bird(tweety).');
    });

    test('clear session', async () => {
      await session.assert('Tweety is a bird');
      session.clear();
      expect(session.getKnowledgeGraph().prolog).toBe('');
    });

    test('reload ontology', async () => {
      session.reloadOntology({
        types: ['canary'],
        relationships: ['has_color']
      });
      const report = await session.assert('Tweety has color yellow');
      expect(report.symbolicRepresentation).toContain('has_color(tweety, yellow).');
      expect(session.getKnowledgeGraph().prolog).toContain('has_color(tweety, yellow).');
    });
  });

  describe('Translation Fallback', () => {
    test('directToProlog falls back to jsonToProlog', async () => {
      const originalTranslator = session.translator;
      session.translator = require('../src/translation/directToProlog');
      jest.spyOn(console, 'error').mockImplementation();
      
      const jsonToProlog = require('../src/translation/jsonToProlog');
      const mockJson = jest.spyOn(jsonToProlog, 'default').mockResolvedValue('has_wings(X) :- bird(X).');
      
      // Force an error in directToProlog
      const directToPrologModule = require('../src/translation/directToProlog');
      directToPrologModule.default.mockRejectedValueOnce(new Error('forced error'));
      
      const report = await session.assert('Complex rule with multiple conditions');
      expect(report.symbolicRepresentation).toMatch(/:-/);
      
      mockJson.mockRestore();
      session.translator = originalTranslator;
    });
  });
```
