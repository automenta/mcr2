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
    const report = await session.assert('Test assertion');
    expect(report).toHaveProperty('success', true);
  });

  test('query returns answer object', async () => {
    const result = await session.query('Test query');
    expect(result).toHaveProperty('answer');
  });

  test('reason returns reasoning result', async () => {
    const result = await session.reason('Test task');
    expect(result).toHaveProperty('answer');
  });

  test('getKnowledgeGraph returns string', () => {
    const kg = session.getKnowledgeGraph();
    expect(typeof kg).toBe('string');
  });
});
