mergeInto(LibraryManager.library, {
  BAHTWIN_LS_GetString: function (keyPtr) {
    try {
      var key = UTF8ToString(keyPtr);
      var value = window.localStorage.getItem(key);
      if (value === null || value === undefined) value = "";
      return allocateUTF8(value);
    } catch (e) {
      return allocateUTF8("");
    }
  }
});
