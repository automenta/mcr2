const { MCR, Session } = require('../src/mcr');

jest.mock('../src/translation/directToProlog', () => jest.fn().mockImplementation(async (text) => {
  if (text.includes('All birds have wings')) return 'has_wings(X) :- bird(X).';
  if (text.includes('Tweety is a bird')) return 'bird(tweety).';
  if (text.includes('Tweety is a canary')) return 'canary(tweety).';
  if (text.includes('have wings?')) return 'has_wings(tweety).';
  if (text === 'Is tweety a bird?') return 'bird(tweety).';
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
    session = null;
  });

  test('assert translates and stores natural language', async () => {
    const report = await session.assert('Tweety is a bird');
    expect(report.symbolicRepresentation).toBe('bird(tweety).');
    expect(session.getKnowledgeGraph()).toContain('bird(tweety).');
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
    const kg = session.getKnowledgeGraph();
    expect(kg).toContain('bird(tweety).');
    expect(kg).toContain('canary(tweety).');
  });

  test('getKnowledgeGraph returns program as string', () => {
    expect(typeof session.getKnowledgeGraph()).toBe('string');
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
```