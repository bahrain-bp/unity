mergeInto(LibraryManager.library, {
    RedirectToURL: function (urlPtr) {
        var url = UTF8ToString(urlPtr);
        window.location.href = url;
    }
});
