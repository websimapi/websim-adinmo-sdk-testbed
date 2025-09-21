// Minimal in-browser mock for AdInMo endpoints
export function attachAdInMoMock(sdk, options = {}) {
  const latencyMs = options.latencyMs ?? 300;

  const original = sdk.makeAPICall.bind(sdk);
  sdk.makeAPICall = async (endpoint, req = {}) => {
    if (sdk.config.baseUrl !== 'mock') {
      return original(endpoint, req);
    }
    await new Promise(r => setTimeout(r, latencyMs));
    if (endpoint === '/session/init') {
      return { ok: true, sessionId: sdk.sessionId, environment: sdk.config.environment };
    }
    if (endpoint === '/ads/request' && req.method === 'POST') {
      const body = JSON.parse(req.body || '{}');
      const id = `ad_${Math.random().toString(36).slice(2)}`;
      const size = body.size || { width: 320, height: 50 };
      const img = `https://picsum.photos/seed/${id}/${Math.max(100, Math.round(size.width))}/${Math.max(50, Math.round(size.height))}`;
      return {
        ad: {
          id,
          imageUrl: img,
          clickUrl: 'https://adinmo.com/?utm_source=mock',
          meta: { placementId: body.placementId }
        }
      };
    }
    if (endpoint === '/track/impression') {
      return { ok: true };
    }
    if (endpoint === '/track/click') {
      return { ok: true };
    }
    if (endpoint === '/messages/poll') {
      // Occasionally push a config update
      if (Math.random() < 0.15) {
        return [{
          type: 'config_update',
          data: { pollingInterval: Math.max(5000, sdk.config.pollingInterval - 1000) }
        }];
      }
      return [];
    }
    return { ok: true };
  };
  return () => { sdk.makeAPICall = original; };
}

