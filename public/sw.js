// ==============================================================================
// VISTORIA YZZY — SERVICE WORKER (ETAPA 09: PWA & OFFLINE SHELL)
// ==============================================================================

const CACHE_NAME = 'yzzy-app-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/logo.jpg',
  '/manifest.json'
];

// 1. INSTALL: Pré-cachear App Shell estático
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. ACTIVATE: Limpar versões obsoletas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH STRATEGY:
// - Assets estáticos (JS, CSS, Imagens da UI, Fontes): Cache First / Stale While Revalidate
// - APIs e Supabase: Network First (Dados de vistoria e mídias privadas são geridos pelo IndexedDB)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não interceptar requests que não sejam GET
  if (request.method !== 'GET') {
    return;
  }

  // Não cachear chamadas Supabase/API pelo Service Worker (IndexedDB gerencia dados offline autenticados)
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ offline: true, message: 'Dispositivo offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // App Shell & Assets Estáticos: Cache First com fallback de rede
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualizar cache em segundo plano (Stale While Revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {
          // Erro de rede em background ignorado silenciosamente
        });
        return cachedResponse;
      }

      // Se não estiver no cache, buscar na rede e cachear se for asset estático
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const isStaticAsset = request.destination === 'style' ||
                              request.destination === 'script' ||
                              request.destination === 'image' ||
                              request.destination === 'font' ||
                              url.pathname === '/';

        if (isStaticAsset) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        // Se a navegação falhar completamente (ex: SPA reload offline), retornar index.html do cache
        if (request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
        return new Response('Sem conexão', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// 4. MENSAGENS: Controle de atualização segura
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
