# Análisis Técnico de HLSLoader Extension v2.2.9

## 📋 Resumen Ejecutivo

HLSLoader es una extensión Manifest V3 que intercepta streams de video (HLS/DASH/MP4) del tráfico de red del navegador. El código está minificado pero legible, y usa técnicas avanzadas de intercepción.

---

## 🔑 Técnicas Clave Identificadas

### 1. **Intercepción de Red con webRequest API**

La extensión usa dos listeners principales:

#### A) `onBeforeRequest` - Detección Inicial

```javascript
// Captura requests de frames principales
chrome.webRequest.onBeforeRequest.addListener(
  (e) => {
    const { tabId, requestId, url, method } = e;
    // Registra URLs principales para tracking
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  [],
);
```

#### B) `onHeadersReceived` - Análisis de Respuestas

```javascript
// Aquí es donde detecta los streams de video
chrome.webRequest.onHeadersReceived.addListener(
  (e) => {
    const { responseHeaders, url } = e;
    // Analiza Content-Type y extensiones
    // Detecta manifests M3U8, DASH, y segmentos TS
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"],
);
```

**Técnica Clave**: Usa `extraHeaders` para acceder a TODOS los headers, incluyendo los protegidos como `Set-Cookie`.

### 2. **Detección Inteligente de Streams**

La extensión identifica streams mediante múltiples criterios:

```javascript
// Content-Types detectados (del código)
const VIDEO_MIME_TYPES = [
  "application/x-mpegurl", // HLS
  "application/dash+xml", // DASH
  "video/mp2t", // Transport Stream (TS)
  "video/mp4",
  "video/webm",
  // ... más de 100 tipos
];

// Extensiones de archivo
const VIDEO_EXTENSIONS = [
  "m3u8",
  "m3u",
  "mpd", // Manifests
  "ts",
  "mp4",
  "webm", // Segmentos
  // ... 180+ extensiones
];
```

**Lógica de detección**:

1. Verifica `Content-Type` del response
2. Si no coincide, extrae extensión de la URL
3. Validación especial para M3U8 pequeños (descarga y verifica contenido `#EXTM3U`)
4. Detecta automáticamente segmentos TS de 16 bytes (píxeles de sincronización)

### 3. **Inyección de Scripts en Páginas (MSE Interception)**

Esta es la técnica MÁS PODEROSA:

```javascript
// Inyectado en MAIN world (puede modificar APIs nativas)
MediaSource._originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;

MediaSource.prototype.addSourceBuffer = function (mimeType) {
  const sourceBuffer = MediaSource._originalAddSourceBuffer.call(
    this,
    mimeType,
  );

  // Intercepta appendBuffer
  sourceBuffer._originalAppendBuffer = sourceBuffer.appendBuffer;
  sourceBuffer.appendBuffer = function (data) {
    // Convierte el ArrayBuffer a Blob y crea URL
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);

    // Envía al content script
    window.postMessage(
      {
        cmd: "c2c_transfer",
        params: {
          url: url,
          mimeType: mimeType,
          timestamp: Date.now(),
        },
      },
      origin,
    );

    // Llama al método original
    return sourceBuffer._originalAppendBuffer.call(this, data);
  };

  return sourceBuffer;
};
```

**Por qué es tan efectiva**:

- Captura datos que pasan por MediaSource Extensions (MSE)
- No depende de webRequest (evita limitaciones de CORS)
- Funciona incluso con streams encriptados _antes_ del DRM
- Intercepta YouTube, Netflix, etc. (aunque YouTube está deshabilitado intencionalmente)

### 4. **Arquitectura de Comunicación**

```
┌─────────────────────────────────────────────────────────┐
│  TAB (Página Web)                                       │
│  ┌──────────────┐         ┌──────────────┐            │
│  │ MAIN World   │────────▶│ ISOLATED     │            │
│  │ (MSE Hook)   │ postMsg │ (Content.js) │            │
│  └──────────────┘         └──────┬───────┘            │
└────────────────────────────────────│────────────────────┘
                                     │ chrome.runtime
                                     │ .sendMessage
                          ┌──────────▼──────────┐
                          │  Service Worker     │
                          │  (bg.js)           │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  Offscreen Document │
                          │  (fetch proxy)      │
                          └─────────────────────┘
```

