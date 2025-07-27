const { MCR, Session } = require('../src/mcr');

describe('MCR', () => {
  test('instantiates with config', () => {
    const config = { llm: { provider: 'openai' } };
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
    const mcr = new MCR({});
    session = mcr.createSession();
  });

  test('assert returns integration report', async () => {
    const report = await session.assert('bird(tweety).');
    expect(report.success).toBe(true);
    expect(report.symbolicRepresentation).toBe('bird(tweety).');
  });

  test('assert updates knowledge graph', async () => {
    await session.assert('bird(tweety).');
    expect(session.getKnowledgeGraph()).toContain('bird(tweety).');
  });

  test('query returns bindings for valid query', async () => {
    await session.assert('bird(tweety).');
    const result = await session.query('bird(X).');
    expect(result.success).toBe(true);
    expect(result.bindings).toContain('X = tweety');
  });

  test('query returns no bindings for invalid query', async () => {
    await session.assert('bird(tweety).');
    const result = await session.query('fish(X).');
    expect(result.success).toBe(false);
    expect(result.bindings).toBeNull();
  });

  test('reason returns reasoning result', async () => {
    const result = await session.reason('Test task');
    expect(result).toHaveProperty('answer');
  });

  test('getKnowledgeGraph returns string', () => {
    expect(typeof session.getKnowledgeGraph()).toBe('string');
  });
});
