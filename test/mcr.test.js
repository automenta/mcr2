const { MCR, Session } = require('../src/mcr');

jest.mock('../src/translation/directToProlog', () => jest.fn().mockResolvedValue('bird(tweety).'));

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

  beforeEach(() => {
    const mcr = new MCR({ llm: { provider: 'openai', apiKey: 'test-key' } });
    session = mcr.createSession();
  });

  test('assert translates and stores natural language', async () => {
    const report = await session.assert('Tweety is a bird');
    expect(report.symbolicRepresentation).toBe('bird(tweety).');
    expect(session.getKnowledgeGraph()).toContain('bird(tweety).');
  });

  test('query returns bindings for valid query', async () => {
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

  test('getKnowledgeGraph returns string', () => {
    expect(typeof session.getKnowledgeGraph()).toBe('string');
  });
});
