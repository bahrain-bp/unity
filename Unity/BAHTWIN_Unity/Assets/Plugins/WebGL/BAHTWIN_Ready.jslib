mergeInto(LibraryManager.library, {
  BAHTWIN_OnUnityReady: function () {
    try {
      if (typeof window !== "undefined" && typeof window.BAHTWIN_OnUnityReady === "function") {
        window.BAHTWIN_OnUnityReady();
      } else {
        console.warn("[BAHTWIN_Ready.jslib] window.BAHTWIN_OnUnityReady is missing");
      }
    } catch (e) {
      console.warn("[BAHTWIN_Ready.jslib] error:", e);
    }
  },
});
