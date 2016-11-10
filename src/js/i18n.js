define(['_lang'], function(_lang) {
    'use strict';

    var core = {
        contextMenuRules: {
            download: ['http://www.nicovideo.jp/watch/*', 'https://www.nicovideo.jp/watch/*']
        }
    };

    return {
        load: function() {
            var df = $.Deferred();
            var lang = nicoDougaApp.config.lang;

            window.i18n = _lang[lang];
            df.resolve()

            return df.promise();
        },

        t: function(key) {
            return window.i18n[key];
        }
    }
});
