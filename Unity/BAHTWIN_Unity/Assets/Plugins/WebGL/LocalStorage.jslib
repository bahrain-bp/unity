mergeInto(LibraryManager.library, {
  BAHTWIN_LS_GetString: function (keyPtr) {
    try {
      var key = UTF8ToString(keyPtr);
      var value = window.localStorage.getItem(key);
      if (value === null || value === undefined) value = "";

      var lengthBytes = lengthBytesUTF8(value) + 1;
      var ptr = _malloc(lengthBytes);
      stringToUTF8(value, ptr, lengthBytes);
      return ptr;

    } catch (e) {
      var lengthBytes = 1;
      var ptr = _malloc(lengthBytes);
      stringToUTF8("", ptr, lengthBytes);
      return ptr;
    }
  }
});
