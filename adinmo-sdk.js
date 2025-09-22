(function(global) {
    'use strict';

    /**
     * Main AdInMo SDK Class
     * Based on Unity AdinmoManager and AdinmoNativeWrapper
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
                /* @tweakable enable ZBD cryptocurrency integration */
                enableZBD: config.enableZBD || false,
                /* @tweakable enable audio ad placements */
                enableAudio: config.enableAudio || true,
                pollingInterval: config.pollingInterval || 30000,
                version: '1.0.0-js',
                ...config
            };

            // Core state - based on Unity implementation
            this.isInitialized = false;
            this.sessionId = null;
            this.placements = new Map();
            this.eventCallbacks = new Map();
            
            // Analytics tracking
            this.impressionCount = 0;
            this.clickCount = 0;
            this.sessionStartTime = Date.now();
            
            // Message polling
            this.messagePoller = null;
            this.isPolling = false;
            
            // IAP Integration - from Unity AdInMoIapProxy
            this.iapCallbacks = {
                purchaseRequested: null,
                getPriceCallback: null,
                alreadyPurchasedCallback: null
            };
            
            // ZBD Integration - from Unity ZBDController
            this.zbdState = {
                supported: false,
                satsBalance: 0,
                dollarBalance: 0,
                gamerTag: '',
                opCallback: null,
                updateCallback: null
            };
            
            // Audio system - from Unity audio wrapper
            this.audioSystem = new AdInMoAudioSystem(this);
            
            // Enhanced input handling - from Unity AdinmoInputHandler
            this.inputHandler = new AdInMoInputHandler(this);
            
            // Device info collection - similar to Unity collectDeviceInfo
            this.deviceInfo = this.collectDeviceInfo();
            
            // Unity-style initialization state
            this.initializationState = 'NotInitialized'; // NotInitialized, Initializing, Initialized, Failed
            
            this.log('AdInMo SDK created', this.config);
        }

        /**
         * Initialize SDK - based on Unity AdmoManager.Initialize()
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
                this.initializationState = 'Initializing';
                
                // Generate session ID - Unity style
                this.sessionId = this.generateSessionId();
                
                // Initialize with AdInMo backend using Unity-style API
                await this.initializeWithBackend();
                
                // Start polling for messages
                this.startMessagePolling();
                
                // Setup browser event listeners
                this.setupBrowserEvents();
                
                this.isInitialized = true;
                this.initializationState = 'Initialized';
                this.log('SDK initialized successfully');
                this.triggerEvent('sdkInitialized', { sessionId: this.sessionId });
                
                return Promise.resolve();
                
            } catch (error) {
                this.initializationState = 'Failed';
                this.log('SDK initialization failed:', error);
                this.triggerEvent('sdkInitializationFailed', { error: error.message });
                throw error;
            }
        }

        /**
         * Initialize with backend - based on Unity native wrapper patterns
         */
        async initializeWithBackend() {
            // Enhanced debugging for API communication
            this.log('=== DETAILED API DEBUGGING ===');
            this.log('Base URL:', this.config.baseUrl);
            this.log('Game Key:', this.config.gameKey ? `${this.config.gameKey.substring(0, 8)}...` : 'NOT SET');
            this.log('Environment:', this.config.environment);
            
            // Try multiple initialization patterns from Unity SDK with different auth methods
            const initMethods = [
                () => this.initializeViaGameKeyAuth(),
                () => this.initializeViaSimpleAuth(),
                () => this.initializeViaUnityPattern(),
                () => this.initializeViaSessionInit(),
                () => this.initializeViaInit(),
                () => this.initializeViaStart(),
                () => this.initializeViaBearerAuth(),
                () => this.initializeViaQueryParams()
            ];

            let lastError = null;
            
            for (const method of initMethods) {
                try {
                    this.log(`Attempting initialization method: ${method.name}`);
                    const result = await method();
                    this.log('Successfully initialized via backend');
                    return result;
                } catch (error) {
                    this.log(`${method.name} failed:`, error.message);
                    lastError = error;
                    continue;
                }
            }
            
            throw lastError || new Error('All initialization methods failed');
        }

        /* @tweakable Unity-style auth pattern */
        async initializeViaSimpleAuth() {
            const payload = {
                gameKey: this.config.gameKey,
                platform: 'web',
                version: this.config.version
            };

            return await this.makeAPICall('/auth', {
                method: 'POST',
                headers: {
                    'X-Game-Key': this.config.gameKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        }

        /* @tweakable Unity manager initialization pattern */
        async initializeViaUnityPattern() {
            const payload = {
                key: this.config.gameKey,
                platform: 'webgl',
                sdk_version: this.config.version,
                device_info: this.deviceInfo
            };

            return await this.makeAPICall('/manager/init', {
                method: 'POST',
                headers: {
                    'Authorization': this.config.gameKey,
                    'Content-Type': 'application/json',
                    'X-Platform': 'web'
                },
                body: JSON.stringify(payload)
            });
        }

        async initializeViaGameKeyAuth() {
            const payload = {
                gameKey: this.config.gameKey,
                sessionId: this.sessionId,
                platform: 'web',
                sdkVersion: this.config.version,
                environment: this.config.environment,
                deviceInfo: this.deviceInfo,
                timestamp: Date.now()
            };

            // Try with X-Game-Key header
            return await this.makeAPICall('/session/init', {
                method: 'POST',
                headers: {
                    'X-Game-Key': this.config.gameKey,
                    'X-API-Key': this.config.gameKey
                },
                body: JSON.stringify(payload)
            });
        }

        async initializeViaBearerAuth() {
            const payload = {
                gameKey: this.config.gameKey,
                sessionId: this.sessionId,
                platform: 'web',
                sdkVersion: this.config.version,
                environment: this.config.environment,
                deviceInfo: this.deviceInfo,
                timestamp: Date.now()
            };

            // Try with Bearer token
            return await this.makeAPICall('/init', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.gameKey}`
                },
                body: JSON.stringify(payload)
            });
        }

        async initializeViaQueryParams() {
            // Try with query parameters instead of headers
            const params = new URLSearchParams({
                gameKey: this.config.gameKey,
                sessionId: this.sessionId,
                platform: 'web',
                environment: this.config.environment
            });

            return await this.makeAPICall(`/initialize?${params.toString()}`, {
                method: 'POST'
            });
        }

        async initializeViaSessionInit() {
            const payload = {
                gameKey: this.config.gameKey,
                sessionId: this.sessionId,
                platform: 'web',
                sdkVersion: this.config.version,
                environment: this.config.environment,
                deviceInfo: this.deviceInfo,
                timestamp: Date.now()
            };

            return await this.makeAPICall('/session/init', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        async initializeViaInit() {
            const payload = {
                gameKey: this.config.gameKey,
                sessionId: this.sessionId,
                platform: 'web',
                sdkVersion: this.config.version,
                environment: this.config.environment,
                timestamp: Date.now()
            };

            return await this.makeAPICall('/init', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        async initializeViaStart() {
            // Try Unity-style start endpoint
            const payload = {
                key: this.config.gameKey,
                session: this.sessionId,
                platform: 'web',
                version: this.config.version,
                env: this.config.environment
            };

            return await this.makeAPICall('/start', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        /**
         * IAP Integration Methods - Based on Unity AdInMoIapProxy
         */
        
        /**
         * Set callback for when AdInMo requests an in-app purchase
         * @param {function} callback Function to handle purchase requests
         */
        setInAppPurchaseCallback(callback) {
            this.iapCallbacks.purchaseRequested = callback;
            this.log('IAP purchase callback registered');
        }

        /**
         * Set callback for getting localized price strings
         * @param {function} callback Function that returns price string for item ID
         */
        setInAppPurchaseGetPriceCallback(callback) {
            this.iapCallbacks.getPriceCallback = callback;
            this.log('IAP price callback registered');
        }

        /**
         * Set callback for checking if item is already purchased
         * @param {function} callback Function that checks purchase status
         */
        setInAppPurchasedAlreadyCallback(callback) {
            this.iapCallbacks.alreadyPurchasedCallback = callback;
            this.log('IAP already purchased callback registered');
        }

        /**
         * Report successful in-app purchase to AdInMo
         */
        inAppPurchaseSuccess(itemId, currency, price, transactionId) {
            const payload = {
                event: 'iap_success',
                itemId,
                currency,
                price,
                transactionId,
                sessionId: this.sessionId,
                timestamp: Date.now()
            };
            
            this.sendAnalytics('/track/iap/success', payload);
            this.triggerEvent('iapSuccess', { itemId, currency, price, transactionId });
            this.log('IAP success reported:', payload);
        }

        /**
         * Report failed in-app purchase to AdInMo
         */
        inAppPurchaseFailed(itemId, currency, price, reason) {
            const payload = {
                event: 'iap_failed',
                itemId,
                currency,
                price,
                reason,
                sessionId: this.sessionId,
                timestamp: Date.now()
            };
            
            this.sendAnalytics('/track/iap/failed', payload);
            this.triggerEvent('iapFailed', { itemId, currency, price, reason });
            this.log('IAP failure reported:', payload);
        }

        /**
         * ZBD Integration Methods - Based on Unity ZBDController
         */
        
        /**
         * Check if ZBD (Zebedee) cryptocurrency features are supported
         */
        get supportsZebedee() {
            return this.config.enableZBD && this.zbdState.supported;
        }

        /**
         * Get current ZBD sats balance
         */
        getZBDSatsBalance() {
            return this.zbdState.satsBalance;
        }

        /**
         * Get current ZBD dollar balance
         */
        getZBDDollarBalance() {
            return this.zbdState.dollarBalance.toFixed(2);
        }

        /**
         * Get ZBD gamer tag
         */
        getZBDGamerTag() {
            return this.zbdState.gamerTag;
        }

        /**
         * Set ZBD gamer tag
         */
        setZBDGamerTag(gamerTag) {
            this.zbdState.gamerTag = gamerTag;
            this.updateZBDProfile();
        }

        /**
         * Set ZBD operation callback
         */
        setZBDOpCallback(callback) {
            this.zbdState.opCallback = callback;
        }

        /**
         * Set ZBD update callback
         */
        setZBDUpdateCallback(callback) {
            this.zbdState.updateCallback = callback;
        }

        /**
         * Initiate ZBD cash out
         * @param {string} gamerTag ZBD gamer tag
         * @param {number} amountMillisats Amount in millisats
         */
        async zbdCashOut(gamerTag, amountMillisats) {
            try {
                /* @tweakable ZBD cashout minimum amount */
                const minCashout = 1000; // millisats
                
                if (amountMillisats < minCashout) {
                    throw new Error(`Minimum cashout is ${minCashout} millisats`);
                }
                
                const payload = {
                    gamerTag,
                    amount: amountMillisats,
                    sessionId: this.sessionId,
                    timestamp: Date.now()
                };
                
                const response = await this.makeAPICall('/zbd/cashout', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                
                if (this.zbdState.opCallback) {
                    this.zbdState.opCallback(
                        response.success,
                        gamerTag,
                        response.newBalance || this.zbdState.satsBalance,
                        response.balanceChange || 0,
                        response.dollarBalance || this.zbdState.dollarBalance,
                        response.feedback || ''
                    );
                }
                
                return response;
                
            } catch (error) {
                this.log('ZBD cashout failed:', error);
                if (this.zbdState.opCallback) {
                    this.zbdState.opCallback(false, gamerTag, this.zbdState.satsBalance, 0, this.zbdState.dollarBalance, error.message);
                }
                throw error;
            }
        }

        /**
         * Update ZBD profile information
         */
        async updateZBDProfile() {
            if (!this.config.enableZBD) return;
            
            try {
                const payload = {
                    gamerTag: this.zbdState.gamerTag,
                    sessionId: this.sessionId
                };
                
                const response = await this.makeAPICall('/zbd/profile', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                
                if (response.success) {
                    this.zbdState.satsBalance = response.satsBalance || 0;
                    this.zbdState.dollarBalance = response.dollarBalance || 0;
                    this.zbdState.gamerTag = response.gamerTag || this.zbdState.gamerTag;
                }
                
            } catch (error) {
                this.log('ZBD profile update failed:', error);
            }
        }

        /**
         * Create ad placement - equivalent to Unity AdinmoTexture
         */
        createPlacement(config) {
            if (!this.isInitialized) {
                throw new Error('SDK not initialized. Call initialize() first.');
            }

            let placement;
            
            /* @tweakable placement type detection and creation */
            switch (config.placementType) {
                case 'audio':
                    placement = new AdInMoAudioPlacement({
                        ...config,
                        sdk: this,
                        sessionId: this.sessionId,
                        audioSystem: this.audioSystem
                    });
                    break;
                case 'banner':
                case 'rectangle':
                case 'interstitial':
                default:
                    placement = new AdInMoPlacement({
                        ...config,
                        sdk: this,
                        sessionId: this.sessionId
                    });
                    break;
            }

            this.placements.set(placement.id, placement);
            this.log(`Created ${config.placementType || 'standard'} placement: ${placement.id}`);
            
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
                environment: this.config.environment,
                deviceInfo: this.deviceInfo,
                timestamp: Date.now()
            };

            try {
                const response = await this.makeAPICall('/session/init', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                
                this.log('Session initialized:', response);
                return response;
                
            } catch (error) {
                this.log('Session initialization failed, trying alternative endpoint...');
                
                // Try alternative initialization approach
                try {
                    const altResponse = await this.makeAPICall('/initialize', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    this.log('Session initialized via alternative endpoint:', altResponse);
                    return altResponse;
                } catch (altError) {
                    this.log('Alternative initialization also failed:', altError);
                    throw error; // Throw original error
                }
            }
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
         * Request an ad for a placement (converted from Unity flow)
         */
        async loadAdForPlacement(placementId, params = {}) {
            const payload = {
                placementId,
                sessionId: this.sessionId,
                size: params.size,
                aspectRatio: params.aspectRatio,
                placementType: params.placementType,
                deviceInfo: this.deviceInfo,
                timestamp: Date.now()
            };
            const res = await this.makeAPICall('/ads/request', { method: 'POST', body: JSON.stringify(payload) });
            return (res && res.ad) ? res.ad : res;
        }

        /**
         * Make API call - based on Unity HTTP patterns
         */
        async makeAPICall(endpoint, options = {}) {
            // Handle mock mode
            if (this.config.baseUrl === 'mock') {
                return await this.originalMakeAPICall(endpoint, options);
            }
            
            // Try each API path variation
            const variations = this.apiPathVariations || [this.buildAPIUrl(endpoint)];
            let lastError = null;
            
            for (let i = 0; i < variations.length; i++) {
                const url = variations[i];
                
                try {
                    const result = await this.makeAPICallToURL(url, options);
                    this.log(`✓ Success with API path variation ${i + 1}: ${url}`);
                    return result;
                } catch (error) {
                    this.log(`✗ Failed API path variation ${i + 1}: ${url} - ${error.message}`);
                    lastError = error;
                    
                    // Don't try other paths for auth errors
                    if (error.message.includes('401') || error.message.includes('403')) {
                        break;
                    }
                    
                    continue;
                }
            }
            
            throw lastError;
        }

        /**
         * Make API call to specific URL with enhanced debugging
         */
        async makeAPICallToURL(url, options = {}) {
            // Unity-style headers based on C# implementation
            /* @tweakable default API headers based on Unity SDK patterns */
            const defaultHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': `AdInMo-JS-SDK/${this.config.version}`,
                'X-SDK-Platform': 'web',
                'X-SDK-Version': this.config.version,
                'X-Client-Platform': 'javascript',
                'X-Unity-Version': 'web-1.0', // Mimic Unity SDK
                'X-Request-ID': this.generateRequestId(),
                'X-Session-ID': this.sessionId || 'none'
            };

            // Try different authorization approaches
            if (this.config.gameKey) {
                // Try multiple auth header formats based on Unity patterns
                /* @tweakable authentication header variations */
                defaultHeaders['Authorization'] = `GameKey ${this.config.gameKey}`;
                defaultHeaders['X-Game-Key'] = this.config.gameKey;
                defaultHeaders['X-API-Key'] = this.config.gameKey;
                defaultHeaders['Game-Key'] = this.config.gameKey;
                defaultHeaders['X-Auth-Token'] = this.config.gameKey;
                defaultHeaders['API-Key'] = this.config.gameKey;
                defaultHeaders['Token'] = this.config.gameKey;
            }

            // Add session header if available
            if (this.sessionId) {
                defaultHeaders['X-Session-ID'] = this.sessionId;
                defaultHeaders['Session-ID'] = this.sessionId;
                defaultHeaders['X-Session'] = this.sessionId;
            }

            /* @tweakable request timeout in milliseconds */
            const requestTimeout = 15000;

            const requestOptions = {
                mode: 'cors',
                credentials: 'omit',
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers
                }
            };

            try {
                this.log(`🌐 Making API call: ${requestOptions.method || 'GET'} ${url}`);
                this.log('📤 Request headers:', JSON.stringify(requestOptions.headers, null, 2));
                if (requestOptions.body) {
                    this.log('📦 Request body:', requestOptions.body);
                }

                // Add timeout to prevent hanging
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
                
                requestOptions.signal = controller.signal;

                const response = await fetch(url, requestOptions);
                clearTimeout(timeoutId);
                
                this.log(`📡 Response status: ${response.status} ${response.statusText}`);
                this.log('📥 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Could not read error response body.');
                    this.log(`❌ API error response:`, errorText);
                    
                    // Enhanced error handling with more specific messages
                    if (response.status === 404) {
                        throw new Error(`API endpoint not found: ${url}. This endpoint may not exist in the AdInMo API.`);
                    } else if (response.status === 401) {
                        throw new Error(`Authentication failed (401). Game Key "${this.config.gameKey}" is invalid or expired. Get a valid key from https://www.adinmo.com/portal`);
                    } else if (response.status === 403) {
                        throw new Error(`Access forbidden (403). Game Key may not have permission for this operation or domain not whitelisted.`);
                    } else if (response.status === 400) {
                        throw new Error(`Bad request (400). Invalid request format: ${errorText}`);
                    } else if (response.status === 429) {
                        throw new Error(`Rate limit exceeded (429). Too many requests. Wait before retrying.`);
                    } else if (response.status >= 500) {
                        throw new Error(`Server error (${response.status}). AdInMo service may be temporarily unavailable: ${errorText}`);
                    }
                    
                    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                }

                const contentType = response.headers.get('content-type') || '';
                let responseData;
                
                if (contentType.includes('application/json')) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }
                
                this.log('✅ Response data:', responseData);
                return responseData;
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout after ${requestTimeout}ms. The API took too long to respond.`);
                }
                
                this.log(`🚨 [NETWORK ERROR] API call failed for URL: ${url}`);
                
                if (error.name === 'TypeError' && error.message.toLowerCase().includes('failed to fetch')) {
                    this.log('=== COMPREHENSIVE NETWORK ERROR ANALYSIS ===');
                    this.log('🔍 URL attempted:', url);
                    this.log('🔍 Method:', requestOptions.method || 'GET');
                    this.log('🔍 Headers sent:', JSON.stringify(requestOptions.headers, null, 2));
                    this.log('🔍 Game Key (partial):', this.config.gameKey ? `${this.config.gameKey.substring(0, 8)}...` : 'NOT SET');
                    this.log('🔍 Browser user agent:', navigator.userAgent);
                    this.log('🔍 Is online:', navigator.onLine);
                    
                    this.log('');
                    this.log('🛠️ POSSIBLE SOLUTIONS:');
                    this.log('1. ✅ CORS Issue: Your domain may not be whitelisted with AdInMo');
                    this.log('2. ✅ Network: Check your internet connection');
                    this.log('3. ✅ Game Key: Verify your Game Key is valid and active');
                    this.log('4. ✅ API URL: AdInMo API endpoints may have changed');
                    this.log('5. ✅ Firewall: Corporate/school firewalls may block the request');
                    this.log('6. ✅ DNS: Try different DNS servers (8.8.8.8, 1.1.1.1)');
                    this.log('7. ✅ Testing: Use "mock" mode to test without API calls');
                    this.log('8. ✅ Browser: Try a different browser or incognito mode');
                    this.log('');
                    this.log('📞 For support, contact AdInMo with this error log');
                    this.log('===============================================');
                    
                    // Test basic connectivity with different domains
                    try {
                        await fetch('https://httpbin.org/get', { mode: 'cors', signal: AbortSignal.timeout(5000) });
                        this.log('✅ Basic CORS connectivity works (httpbin test passed)');
                        
                        // Test AdInMo domain connectivity
                        try {
                            await fetch('https://api.adinmo.com', { mode: 'no-cors', signal: AbortSignal.timeout(5000) });
                            this.log('✅ AdInMo domain is reachable (no-cors test)');
                        } catch (adinmoError) {
                            this.log('❌ AdInMo domain connectivity issue:', adinmoError.message);
                        }
                        
                    } catch (testError) {
                        this.log('❌ Basic CORS connectivity failed. This indicates a broader network or browser issue.');
                    }
                }
                
                throw error;
            }
        }

        // Store original method for mock mode
        originalMakeAPICall = this.makeAPICall;

        /**
         * Build API URL - based on Unity API structure analysis
         */
        buildAPIUrl(endpoint) {
            let baseUrl = this.config.baseUrl;
            
            // Handle different base URL formats
            if (baseUrl === 'production') {
                baseUrl = 'https://api.adinmo.com';
            } else if (baseUrl === 'staging') {
                baseUrl = 'https://staging-api.adinmo.com';
            }
                
            // Clean endpoint
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
            
            // Based on Unity SDK analysis, try different API patterns
            /* @tweakable API endpoint patterns based on Unity SDK analysis */
            const possiblePaths = [
                `${baseUrl}/v2/${cleanEndpoint}`,           // Try v2 API first
                `${baseUrl}/v1/${cleanEndpoint}`,           // Most likely based on Unity patterns
                `${baseUrl}/unity/${cleanEndpoint}`,        // Unity-specific path
                `${baseUrl}/sdk/${cleanEndpoint}`,          // SDK specific path
                `${baseUrl}/game/${cleanEndpoint}`,         // Game-specific
                `${baseUrl}/api/v1/${cleanEndpoint}`,       // Alternative structure
                `${baseUrl}/api/${cleanEndpoint}`,          // API prefix
                `${baseUrl}/${cleanEndpoint}`,              // Direct endpoint
                `${baseUrl}/adinmo/${cleanEndpoint}`,       // Namespaced
                `${baseUrl}/mobile/${cleanEndpoint}`,       // Mobile API path
                `${baseUrl}/web/${cleanEndpoint}`,          // Web-specific path
                `${baseUrl}/js/${cleanEndpoint}`            // JavaScript SDK path
            ];
            
            // For now, use the most likely pattern but store others for fallback
            this.apiPathVariations = possiblePaths;
            return possiblePaths[0];
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
         * Enhanced device info collection with touch support detection
         */
        collectDeviceInfo() {
            return {
                // Basic device info
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                languages: navigator.languages || [navigator.language],
                
                // Screen information
                screen: {
                    width: screen.width,
                    height: screen.height,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth,
                    orientation: screen.orientation ? screen.orientation.type : 'unknown'
                },
                
                // Viewport information
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                
                // Enhanced device capabilities - from Unity input handler
                devicePixelRatio: window.devicePixelRatio || 1,
                timezone: this.getTimezone(),
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine,
                touchSupport: this.detectTouchSupport(),
                webGL: this.detectWebGL(),
                audioContext: this.detectAudioContext(),
                
                // Session information
                url: window.location.href,
                referrer: document.referrer,
                
                // Unity-style system info
                operatingSystem: this.getOperatingSystem(),
                browserName: this.getBrowserName(),
                browserVersion: this.getBrowserVersion(),
                
                // SDK-specific
                sdkVersion: this.config.version,
                sdkPlatform: 'web'
            };
        }

        /**
         * Get timezone information for device tracking
         * @tweakable timezone detection method and format
         */
        getTimezone() {
            try {
                return {
                    name: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    offset: new Date().getTimezoneOffset(),
                    /* @tweakable include detailed timezone info */
                    offsetString: this.getTimezoneOffsetString(),
                    locale: Intl.DateTimeFormat().resolvedOptions().locale
                };
            } catch (error) {
                // Fallback for older browsers
                return {
                    name: 'Unknown',
                    offset: new Date().getTimezoneOffset(),
                    offsetString: this.getTimezoneOffsetString(),
                    locale: navigator.language
                };
            }
        }

        /**
         * Get timezone offset as string (e.g., "-05:00")
         * @tweakable timezone offset format
         */
        getTimezoneOffsetString() {
            const offset = new Date().getTimezoneOffset();
            const sign = offset > 0 ? '-' : '+';
            const hours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
            const minutes = (Math.abs(offset) % 60).toString().padStart(2, '0');
            return `${sign}${hours}:${minutes}`;
        }

        /**
         * Enhanced touch support detection - from Unity AdinmoInputHandler
         */
        detectTouchSupport() {
            return {
                supported: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
                maxTouchPoints: navigator.maxTouchPoints || 0,
                multiTouch: navigator.maxTouchPoints > 1,
                pointerEvents: 'PointerEvent' in window
            };
        }

        /**
         * Audio context detection for audio ads
         */
        detectAudioContext() {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    const ctx = new AudioContext();
                    const supported = ctx.state !== undefined;
                    ctx.close();
                    return { supported, states: ['suspended', 'running', 'closed'] };
                }
            } catch (e) {
                return { supported: false };
            }
            return { supported: false };
        }

        /**
         * WebGL detection for graphics capabilities
         */
        detectWebGL() {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (gl && gl instanceof WebGLRenderingContext) {
                    const info = {
                        supported: true,
                        version: gl.getParameter(gl.VERSION),
                        vendor: gl.getParameter(gl.VENDOR),
                        renderer: gl.getParameter(gl.RENDERER)
                    };
                    return info;
                }
            } catch (e) {
                return { supported: false };
            }
            return { supported: false };
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
            const random = Math.random().toString(36).substring(2, 15);
            return `web_${timestamp}_${random}`;
        }

        /**
         * Generate unique request ID for tracking
         */
        generateRequestId() {
            return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }

        log(...args) {
            if (this.config.debugMode) {
                console.log('[AdInMo SDK]', ...args);
            }
        }
    }

    /**
     * Enhanced Input Handler - Based on Unity AdinmoInputHandler
     */
    class AdInMoInputHandler {
        constructor(sdk) {
            this.sdk = sdk;
            this.currentTouch = null;
            this.setupInputListeners();
        }

        setupInputListeners() {
            // Enhanced touch handling
            document.addEventListener('touchstart', this.handleTouchStart.bind(this));
            document.addEventListener('touchmove', this.handleTouchMove.bind(this));
            document.addEventListener('touchend', this.handleTouchEnd.bind(this));
            document.addEventListener('touchcancel', this.handleTouchCancel.bind(this));
            
            // Enhanced mouse handling for desktop
            document.addEventListener('mousedown', this.handleMouseDown.bind(this));
            document.addEventListener('mousemove', this.handleMouseMove.bind(this));
            document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        }

        /**
         * Get potential touch position - Unity style
         */
        getPotentialTouchPos() {
            if (this.currentTouch) {
                return { x: this.currentTouch.clientX, y: this.currentTouch.clientY };
            }
            return { x: -1, y: -1 };
        }

        /**
         * Get current touch - Unity style
         */
        getTouch() {
            if (!this.currentTouch) return null;
            
            return {
                position: { x: this.currentTouch.clientX, y: this.currentTouch.clientY },
                phase: this.currentTouch.phase || 'unknown',
                fingerId: this.currentTouch.identifier || 0
            };
        }

        handleTouchStart(event) {
            if (event.touches.length === 1) {
                this.currentTouch = event.touches[0];
                this.currentTouch.phase = 'began';
            }
        }

        handleTouchMove(event) {
            if (this.currentTouch && event.touches.length === 1) {
                this.currentTouch = event.touches[0];
                this.currentTouch.phase = 'moved';
            }
        }

        handleTouchEnd(event) {
            if (this.currentTouch) {
                this.currentTouch.phase = 'ended';
                this.currentTouch = null;
            }
        }

        handleTouchCancel(event) {
            if (this.currentTouch) {
                this.currentTouch.phase = 'cancelled';
                this.currentTouch = null;
            }
        }

        handleMouseDown(event) {
            this.currentTouch = {
                clientX: event.clientX,
                clientY: event.clientY,
                phase: 'began',
                identifier: 0
            };
        }

        handleMouseMove(event) {
            if (this.currentTouch && event.buttons > 0) {
                this.currentTouch.clientX = event.clientX;
                this.currentTouch.clientY = event.clientY;
                this.currentTouch.phase = 'moved';
            }
        }

        handleMouseUp(event) {
            if (this.currentTouch) {
                this.currentTouch.phase = 'ended';
                this.currentTouch = null;
            }
        }

        /**
         * Vibrate device - Unity style
         */
        vibrate() {
            if ('vibrate' in navigator) {
                /* @tweakable vibration pattern for ad interactions */
                navigator.vibrate([50, 100, 50]);
            }
        }
    }

    /**
     * Audio System for Audio Ads - Based on Unity audio wrapper
     */
    class AdInMoAudioSystem {
        constructor(sdk) {
            this.sdk = sdk;
            this.audioContext = null;
            this.activeAudio = new Map();
            this.init();
        }

        async init() {
            if (!this.sdk.config.enableAudio) return;
            
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.audioContext = new AudioContext();
                    this.sdk.log('Audio system initialized');
                }
            } catch (error) {
                this.sdk.log('Audio system initialization failed:', error);
            }
        }

        /**
         * Download and prepare audio
         */
        async downloadAudio(url, timeout = 10000) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                return audioBuffer;
                
            } catch (error) {
                this.sdk.log('Audio download failed:', error);
                throw error;
            }
        }

        /**
         * Play audio
         */
        playAudio(audioBuffer, options = {}) {
            if (!this.audioContext || !audioBuffer) return null;
            
            try {
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                /* @tweakable audio volume for ads */
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = options.volume || 0.8;
                
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                const audioId = Date.now().toString();
                this.activeAudio.set(audioId, { source, gainNode, startTime: Date.now() });
                
                source.onended = () => {
                    this.activeAudio.delete(audioId);
                };
                
                source.start(0);
                return audioId;
                
            } catch (error) {
                this.sdk.log('Audio playback failed:', error);
                return null;
            }
        }

        /**
         * Stop audio
         */
        stopAudio(audioId) {
            const audio = this.activeAudio.get(audioId);
            if (audio) {
                audio.source.stop();
                this.activeAudio.delete(audioId);
            }
        }

        /**
         * Check if audio is playing
         */
        isPlaying(audioId) {
            return this.activeAudio.has(audioId);
        }

        /**
         * Get audio playback time
         */
        getAudioTime(audioId) {
            const audio = this.activeAudio.get(audioId);
            if (audio) {
                return (Date.now() - audio.startTime) / 1000;
            }
            return 0;
        }

        cleanup() {
            this.activeAudio.forEach((audio, id) => {
                this.stopAudio(id);
            });
            
            if (this.audioContext) {
                this.audioContext.close();
            }
        }
    }

    /**
     * Audio Ad Placement Class - Based on Unity audio placement concepts
     */
    class AdInMoAudioPlacement {
        constructor(config) {
            this.id = config.id || this.generateId();
            this.sdk = config.sdk;
            this.audioSystem = config.audioSystem;
            
            /* @tweakable audio ad configuration */
            this.config = {
                autoplay: config.autoplay || false,
                volume: config.volume || 0.8,
                loop: config.loop || false,
                timeout: config.timeout || 10000
            };
            
            this.isLoaded = false;
            this.isPlaying = false;
            this.currentAd = null;
            this.audioBuffer = null;
            this.audioId = null;
        }

        async loadAd() {
            try {
                this.sdk.log(`Loading audio ad for placement ${this.id}`);
                
                const adData = await this.sdk.loadAdForPlacement(this.id, {
                    placementType: 'audio',
                    aspectRatio: 'audio'
                });
                
                if (adData.audioUrl) {
                    this.audioBuffer = await this.audioSystem.downloadAudio(adData.audioUrl, this.config.timeout);
                }
                
                this.currentAd = adData;
                this.isLoaded = true;
                
                this.sdk.triggerEvent('adLoaded', { 
                    placementId: this.id, 
                    ad: this.currentAd 
                });
                
                if (this.config.autoplay) {
                    await this.play();
                }
                
                return this.currentAd;
                
            } catch (error) {
                this.sdk.log('Audio ad load failed:', error);
                this.sdk.triggerEvent('adLoadFailed', { 
                    placementId: this.id, 
                    error: error.message 
                });
                throw error;
            }
        }

        async play() {
            if (!this.isLoaded || !this.audioBuffer) {
                throw new Error('Audio ad not loaded');
            }
            
            this.audioId = this.audioSystem.playAudio(this.audioBuffer, {
                volume: this.config.volume,
                loop: this.config.loop
            });
            
            this.isPlaying = true;
            
            // Track impression for audio
            await this.sdk.trackImpression(this.id, this.currentAd);
            
            this.sdk.triggerEvent('adShown', { 
                placementId: this.id, 
                ad: this.currentAd 
            });
        }

        stop() {
            if (this.audioId) {
                this.audioSystem.stopAudio(this.audioId);
                this.isPlaying = false;
                this.audioId = null;
                
                this.sdk.triggerEvent('adHidden', { placementId: this.id });
            }
        }

        generateId() {
            return `audio_plc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }
    }

    /**
     * Ad Placement Class - based on Unity AdinmoTexture
     */
    class AdInMoPlacement {
        constructor(config) {
            this.id = config.id || this.generateId();
            this.sdk = config.sdk;
            this.sessionId = config.sessionId;
            
            // Placement configuration - Unity style
            this.container = config.container;
            this.size = config.size || { width: 320, height: 50 };
            this.position = config.position || { x: 0, y: 0 };
            this.aspectRatio = config.aspectRatio || 'landscape';
            this.placementType = config.placementType || 'banner';
            this.zIndex = config.zIndex || 1000;
            
            // Unity-style state management
            this.isLoaded = false;
            this.isVisible = false;
            this.isActive = true;
            this.currentAd = null;
            this.loadState = 'NotLoaded'; // NotLoaded, Loading, Loaded, Failed
            
            // DOM elements
            this.element = null;
            this.adElement = null;
            
            this.createDOM();
            this.setupEvents();
        }

        /**
         * Load ad content - Unity AdinmoTexture.LoadAd equivalent
         */
        async loadAd() {
            if (this.loadState === 'Loading') {
                this.sdk.log(`Placement ${this.id} is already loading`);
                return;
            }

            try {
                this.loadState = 'Loading';
                this.sdk.log(`Loading ad for placement ${this.id}`);

                const adData = await this.sdk.loadAdForPlacement(this.id, {
                    size: this.size,
                    aspectRatio: this.aspectRatio,
                    placementType: this.placementType
                });

                this.currentAd = adData;
                await this.renderAd();
                this.isLoaded = true;
                this.loadState = 'Loaded';
                
                this.sdk.triggerEvent('adLoaded', { 
                    placementId: this.id, 
                    ad: this.currentAd 
                });
                
                return this.currentAd;

            } catch (error) {
                this.loadState = 'Failed';
                this.sdk.log('Failed to load ad for placement:', this.id, error);
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
                background: #f3f4f6;
                color: #111;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: inherit;
                font-size: 14px;
                text-align: center;
                border: 1px dashed #ddd;
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
    global.AdInMoAudioPlacement = AdInMoAudioPlacement;
    global.AdInMoInputHandler = AdInMoInputHandler;
    global.AdInMoAudioSystem = AdInMoAudioSystem;

    // Also support CommonJS and AMD if available
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { 
            AdInMoSDK, 
            AdInMoPlacement, 
            AdInMoAudioPlacement,
            AdInMoInputHandler,
            AdInMoAudioSystem
        };
    } else if (typeof define === 'function' && define.amd) {
        define([], function() {
            return { 
                AdInMoSDK, 
                AdInMoPlacement, 
                AdInMoAudioPlacement,
                AdInMoInputHandler,
                AdInMoAudioSystem
            };
        });
    }

})(typeof window !== 'undefined' ? window : this);