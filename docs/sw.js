// 「迦哥闯天下」离线缓存服务
// 策略：同源 GET 一律缓存优先，首次联网访问后整站可用，导航请求兜底回 index.html
const VERSION = 'jiage-v26'
const PRECACHE = ['./', './index.html', './start.html', './manifest.webmanifest', './icon-192-v12.png', './icon-512-v12.png', './apple-touch-icon-v12.png', './apple-touch-icon.png', './apple-touch-icon-precomposed.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // SPA 导航：网络优先，失败回缓存的 index.html（离线可用）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('./index.html').then((r) => r || caches.match('./'))
      )
    )
    return
  }

  // 图标类资源：网络优先，避免旧缓存图标长期不更新；其余静态资源缓存优先
  if (/icon|manifest/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone()
            caches.open(VERSION).then((cache) => cache.put(request, clone))
          }
          return resp
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // 静态资源：缓存优先，未命中则联网并写入缓存
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone()
            caches.open(VERSION).then((cache) => cache.put(request, clone))
          }
          return resp
        })
    )
  )
})