### 5. **Storage y Compresión de Datos**

```javascript
// Compresión de URLs (del código)
compress_x2: (item, tab) => {
  // Separa URL en: origen + path + filename
  const urlParts = url.match(/(^[^:]+:\/\/[^\/]+\/)(.*)([^\/]*$)/);

  // Comprime usando hashmap de strings repetidos
  // Reduce almacenamiento ~70%
  return compressed_string;
};
```

**Sistema de storage**:

- `chrome.storage.session` - Datos temporales (limpia al cerrar)
- `chrome.storage.local` - Configuración persistente
- Estructura por pestañas con tracking de relaciones (root/child)

### 6. **Offscreen Document para Fetch**

```javascript
// En offscreen.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.cmd === "b2o_fetch_request") {
    const { url, method, headers } = msg.params;

    fetch(url, {
      method: method || "GET",
      mode: "cors",
      credentials: "include",
      headers: headers,
    })
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        return { ok: true, blobUrl: blobUrl };
      });
  }
});
```

**Por qué Offscreen**:

- Service Workers NO pueden crear Blob URLs
- Offscreen document es un HTML oculto que SÍ puede
- Permite descargar recursos cross-origin con credenciales

### 7. **Declarative Net Request (DNR) Dinámico**

```javascript
// Modifica headers dinámicamente por tab
chrome.declarativeNetRequest.updateSessionRules({
  addRules: [
    {
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "Referer", operation: "set", value: customReferer },
          { header: "Origin", operation: "set", value: customOrigin },
        ],
      },
      condition: {
        tabIds: [specificTabId],
        urlFilter: "*playlist.m3u8*",
      },
      id: ruleId,
      priority: 1,
    },
  ],
});
```

Permite bypassear protecciones de referer/origin por video.

---

## 🎯 Estrategia de Detección por Tipo

### HLS (HTTP Live Streaming)

1. Detecta manifest `.m3u8` via Content-Type o extensión
2. Si es pequeño (<100KB), descarga y verifica contenido `#EXTM3U`
3. Captura todos los segmentos `.ts` subsecuentes
4. Trackea variantes (calidades) del master playlist

### DASH (Dynamic Adaptive Streaming)

1. Detecta manifest `.mpd` (application/dash+xml)
2. Parsea XML para extraer información de segmentos
3. Captura initialization segments y media segments

### Progressive Download (MP4/WebM)

1. Detecta por Content-Type: video/mp4, video/webm
2. Captura directamente (no requiere segmentación)

### MSE (Media Source Extensions)

1. Hook en MediaSource.addSourceBuffer()
2. Intercepta sourceBuffer.appendBuffer()
3. Captura blobs en tiempo real
4. **Funciona con cualquier formato que use MSE**

---

## 🚀 Técnicas Aplicables a Tu Proyecto

### ✅ Nivel 1: Testing con Node/Bun (VIABLE)

```javascript
// Puedes simular:
1. Parser de manifests M3U8/MPD
2. Lógica de detección por Content-Type/extensión
3. Descarga de segmentos
4. Concatenación de TS/MP4
5. Sistema de playlist en memoria
```

### ✅ Nivel 2: Extensión Básica

```javascript
1. webRequest.onHeadersReceived para detectar
2. Storage.session para playlist temporal
3. Popup con lista estilo YouTube
4. Player integrado (hls.js)
```

### ✅✅ Nivel 3: Extensión Avanzada (Como HLSLoader)

```javascript
1. Inyección MSE hooks (MAIN world)
2. Offscreen document para fetch
3. DNR dinámico para headers
4. Compresión de datos
5. Multi-tab tracking
```

---

## ⚠️ Limitaciones y Consideraciones

### 1. **YouTube está explícitamente bloqueado**

```javascript
const DISABLE_ON_YOUTUBE_REGEXP = /^https?:\/\/www\.youtube\.com\//;
```

Razón: Evitar problemas legales y competencia con YouTube Premium.

### 2. **DRM no se puede bypassear**

