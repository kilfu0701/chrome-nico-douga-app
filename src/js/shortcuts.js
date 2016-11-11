define(['constants', 'storage', 'tabs', 'util'], function(C, storage, tabs, util){
    'use strict';

    var NDA;
    var prefix = '[shortcuts.js]'.padRight(C.LOG_PAD, ' ');

    function init() {
        var df = $.Deferred();

        NDA = window.nicoDougaApp;
        window.console.log(prefix, '[init]');

        $(window).keydown(function(e) {
            window.console.log(prefix, 'keydown =', e);
            switch(e.which) {
                case C.KEYCODES.ESC:
                    tabs.escape_current_tab();
                    break;

                case C.KEYCODES.F:
                    if (e.ctrlKey) {
                        tabs.start_find();
                    }
                    break;

                case C.KEYCODES.L:
                    if(e.ctrlKey) {
                        tabs.focus_address_bar();
                    }
                    break;

                case C.KEYCODES.N:
                    if(e.ctrlKey) {
                        tabs.openNewRootTab(null, true);
                    }
                    break;

                case C.KEYCODES.Q:
                    if (e.ctrlKey) {
                        storage.clear();
                    }
                    break;

                case C.KEYCODES.R:
                    if (e.ctrlKey) {
                        tabs.refresh_current_tab();
                    }
                    break;

                case C.KEYCODES.T:
                    if (e.ctrlKey) {
                        tabs.openNewRootTab(null, true);
                    }
                    break;

                case C.KEYCODES.W:
                    if (e.ctrlKey) {
                        tabs.close_current_tab();
                        e.preventDefault();
                    }
                    break;

                default:
                    break;
            }
        });

        df.resolve();

        return df.promise();
    }

    return {
        init: init
    };

});
