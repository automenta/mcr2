const pl = require('tau-prolog');
const { OpenAI } = require('openai');
const directToProlog = require('./translation/directToProlog');
const OntologyManager = require('./ontology/OntologyManager');

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
    this.ontology = new OntologyManager(options.ontology);
  }

  async translateWithRetry(text) {
    console.debug(`[${new Date().toISOString()}] translateWithRetry called for: "${text}"`);
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
    console.debug(`[${new Date().toISOString()}] assert called for: "${naturalLanguageText}"`);
    try {
      const prologClause = await this.translateWithRetry(naturalLanguageText);
      if (!prologClause) throw new Error('Translation resulted in empty clause');
      
      // Ontology validation
      const parts = prologClause.split(':-');
      const head = parts[0].trim();
      const body = parts.length > 1 ? parts[1].replace(/\.\s*$/, '').trim() : '';
      const headPredicate = head.split('(')[0].trim();
      
      if (body) {
        const bodyPredicates = body.split(/,\s*/).map(p => p.split('(')[0].trim());
        this.ontology.validateRule(headPredicate, bodyPredicates);
      } else {
        // For a fact: remove trailing dot and extract arguments
        const headWithoutDot = head.replace(/\.\s*$/, '');
        let argList = [];
        if (headWithoutDot.includes('(') && headWithoutDot.endsWith(')')) {
          const inner = headWithoutDot.substring(headWithoutDot.indexOf('(')+1, headWithoutDot.lastIndexOf(')'));
          argList = inner.split(',').map(a => a.trim());
        }
        this.ontology.validateFact(headPredicate, argList);
      }
      
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
        originalText: naturalLanguageText,
        error: error.message
      };
    }
  }

  extractPredicates(query) {
    return query
      .split(/[,\s\(\)\.]+/)
      .filter(token => /^[a-z][a-zA-Z0-9_]*$/.test(token));
  }

  async query(prologQuery, options = {}) {
    console.debug(`[${new Date().toISOString()}] query called for: "${prologQuery}"`);
    const { allowSubSymbolicFallback = false } = options;
    try {
      this.prologSession.consult(this.program.join('\n'));
      if (this.options.ontology) {
        const predicates = this.extractPredicates(prologQuery);
        predicates.forEach(p => this.ontology.validateFact(p));
      }
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
    console.debug(`[${new Date().toISOString()}] nquery called for: "${naturalLanguageQuery}"`);
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
    console.debug(`[${new Date().toISOString()}] reason called for: "${taskDescription}"`);
    try {
      const steps = [];
      let currentState = taskDescription;
      let maxSteps = options.maxSteps || 5;
      let accumulatedBindings = '';
      
      for (let step = 0; step < maxSteps; step++) {
        const prologQuery = await this.translateWithRetry(currentState);
        const result = await this.query(prologQuery, {allowSubSymbolicFallback: options.allowSubSymbolicFallback});
        
        steps.push(`Step ${step+1}: Translated to "${prologQuery}"`);
        steps.push(`Result: ${result.success ? 'Success' : 'No solution found'}`);
        
        if (result.success) {
          steps.push(`Bindings: ${result.bindings}`);
          accumulatedBindings = accumulatedBindings 
            ? `${accumulatedBindings}, ${result.bindings}`
            : result.bindings;
          
          if (this.isFinalResult(result.bindings)) {
            return {
              answer: result.bindings.includes('true') || result.bindings.includes('yes') ? 'Yes' : 'No',
              steps,
              confidence: result.confidence
            };
          }
        }
        
        // Prepare next step prompt
        currentState = `Current knowledge: ${accumulatedBindings || 'No facts yet'}\n` + 
                       `Original task: ${taskDescription}`;
      }
      
      // If max steps reached without final answer
      return {
        answer: 'Inconclusive',
        steps: [...steps, `Reached maximum steps (${maxSteps}) without conclusion`],
        confidence: 0.3
      };
    } catch (error) {
      return { 
        answer: 'Reasoning error', 
        steps: [`Error: ${error.message}`],
        confidence: 0.0
      };
    }
  }

  isFinalResult(bindings) {
    // Simple heuristic: if bindings contain a true/false conclusion
    return bindings.includes('true') || 
           bindings.includes('false') ||
           bindings.includes('yes') ||
           bindings.includes('no');
  }

  generateNextStep(originalTask, steps, bindings) {
    return `Given: ${bindings.replace(/,\s*/g, ', ')}\nContinue: ${originalTask}`;
  }

  getKnowledgeGraph() {
    return {
      prolog: this.program.join('\n'),
      entities: Array.from(this.ontology.types),
      relationships: Array.from(this.ontology.relationships)
    };
  }
}

module.exports = { MCR, Session };
