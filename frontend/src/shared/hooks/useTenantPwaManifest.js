import { useEffect } from 'react';

const TENANT_PWA_KEY = 'tenantPwaInfo';

/**
 * Store tenant branding for PWA manifest injection.
 * Call this after login/profile hydration when tenant info is available.
 */
export function storeTenantPwaInfo({ schoolName, logoUrl, subdomain }) {
  if (!schoolName && !logoUrl) return;
  const nextValue = { schoolName: schoolName || '', logoUrl: logoUrl || '', subdomain: subdomain || '' };
  window.localStorage.setItem(TENANT_PWA_KEY, JSON.stringify(nextValue));
  window.dispatchEvent(new CustomEvent('ndovera:tenant-pwa-updated', { detail: nextValue }));
}

export function clearTenantPwaInfo() {
  window.localStorage.removeItem(TENANT_PWA_KEY);
  window.dispatchEvent(new CustomEvent('ndovera:tenant-pwa-updated', { detail: null }));
}

export function getTenantPwaInfo() {
  try {
    return JSON.parse(window.localStorage.getItem(TENANT_PWA_KEY) || 'null');
  } catch {
    return null;
  }
}

/**
 * Injects a dynamic <link rel="manifest"> blob URL when a tenant user is logged in,
 * so the PWA install banner uses the school's logo and name.
 */
export function useTenantPwaManifest(auth) {
  useEffect(() => {
    const user = auth?.user;
    const isTenantUser = user?.tenantId && user?.role !== 'ami';
    if (!isTenantUser) return;

    const info = getTenantPwaInfo();
    if (!info?.schoolName && !info?.logoUrl) return;

    const icons = info.logoUrl
      ? [
          { src: info.logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: info.logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ]
      : [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ];

    const manifest = {
      name: info.schoolName || 'NDOVERA',
      short_name: info.schoolName ? info.schoolName.split(' ')[0] : 'NDOVERA',
      description: `${info.schoolName || 'School'} — powered by NDOVERA`,
      start_url: '/',
      scope: '/',
      icons,
      theme_color: '#191970',
      background_color: '#b5e3f4',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'portrait-primary',
      categories: ['education', 'productivity'],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const url = URL.createObjectURL(blob);

    // Replace existing manifest link
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    const oldHref = link.href;
    link.href = url;

    return () => {
      URL.revokeObjectURL(url);
      // Restore original manifest when logged out
      if (link) link.href = oldHref || '/manifest.json';
    };
  }, [auth]);
}
