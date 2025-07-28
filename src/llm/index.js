const { ChatOllama } = require('@langchain/ollama');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { OpenAI } = require('openai');

function getLlmClient(llmConfig) {
  const { provider, model, ...restConfig } = llmConfig;

  switch (provider?.toLowerCase()) {
    case 'ollama':
      return new ChatOllama({ model, ...restConfig });
    case 'google':
      if (!restConfig.apiKey) throw new Error('Google provider requires an apiKey.');
      return new ChatGoogleGenerativeAI({ model, ...restConfig });
    case 'anthropic':
      if (!restConfig.apiKey) throw new Error('Anthropic provider requires an apiKey.');
      return new ChatAnthropic({ model, ...restConfig });
    case 'openai':
      return new OpenAI({ model, ...restConfig });
    default:
      throw new Error(`Unsupported LLM provider: ${provider}. Please provide an 'llm.client' instance for custom providers.`);
  }
}

module.exports = { getLlmClient };
