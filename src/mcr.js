const pl = require('tau-prolog');
const { OpenAI } = require('openai');
const directToProlog = require('./translation/directToProlog');

class MCR {
  constructor(config) {
    this.config = config;
    this.llmClient = config.llm.provider === 'openai' 
      ? new OpenAI({ apiKey: config.llm.apiKey }) 
      : null;
  }

  createSession(options = {}) {
    return new Session(this, options);
  }
}

class Session {
  constructor(mcr, options) {
    this.mcr = mcr;
    this.options = options;
    this.prologSession = pl.create();
    this.program = [];
    this.translator = directToProlog;
  }

  async assert(naturalLanguageText) {
    try {
      const prologClause = await this.translator(naturalLanguageText, this.mcr.llmClient);
      this.program.push(prologClause);
      this.prologSession.consult(this.program.join('\n'));
      return { success: true, symbolicRepresentation: prologClause };
    } catch (error) {
      console.error('Assertion error:', error);
      return { success: false, symbolicRepresentation: null };
    }
  }

  async query(prologQuery) {
    try {
      this.prologSession.consult(this.program.join('\n'));
      const answers = [];
      return new Promise(resolve => {
        this.prologSession.query(prologQuery);
        const gatherAnswers = ans => {
          ans === false 
            ? resolve({ success: answers.length > 0, bindings: answers.length ? answers.join(', ') : null, explanation: [prologQuery] })
            : (answers.push(pl.format_answer(ans)), this.prologSession.answer(gatherAnswers));
        };
        this.prologSession.answer(gatherAnswers);
      });
    } catch (error) {
      console.error('Query error:', error);
      return { success: false, bindings: null, explanation: [] };
    }
  }

  async nquery(naturalLanguageQuery) {
    try {
      const prologQuery = await this.translator(naturalLanguageQuery, this.mcr.llmClient);
      return await this.query(prologQuery);
    } catch (error) {
      console.error('Natural query error:', error);
      return { success: false, bindings: null, explanation: [] };
    }
  }

  async reason(taskDescription) {
    try {
      const prologQuery = await this.translator(taskDescription, this.mcr.llmClient);
      const steps = [`Translated: ${prologQuery}`];
      const result = await this.query(prologQuery);
      result.success && (steps.push(`Executed: ${prologQuery}`, `Result: ${result.bindings}`));
      return { answer: result.success ? 'Yes' : 'No', steps };
    } catch (error) {
      return { answer: 'Reasoning error', steps: [`Error: ${error.message}`] };
    }
  }

  getKnowledgeGraph() {
    return this.program.join('\n');
  }
}

module.exports = { MCR, Session };
