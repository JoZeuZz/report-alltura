const CACHE_NAME = 'alltura-reports-v2'; // bump: invalida cachés v1 podridas
const RUNTIME_CACHE = 'runtime-v1';

// Solo assets que Vite garantiza estables (sin hash). Los bundles /assets/* se
// cachean en runtime por cacheFirstStrategy cuando el navegador los solicita.
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo192.png',
  '/offline.html',
];

// Instalación: cachear recursos estáticos con tolerancia a fallos individuales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// Activación: limpiar cachés que no estén en la lista blanca (incluye v1)
self.addEventListener('activate', (event) => {
  const VALID_CACHES = new Set([CACHE_NAME, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !VALID_CACHES.has(name))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Estrategia de fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (isApiRequest(request)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
  }
});

// Network First para APIs (GET → cachea; otros métodos → solo network)
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.status === 200 && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    if (request.method === 'GET') {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    throw _error;
  }
}

// Cache First para assets estáticos (scripts, estilos, imágenes)
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

// Navegación: network first, fallback a offline.html cacheado
async function navigationStrategy(request) {
  try {
    return await fetch(request);
  } catch (_error) {
    const offline = await caches.match('/offline.html');
    return offline || new Response('Sin conexión', { status: 503 });
  }
}

// Helpers
function isApiRequest(request) {
  return request.url.includes('/api/');
}

function isStaticAsset(request) {
  return (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image'
  );
}
