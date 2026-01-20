mergeInto(LibraryManager.library, {
    RedirectToURL: function (urlPtr) {
        var url = UTF8ToString(urlPtr);

        // If Unity sends a relative path, resolve it automatically
        if (url && url.startsWith("/")) {
            url = window.location.origin + url;
        }

        window.location.href = url;
    }
});
