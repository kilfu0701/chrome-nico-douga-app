define([], function() {
    'use strict';

    return {
        read: function(filepath) {
            var df = $.Deferred();

            var errHandle = function(e) {
                df.reject(e);
            };

            chrome.runtime.getPackageDirectoryEntry(function(root) {
                root.getFile(filepath, {create: false}, function(entry) {
                    entry.file(function(file) {
                        var reader = new FileReader;
                        reader.onload = function(e) {
                            df.resolve(e.target.result);
                        }
                        reader.readAsText(file, 'utf-8');
                    }, errHandle);
                }, errHandle);
            });

            return df.promise();
        }
    }
});
