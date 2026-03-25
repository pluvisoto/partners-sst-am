const UTM_STORAGE_KEY = 'am_utm_params';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];

export const captureUtmParams = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = {};
    let hasUrlUtm = false;
    UTM_KEYS.forEach(key => {
      const value = params.get(key);
      if (value) {
        fromUrl[key] = value.trim().substring(0, 200);
        hasUrlUtm = true;
      }
    });
    if (hasUrlUtm) {
      try { sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl)); } catch (_) { /* storage indisponivel */ }
      return fromUrl;
    }
    try {
      const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (_) { /* storage indisponivel */ }
    return {};
  } catch (_) {
    return {};
  }
};
