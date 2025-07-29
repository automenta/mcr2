package com.mcr.translation;

import java.util.List;

public interface TranslationStrategy {
    String translate(String naturalLanguageText, Object llmClient, String model, List<String> ontologyTerms, String feedback) throws Exception;
}
