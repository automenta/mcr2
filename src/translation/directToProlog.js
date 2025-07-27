async function directToProlog(naturalLanguageText, llmClient) {
  const prompt = `Translate the following into a Prolog fact or rule. Only output the Prolog code. Example: "All men are mortal." becomes "mortal(X) :- man(X)."\n\nInput: ${naturalLanguageText}\nOutput:`;
  const response = await llmClient.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.0,
  });
  return response.choices[0].message.content.trim();
}

module.exports = directToProlog;
