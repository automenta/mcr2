const jsonToProlog = require('./jsonToProlog');

async function directToProlog(naturalLanguageText, llmClient) {
  if (!llmClient) return '';
  
  try {
    const prompt = `Translate the following into a Prolog fact, rule or query. Only output valid Prolog code with no explanations or additional text. Examples:\n1. "All men are mortal." becomes "mortal(X) :- man(X)."\n2. "Does tweety have wings?" becomes "has_wings(tweety)."\n\nInput: ${naturalLanguageText}\nOutput:`;
    
    const response = await llmClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
    });
    
    const prologOutput = response.choices[0].message.content.trim();
    
    // Add self-correction attempt
    if (!prologOutput || !prologOutput.includes('(') || !prologOutput.includes(')')) {
      return await jsonToProlog(naturalLanguageText, llmClient);
    }
    return prologOutput;
  } catch (error) {
    console.error('Initial translation failed:', error.message);
    try {
      console.log('Attempting JSON fallback');
      return await jsonToProlog(naturalLanguageText, llmClient);
    } catch (fallbackError) {
      console.error('JSON translation also failed:', fallbackError.message);
      throw new Error(`Translation failed: ${fallbackError.message}`);
    }
  }
}

module.exports = directToProlog;
