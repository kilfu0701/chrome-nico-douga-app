require(['config', 'shortcuts', 'tabs', 'tab_content', 'i18n'], function(config, shortcuts, tabs, tab_content, i18n) {
    'use strict';

    $(document).ready(function() {
        var $main_container = $('#main-container');
        var _templates = {};

        $('#templates').children().each(function() {
            var $this = $(this);
            _templates[$this.data('template')] = $this.children().first();
        });

        $('.button-collapse').click(function() {
            $main_container.toggleClass('collapsed-tree');
        });

        $('.reveal-container .button').mouseover(function() {
            $main_container.addClass('reveal-tree');
        });

        $('.header .logo').click(function() {
            tabs.unselect_current_tab();
        });

        $(window).mousemove(function(e) {
            if (e.clientX > 300) {
                $main_container.removeClass('reveal-tree');
            }
        });

        var nicoDougaApp = (function() {
            var df = $.Deferred();

            window.nicoDougaApp = {};
            df.resolve();

            return df.promise();
        })();

        nicoDougaApp
            .then(config.init)
            .then(config.load)
            .then(i18n.load)
            .then(shortcuts.init)
            .then(function() {
                tabs.init(_templates);
                tab_content.init(_templates);
            });
    });
});
