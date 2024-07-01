const timer = {};

export function debounce(func, wait = 300, id) {
  if (typeof func !== 'function') return;
  const name = id || func.name || 'generic';
  if (timer[name]) clearTimeout(timer[name]);
  timer[name] = setTimeout(func, wait);
}

export async function proxyFetch(url, options = {}) {
  const body = new FormData();
  body.append('headers', JSON.stringify(options.headers || {}));
  body.append('method', options.method || 'GET');
  return await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, {
    ...options,
    body,
    method: 'POST',
  });
}

export function convertBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result.split(',')[1]); // Extract only the Base64 part
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
