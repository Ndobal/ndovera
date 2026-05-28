export default {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request);

    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    const url = new URL(request.url);
    const isDocumentRequest = request.method === 'GET' || request.method === 'HEAD';
    const looksLikeStaticAsset = /\.[^/]+$/.test(url.pathname);

    if (!isDocumentRequest || looksLikeStaticAsset) {
      return assetResponse;
    }

    url.pathname = '/index.html';
    const appShellResponse = await env.ASSETS.fetch(new Request(url.toString(), request));
    const headers = new Headers(appShellResponse.headers);
    headers.delete('location');

    return new Response(appShellResponse.body, {
      status: 200,
      statusText: 'OK',
      headers,
    });
  },
};