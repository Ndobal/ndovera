export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isDocumentRequest = request.method === 'GET' || request.method === 'HEAD';
    const looksLikeStaticAsset = /\.[^/]+$/.test(url.pathname);
    const shouldServeAppShell = isDocumentRequest && !looksLikeStaticAsset && url.pathname !== '/' && url.pathname !== '/index.html';

    if (!shouldServeAppShell) {
      return env.ASSETS.fetch(request);
    }

    url.pathname = '/index.html';
    const appShellResponse = await env.ASSETS.fetch(new Request(url.toString(), {
      method: 'GET',
      headers: request.headers,
    }));
    const headers = new Headers(appShellResponse.headers);
    headers.delete('location');
    headers.delete('content-length');

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        statusText: 'OK',
        headers,
      });
    }

    const body = await appShellResponse.arrayBuffer();

    return new Response(body, {
      status: 200,
      statusText: 'OK',
      headers,
    });
  },
};