/* @tweakable default SDK config */
const defaultConfig = {
  gameKey: '', // Using a dummy key for auto-init. Replace with your key via UI.
  environment: 'production',
  baseUrl: 'mock', // 'mock' or 'production' or https://api.adinmo.com
  debugMode: true, // Enable debug mode by default for troubleshooting
  /* @tweakable server polling interval (ms) */
  pollingInterval: 30000
};

/* @tweakable mock network latency (ms) for the local adapter */
const mockLatencyMs = 300;

let sdk = null;
let banner = null;
let rect = null;
let detachMock = null;

const $ = sel => document.querySelector(sel);
const logView = $('#logOutput');
function logLine(msg, data) {
  const time = new Date().toISOString().split('T')[1].replace('Z','');
  const text = typeof data === 'undefined' ? msg : `${msg} ${JSON.stringify(data)}`;
  logView.textContent += `[${time}] ${text}\n`;
  logView.scrollTop = logView.scrollHeight;
}

function applyInputsToConfig(cfg) {
  cfg.gameKey = $('#gameKey').value.trim() || cfg.gameKey;
  cfg.environment = $('#environment').value;
  const baseUrlValue = $('#baseUrl').value;
  cfg.baseUrl = baseUrlValue === 'https://api.adinmo.com' ? 'production' : baseUrlValue;
  cfg.debugMode = $('#debugMode').checked;
  const pi = parseInt($('#pollInterval').value, 10);
  if (!Number.isNaN(pi)) cfg.pollingInterval = pi;
  return cfg;
}

function bindSDKEvents(sdk) {
  const events = [
    'sdkInitialized','sdkInitializationFailed','adLoaded','adLoadFailed','adShown','adHidden',
    'adUpdated','impressionTracked','clickTracked','configUpdated','appPaused','appResumed',
    'appFocused','appBlurred','connectionRestored','connectionLost','sdkCleanup'
  ];
  events.forEach(ev => sdk.on(ev, (data) => logLine(ev, data)));
}

async function initSDK() {
  if (sdk) {
    try { sdk.cleanup(); } catch {}
    sdk = null;
    if (detachMock) detachMock();
    detachMock = null;
  }
  
  const config = applyInputsToConfig({ ...defaultConfig });
  
  // Save game key for future use
  if (config.gameKey) {
    localStorage.setItem('adinmo-game-key', config.gameKey);
  }
  
  // Enhanced validation for non-mock modes
  if (config.baseUrl !== 'mock' && !config.gameKey) {
    logLine('❌ ERROR: Game Key is required for production API.');
    logLine('📝 Get your Game Key from: https://www.adinmo.com/portal');
    logLine('🧪 Or use "mock" mode for testing without a key.');
    logLine('💡 Set Base URL to "mock (local)" to test without API calls.');
    throw new Error('Game Key is required for production API. Get one from https://www.adinmo.com/portal');
  }
  
  // Better logging for initialization attempts
  logLine('🚀 Starting SDK initialization...');
  logLine('⚙️ Config:', {
    gameKey: config.gameKey ? `${config.gameKey.substring(0, 8)}...` : 'NOT SET',
    environment: config.environment,
    baseUrl: config.baseUrl,
    debugMode: config.debugMode
  });
  
  sdk = new AdInMoSDK(config);
  bindSDKEvents(sdk);

  // Attach mock if requested
  if (sdk.config.baseUrl === 'mock') {
    logLine('🧪 Using mock mode - no real API calls will be made');
    const { attachAdInMoMock } = await import('./mock-adapter.js');
    detachMock = attachAdInMoMock(sdk, { latencyMs: mockLatencyMs });
  }

  // Enhanced initialization error handling with more context
  try {
    await sdk.initialize();
  } catch (error) {
    logLine('💥 Initialization failed with detailed error:');
    logLine('📋 Error message:', error.message);
    logLine('');
    logLine('🔧 Troubleshooting steps:');
    logLine('1. ✅ Verify your Game Key is correct and active at https://www.adinmo.com/portal');
    logLine('2. ✅ Check your internet connection and try again');
    logLine('3. ✅ Try using "mock" mode for testing: set Base URL to "mock (local)"');
    logLine('4. ✅ Check browser console for additional CORS or network errors');
    logLine('5. ✅ Try a different browser or disable browser extensions');
    logLine('6. ✅ If on corporate/school network, check firewall settings');
    logLine('7. ✅ Contact AdInMo support with this error log if issues persist');
    logLine('');
    logLine('🌐 Browser info:', navigator.userAgent);
    logLine('📡 Online status:', navigator.onLine ? 'Connected' : 'Offline');
    if (sdk && Array.isArray(sdk.apiAttemptLog) && sdk.apiAttemptLog.length) {
      logLine('🔎 API attempt summary (most recent last):');
      sdk.apiAttemptLog.forEach((a,i) => {
        const status = a.ok ? `OK ${a.status}` : `FAIL ${a.error || a.statusText || a.status}`;
        logLine(`  ${String(i+1).padStart(2,'0')}. ${status} -> ${a.url}`);
      });
    }
    throw error;
  }

  // Create placements
  const container = $('#adContainer');

  banner = sdk.createPlacement({
    id: 'banner-top',
    container,
    /* @tweakable banner size */
    size: { width: parseInt($('#bannerW').value,10), height: parseInt($('#bannerH').value,10) },
    /* @tweakable banner position */
    position: { x: parseInt($('#bannerX').value,10) || 16, y: parseInt($('#bannerY').value,10) || 16 },
    aspectRatio: 'landscape',
    placementType: 'banner',
    zIndex: 1000
  });

  rect = sdk.createPlacement({
    id: 'rect-br',
    container,
    /* @tweakable rectangle size */
    size: { width: parseInt($('#rectW').value,10), height: parseInt($('#rectH').value,10) },
    /* @tweakable rectangle position */
    position: {
      x: resolveMaybeCalc($('#rectX').value, container.clientWidth) ?? container.clientWidth - 316,
      y: resolveMaybeCalc($('#rectY').value, container.clientHeight) ?? container.clientHeight - 266
    },
    aspectRatio: 'portrait',
    placementType: 'rectangle',
    zIndex: 1000
  });

  logLine('SDK ready. Create and load placements.');
}

