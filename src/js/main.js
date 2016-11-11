require(['config', 'shortcuts', 'tabs', 'tab_content', 'i18n', 'storage'], function(config, shortcuts, tabs, tab_content, i18n, storage) {
    'use strict';

    $(document).ready(function() {
        let $main_container = $('#main-container');
        let _templates = {};

        $('#templates').children().each(function() {
            let $this = $(this);
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

        let nicoDougaApp = (function() {
            let df = $.Deferred();

            let _logger = function(level, msgs) {
                if (window.nicoDougaApp.debug_mode) {
                    window._console[level].apply(this, msgs);
                }
            };

            window.nicoDougaApp = {
                config: {},
                i18n: {},
                debug_mode: true,
                pr: 20
            };

            // override 'window.console'
            window._console = window.console;
            var console = {
                log:   function() { _logger('log', arguments); },
                warn:  function() { _logger('warn', arguments); },
                info:  function() { _logger('info', arguments); },
                debug: function() { _logger('debug', arguments); },
                error: function() { _logger('error', arguments); }
            };
            window.console = console;

            df.resolve();

            return df.promise();
        })();

        nicoDougaApp
            .then(storage.init)
            .then(config.init)
            .then(shortcuts.init)
            .then(config.load)
            .then(i18n.load)
            .then(function() {
                tabs.init(_templates);
                tab_content.init(_templates);
            });
    });
});
