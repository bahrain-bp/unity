mergeInto(LibraryManager.library, {
  AskPeccyAssistantFromUnity: function (questionPtr, sessionIdPtr, unityObjectNamePtr) {
    const question = UTF8ToString(questionPtr);
    const sessionId = UTF8ToString(sessionIdPtr);
    const unityObjectName = UTF8ToString(unityObjectNamePtr);

    if (typeof window.AskPeccyAssistant !== "function") {
      console.warn("[ChatPlugin] window.AskPeccyAssistant not found");
      return;
    }

    window.AskPeccyAssistant(question, sessionId, unityObjectName);
  }
});