function resolveMaybeCalc(val, total) {
  if (typeof val !== 'string') return val;
  if (!val.includes('calc')) {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  try {
    // Very tiny calc parser: supports calc(100% - N)
    const m = val.match(/calc\((\d+)%\s*-\s*(\d+)\)/i);
    if (m) {
      const pct = parseFloat(m[1]);
      const sub = parseFloat(m[2]);
      return Math.round((pct / 100) * total - sub);
    }
  } catch {}
  return 0;
}

async function loadAll() {
  await Promise.all([banner.loadAd(), rect.loadAd()]);
}
async function showAll() {
  await Promise.all([banner.show(), rect.show()]);
}
function hideAll() {
  sdk.hideAd(banner.id);
  sdk.hideAd(rect.id);
}

function randomizePositions() {
  const cont = $('#adContainer');
  const maxX = cont.clientWidth;
  const maxY = cont.clientHeight;
  const rand = (min, max) => Math.max(min, Math.floor(Math.random() * max));
  const bPos = { x: rand(0, Math.max(0, maxX - banner.size.width)), y: rand(0, Math.max(0, maxY - banner.size.height)) };
  const rPos = { x: rand(0, Math.max(0, maxX - rect.size.width)), y: rand(0, Math.max(0, maxY - rect.size.height)) };

  banner.updateConfig({ position: bPos });
  rect.updateConfig({ position: rPos });

  $('#bannerX').value = bPos.x; $('#bannerY').value = bPos.y;
  $('#rectX').value = rPos.x; $('#rectY').value = rPos.y;
}

function applyBanner() {
  const size = { width: parseInt($('#bannerW').value,10), height: parseInt($('#bannerH').value,10) };
  const pos = { x: parseInt($('#bannerX').value,10), y: parseInt($('#bannerY').value,10) };
  banner.updateConfig({ size, position: pos });
}
function applyRect() {
  const cont = $('#adContainer');
  const size = { width: parseInt($('#rectW').value,10), height: parseInt($('#rectH').value,10) };
  const pos = {
    x: resolveMaybeCalc($('#rectX').value, cont.clientWidth),
    y: resolveMaybeCalc($('#rectY').value, cont.clientHeight)
  };
  rect.updateConfig({ size, position: pos });
}

function bindUI() {
  $('#initBtn').addEventListener('click', () => initSDK().catch(e => logLine('init error', e.message)));
  $('#clearLog').addEventListener('click', () => (logView.textContent = ''));

  $('#bannerLoad').addEventListener('click', () => banner.loadAd().catch(e => logLine('banner load error', e.message)));
  $('#bannerShow').addEventListener('click', () => banner.show().catch(e => logLine('banner show error', e.message)));
  $('#bannerHide').addEventListener('click', () => sdk.hideAd(banner.id));
  $('#bannerApply').addEventListener('click', applyBanner);

  $('#rectLoad').addEventListener('click', () => rect.loadAd().catch(e => logLine('rect load error', e.message)));
  $('#rectShow').addEventListener('click', () => rect.show().catch(e => logLine('rect show error', e.message)));
  $('#rectHide').addEventListener('click', () => sdk.hideAd(rect.id));
  $('#rectApply').addEventListener('click', applyRect);

  $('#loadAll').addEventListener('click', () => loadAll().catch(e => logLine('loadAll error', e.message)));
  $('#showAll').addEventListener('click', () => showAll().catch(e => logLine('showAll error', e.message)));
  $('#hideAll').addEventListener('click', hideAll);
  $('#randomize').addEventListener('click', randomizePositions);

  // Seed defaults
  $('#gameKey').value = defaultConfig.gameKey;
  $('#environment').value = defaultConfig.environment;
  $('#baseUrl').value = defaultConfig.baseUrl;
  $('#pollInterval').value = defaultConfig.pollingInterval;
  $('#debugMode').checked = defaultConfig.debugMode;
}

window.addEventListener('DOMContentLoaded', () => {
  bindUI();

  // Try to get a game key from storage, if not, prompt user
  const savedGameKey = localStorage.getItem('adinmo-game-key');
  if (savedGameKey) {
    $('#gameKey').value = savedGameKey;
    logLine('Loaded saved Game Key. Click "Initialize SDK" to start.');
  } else {
    logLine('Enter your Game Key and click "Initialize SDK" to start.');
  }
  
  // Enable debug mode by default for troubleshooting
  $('#debugMode').checked = true;
});