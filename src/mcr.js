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
          resolve({ 
            success: ans !== false, 
            bindings: ans !== false ? pl.format_answer(ans) : null,
            explanation: ans !== false ? [prologQuery] : []
          });
        });
      });
    } catch (error) {
      return { success: false, bindings: null, explanation: [] };
    }
  }

  async nquery(naturalLanguageQuery) {
    try {
      const prologQuery = await this.translator(naturalLanguageQuery, this.mcr.llmClient);
      const result = await this.query(prologQuery);
      return result;
    } catch (error) {
      return { success: false, bindings: null, explanation: [] };
    }
  }

  async reason(taskDescription) {
    let steps = [];
    try {
      const prologQuery = await this.translator(taskDescription, this.mcr.llmClient);
      steps.push(`Translated: ${prologQuery}`);
      const result = await this.query(prologQuery);
      steps = [...steps, ...result.explanation];
      
      return {
        answer: result.success ? 'Yes' : 'No',
        steps: steps
      };
    } catch (error) {
      return {
        answer: 'Reasoning error',
        steps: [`Error: ${error.message}`]
      };
    }
  }

  getKnowledgeGraph() {
    return this.program.join('\n');
  }
}

module.exports = { MCR, Session };
