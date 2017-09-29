require(['config', 'shortcuts', 'tabs', 'tab_content', 'i18n', 'storage'], function(config, shortcuts, tabs, tab_content, i18n, storage) {
    'use strict';

    window.addEventListener('message', function(e) {
        console.log('message', e);
    }, false);

    $(document).ready(function() {
        // dynamic remove flash alert message.
        window.setInterval(function() {
            $('.alerts').remove();
        }, 1000);

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

        $('.top-new-tab').on('click', function() {
            tabs.openNewRootTab(null, true);
        });

        $(window).mousemove(function(e) {
            if (e.clientX > 300) {
                $main_container.removeClass('reveal-tree');
            }
        });

        let nicoDougaApp = (function() {
            let df = $.Deferred();
            let _logger = function(level, msgs) {
                if (window.nicoDougaApp.debugEnabled) {
                    window._console[level].apply(this, msgs);
                }
            };

            window.nicoDougaApp = {
                config: {},
                i18n: {},
                debugEnabled: true,
                pr: 20,
                user: {}
            };

            // override 'window.console'
            window._console = window.console;
            let console = {
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

        // https://account.nicovideo.jp/api/v1/login?show_button_twitter=1&site=niconico&show_button_facebook=1
        //   mail_tel:poxicfu04@infoseek.jp
        //   password:???
        //   auth_id:3343201646
        nicoDougaApp
            .then(config.init)
            .then(shortcuts.init)
            .then(config.load)
            .then(i18n.load)
            .then(function() {
                tabs.init(_templates);
                tab_content.init(_templates);

                $.ajax({
                    url: 'https://account.nicovideo.jp/api/v1/login?show_button_twitter=1&site=niconico&show_button_facebook=1',
                    data: {
                        mail_tel: 'poxicfu04@infoseek.jp',
                        password: '48694869'
                    },
                    type: 'POST',
                    success: function(r) {
                        console.log('ok');
                        $.get('http://www.nicovideo.jp/watch/1477557557', function(r) {
                            console.log(r.search('登入'));
                        });
                    },
                    error: function(r) {
                        console.warn('err');
                    }
                });
            });
    });
});
