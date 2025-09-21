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
            /* ...existing code... */
        }
        /* ...existing code... */
    }
    /* @tweakable toggle device info collection */
    const DEVICE_INFO_ENABLED = true;
    if (typeof AdInMoSDK!=='undefined'){ if(!AdInMoSDK.prototype.collectDeviceInfo){ AdInMoSDK.prototype.collectDeviceInfo=function(){ if(!DEVICE_INFO_ENABLED) return {}; const c=document.createElement('canvas'); const tz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone;}catch(e){return 'Unknown';}})(); const webgl=(()=>{try{return !!(window.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl')));}catch(e){return false;}})(); return { userAgent:navigator.userAgent, platform:navigator.platform, language:navigator.language, languages:navigator.languages||[navigator.language], screen:{width:screen.width,height:screen.height,colorDepth:screen.colorDepth,pixelDepth:screen.pixelDepth}, viewport:{width:window.innerWidth,height:window.innerHeight}, devicePixelRatio:window.devicePixelRatio||1, timezone:tz, url:window.location.href, referrer:document.referrer, cookieEnabled:navigator.cookieEnabled, onLine:navigator.onLine, touchSupport:('ontouchstart'in window)||navigator.maxTouchPoints>0, webGL:webgl }; }; } }
    /* ...existing code... */
    global.AdInMoSDK = AdInMoSDK;
    global.AdInMoPlacement = AdInMoPlacement;
    /* ...existing code... */
})(typeof window !== 'undefined' ? window : this);