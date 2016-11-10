define(['storage'], function(storage) {
  'use strict';

  console.log('config.js');

  var init_config = {
    inited: true,
    lang: 'zh',
    defaultURL: 'http://www.nicovideo.jp/video_top',
    openWithDefaultPageFlag: true
  };

  return {
    init: function() {
      return storage.initConfig(init_config);
    },

    load: function() {
      return storage.loadConfig();
    }
  };

});
