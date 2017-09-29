define(['constants', 'storage', 'util'], function(C, storage, util) {
    'use strict';

    var NDA;
    var prefix = '[config.js]'.padRight(C.LOG_PAD, ' ');

    var init_config = {
        inited: true,
        lang: 'zh',
        defaultURL: 'http://www.nicovideo.jp/video_top',
        openWithDefaultPageFlag: true
    };

    return {
        init: function() {
            NDA = window.nicoDougaApp;
            window.console.log(prefix, '[init]');

            return storage.initConfig(init_config);
        },

        load: function() {
            window.console.log(prefix, '[load]');

            return storage.loadConfig().then(function(config) {
                window.console.log(prefix, '[load] config =', config)
                NDA.config = config;
            });
        }
    };

});
