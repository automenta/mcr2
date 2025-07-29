package com.example.mcr.translation;

import java.util.List;
import java.util.concurrent.CompletableFuture;

public interface TranslationStrategy {
    CompletableFuture<String> translate(String text, List<String> ontologyTerms, String feedback);
}