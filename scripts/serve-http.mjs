// 「迦哥闯天下」主屏幕图标入口服务（纯 HTTP，静态小服务，常驻）
// iPad 图标走 http 通道可完整显示；游戏本体在 https://jiagedeMac-mini.local:8000
import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIR = join(ROOT, 'build', 'launcher')
const PORT = Number(process.env.PORT || 8080)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

createServer((req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (path === '/') path = '/index.html'
    const file = normalize(join(DIR, path))
    if (!file.startsWith(DIR) || !existsSync(file)) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    createReadStream(file).pipe(res)
  } catch (err) {
    res.writeHead(500)
    res.end(String(err))
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[迦哥闯天下] 图标入口服务已启动：http://jiagedeMac-mini.local:${PORT}/`)
})
