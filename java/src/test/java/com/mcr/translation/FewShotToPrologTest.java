package com.mcr.translation;

import dev.langchain4j.model.chat.ChatLanguageModel;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class FewShotToPrologTest {

    @Test
    public void testTranslate() throws Exception {
        ChatLanguageModel llmClient = Mockito.mock(ChatLanguageModel.class);
        Mockito.when(llmClient.generate(Mockito.anyString())).thenReturn("flies(tweety).");

        FewShotToProlog strategy = new FewShotToProlog();
        List<String> ontologyTerms = Arrays.asList("bird", "flies");
        Map<String, Object> result = strategy.translate("Does tweety fly?", llmClient, "test-model", ontologyTerms, null);

        assertEquals("flies(tweety).", result.get("prolog"));
    }
}
