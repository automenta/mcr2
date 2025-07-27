const { MCR, Session } = require('../src/mcr');

jest.mock('../src/translation/directToProlog', () => jest.fn().mockImplementation(async (text) => {
  if (text.includes('bird')) return 'bird(tweety).';
  if (text.includes('canary')) return 'canary(tweety).';
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

  test('query returns bindings for valid query after natural language assert', async () => {
    await session.assert('Tweety is a bird');
    const result = await session.query('bird(X).');
    expect(result.success).toBe(true);
    expect(result.bindings).toContain('X = tweety');
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
});
