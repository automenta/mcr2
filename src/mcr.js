const pl = require('tau-prolog');
const { OpenAI } = require('openai');
const directToProlog = require('./translation/directToProlog');

class MCR {
  constructor(config) {
    this.config = config;
    const llmConfig = config.llm || {};
    this.llmClient = null;

    if (llmConfig.provider) {
      switch (llmConfig.provider.toLowerCase()) {
        case 'openai': {
          if (!llmConfig.apiKey) throw new Error('OpenAI API key is required');
          this.llmClient = new OpenAI({ apiKey: llmConfig.apiKey });
          break;
        }
        default:
          console.warn(`Unsupported LLM provider: ${llmConfig.provider}`);
      }
    }
  }

  createSession(options = {}) {
    return new Session(this, options);
  }
}

class Session {
  constructor(mcr, options = {}) {
    this.mcr = mcr;
    this.options = options;
    this.prologSession = pl.create();
    this.program = [];
    this.translator = options.translator || directToProlog;
    this.maxAttempts = options.translationAttempts || 2;
  }

  async translateWithRetry(text) {
    let attempt = 0;
    let lastError;
    
    while (attempt < this.maxAttempts) {
      try {
        return await this.translator(text, this.mcr.llmClient);
      } catch (error) {
        lastError = error;
        attempt++;
      }
    }
    throw lastError;
  }

  async assert(naturalLanguageText) {
    try {
      const prologClause = await this.translateWithRetry(naturalLanguageText);
      if (!prologClause) throw new Error('Translation resulted in empty clause');
      this.program.push(prologClause);
      await this.prologSession.consult(this.program.join('\n'));
      return { 
        success: true, 
        symbolicRepresentation: prologClause,
        originalText: naturalLanguageText 
      };
    } catch (error) {
      console.error('Assertion error:', error);
      return { 
        success: false, 
        symbolicRepresentation: null,
        originalText: naturalLanguageText 
      };
    }
  }

  async query(prologQuery, options = {}) {
    const { allowSubSymbolicFallback = false } = options;
    try {
      this.prologSession.consult(this.program.join('\n'));
      const answers = [];
      const gatherAnswers = (ans) => {
        if (ans === false) {
          const success = answers.length > 0;
          const bindings = success ? answers.join(', ') : null;
          return { 
            success, 
            bindings, 
            explanation: [prologQuery], 
            confidence: success ? 1.0 : 0.0 
          };
        }
        answers.push(pl.format_answer(ans));
        this.prologSession.answer(gatherAnswers);
      };
      this.prologSession.query(prologQuery);
      this.prologSession.answer(gatherAnswers);
      
      if (!answers.length && allowSubSymbolicFallback && this.mcr.llmClient) {
        const llmAnswer = await this.mcr.llmClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: `Question: ${prologQuery}\nAnswer:` }],
          temperature: 0.0,
        });
        const answer = llmAnswer.choices[0].message.content.trim();
        return { 
          success: true, 
          bindings: answer, 
          explanation: ['Sub-symbolic fallback'], 
          confidence: 0.7 
        };
      }

      const success = answers.length > 0;
      return { 
        success, 
        bindings: success ? answers.join(', ') : null, 
        explanation: [prologQuery], 
        confidence: success ? 1.0 : 0.0 
      };
    } catch (error) {
      console.error('Query error:', error);
      return { 
        success: false, 
        bindings: null, 
        explanation: [], 
        confidence: 0.0 
      };
    }
  }

  async nquery(naturalLanguageQuery, options = {}) {
    try {
      const prologQuery = await this.translateWithRetry(naturalLanguageQuery);
      return await this.query(prologQuery, options);
    } catch (error) {
      console.error('Natural query error:', error);
      return { 
        success: false, 
        bindings: null, 
        explanation: [], 
        confidence: 0.0 
      };
    }
  }

  async reason(taskDescription, options = {}) {
    try {
      const prologQuery = await this.translateWithRetry(taskDescription);
      const result = await this.query(prologQuery, options);
      return {
        answer: result.success ? 'Yes' : 'No',
        steps: result.success 
          ? [
              `Translated: ${prologQuery}`,
              `Executed: ${prologQuery}`,
              `Result: ${result.bindings}`,
              `Confidence: ${result.confidence}`
            ]
          : [
              `Translated: ${prologQuery}`,
              `Error: ${result.bindings || 'Unknown error'}`
            ],
        confidence: result.confidence
      };
    } catch (error) {
      return { 
        answer: 'Reasoning error', 
        steps: [`Error: ${error.message}`],
        confidence: 0.0
      };
    }
  }

  getKnowledgeGraph() {
    return this.program.join('\n');
  }
}

module.exports = { MCR, Session };
