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
      const answers = [];
      return new Promise((resolve) => {
        this.prologSession.query(prologQuery);
        const gatherAnswers = (ans) => {
          if (ans === false) {
            resolve({
              success: answers.length > 0,
              bindings: answers.length > 0 ? answers.join(', ') : null,
              explanation: answers.length > 0 ? [prologQuery] : []
            });
          } else {
            answers.push(pl.format_answer(ans));
            this.prologSession.answer(gatherAnswers);
          }
        };
        this.prologSession.answer(gatherAnswers);
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
    const steps = [];
    try {
      const prologQuery = await this.translator(taskDescription, this.mcr.llmClient);
      steps.push(`Translated: ${prologQuery}`);
      const result = await this.query(prologQuery);
      if (result.success) {
        steps.push(`Executed: ${prologQuery}`);
        steps.push(`Result: ${result.bindings}`);
      }
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
