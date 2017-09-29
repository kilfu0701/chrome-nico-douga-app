'use strict';

var utils = utils;
var io = io;
var app = app;
var wget = {};

// @param    {[type]} obj.url                     [url]
// @param    {[type]} obj.referrer            [referrer]
// @param    {[type]} obj.alternatives    [alternative urls]
// @param    {[type]} obj.folder                [folder path to store download link to (Firefox only)]
// @param    {[type]} obj.name                    [overwrite suggested file-name]
// @param    {[type]} obj.timeout             [timeout]
// @param    {[type]} obj['persistent-pause'] [persistent-pause = true is not being triggered automatically for resume]
// @param    {[type]} obj['temporary-pause'] [pause it for mow but can be resumed by resume triggers]
// @param    {[type]} obj.retries             [number of retries; 50]
// @param    {[type]} obj.headers             [headers; {}]
// @param    {[type]} obj.pause                 [delay in between multiple schedule calls; 100 mSecs]
// @param    {[type]} obj.use-native        [use native method to find the actual downloadable url]
// @param    {[type]} obj.writer                request writing to disk
// @param    {[type]} obj['min-segment-size'] [minimum thread size; 50 KBytes]
// @param    {[type]} obj['max-segment-size'] [maximum thread size; 50 MBytes]

