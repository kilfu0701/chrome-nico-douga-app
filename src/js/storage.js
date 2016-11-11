define(['util', 'constants'], function(util, C) {
    'use strict';

    var NDA;
    var prefix = '[storage.js]'.padRight(C.LOG_PAD, ' ');

    var STORAGE_KEY_TABS_DATA = "tabs_data";
    var STORAGE_KEY_CONFIG = "config";

    var _tab_data_to_set = {};

    function default_tabs_data(){
        return {
            tabs: {}
        };
    }

    function init() {
        var df = $.Deferred();

        NDA = window.nicoDougaApp;
        window.console.log(prefix, '[init]');
        df.resolve();

        return df.promise();
    }

    function initConfig(data) {
        var df = $.Deferred();

        window.console.log(prefix, '[initConfig]', data);

        loadConfig().then(function(d) {
            if (d == undefined || d.inited == undefined) {
                saveConfig(data).then(function() {
                    df.resolve();
                });
            }

            df.resolve();
        });

        return df.promise();
    }

    function saveConfig(data) {
        var df = $.Deferred();
        var _data = {};

        window.console.log(prefix, '[saveConfig]', data);

        _data[STORAGE_KEY_CONFIG] = data
        chrome.storage.sync.set(_data, function(r) {
            df.resolve();
        });

        return df.promise();
    }

    function loadConfig() {
        var df = $.Deferred();

        chrome.storage.sync.get(STORAGE_KEY_CONFIG, function(item) {
            window.console.log(prefix, '[loadConfig]', item[STORAGE_KEY_CONFIG]);
            df.resolve(item[STORAGE_KEY_CONFIG]);
        });

        return df.promise();
    }

    function loadTabs(callback) {
        chrome.storage.local.get(STORAGE_KEY_TABS_DATA, function(items){
            var _tabs = items[STORAGE_KEY_TABS_DATA];
            if(_tabs === undefined)
                _tabs = default_tabs_data();
            callback(_tabs);
        });
    }

    function addTabsListener(callback){
        chrome.storage.onChanged.addListener(function(changes, area_name){
            var _tab_data = changes[STORAGE_KEY_TABS_DATA];
            if (_tab_data !== undefined)
                callback(_tab_data.newValue ? _tab_data.newValue : default_tabs_data());
        });
    }

    function setTabData(id, data, callback){
        var _perform_load = $.isEmptyObject(_tab_data_to_set);
        _tab_data_to_set[id] = data;
        if(_perform_load){
            loadTabs(function(tabs){
                $.each(_tab_data_to_set, function(id, data){
                    tabs.tabs[id] = data;
                });
                var _data = {};
                _data[STORAGE_KEY_TABS_DATA] = tabs;
                chrome.storage.local.set(_data);
                _tab_data_to_set = {};
            });
        }
    }

    function clear() {
        chrome.storage.local.clear();
    }

    return {
        loadTabs: loadTabs,
        addTabsListener: addTabsListener,
        setTabData: setTabData,
        initConfig: initConfig,
        saveConfig: saveConfig,
        loadConfig: loadConfig,
        clear: clear
    };

});
