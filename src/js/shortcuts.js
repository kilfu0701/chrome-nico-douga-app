define(['constants', 'storage','tabs'], function(C, storage, tabs){
    'use strict';


    function init() {
        var df = $.Deferred();

        $(window).keydown(function(e) {
            console.log(e);
            switch(e.which){
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
                    console.log(e);
            }
        });

        df.resolve();

        return df.promise();
    }

    return {
        init: init
    };

});
