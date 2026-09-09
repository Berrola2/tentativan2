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
// - Navegação (HTML/Document): Network First com fallback para cache offline (evita travar em versões antigas)
// - Assets com hash (JS, CSS, Imagens da UI): Cache First com atualização em background
// - APIs e Supabase: Network First (Dados de vistoria e mídias privadas são geridos pelo IndexedDB)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não interceptar requests que não sejam GET
  if (request.method !== 'GET') {
    return;
  }

  // Não interceptar chamadas Supabase/API pelo Service Worker (IndexedDB gerencia dados offline autenticados)
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

  // 3.1 NAVEGAÇÃO / HTML: Network-First (Garante que novos deploys apareçam imediatamente quando online)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Se estiver offline ou sem rede, entrega o App Shell do cache
          return caches.match('/index.html') || caches.match('/') || new Response('Vistoria YZZY Offline', { status: 503 });
        })
    );
    return;
  }

  // 3.2 ASSETS ESTÁTICOS (JS, CSS, Imagens, Fontes): Cache First com atualização em background
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const isStaticAsset =
          request.destination === 'style' ||
          request.destination === 'script' ||
          request.destination === 'image' ||
          request.destination === 'font';

        if (isStaticAsset) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
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
