var messageHandler = function(e) {
    console.log(e);

    if (e.origin !== 'chrome-extension://hheojobcpkekaanflpelinndlpjlpnfc')
        return ;

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

};

//window.removeEventListener('message', messageHandler);
window.addEventListener('message', messageHandler, false);