(function () {
    function xhr (obj, range) {
        let d = app.Promise.defer(), loaded = 0, dead = false;
        let id = app.timer.setTimeout(() => d.reject(new utils.CError('timeout', 3, {url: obj.urls[0]})), obj.timeout);
        let reader = {
            cancel: function () {}
        };

        obj.event.on('abort', () => {
            d.reject(new utils.CError('abort', 2));
        });
        function process () {
            return reader.read().then(function (result) {
                app.timer.clearTimeout(id);
                id = app.timer.setTimeout(() => d.reject(new utils.CError('timeout', 3, {url: obj.urls[0]})), obj.timeout);

                let buffer = result.value;
                if (buffer && buffer.byteLength) {
                    let offset = loaded;
                    let length = buffer.byteLength;
                    loaded += length;
                    obj.event.emit('progress', {offset, length}, result.done);
                    return obj.writer(range, {offset, buffer}).then(function () {
                        return result.done ? d.resolve('done') : process();
                    });
                }
                else {
                    return result.done ? d.resolve('done') : process();
                }

            }).catch(e => d.reject(e));
        }
        let options = {headers: obj.headers};
        if (obj.referrer) {
            options.headers[app.globals.referrer] = obj.referrer;
        }
        app.fetch(obj.urls[0], options).then(function (res) {
            if (res.body) {
                reader = res.body.getReader();
            }
            if (dead) {
                reader.cancel();
            }
            if (!res.ok) {
                throw new utils.CError('fetch error', 4);
            }
            // make sure server supports partial content fetching; 206
            if (res.status && res.status !== 206 && obj.headers.Range) {
                throw new utils.CError(`expected 206 but got ${res.status}`, 1, {url: obj.urls[0]});
            }
            return process();
        }).catch((e) => d.reject(Object.assign(e, {code: 5, url: obj.urls[0]})));

        return utils.spy(d.promise, () => {
            dead = true;
            reader.cancel();
        });
    }
    function chunk (obj, range, event, report, writer) {
        obj = Object.assign({ // clone
            headers: {},
            event,
            writer
        }, obj);
        if (report) { // if download does not support multi-threading do not send range info
            obj.headers.Range = `bytes=${range.start}-${range.end}`;
        }
        return xhr(obj, range);
    }
    /**
     * Get information from a URL
     * @param    {[object]} obj         [{url, referrer}]
     * @param    {[boolean]} forced [send 'GET' instead of 'HEAD']
     * @param    {[object]} d             [defer object]
     * @return {[object]}                 [information object]
     */
    var head = function (obj, forced, d) {
        let req = new app.XMLHttpRequest();
        d = d || app.Promise.defer();

        req.open(forced ? 'GET' : 'HEAD', obj.url, true);
        req.setRequestHeader('Cache-Control', 'max-age=0');

        if (obj.referrer) {
            req.setRequestHeader(app.globals.referrer, obj.referrer);
        }

        function analyze () {
            let length = +req.getResponseHeader('Content-Length');
            let contentEncoding = req.getResponseHeader('Content-Encoding');
            let lengthComputable = req.getResponseHeader('Length-Computable');
            // console.error(req.getAllResponseHeaders(), obj)
            if (req.getResponseHeader('Content-Length') === null && !forced) {
                head(obj, true, d);
            }
            else {
                d.resolve({
                    'length': length,
                    'encoding': contentEncoding,
                    'url': req.responseURL,
                    'mime': req.getResponseHeader('Content-Type'),
                    'disposition': req.getResponseHeader('Content-Disposition'),
                    'simple-mode': contentEncoding !== null || lengthComputable === 'false' || length === 0,
                    'multi-thread': !!length &&
                        contentEncoding === null &&
                        req.getResponseHeader('Accept-Ranges') === 'bytes' &&
                        lengthComputable !== 'false'
                });
            }
        }

        req.onreadystatechange = function () {
            if ((req.readyState === 2 || req.readyState === 3 || req.readyState === 4) && forced) {
                analyze();
                req.abort();
            }
        };
        req.onerror = analyze;
        req.onload = analyze;
        req.onerror = req.ontimeout = (e) => d.reject(e);
        req.timeout = 60000;
        req.send();
        return d.promise;
    };

    function aget (obj, restore) {
        obj.threads = obj.threads || 1;
        obj.retries = obj.retries || 30;
        obj.alternatives = (obj.alternatives || []).filter(url => url);
        obj.urls = [];

        let event = new app.EventEmitter(), d = app.Promise.defer(), segments = [], info, lastCount = 0;

        let internals = {};
        let buffers = [];
        let idSchedule;

        function writer (range, e) {
            let start = e.offset + range.start;
            let end = start + e.buffer.byteLength;
            let match = buffers.filter(o => o.end === start);

            if (match.length) {
                let index = buffers.indexOf(match[0]);
                buffers[index].end = end;
                buffers[index].segments.push(e.buffer);
                if (end - buffers[index].start > obj['write-size']) {
                    let buffer = buffers[index];
                    buffers.splice(index, 1);
                    return internals.file.write(buffer.start, buffer.segments);
                }
            }
            else {
                buffers.push({
                    start: start,
                    end: end,
                    segments: [e.buffer]
                });
            }
            return app.Promise.resolve();
        }

        utils.assign(internals, 'status', event)
                 .assign(internals, 'retries', event, 0);

        event.on('status', (s) => event.emit('add-log', `Download status is changed to **${s}**`));


        if (restore) {
            info = restore.info;
            internals.status = 'pause';
            event.emit('info', info);
        }
        else {
            internals.status = 'head';    // 'head', 'download', 'error', 'done', 'pause'
        }


        function count () {
            let c = segments.filter(s => s.status === 'downloading').length;
            lastCount = c;
            event.emit('count', c);
            return c;
        }
        function done (s) {
            internals.status = s || internals.status;
            event.emit('count', 0);
            if (s === 'error') {
                segments.forEach(s => s.event.emit('abort'));
                d.reject();
            }
            else {
                d.resolve(s);
            }
            segments = [];
        }
        function callSchedule (time) {
            app.timer.clearTimeout(idSchedule);
            idSchedule = app.timer.setTimeout(schedule, time || obj.pause || 500);
        }
        event.on('call-schedule', callSchedule);
        function schedule () {
            if (['error', 'pause', 'done'].indexOf(internals.status) !== -1) {
                return;
            }
            if (internals.ranges.length === 0) {
                return done('done');
            }
            let ranges = internals.ranges
                .filter(a => internals.locks.indexOf(a) === -1)
                .sort((a, b) => a.start - b.start);

            let c = count();
            if (ranges.length && c < obj.threads) {
                add(obj, ranges[0]);
                internals.locks.push(ranges[0]);
            }
            else {
                return;
            }
            //
            if (c < obj.threads) {
                callSchedule();
            }
        }
        function fix (range) {
            let rngs = internals.ranges.filter(r => r.start <= range.start && r.end >= range.end);
            if (rngs.length !== 1) {
                event.emit('add-log', 'Internal Error: \`internals.ranges.length\` is not equal to one', {type: 'error'});
                return done('error');
            }
            if (rngs[0].start < range.start) {
                event.emit('add-log', 'Internal Error: \`rngs[0].start\` is not euqal to range.start', {type: 'error'});
                return done('error');
            }
            if (rngs[0].end > range.end) {
                (function (tmp) {
                    internals.ranges.push(tmp);
                    internals.locks.push(tmp);
                })({
                    start: range.end + 1,
                    end: rngs[0].end
                });
            }
            // removing the old range and free up its index
            internals.ranges.splice(internals.ranges.indexOf(rngs[0]), 1);
            internals.locks.splice(internals.locks.indexOf(rngs[0]), 1);
            //percent
            let remained = internals.ranges.reduce((p, c) => p += c.end - c.start, 0);
            let percent = parseInt((info.length - remained) / info.length * 100);
            if (isNaN(fix.percent) || fix.percent < percent) {
                event.emit('percent', internals.ranges.reduce((p, c) => p += c.end - c.start, 0), info.length);
            }
            fix.percent = percent;
        }

        function add (obj, range) {
            // rotating mirrors
            obj.urls.push(obj.urls.shift());
            let e = new app.EventEmitter(), progress;
            e.on('progress', (obj) => fix({
                start: obj.offset + range.start,
                end: obj.offset + obj.length + range.start - 1
            }));
            let tmp = {
                status: 'downloading',
                range: range,
                event: e,
                // we will use id as progress color as well
                id: '#' + Math.floor(Math.random() * 16777215).toString(16)
            };
            segments.push(tmp);
            // reporting counts
            count();

            e.on('progress', (function (oldPercent) {
                return function (obj) {
                    let percent = parseInt((obj.offset + obj.length) / info.length * 100);
                    if (isNaN(oldPercent) || percent > oldPercent || percent === 100) {
                        event.emit('progress', tmp, obj);
                        oldPercent = percent;
                    }
                    event.emit('progress-for-speed', tmp, obj);
                    progress = obj;
                };
            })());

            function after () {
                // clean up
                e.removeAllListeners();
                // report
                if (progress) {
                    event.emit('progress', tmp, progress);
                }
            }
            function omitURL (url) {
                let index = obj.urls.indexOf(url);
                if (index !== -1) {
                    obj.urls.splice(index, 1);
                    event.emit('add-log', `${url} is removed from url list due to a fetch error`, {type: 'warning'});
                }
            }

            chunk(
                obj, range, e,
                range.start !== 0 || (range.end !== info.length - 1 && range.end !== Infinity),
                writer
            ).then(
                function (status) {
                    if (info['simple-mode'] && status === 'done') {
                        internals.ranges = [];
                        internals.locks = [];
                    }
                    tmp.status = status;
                    after();
                    callSchedule(obj['short-pause'] || 100);
                },
                function (e) {
                    tmp.status = 'error';
                    event.emit('add-log', `fetch error[${e.code}]; "${e.message}"`, {type: 'warning'});
                    after();
                    if (e.message === 'abort' || e.code === 2) {
                        // removing locked ranges inside the chunk with abort code
                        internals.locks = internals.locks.filter(r => r.start < range.start || r.end > range.end);
                    }
                    else {
                        if (internals.retries < obj.retries && info['multi-thread']) {
                            if (internals.locks.filter(r => r.start === range.start).length) {
                                internals.retries += 1;
                            }
                            // removing locked ranges inside the chunk with error code
                            internals.locks = internals.locks.filter(r => r.start < range.start || r.end > range.end);

                            // should I validate the failed url
                            if (obj.urls.length > 1 && e.url && e.code !== 1) { // check link
                                head({url: e.url, referrer: obj.referrer}).then(function (i) {
                                    if (i.length !== info.length) {
                                        omitURL(e.url);
                                    }
                                }, () => omitURL(e.url)).then(callSchedule);
                            }
                            // server is not supporting ranging; still there are other sources
                            else if (obj.urls.length > 1 && e.url && e.code === 1) {
                                omitURL(e.url);
                                callSchedule();
                            }
                            // server is not supporting ranging and there is no other source
                            else if (obj.urls.length === 1 && e.code === 1) {
                                // reseting download with a single thread
                                if (range.start === 0) {
                                    segments.forEach(s => s.event.emit('abort'));
                                    obj.threads = 1;
                                    internals.locks = [];
                                    internals.ranges = [{
                                        start: 0,
                                        end: info.length - 1
                                    }];
                                    info['multi-thread'] = false;
                                    event.emit('info', info);
                                    event.emit('add-log', 'resuming with one thread', {type: 'warning'});
                                    callSchedule();
                                }
                                else {
                                    // wait a bit longer before trying again as server requested reset
                                    callSchedule((obj.pause || 500) * 4);
                                }
                            }
                            else { // there is no alternative mirror; just try with this one
                                callSchedule();
                            }
                        }
                        else {
                            return event.emit('pause');
                        }
                    }
                }
            );
        }
        function guess (obj) {
            let url = obj.urls[0], name = obj.name, mime = (obj.mime || '').split(';').shift(), disposition = obj.disposition;
            if (!name && disposition) {
                let tmp = /filename\=([^\;]*)/.exec(disposition);
                if (tmp && tmp.length) {
                    name = tmp[1].replace(/[\"\']$/, '').replace(/^[\"\']/, '');
                }
            }
            if (!name) {
                url = url.replace(/\/$/, '');
                let tmp = /(title|filename)\=([^\&]+)/.exec(url);
                if (tmp && tmp.length) {
                    name = tmp[2];
                }
                else {
                    name = url.substring(url.lastIndexOf('/') + 1);
                }
                name = decodeURIComponent(name.split('?')[0].split('&')[0]) || 'unknown';
            }
            // extracting extension from file name
            let se = /\.\w{2,}$/.exec(name);
            if (se && se.length) {
                name = name.replace(se[0], '');
            }
            // removing exceptions
            name = name.replace(/[\\\/\:\*\?\"<\>\|\"]/g, '-');
            // removing trimming white spaces
            name = name.trim();
            if (se && se.length) {
                return name + se[0];
            }
            // extension
            let extension =    app.mimes[mime] || '';
            if (extension) {
                let r = new RegExp('\.(' + extension.join('|') + ')$');
                name = name.replace(r, '');
                return name + '.' + extension[0];
            }
            else {
                return name;
            }
        }
        //
        event.on('info', function () {
            if (info.length === 0) {
                event.emit('add-log', '\`info.length\` is equal to zero', {type: 'warning'});
            }
            if (info.encoding) {
                event.emit('add-log', '\`info.encoding\` is not null', {type: 'warning'});
            }
            if (restore) {
                internals.ranges = restore.internals.ranges;
                internals.locks = [];
                internals.status = 'pause';
                internals.name = restore.file.name;

            }
            else {
                (function (len) {
                    len = Math.max(len, obj['min-segment-size'] || 50 * 1024);
                    len = Math.min(len, obj['max-segment-size'] || 100 * 1024 * 1024);
                    len = Math.min(info.length, len);

                    let threads = Math.floor(info.length / len);
                    if (!info['multi-thread']) {
                        threads = 1;
                    }
                    let arr = Array.from(new Array(threads), (x, i) => i);
                    internals.ranges = arr.map((a, i, l) => ({
                        start: a * len,
                        end: l.length === i + 1 ? info.length - 1 : (a + 1) * len - 1
                    }));
                    internals.locks = [];
                })(Math.floor(info.length / obj.threads));

                if (info['simple-mode']) {
                    internals.ranges[0].end = Infinity;
                    event.emit('add-log', 'Server does not support multi-threading; Either file-size is not defined or file is encoded', {type: 'warning'});
                }

                internals.status = 'download';

                internals.name = guess(Object.assign({
                    mime: info.mime,
                    disposition: info.disposition
                }, obj));

            }

            event.emit('mime', info.mime);
            internals.file = new io.File({
                name: internals.name,
                mime: info.mime,
                path: obj.folder,
                length: info.length,
                append: restore ? true : false
            });
            event.emit('name', 'Allocating space ...');

            internals.file.open().then(function (name) {
                event.emit('name', internals.name);
                // sync the names
                if (name && name !== internals.name) {
                    internals.name = name;
                    event.emit('name', internals.name);
                    if (obj['pause-on-exists']) {
                        event.emit('add-log', 'File with the same name already exists. Pausing the download for user attention.', {type: 'warning'});
                        app.notification('You new download is paused as a file with the same name exists. Resume if needed.');
                        obj['persistent-pause'] = true;
                    }
                    else {
                        event.emit('add-log', 'File with the same name already exists. Still downloading due to "pause-on-exists" argument.', {type: 'warning'});
                    }
                }

                function validateMirrors () {
                    return Promise.all(obj.alternatives.map(url => head({url, referrer: obj.referrer}).catch(() => null)))
                    .then(arr => arr.filter(a => a))
                    .then(arr => arr.filter(i => {
                        if (i.length === info.length) {
                            event.emit('add-log', `${i.url} is added as a mirror`);
                        }
                        else {
                            event.emit('add-log', `Cannot use ${i.url} as a mirror. Server returns **${i.length}** bytes for file-size`, {type: 'warning'});
                        }
                        return i.length === info.length;
                    }))
                    .then(arr => arr.map(i => i.url))
                    .then(urls => {
                        obj.urls = obj.urls.concat(urls);
                    });
                }
                if (restore) {
                    event.emit('add-log', 'This job is restored from session manager');
                    event.emit('pause');
                }
                else if (obj['temporary-pause'] || obj['persistent-pause']) {
                    event.emit('pause');
                    if (internals.ranges.length > 1) {
                        validateMirrors();
                    }
                    if (internals.ranges.length === 1 && obj.alternatives.length) {
                        event.emit('add-log', 'I am not going to validate mirrors as this download is single threaded', {type: 'warning'});
                    }
                }
                else {
                    if (internals.ranges.length === 1 || !obj.alternatives.length) {
                        schedule();
                        if (obj.alternatives.length) {
                            event.emit('add-log', 'I am not going to validate mirrors as this download is single threaded', {type: 'warning'});
                        }
                    }
                    else {
                        let tmp = obj.threads;
                        obj.threads = 1;
                        schedule();
                        validateMirrors().then(function () {
                            obj.threads = tmp;
                            schedule();
                        });
                    }
                }
            }).catch((e) => {
                event.emit('add-log', `Cannot open file; ${e.message || e}`, {type: 'error'});
                done('error');
            });
        });
        // pause
        event.on('pause', function (manual) {
            // do not let triggers to resume the download when it goes to the pause mode
            if (manual) {
                obj['persistent-pause'] = true;
            }
            internals.status = 'pause';
            segments.forEach(s => s.event.emit('abort'));
            count();
            // write all leftovers
            app.Promise.all(buffers.map(b => internals.file.write(b.start, b.segments))).catch(e => {
                event.emit('add-log', `Cannot open file; ${e.message || e}`, {type: 'error'});
                done('error');
            });
        });
        event.on('resume', function () {
            if (internals.status === 'pause') {
                internals.retries = 0;
                if (internals.locks.length) {
                    internals.locks = [];
                }
                internals.status = 'download';
                schedule();
            }
        });
        // cancel
        event.on('cancel', () => done('error'));
        // error
        event.on('error', function () {
            if (internals.status !== 'error') {
                done('error');
            }
        });
        event.on('rename', function (name) {
            name = name.trim();
            if (name && internals.name !== name) {
                internals.file.rename(name).then(() => {
                    internals.name = name;
                    event.emit('name', internals.name);
                    event.emit('log', `File-name is changed to ${internals.name}`);
                },
                (e) => {
                    event.emit('add-log', `**Unsuccesful** renaming; ${e.message}`, {type: 'warning'});
                    app.notification(e.message);
                });
            }
        });
        event.on('info', () => {
            event.emit('add-log', `File mime type is **${info.mime}**`);
            event.emit('add-log', `File encoding is **${info.encoding}**`);
            event.emit('add-log', `Server multi-threading support status is **${info['multi-thread']}**`);
            event.emit('add-log', `File length in bytes is **${info.length}**`);
            event.emit('add-log', `Actual downloadable URL is ${obj.urls[0]}`);
        });

        // getting header
        // if use-native is true, app.sandbox finds the actual downloadable url
        (function () {
            return new app.Promise(function (resolve) {
                if (obj['use-native']) {
                    event.emit('add-log', 'waiting for native-method to catch download link ...');
                    return app.sandbox(obj.url, {
                        'referrer': obj.referrer,
                        'no-response': 40 * 1000
                    }).then(function (url) {
                        event.emit('add-log', `native-method returned ${url}`);
                        obj.url = url;
                        resolve();
                    }).catch (function () {
                        event.emit('add-log', `native-method is not responding; timeout`, {type: 'warning'});
                        resolve();
                    });
                }
                else {
                    resolve();
                }
            });
        })()
        .then(() => app.Promise.race([obj.url, obj.url, obj.url].map(url => head({url, referrer: obj.referrer}))))
        .then(
            function (i) {
                info = i;
                obj.urls = [info && info.url ? info.url : obj.url]; // bypass redirects
                event.emit('info', info);
            },
            (e) => {
                event.emit('add-log', `Cannot get file information form server; ${e.message}`, {type: 'error'});
                done('error');
            }
        );
        let promise;
        promise = utils.spy(d.promise, function () {
            return app.Promise.all(buffers.map(b => internals.file.write(b.start, b.segments)))
                .then(() => buffers = [])
                .then(() => internals.file.flush())
                .then(function () {
                    if (info.length > (obj['max-size-md5'] || 500 * 1024 * 1024)) {
                        return 'MD5 calculation is skipped';
                    }
                    return internals.file.md5();
                })
                .then(function (md5) {
                    internals.md5 = md5;
                    event.emit('md5', md5);
                    event.emit('add-log', `MD5 checksum is **${md5}**`);
                    return internals.status;
                });
        });
        promise = utils.spy(promise, function () {
            return internals.file.close().then().catch(function (){});
        });
        return {
            event,
            promise,
            session: restore ? restore.id : null,
            resolve: d.resolve,
            reject: d.reject,
            get segments () {return segments;},
            get threads () {return lastCount;},
            get status () {return internals.status;},
            get retries () {return internals.retries;},
            get info () {return info;},
            get internals () {return internals;},
            isAvailable: () => obj['persistent-pause'] ? false : true,
            modify: function (uo) {
                obj.threads = uo.threads || obj.threads;
                obj.timeout = uo.timeout ? uo.timeout * 1000 : obj.timeout;
                if (uo.name !== internals.name) {
                    event.emit('rename', uo.name.replace(/[\\\/\:\*\?\"<\>\|\"]/g, '-')); // removing exceptions
                }
                if (uo.url && obj.urls.indexOf(uo.url) === -1) {
                    app.Promise.race([uo.url, uo.url, uo.url].map(url => head({url, referrer: obj.referrer}))).then(
                        function (i) {
                            if (info.length === i.length) {
                                if (obj.urls.indexOf(i.url) === -1) {
                                    obj.urls = obj.urls.concat(i.url);
                                    event.emit('add-log', `[${i.url}](${i.url}) is appeded as a mirror. Total number of downloadable links is **${obj.urls.length}**`);
                                }
                                else {
                                    event.emit('add-log', `[${i.url}](${i.url}) is already in the list`, {type: 'warning'});
                                }
                            }
                            else {
                                event.emit('add-log', `Applying the new URL failed. ${uo.url} returns **${i.length}** bytes for file-size`, {type: 'warning'});
                            }
                        },
                        (e) => event.emit('add-log', `Cannot change URL; Cannot access server; ${e.message}.`, {type: 'warning'})
                    );
                }
            }
        };
    }
    /* handling IO */
    function bget (obj, restore) {
        return aget(obj, restore);
    }
    /* handling speed measurement */
    function cget (obj, restore) {
        let b = bget(obj, restore), id, stats = [0];
        let zeroReport = false;
        obj.update = obj.update || 1000;

        function done () {
            app.timer.clearInterval(id);
            update();
        }
        function speed () {
            return stats.reduce((p, c) => p + c, 0) / stats.length / obj.update * 1000;
        }
        function update () {
            b.event.emit('speed', speed());
            stats.push(0);
            stats = stats.slice(-5);
            if (stats.filter(s => s).length === 0) {
                if (b.internals.status === 'download' && zeroReport) {
                    zeroReport = false;
                    b.event.emit('add-log', 'Server seems to be done', {type: 'warning'});
                    app.timer.setTimeout(function () {
                        if (stats.filter(s => s).length === 0 && b.internals.status === 'download') {
                            b.event.emit('call-schedule');
                            b.event.emit('add-log', 'Requesting a new thread', {type: 'warning'});
                        }
                    }, obj.timeout);
                }
            }
            else {
                zeroReport = true;
            }
        }
        function start () {
            app.timer.clearInterval(id);
            id = app.timer.setInterval(update, obj.update);
        }
        b.event.on('progress-for-speed', function (d, obj) {
            stats[stats.length - 1] += obj.length;
        });
        b.event.on('pause', function () {
            stats = [0];
            done();
        });
        b.event.on('resume', start);
        if (!restore) {
            start();
        }

        b.promise = utils.spy(b.promise, done);

        Object.defineProperty(b, 'speed', {
            get: function () {
                return speed();
            }
        });
        return b;
    }
    //listeners clean up
    function vget (obj, restore) {
        let c = cget(obj, restore);

        c.promise = utils.spy(c.promise, function () {
            app.timer.setTimeout(() => c.event.removeAllListeners(), 5000);
        });

        return c;
    }
    wget.download = vget;
})();
