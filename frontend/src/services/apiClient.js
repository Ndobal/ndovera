const DEFAULT_TIMEOUT_MS = 7000;

function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function getJson(url, fallbackData, options = {}) {
  try {
    const response = await withTimeout(
      fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      }),
      options.timeoutMs
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.json();
  } catch (error) {
    return {
      ...fallbackData,
      _meta: {
        source: 'fallback',
        reason: error.message,
      },
    };
  }
}
