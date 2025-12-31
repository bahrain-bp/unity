mergeInto(LibraryManager.library, {
  BAHTWIN_LS_GetString: function (keyPtr) {
    var key = UTF8ToString(keyPtr);
    var value = window.localStorage.getItem(key);
    if (value === null) value = "";
    var size = lengthBytesUTF8(value) + 1;
    var buffer = _malloc(size);
    stringToUTF8(value, buffer, size);
    return buffer;
  }
});
