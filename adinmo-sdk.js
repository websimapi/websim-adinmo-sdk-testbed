(function(global) {
    'use strict';
    /* ...existing code... */
    class AdInMoSDK {
        constructor(config = {}) {
            this.config = {
                gameKey: config.gameKey || '',
                environment: config.environment || 'production',
                debugMode: config.debugMode || false,
                baseUrl: config.baseUrl || 'https://api.adinmo.com',
                enableAnalytics: config.enableAnalytics !== false,
                enableIAP: config.enableIAP || false,
                pollingInterval: config.pollingInterval || 30000,
                version: '1.0.0-js',
                ...config
            };
            /* ...existing code... */
            this.deviceInfo = this.collectDeviceInfo();
            this.log('AdInMo SDK created', this.config);
        }
        /* ...existing code... */
    }
    /* ...existing code... */
    class AdInMoPlacement {
        constructor(config) {
            this.id = config.id || this.generateId();
            this.sdk = config.sdk;
            /* ...existing code... */
            this.createDOM();
            this.setupEvents();
        }
        /* ...existing code... */
    }
    /* ...existing code... */
    global.AdInMoSDK = AdInMoSDK;
    global.AdInMoPlacement = AdInMoPlacement;
    /* ...existing code... */
})(typeof window !== 'undefined' ? window : this);

