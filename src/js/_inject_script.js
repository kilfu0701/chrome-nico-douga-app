var NDAScript = function() {
    this.initialize.apply(this, arguments);
};

NDAScript.prototype = {
    initialize: function(params) {
/*
        this._baseUrl  = params.baseUrl;
        this._origin   = params.origin || location.href;
        this._type     = params.type;
        this._messager = params.messager || WindowMessageEmitter;

        this._loaderFrame = null;
        this._sessions = {};
        this._initializeStatus = '';
*/
    },

    setupMessageListener: function() {
        window.addEventListener('message', this._messageHandler, false);
    },

    _messageHandler: function(e) {
        if (e.origin !== 'chrome-extension://hheojobcpkekaanflpelinndlpjlpnfc')
            return ;

        console.log(e);

        var data = JSON.parse(e.data);

        switch (data.id) {
            case 'isSignined':
                var elements = document.querySelectorAll('.siteHeaderLogin');
                var isSignined;

                if (elements.length === 1)
                    isSignined = false;
                else
                    isSignined = true;

                e.source.postMessage(JSON.stringify({id: 'isSigninedCB', data: isSignined}), e.origin);
                break;

            default:
                break;
        }
    }
};

// main
var ndas = new NDAScript();
ndas.setupMessageListener();

// remove flash contaniner
document.getElementById('playerContainerWrapper').remove()

// get flashvar
var watchAPIDataContainer = document.getElementById('watchAPIDataContainer');
var jsInitalWatchData = document.getElementById('js-initial-watch-data');
var watchAPIData;
if (watchAPIDataContainer) {
    watchAPIData = JSON.parse(watchAPIDataContainer.innerHTML);
    console.log(watchAPIData);
} else if (jsInitalWatchData) {
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
