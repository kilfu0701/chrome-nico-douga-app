define(['_i18n/lang', 'util', 'constants'], function(lang, util, C) {
    'use strict';

    var NDA;
    var prefix = '[i18n.js]'.padRight(C.LOG_PAD, ' ');

    return {
        load: function() {
            var df = $.Deferred();

            NDA = window.nicoDougaApp;
            window.console.log(prefix, '[load]');

            var current_lang = NDA.config.lang;
            NDA.i18n = lang[current_lang];
            window.console.log(prefix, '[load] lang =', current_lang)

            df.resolve()

            return df.promise();
        },

        t: function(key) {
            window.console.log(prefix, key + '=' + NDA.i18n[key]);
            return NDA.i18n[key];
        }
    }
});
