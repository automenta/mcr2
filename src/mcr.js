const pl = require('tau-prolog');
const { OpenAI } = require('openai');
const directToProlog = require('./translation/directToProlog');
const OntologyManager = require('./ontology/OntologyManager');

class MCR {
  constructor(config) {
    this.config = config;
    const llmConfig = config.llm || {};
    this.llmClient = null;
    this.llmModel = llmConfig.model || 'gpt-3.5-turbo';

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
    this.sessionId = options.sessionId || Date.now().toString(36);
    this.prologSession = pl.create();
    this.program = [];
    this.translator = this.resolveTranslator(options.translator);
    this.maxAttempts = options.translationAttempts || 2;
    this.ontology = new OntologyManager(options.ontology);
  }
  
  resolveTranslator(translatorOption) {
    if (typeof translatorOption === 'function') return translatorOption;
    if (translatorOption === 'json') return require('./translation/jsonToProlog');
    return require('./translation/directToProlog');
  }
  
  reloadOntology(newOntology) {
    this.ontology = new OntologyManager(newOntology);
    // Revalidate existing program with new ontology
    console.warn('Existing program not revalidated against new ontology');
  }

  clear() {
    this.program = [];
    this.prologSession = pl.create();
    if (this.options.ontology) {
      this.ontology = new OntologyManager(this.options.ontology);
    }
    console.debug(`[${new Date().toISOString()}] [${this.sessionId}] Session cleared`);
  }
  
  async translateWithRetry(text) {
    console.debug(`[${new Date().toISOString()}] [${this.sessionId}] translateWithRetry: "${text}"`);
    let attempt = 0;
    let lastError;
    
    while (attempt < this.maxAttempts) {
      try {
        return await this.translator(text, this.mcr.llmClient, this.mcr.llmModel);
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
      const translationResult = await this.translateWithRetry(naturalLanguageText);
      if (typeof translationResult !== 'string' || translationResult.error) {
        throw new Error(`Translation failed: ${translationResult.error || 'Unknown error'}`);
      }
      if (!translationResult) throw new Error('Translation resulted in empty clause');
      
      const prologClause = translationResult;
      // Ontology validation
      const parts = prologClause.split(':-');
      const head = parts[0].trim();
      const body = parts.length > 1 ? parts[1].replace(/\.\s*$/, '').trim() : '';
      const headPredicate = head.split('(')[0].trim();
      
      if (body) {
        const bodyPredicates = body.split(/,\s*/).map(p => {
          const pred = p.split('(')[0].trim();
          this.ontology.validateRulePredicate(pred);
          return pred;
        });
        this.ontology.validateRuleHead(headPredicate);
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
    console.debug(`[${new Date().toISOString()}] [${this.sessionId}] query: "${prologQuery}"`);
    const { allowSubSymbolicFallback = false } = options;
    try {
      this.prologSession.consult(this.program.join('\n'));
      if (this.options.ontology) {
        const predicates = this.extractPredicates(prologQuery);
        predicates.forEach(p => this.ontology.validateFact(p));
      }
      return new Promise((resolve, reject) => {
        const bindings = [];
        const proofSteps = [];
        const onAnswer = (answer) => {
          if (answer === false) {
            const success = bindings.length > 0;
            resolve({
              success,
              bindings: success ? bindings : null,
              explanation: proofSteps,
              confidence: success ? 1.0 : 0.0
            });
          } else {
            const formatted = pl.format_answer(answer);
            bindings.push(formatted);
            proofSteps.push(`Derived: ${formatted}`);
            this.prologSession.answer(onAnswer);
          }
        };
        this.prologSession.query(prologQuery);
        this.prologSession.answer(onAnswer);
      }).then(async (result) => {
        if (!result.success && allowSubSymbolicFallback && this.mcr.llmClient) {
          const llmAnswer = await this.mcr.llmClient.chat.completions.create({
            model: this.mcr.llmModel,
            messages: [{ role: 'user', content: `Question: ${prologQuery}\nAnswer:` }],
            temperature: 0.0,
          });
          const answer = llmAnswer.choices[0].message.content.trim();
          return { 
            success: true, 
            bindings: [answer], 
            explanation: ['Sub-symbolic fallback'], 
            confidence: 0.7 
          };
        }
        return result;
      });
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
        if (typeof prologQuery !== 'string' || prologQuery.error) {
          throw new Error(`Translation failed: ${prologQuery.error || 'Unknown error'}`);
        }
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
    // More robust termination detection
    return bindings.some(b => 
      b.includes('true') || 
      b.includes('false') ||
      b.includes('yes') ||
      b.includes('no') ||
      b.includes('conclusion(')
    );
  }

  generateNextStep(originalTask, steps, bindings) {
    return `Given: ${bindings.replace(/,\s*/g, ', ')}\nContinue: ${originalTask}`;
  }

  getKnowledgeGraph() {
    return {
      prolog: this.program.join('\n'),
      entities: Array.from(this.ontology.types),
      relationships: Array.from(this.ontology.relationships),
      constraints: Array.from(this.ontology.constraints)
    };
  }
}

module.exports = { MCR, Session };
