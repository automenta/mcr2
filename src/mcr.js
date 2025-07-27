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
    const prologClause = await this.translator(naturalLanguageText, this.mcr.llmClient);
    this.program.push(prologClause);
    const fullProgram = this.program.join('\n');
    this.prologSession.consult(fullProgram);
    return {
      success: true,
      message: 'Asserted successfully',
      symbolicRepresentation: prologClause
    };
  }

  async query(prologQuery) {
    try {
      const fullProgram = this.program.join('\n');
      this.prologSession.consult(fullProgram);
      return new Promise((resolve) => {
        this.prologSession.query(prologQuery);
        this.prologSession.answer(ans => {
          resolve({ success: ans !== false, bindings: ans !== false ? pl.format_answer(ans) : null });
        });
      });
    } catch (error) {
      return { success: false, bindings: null };
    }
  }

  async reason(taskDescription) {
    return {
      answer: 'Reasoning result placeholder',
      steps: []
    };
  }

  getKnowledgeGraph() {
    return this.program.join('\n');
  }
}

module.exports = { MCR, Session };
