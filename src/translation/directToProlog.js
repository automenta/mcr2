async function directToProlog(naturalLanguageText, llmClient) {
  try {
    const prompt = `Translate the following into a Prolog fact, rule or query. Only output valid Prolog code with no explanations or additional text. Examples:\n1. "All men are mortal." becomes "mortal(X) :- man(X)."\n2. "Does tweety have wings?" becomes "has_wings(tweety)."\n\nInput: ${naturalLanguageText}\nOutput:`;
    const response = await llmClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

module.exports = directToProlog;
