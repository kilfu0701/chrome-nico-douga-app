chrome.app.runtime.onLaunched.addListener(function() {
    chrome.app.window.create('index.html', {
        id: 'main',
        outerBounds: {
            width: 800,
            height: 640
        }
    });
});

// background script
var app = {};

if (!Promise.defer) {
    Promise.defer = function () {
        let deferred = {};
        let promise = new Promise(function (resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject  = reject;
        });
        deferred.promise = promise;
        return deferred;
    };
}
app.Promise = Promise;

app.disk = {
    browse: function () {
        return new Promise(function (resolve, reject) {
            let wins = chrome.app.window.getAll();
            if (wins && wins.length) {
                let win = wins[0].contentWindow;
                win.chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function (folder) {
                    chrome.storage.local.set({
                        folder: chrome.fileSystem.retainEntry(folder)
                    });
                    resolve(folder.name);
                });
            } else {
                reject();
            }
        });
    }
};

app.play = (src) => {
    let audio = new Audio(chrome.runtime.getURL('/data/' + src));
    audio.play();
};

window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
app.fileSystem = {
    file: {
        exists: function (root, name) {
            return new Promise(function (resolve) {
                root.getFile(name, {create: true, exclusive: true}, () => resolve(false), () => resolve(true));
            });
        },
        create: function (root, name) {
            return new Promise(function (resolve, reject) {
                root.getFile(
                    name,    // a unique name
                    {create: true, exclusive: false},
                    (fe) => resolve(fe),
                    (e) => reject(e)
                );
            });
        },
        truncate: function (file, bytes) {
            return new Promise(function (resolve, reject) {
                file.createWriter(function (fileWriter) {
                    fileWriter.onwrite = () => resolve();
                    fileWriter.onerror = (e) => reject(e);
                    fileWriter.truncate(bytes);
                });
            });
        },
        write: function (file, offset, arr) {
            return new Promise(function (resolve, reject) {
                file.createWriter(function (fileWriter) {
                    let blob = new Blob(arr, {type: 'application/octet-stream'});
                    fileWriter.onerror = (e) => reject(e);
                    fileWriter.onwrite = () => resolve();
                    fileWriter.seek(offset);
                    fileWriter.write(blob);
                }, (e) => reject(e));
            });
        },
        md5: function (file, bytes) {
            return new Promise(function (resolve, reject) {
                if (!file) {
                    return resolve('file is not found');
                }
                if (bytes > 50 * 1024 * 1024) {
                    return resolve('MD5 calculation is skipped');
                }
                file.file(function (file) {
                    let reader = new FileReader();
                    reader.onloadend = function () {
                        resolve(CryptoJS.MD5(CryptoJS.enc.Latin1.parse(this.result)).toString());
                    };
                    reader.readAsBinaryString(file);
                }, (e) => reject(e));
            });
        },
        rename: function (file, root, name) {
            return new Promise((resolve, reject) => file.moveTo(root, name, resolve, reject));
        },
        remove: function (file) {
            return new Promise((resolve, reject) => file.remove(resolve, reject));
        },
        launch: () => Promise.reject(new Error('not implemented')),
        reveal: () => Promise.reject(new Error('not implemented')),
        close: () => Promise.resolve(),
        toURL: (file) => {
            return new Promise(function (resolve, reject) {
                file.file(f => resolve(URL.createObjectURL(f)), (e) => reject(e));
            });
        }
    },
    root: {
        internal: function (bytes) {
            return new Promise(function (resolve, reject) {
                navigator.webkitTemporaryStorage.requestQuota(bytes, function (grantedBytes) {
                    if (grantedBytes === bytes) {
                        window.requestFileSystem(
                            window.TEMPORARY, bytes, function (fs) {
                                resolve(fs.root);
                            },
                            (e) => reject(e)
                        );
                    }
                    else {
                        reject(new Error('cannot allocate space in the internal storage'));
                    }
                });
            });
        },
        external: function () {
            return new Promise(function (resolve, reject) {
                chrome.storage.local.get(null, function (storage) {
                    if (storage.folder && config.wget.directory) {
                        try {
                            chrome.fileSystem.restoreEntry(storage.folder, function (root) {
                                if (root) {
                                    resolve(root);
                                }
                                else {
                                    reject(new Error('storage.folder is undefined'));
                                }
                            });
                        }
                        catch (e) {
                            reject(e);
                        }
                    }
                    else {
                        reject(new Error('either storage.folder or config.wget.directory is undefined'));
                    }
                });
            });
        }
    }
};