La intercepción ocurre DESPUÉS del descifrado DRM, así que:

- ❌ Netflix, Disney+, HBO Max (Widevine L1)
- ✅ Streams sin DRM
- ✅ Streams con protección básica (referer/origin)

### 3. **Service Worker vs Offscreen**

- Service Worker: No puede crear Blob URLs
- Offscreen: Puede, pero consume más recursos
- HLSLoader usa ambos estratégicamente

---

## 📦 Dependencias Mínimas para Tu Proyecto

### Testing (Node/Bun)

```bash
bun add m3u8-parser        # Parser HLS
bun add fast-xml-parser    # Parser DASH/MPD
bun add better-sqlite3     # Storage temporal
```

### Extensión

```javascript
// Manifest V3
"permissions": [
  "webRequest",
  "declarativeNetRequest",
  "scripting",
  "offscreen",
  "storage",
  "tabs"
],
"host_permissions": ["<all_urls>"]
```

### UI Player

```javascript
- hls.js (HLS playback)
- dash.js (DASH playback)
- Video.js (UI wrapper)
```

---

## 🎬 Siguiente Paso Recomendado

### Opción A: Prototipo de Testing Rápido (2-3 horas)

Crear un script Bun que:

1. Simule detección de manifests
2. Descargue y parsee M3U8
3. Descargue primeros 5 segmentos
4. Los concatene en un archivo
5. Verifique que sea reproducible

### Opción B: Extension MVP (1 día)

1. Implementar webRequest listener
2. Detectar solo M3U8/MPD
3. Storage simple en session
4. Popup básico con lista
5. Link de descarga

### Opción C: Full Implementation (3-5 días)

Todo lo anterior + MSE hooks + offscreen + DNR

---

## 💡 Insights Importantes

1. **La clave es webRequest.onHeadersReceived con extraHeaders**: Da acceso a todos los headers sin restricciones.

2. **MSE hooking es más poderoso que webRequest**: Captura lo que realmente se renderiza, no solo lo que se descarga.

3. **Offscreen document es obligatorio para fetch en MV3**: Service workers no pueden crear Blob URLs.

4. **La compresión de datos es crucial**: chrome.storage tiene límites estrictos (10MB session, 100MB local).

5. **Multi-tab tracking es complejo**: HLSLoader usa un sistema de tabs root/child con sincronización.

---

## 🔗 URLs y Patterns Importantes

```javascript
// Patterns de detección
const HLS_PATTERNS = [
  "*://*/playlist.m3u8*",
  "*://*/master.m3u8*",
  "*://*/*.m3u8",
  "*://*/hls/*",
];

const DASH_PATTERNS = ["*://*/*.mpd", "*://*/dash/*"];

const SEGMENT_PATTERNS = [
  "*://*/*.ts",
  "*://*/segment*.m4s",
  "*://*/chunk*.m4s",
];
```

---

## 📊 Métricas de Performance

- Storage usado: Compresión ~70% vs datos raw
- Límite segmentos en memoria: 50 indexes, 10 fragments
- Timeout de fetch: 5000ms
- Cleanup de Blob URLs: 60 segundos
- Session storage: Auto-cleanup al cerrar tabs

---

## 🛠️ Herramientas de Debug

```javascript
// HLSLoader expone funciones globales
external_functions = {
  help: () => {}, // Lista comandos
  log: () => {}, // Toggle logging
  show: () => {}, // Muestra storage
  rules: () => {}, // Muestra DNR rules
  reset: () => {}, // Limpia storage
};
```

Usar en console del background: `log()`, `show()`, etc.

---

## Conclusión

HLSLoader es una extensión MUY bien diseñada que combina:

- Intercepción de red tradicional (webRequest)
- Hooks de bajo nivel (MSE monkey-patching)
- Proxy de fetch (offscreen)
- Reglas dinámicas (DNR)

La técnica más valiosa para tu proyecto es el **MSE hooking**, ya que:

- Captura lo que otros métodos pierden
- Funciona con la mayoría de players modernos
- No está limitado por CORS
- Es relativamente simple de implementar

**¿Arrancamos con el prototipo de testing en Bun?**
