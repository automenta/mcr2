package com.mcr.translation;

import java.util.List;

import java.util.Map;

public interface TranslationStrategy {
    Map<String, Object> translate(String naturalLanguageText, Object llmClient, String model, List<String> ontologyTerms, String feedback) throws Exception;
}
