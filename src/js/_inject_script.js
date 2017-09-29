var NDAScript = function() {
    this.initialize.apply(this, arguments);
};

NDAScript.prototype = {
    initialize: function(params) {
        this.isSignined = false;
        this.extensionPackage = 'chrome-extension://hheojobcpkekaanflpelinndlpjlpnfc';
        this.watchAPIData = {};
        this._e = null;

        if (window.location.href.search("https://account.nicovideo.jp/login") !== -1) {
            this._setupLoginSyncedWithApp();
        }
    },

    setupMessageListener: function() {
        let me = this;

        window.addEventListener('message', function(e) {
            if (e.origin !== me.extensionPackage)
                return ;

            if (!me._e)
                me._e = e;

            console.log(e);
            let data = JSON.parse(e.data);

            switch (data.id) {
                case 'isSignined':
                    let elements = document.querySelectorAll('.siteHeaderLogin');
                    let isSignined;

                    if (elements.length === 1)
                        me.isSignined = false;
                    else
                        me.isSignined = true;

                    e.source.postMessage(JSON.stringify({id: 'isSigninedCB', data: me.isSignined}), e.origin);
                    break;

                default:
                    break;
            }
        }, false);
    },

    parseVideoInfo: function() {
        // get flashvar
        let watchAPIDataContainer = document.getElementById('watchAPIDataContainer'),
            jsInitalWatchData = document.getElementById('js-initial-watch-data');

        if (watchAPIDataContainer) {
            // Ginza
            let data = JSON.parse(watchAPIDataContainer.innerHTML);
            let flvInfo = this._parseQueryString(data.flashvars.flvInfo);
            let videoURL = decodeURIComponent(flvInfo.url);
            console.log(data);

            this.watchAPIData = {
                flvInfo:        flvInfo,
                videoID:        data.videoDetail.id,
                thumbnail:      data.flashvars.thumbImage,
                videoURL:       videoURL,
                is:             this._parseTypeByURL(videoURL),
                csrfToken:      data.flashvars.csrfToken,
                playlistToken:  data.playlistToken,
                watchAuthKey:   data.flashvars.watchAuthKey,
                seekToken:      data.flashvars.seek_token,
                msgInfo: {
                    server:             flvInfo.ms,
                    threadId:           flvInfo.thread_id,
                    duration:           flvInfo.l,
                    userId:             flvInfo.user_id,
                    isNeedKey:          flvInfo.needs_key === '1',
                    optionalThreadId:   flvInfo.optional_thread_id,
                    userKey:            flvInfo.userkey,
                    hasOwnerThread:     !!data.videoDetail.has_owner_thread
                },
                playlist: [],
                dmcInfo: JSON.parse(decodeURIComponent(data.flashvars.dmcInfo || '{}'))
            };
        } else if (jsInitalWatchData) {
            // Html5
            const data = JSON.parse(jsInitalWatchData.getAttribute('data-api-data'));
            const env  = JSON.parse(jsInitalWatchData.getAttribute('data-environment'));

            const videoId = data.video.id;
            const hasLargeThumbnail = ZenzaWatch.util.hasLargeThumbnail(videoId);
            const flvInfo = {
                url: data.video.source
            };
            const dmcInfo = data.video.dmcInfo;
            const thumbnail = data.video.thumbnail + (hasLargeThumbnail ? '.L' : '');
            const videoUrl  = flvInfo.url;
            const isEco = /\d+\.\d+low$/.test(videoUrl);
            const isFlv = /\/smile\?v=/.test(videoUrl);
            const isMp4 = /\/smile\?m=/.test(videoUrl);
            const isSwf = /\/smile\?s=/.test(videoUrl);
            const isDmc = !!dmcInfo;
            const isChannel = !!data.channel;
            const isCommunity = !!data.community;
            const csrfToken     = data.context.csrfToken;
            const watchAuthKey  = data.context.watchAuthKey;
            const playlistToken = env.playlistToken;
            const msgInfo = {
                server:   data.thread.serverUrl,
                threadId: data.thread.ids.community || data.thread.ids.default,
                duration: data.video.duration,
                userId:   data.viewer.id,
                isNeedKey: (isChannel || isCommunity),
                optionalThreadId: '',
                userKey: data.context.userkey,
                hasOwnerThread: data.thread.hasOwnerThread
            };
            const isPlayable = isMp4 && !isSwf && (videoUrl.indexOf('http') === 0);
        }
    },

    request: function(params, cb) {
        function reqListener() {
            if (typeof cb === 'function')
                cb(this.responseText);
        };

        var oReq = new XMLHttpRequest();
        oReq.onload = reqListener;
        oReq.open(params.method, params.url, true);
        oReq.send();
    },

    removeFlashElements: function() {
        document.getElementById('playerContainerWrapper').remove();
        document.getElementById('appliPanel').remove();
    },

    _parseQueryString: function(str) {
        let result = {};
        let decode_str = decodeURIComponent(str);
        let arr = decode_str.split('&');

        for (let item of arr) {
            let m = item.split('=');
            result[m[0]] = m[1];
        }

        return result;
    },

    _parseTypeByURL: function(url) {
        return {
            eco: /\d+\.\d+low$/.test(url),
            flv: /\/smile\?v=/.test(url),
            mp4: /\/smile\?m=/.test(url),
            swf: /\/smile\?s=/.test(url)
        }
    },

    _setupLoginSyncedWithApp: function() {
        let me = this;
        let loginForm = document.querySelector('form');
        loginForm.onsubmit = function(e) {
            let input = loginForm.getElementsByTagName('input');
            let inputDict = {};
            for (var i = 0; i < input.length; i++) {
                inputDict[input[i].name] = input[i].value;
            }
            me._e.source.postMessage(JSON.stringify({id: 'syncBackgroundLoginPage', data: inputDict}), me._e.origin);
        };
    }
};

// main
var ndas = new NDAScript();
ndas.setupMessageListener();
ndas.parseVideoInfo();
ndas.removeFlashElements();
