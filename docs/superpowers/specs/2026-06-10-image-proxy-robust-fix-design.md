# Image Proxy: Semáforo + Streaming + Caché Redis

**Fecha:** 2026-06-10  
**Contexto:** Backend Node.js crasheaba silenciosamente (OOM kill por Docker) cuando llegaban 15+ requests concurrentes a `/api/image-proxy`. Causa: `file.download()` cargaba el buffer completo de GCS en heap (~15MB) + Sharp también allocaba buffer de salida, sumando ~50-80MB por request. 15 requests × 70MB = ~1GB, superando el `mem_limit: 512m`.

**Fix inmediato ya aplicado:** `mem_limit` backend: `512m` → `1g`.

**Este spec:** Fix estructural para que el problema no pueda volver a ocurrir independientemente del límite de memoria.

---

## Objetivos

1. Limitar concurrencia de operaciones Sharp (semáforo) para evitar spikes de memoria.
2. Reemplazar el approach buffer-completo por streaming (GCS stream → Sharp transform → response), reduciendo memoria por request de ~70MB a ~5-10MB.
3. Cachear outputs procesados en Redis para que requests repetidas no toquen GCS ni Sharp.

## Archivos afectados

| Archivo | Acción |
|---|---|
| `backend/src/lib/imageSemaphore.js` | NUEVO |
| `backend/src/lib/imageCache.js` | NUEVO |
| `backend/src/routes/imageProxy.routes.js` | REFACTOR |

No se tocan otros archivos del backend.

---

## Componente 1: `imageSemaphore.js`

Clase `Semaphore` en JS puro, sin dependencias externas.

**Comportamiento:**
- Constructor recibe `max` (máx. operaciones concurrentes).
- `acquire()` → devuelve Promise. Si hay slot disponible, resuelve inmediatamente. Si no, encola.
- `release()` → libera slot y desencola el siguiente waiter si hay.
- `acquireWithTimeout(ms)` → envuelve `acquire()` con un `setTimeout`. Si expira antes de adquirir, rechaza con error `SEMAPHORE_TIMEOUT`.

**Configuración:**
- `SHARP_CONCURRENCY` (env) — default `6`.
- `SHARP_QUEUE_TIMEOUT_MS` (env) — default `8000`.

**Instancia singleton** exportada del módulo — un solo semáforo global para todas las operaciones Sharp del proceso.

---

## Componente 2: `imageCache.js`

Wrapper Redis para cachear outputs procesados.

**Interface:**
```
get(key) → { contentType, etag, data: Buffer } | null
set(key, { contentType, etag, data: Buffer }, ttlSeconds) → void (fire-and-forget)
buildKey(bucketName, objectName, size) → string (hash SHA-256, 16 chars hex)
```

**Almacenamiento:**
- Serialización: JSON string con `{ contentType, etag, data: <base64> }`.
- Key Redis: `imgproxy:{16-char-sha256-hex-of-"bucket:object:size"}`.
- TTL: `IMAGE_PROXY_CACHE_TTL_SECONDS` (env) — default `14400` (4h).

**Habilitación:**
- `IMAGE_PROXY_CACHE_ENABLED` (env) — default `true`. Si `false`, `get()` siempre devuelve `null` y `set()` no hace nada.

**Errores:**
- `get()` y `set()` capturan excepciones de Redis internamente y loggean con `warn`. Nunca propagan — si Redis falla, el proxy sigue funcionando sin caché.

**¿Qué se cachea?**
- Solo requests con `size` preset válido (`thumb`, `medium`). Son los costosos.
- Requests sin `size` (passthrough) van directo a stream — ya son eficientes de por sí.

---

## Componente 3: `imageProxy.routes.js` (refactor)

### Inicialización del módulo

```javascript
sharp.concurrency(1);  // 1 thread por instancia Sharp (limita uso de libuv thread pool)
sharp.cache(false);    // desactiva caché interno de Sharp (usamos Redis)
```

### Flujo GCS con `size` preset (path principal refactorizado)

```
1. Verificar JWT
2. Obtener metadata GCS (para ETag, Last-Modified)
3. Calcular resolvedEtag
4. Si If-None-Match coincide → 304 (sin caché Redis, sin GCS download)
5. Consultar imageCache.get(key)
   HIT → set headers → res.end(buffer) → return
   MISS → continuar
6. semaphore.acquireWithTimeout(SHARP_QUEUE_TIMEOUT_MS)
   TIMEOUT → res.status(503).set('Retry-After', '2').json({message: '...'}) → return
7. GCS createReadStream() → Sharp({ failOnError: false }).rotate().resize(preset)
8. pipeline.toBuffer()  ← solo el output (pequeño), input va por stream interno de Sharp
9. semaphore.release()
10. imageCache.set(key, { contentType, etag, data }) — async, sin await
11. res.set(headers).end(outputBuffer)
```

**Nota sobre paso 7-8:** Sharp acepta un stream readable como input cuando se instancia con `sharp(stream)`. Internamente Sharp maneja su propio buffer para el procesamiento. El output `toBuffer()` es solo la imagen redimensionada (~10-15KB para thumb), no el original. Esto es lo que reduce la huella de memoria de Node.js.

### Flujo GCS sin `size` (passthrough)

Sin cambios respecto al código actual — ya usa `createReadStream()` + `stream.pipe(res)`. Es eficiente.

### Flujo local con `size` preset

Mismo patrón que GCS: `fs.createReadStream(path)` → `sharp(stream)` → semáforo → caché.

### Manejo de errores en stream

```javascript
gcsStream.on('error', (err) => { semaphore.release(); if (!res.headersSent) res.status(500).end(); });
```

Semáforo siempre se libera en error — usar try/finally alrededor del bloque de procesamiento.

### Respuesta en timeout de semáforo

```
HTTP 503 Service Unavailable
Retry-After: 2
{ "message": "Servidor ocupado procesando imágenes, reintenta en unos segundos." }
```

El frontend ya tiene lógica de retry (`?retry=...` en los logs). El 503 es más correcto que dejar que la conexión cuelgue.

---

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `SHARP_CONCURRENCY` | `6` | Máx. operaciones Sharp paralelas |
| `SHARP_QUEUE_TIMEOUT_MS` | `8000` | Tiempo máx. en cola antes de 503 |
| `IMAGE_PROXY_CACHE_TTL_SECONDS` | `14400` | TTL caché Redis (4h) |
| `IMAGE_PROXY_CACHE_ENABLED` | `true` | Activar/desactivar caché |

Todas opcionales. El sistema funciona con defaults sin ninguna configuración adicional en Coolify.

---

## Estimación de memoria con fix completo

| Escenario | Antes del fix | Con fix |
|---|---|---|
| 15 thumbs concurrentes, primera carga | ~1GB peak → OOM | ~90MB peak (6 activos × 15MB Sharp interno) |
| 15 thumbs concurrentes, segunda carga | ~1GB peak → OOM | <1MB (todo desde Redis, ~15KB × 15) |
| mem_limit backend | 512m (insuficiente) | 1g (holgado incluso en peak) |

---

## Lo que NO cambia

- Autenticación JWT del proxy — sin cambios.
- Rate limiting por IP — sin cambios.
- ETag / 304 handling — sin cambios (funciona en cache hit también).
- Passthrough sin resize — sin cambios (ya era eficiente).
- Flujo de archivos locales sin resize — sin cambios.
- Ninguna ruta ni endpoint del resto del backend.
