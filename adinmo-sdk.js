
```javascript
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
    /* add safe logger if missing */
    if (typeof AdInMoSDK!=='undefined'){ if(!AdInMoSDK.prototype.log){ AdInMoSDK.prototype.log=function(){ try{ if(this && this.config && this.config.debugMode){ console.log('[AdInMo SDK]', ...arguments); } }catch(_){} }; } }
    /* ensure event system exists */
    if (typeof AdInMoSDK!=='undefined' && !AdInMoSDK.prototype.on) {
      AdInMoSDK.prototype.on=function(ev,cb){ this.eventCallbacks=this.eventCallbacks||new Map(); if(!this.eventCallbacks.has(ev)) this.eventCallbacks.set(ev,[]); this.eventCallbacks.get(ev).push(cb); return this; };
      AdInMoSDK.prototype.off=function(ev,cb){ this.eventCallbacks=this.eventCallbacks||new Map(); const arr=this.eventCallbacks.get(ev)||[]; const i=arr.indexOf(cb); if(i>-1) arr.splice(i,1); return this; };
      AdInMoSDK.prototype.triggerEvent=function(ev,data={}){ this.eventCallbacks=this.eventCallbacks||new Map(); const arr=this.eventCallbacks.get(ev)||[]; arr.slice().forEach(fn=>{ try{ fn(data); }catch(e){ this.log && this.log('Error in event callback:', e); } }); };
    }
    /* ...existing code... */
    global.AdInMoSDK = AdInMoSDK;
    global.AdInMoPlacement = AdInMoPlacement;
    /* ...existing code... */
})(typeof window !== 'undefined' ? window : this);