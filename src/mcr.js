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
      
      // Ontology validation
      const parts = prologClause.split(':-');
      const head = parts[0].trim();
      const body = parts.length > 1 ? parts[1].replace(/\.\s*$/, '').trim() : '';
      const headPredicate = head.split('(')[0].trim();
      
      if (body) {
        const bodyPredicates = body.split(/,\s*/).map(p => p.split('(')[0].trim());
        this.ontology.validateRule(headPredicate, bodyPredicates);
      } else {
        this.ontology.validateFact(headPredicate);
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
      // Break down complex tasks into smaller steps
      const steps = [];
      let currentState = taskDescription;
      let maxSteps = options.maxSteps || 5;
      
      while (true) {
        const prologQuery = await this.translateWithRetry(currentState);
        const result = await this.query(prologQuery, options);
        
        steps.push(`Translated: ${prologQuery}`);
        if (result.success) {
          steps.push(`Executed: ${prologQuery}`);
          steps.push(`Result: ${result.bindings}`);
          
          // Validate against ontology constraints
          try {
            if (this.options.ontology) {
              this.ontology.validateConstraint(prologQuery);
            }
          } catch (constraintError) {
            steps.push(`Constraint violation: ${constraintError.message}`);
            return {
              answer: 'Constraint violation',
              steps,
              confidence: 0.0
            };
          }
          
          // Check if we've reached a final conclusion
          if (this.isFinalResult(result.bindings) || steps.length >= maxSteps) {
            return {
              answer: result.success ? 'Yes' : 'No',
              steps,
              confidence: result.confidence
            };
          }
          
          // Update state for next iteration
          currentState = this.generateNextStep(
            taskDescription, 
            steps, 
            result.bindings
          );
        } else {
          return {
            answer: 'No',
            steps: [
              ...steps,
              `Error: No solution found for ${prologQuery}`
            ],
            confidence: 0.0
          };
        }
      }
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
    // Generate next step prompt using previous results
    return `Based on: ${steps.slice(-1)[0]}\nContinue reasoning about: ${originalTask}`;
  }

  getKnowledgeGraph() {
    return this.program.join('\n');
  }
}

module.exports = { MCR, Session };
