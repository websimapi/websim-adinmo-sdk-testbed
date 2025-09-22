(function(global) {
    'use strict';

    /**
     * Main AdInMo SDK Class
     * Based on Unity AdinmoManager
     */
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

            // Core state
            this.isInitialized = false;
            this.sessionId = null;
            this.placements = new Map();
            this.eventCallbacks = new Map();
            
            // Analytics tracking
            this.impressionCount = 0;
            this.clickCount = 0;
            this.sessionStartTime = Date.now();
            
            // Message polling (Unity GetMessageFromServer equivalent)
            this.messagePoller = null;
            this.isPolling = false;
            
            // Device info collection
            this.deviceInfo = this.collectDeviceInfo();
            
            this.log('AdInMo SDK created', this.config);
        }

        /**
         * Initialize SDK - equivalent to Unity Initialize()
         */
        async initialize() {
            if (this.isInitialized) {
                this.log('SDK already initialized');
                return Promise.resolve();
            }

            if (!this.config.gameKey) {
                throw new Error('Game Key is required. Get it from https://www.adinmo.com/portal');
            }

            try {
                this.log('Initializing AdInMo SDK...');
                
                // Generate session ID
                this.sessionId = this.generateSessionId();
                
                // Initialize session with AdInMo backend
                await this.initializeSession();
                
                // Start message polling (Unity equivalent)
                this.startMessagePolling();
                
                // Setup browser event listeners
                this.setupBrowserEvents();
                
                this.isInitialized = true;
                this.log('SDK initialized successfully');
                this.triggerEvent('sdkInitialized', { sessionId: this.sessionId });
                
                return Promise.resolve();
                
            } catch (error) {
                this.log('SDK initialization failed:', error);
                this.triggerEvent('sdkInitializationFailed', { error: error.message });
                throw error;
            }
        }

        /**
         * Create ad placement - equivalent to Unity AdinmoTexture
         */
        createPlacement(config) {
            if (!this.isInitialized) {
                throw new Error('SDK not initialized. Call initialize() first.');
            }

            const placement = new AdInMoPlacement({
                ...config,
                sdk: this,
                sessionId: this.sessionId
            });

            this.placements.set(placement.id, placement);
            this.log(`Created placement: ${placement.id}`);
            
            return placement;
        }

        /**
         * Get placement by ID
         */
        getPlacement(id) {
            return this.placements.get(id);
        }

        /**
         * Load ad for placement
         */
        async loadAd(placementId) {
            const placement = this.getPlacement(placementId);
            if (!placement) {
                throw new Error(`Placement ${placementId} not found`);
            }
            return await placement.loadAd();
        }

        /**
         * Show ad for placement
         */
        async showAd(placementId) {
            const placement = this.getPlacement(placementId);
            if (!placement) {
                throw new Error(`Placement ${placementId} not found`);
            }
            return await placement.show();
        }

        /**
         * Hide ad for placement
         */
        hideAd(placementId) {
            const placement = this.getPlacement(placementId);
            if (placement) {
                placement.hide();
            }
        }

        /**
         * Track impression - Unity equivalent
         */
        async trackImpression(placementId, adData) {
            try {
                this.impressionCount++;
                
                const payload = {
                    event: 'impression',
                    placementId: placementId,
                    adId: adData.id,
                    sessionId: this.sessionId,
                    timestamp: Date.now(),
                    impressionCount: this.impressionCount,
                    deviceInfo: this.deviceInfo
                };

                await this.sendAnalytics('/track/impression', payload);
                this.triggerEvent('impressionTracked', { placementId, adData });
                
            } catch (error) {
                this.log('Failed to track impression:', error);
            }
        }

        /**
         * Track click - Unity equivalent
         */
        async trackClick(placementId, adData, clickPosition = null) {
            try {
                this.clickCount++;
                
                const payload = {
                    event: 'click',
                    placementId: placementId,
                    adId: adData.id,
                    clickPosition: clickPosition,
                    sessionId: this.sessionId,
                    timestamp: Date.now(),
                    clickCount: this.clickCount,
                    deviceInfo: this.deviceInfo
                };

                await this.sendAnalytics('/track/click', payload);
                this.triggerEvent('clickTracked', { placementId, adData, clickPosition });
                
                // Open click URL if available
                if (adData.clickUrl) {
                    window.open(adData.clickUrl, '_blank');
                }
                
            } catch (error) {
                this.log('Failed to track click:', error);
            }
        }

        /**
         * Initialize session with AdInMo backend
         */
        async initializeSession() {
            const payload = {
                gameKey: this.config.gameKey,
                sessionId: this.sessionId,
                platform: 'web',
                sdkVersion: this.config.version,
                deviceInfo: this.deviceInfo,
                timestamp: Date.now()
            };

            return await this.makeAPICall('/session/init', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        /**
         * Send analytics data
         */
        async sendAnalytics(endpoint, data) {
            return await this.makeAPICall(endpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        /**
         * Make API call to AdInMo backend
         */
        async makeAPICall(endpoint, options = {}) {
            const url = `${this.config.baseUrl}${endpoint}`;
            
            const defaultHeaders = {
                'Content-Type': 'application/json',
                'X-AdInMo-Game-Key': this.config.gameKey,
                'X-AdInMo-Session-ID': this.sessionId || '',
                'X-AdInMo-SDK-Version': this.config.version,
                'User-Agent': navigator.userAgent
            };

            const requestOptions = {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers
                }
            };

            try {
                const response = await fetch(url, requestOptions);
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Could not read error response body.');
                    this.log(`API call HTTP error: ${response.status} ${response.statusText}`, errorText);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                }
                
                return await response.text();
                
            } catch (error) {
                this.log(`API call failed to endpoint: ${endpoint}`);
                this.log('Request URL:', url);
                
                if (error.name === 'TypeError' && error.message.toLowerCase().includes('failed to fetch')) {
                    this.log('This is a common network error. Here are the likely causes:');
                    this.log('1. CORS Policy: The server at the API endpoint does not allow requests from this origin. This is the most common issue. The server needs to return an `Access-Control-Allow-Origin: *` header (or your specific domain) in response to a pre-flight OPTIONS request.');
                    this.log('2. Network Connectivity: Check your internet connection, DNS settings, or any firewalls/proxies that might be blocking the request.');
                    this.log('3. Invalid URL / Server Down: Ensure the Base URL is correct and the API server is online and accessible from your network.');
                    this.log('4. Mixed Content: If this test page is served over HTTP, it cannot make requests to an HTTPS API. Ensure both are using HTTPS.');
                    this.log('Check the browser\'s developer console (usually F12) in the "Console" and "Network" tabs for more specific error messages from the browser itself.');
                } else {
                    this.log('An unexpected network error occurred:', error);
                }
                
                throw error;
            }
        }

        /**
         * Message polling - Unity GetMessageFromServer equivalent
         */
        startMessagePolling() {
            if (this.isPolling) return;
            
            this.isPolling = true;
            this.pollMessages();
        }

        async pollMessages() {
            if (!this.isPolling || !this.isInitialized) return;

            try {
                const messages = await this.makeAPICall('/messages/poll', {
                    method: 'GET'
                });

                if (messages && Array.isArray(messages) && messages.length > 0) {
                    messages.forEach(message => this.handleServerMessage(message));
                }
                
            } catch (error) {
                this.log('Message polling error:', error);
            }

            // Schedule next poll
            if (this.isPolling) {
                this.messagePoller = setTimeout(() => this.pollMessages(), this.config.pollingInterval);
            }
        }

        /**
         * Handle server messages
         */
        handleServerMessage(message) {
            this.log('Server message:', message);
            
            switch (message.type) {
                case 'ad_update':
                    this.handleAdUpdate(message.data);
                    break;
                case 'config_update':
                    this.handleConfigUpdate(message.data);
                    break;
                case 'placement_update':
                    this.handlePlacementUpdate(message.data);
                    break;
                default:
                    this.log('Unknown message type:', message.type);
            }
        }

        handleAdUpdate(data) {
            const placement = this.getPlacement(data.placementId);
            if (placement) {
                placement.updateAd(data.adData);
            }
        }

        handleConfigUpdate(data) {
            Object.assign(this.config, data);
            this.triggerEvent('configUpdated', data);
        }

        handlePlacementUpdate(data) {
            const placement = this.getPlacement(data.placementId);
            if (placement) {
                placement.updateConfig(data.config);
            }
        }

        /**
         * Setup browser-specific event listeners
         */
        setupBrowserEvents() {
            // Page visibility changes
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.triggerEvent('appPaused');
                    this.pauseSDK();
                } else {
                    this.triggerEvent('appResumed');
                    this.resumeSDK();
                }
            });

            // Window focus/blur
            window.addEventListener('focus', () => {
                this.triggerEvent('appFocused');
                this.resumeSDK();
            });
            
            window.addEventListener('blur', () => {
                this.triggerEvent('appBlurred');
                this.pauseSDK();
            });

            // Before page unload
            window.addEventListener('beforeunload', () => {
                this.cleanup();
            });

            // Online/offline status
            window.addEventListener('online', () => {
                this.triggerEvent('connectionRestored');
                this.resumeSDK();
            });
            
            window.addEventListener('offline', () => {
                this.triggerEvent('connectionLost');
                this.pauseSDK();
            });
        }

        /**
         * Pause SDK operations
         */
        pauseSDK() {
            this.isPolling = false;
            if (this.messagePoller) {
                clearTimeout(this.messagePoller);
                this.messagePoller = null;
            }
        }

        /**
         * Resume SDK operations
         */
        resumeSDK() {
            if (this.isInitialized && !this.isPolling) {
                this.startMessagePolling();
            }
        }

        /**
         * Cleanup resources
         */
        cleanup() {
            this.isPolling = false;
            this.isInitialized = false;
            
            if (this.messagePoller) {
                clearTimeout(this.messagePoller);
                this.messagePoller = null;
            }
            
            // Hide all placements
            this.placements.forEach(placement => placement.hide());
            
            this.triggerEvent('sdkCleanup');
        }

        /**
         * Collect device information
         */
        collectDeviceInfo() {
            return {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                languages: navigator.languages || [navigator.language],
                screen: {
                    width: screen.width,
                    height: screen.height,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                devicePixelRatio: window.devicePixelRatio || 1,
                timezone: this.getTimezone(),
                url: window.location.href,
                referrer: document.referrer,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine,
                touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
                webGL: this.detectWebGL()
            };
        }

        getTimezone() {
            try {
                return Intl.DateTimeFormat().resolvedOptions().timeZone;
            } catch (e) {
                return 'Unknown';
            }
        }

        detectWebGL() {
            try {
                const canvas = document.createElement('canvas');
                return !!(window.WebGLRenderingContext && (
                    canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
                ));
            } catch (e) {
                return false;
            }
        }

        /**
         * Event system
         */
        on(event, callback) {
            if (!this.eventCallbacks.has(event)) {
                this.eventCallbacks.set(event, []);
            }
            this.eventCallbacks.get(event).push(callback);
            return this;
        }

        off(event, callback) {
            if (this.eventCallbacks.has(event)) {
                const callbacks = this.eventCallbacks.get(event);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
            return this;
        }

        triggerEvent(event, data = {}) {
            if (this.eventCallbacks.has(event)) {
                this.eventCallbacks.get(event).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        this.log('Error in event callback:', error);
                    }
                });
            }
        }

        /**
         * Utility methods
         */
        generateSessionId() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2);
            return `web_${timestamp}_${random}`;
        }

        log(...args) {
            if (this.config.debugMode) {
                console.log('[AdInMo SDK]', ...args);
            }
        }
    }

    /**
     * Ad Placement Class - equivalent to Unity AdinmoTexture
     */
    class AdInMoPlacement {
        constructor(config) {
            this.id = config.id || this.generateId();
            this.sdk = config.sdk;
            this.sessionId = config.sessionId;
            
            // Placement configuration
            this.container = config.container;
            this.size = config.size || { width: 320, height: 50 };
            this.position = config.position || { x: 0, y: 0 };
            this.aspectRatio = config.aspectRatio || 'landscape';
            this.placementType = config.placementType || 'banner';
            this.zIndex = config.zIndex || 1000;
            
            // State
            this.isLoaded = false;
            this.isVisible = false;
            this.currentAd = null;
            
            // DOM elements
            this.element = null;
            this.adElement = null;
            
            this.createDOM();
            this.setupEvents();
        }

        /**
         * Load ad content
         */
        async loadAd() {
            try {
                this.sdk.log(`Loading ad for placement ${this.id}`);

                const requestData = {
                    placementId: this.id,
                    size: this.size,
                    aspectRatio: this.aspectRatio,
                    placementType: this.placementType,
                    sessionId: this.sessionId,
                    deviceInfo: this.sdk.deviceInfo,
                    timestamp: Date.now()
                };

                const response = await this.sdk.makeAPICall('/ads/request', {
                    method: 'POST',
                    body: JSON.stringify(requestData)
                });

                if (response && response.ad) {
                    this.currentAd = response.ad;
                    await this.renderAd();
                    this.isLoaded = true;
                    
                    this.sdk.triggerEvent('adLoaded', { 
                        placementId: this.id, 
                        ad: this.currentAd 
                    });
                    
                    return this.currentAd;
                } else {
                    throw new Error('No ad content available');
                }

            } catch (error) {
                this.sdk.log('Failed to load ad:', error);
                this.sdk.triggerEvent('adLoadFailed', { 
                    placementId: this.id, 
                    error: error.message 
                });
                throw error;
            }
        }

        /**
         * Show the loaded ad
         */
        async show() {
            if (!this.isLoaded || !this.currentAd) {
                throw new Error('No ad loaded. Call loadAd() first.');
            }

            this.element.style.display = 'block';
            this.isVisible = true;

            // Track impression
            await this.sdk.trackImpression(this.id, this.currentAd);

            this.sdk.triggerEvent('adShown', { 
                placementId: this.id, 
                ad: this.currentAd 
            });
            
            return true;
        }

        /**
         * Hide the ad
         */
        hide() {
            if (this.element) {
                this.element.style.display = 'none';
            }
            this.isVisible = false;
            
            this.sdk.triggerEvent('adHidden', { placementId: this.id });
        }

        /**
         * Update ad content
         */
        async updateAd(adData) {
            if (adData) {
                this.currentAd = adData;
                await this.renderAd();
                this.sdk.triggerEvent('adUpdated', { 
                    placementId: this.id, 
                    ad: adData 
                });
            }
        }

        /**
         * Update placement configuration
         */
        updateConfig(newConfig) {
            Object.assign(this, newConfig);
            this.updateDOMStyles();
        }

        /**
         * Create DOM elements
         */
        createDOM() {
            // Main container
            this.element = document.createElement('div');
            this.element.id = `adinmo-placement-${this.id}`;
            this.element.className = `adinmo-placement adinmo-${this.placementType}`;
            
            this.updateDOMStyles();

            // Add to specified container or body
            const targetContainer = this.container || document.body;
            targetContainer.appendChild(this.element);
        }

        /**
         * Update DOM styles
         */
        updateDOMStyles() {
            if (!this.element) return;
            
            this.element.style.cssText = `
                position: absolute;
                left: ${this.position.x}px;
                top: ${this.position.y}px;
                width: ${this.size.width}px;
                height: ${this.size.height}px;
                display: none;
                z-index: ${this.zIndex};
                cursor: pointer;
                overflow: hidden;
                border-radius: 4px;
                box-sizing: border-box;
                ${this.sdk.config.debugMode ? 'border: 2px solid #ff6b6b;' : ''}
            `;
        }

        /**
         * Setup event handlers
         */
        setupEvents() {
            this.element.addEventListener('click', this.handleClick.bind(this));
            this.element.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
            this.element.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        }

        async handleClick(event) {
            if (!this.currentAd) return;
            
            event.preventDefault();
            
            const rect = this.element.getBoundingClientRect();
            const clickPosition = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
            await this.sdk.trackClick(this.id, this.currentAd, clickPosition);
        }

        handleMouseEnter() {
            if (this.currentAd) {
                this.element.style.opacity = '0.8';
                this.element.style.transform = 'scale(1.02)';
                this.element.style.transition = 'all 0.2s ease';
            }
        }

        handleMouseLeave() {
            this.element.style.opacity = '1';
            this.element.style.transform = 'scale(1)';
        }

        /**
         * Render ad content
         */
        async renderAd() {
            if (!this.currentAd) return;

            // Clear existing content
            this.element.innerHTML = '';

            try {
                if (this.currentAd.imageUrl) {
                    await this.renderImageAd();
                } else if (this.currentAd.htmlContent) {
                    this.renderHtmlAd();
                } else if (this.currentAd.videoUrl) {
                    this.renderVideoAd();
                } else {
                    this.renderFallback();
                }
            } catch (error) {
                this.sdk.log('Error rendering ad:', error);
                this.renderFallback();
            }
        }

        async renderImageAd() {
            return new Promise((resolve, reject) => {
                const img = document.createElement('img');
                img.src = this.currentAd.imageUrl;
                img.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                `;
                
                img.onload = () => {
                    this.element.appendChild(img);
                    resolve();
                };
                
                img.onerror = () => {
                    this.sdk.log(`Failed to load ad image: ${this.currentAd.imageUrl}`);
                    this.renderFallback();
                    resolve();
                };
            });
        }

        renderHtmlAd() {
            const container = document.createElement('div');
            container.innerHTML = this.currentAd.htmlContent;
            container.style.cssText = `
                width: 100%;
                height: 100%;
                overflow: hidden;
            `;
            this.element.appendChild(container);
        }

        renderVideoAd() {
            const video = document.createElement('video');
            video.src = this.currentAd.videoUrl;
            video.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.controls = false;
            
            this.element.appendChild(video);
        }

        renderFallback() {
            const fallback = document.createElement('div');
            fallback.style.cssText = `
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
                font-size: 14px;
                text-align: center;
            `;
            fallback.textContent = 'AdInMo';
            this.element.appendChild(fallback);
        }

        generateId() {
            return `plc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }

        /**
         * Cleanup placement
         */
        destroy() {
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            this.element = null;
            this.currentAd = null;
            this.isLoaded = false;
            this.isVisible = false;
        }
    }

    // Export to global scope
    global.AdInMoSDK = AdInMoSDK;
    global.AdInMoPlacement = AdInMoPlacement;

    // Also support CommonJS and AMD if available
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { AdInMoSDK, AdInMoPlacement };
    } else if (typeof define === 'function' && define.amd) {
        define([], function() {
            return { AdInMoSDK, AdInMoPlacement };
        });
    }

})(typeof window !== 'undefined' ? window : this);