define(['_lang', 'util', 'constants'], function(_lang, util, C) {
    'use strict';

    var NDA;
    var prefix = '[i18n.js]'.padRight(C.LOG_PAD, ' ');

    return {
        load: function() {
            var df = $.Deferred();

            NDA = window.nicoDougaApp;
            window.console.log(prefix, '[load]');

            var lang = NDA.config.lang;
            NDA.i18n = _lang[lang];
            window.console.log(prefix, '[load] lang =', lang)

            df.resolve()

            return df.promise();
        },

        t: function(key) {
            window.console.log(prefix, key + '=' + NDA.i18n[key]);
            return NDA.i18n[key];
        }
    }
});
