// 「迦哥闯天下」iPad 专用 HTTPS 静态服务
// 用法：npm run build && npm run serve:ipad
// 作用：以 HTTPS 提供 dist/（iOS 安装 PWA 必需），并暴露根证书下载
import { createServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const HTTPS_DIR = join(ROOT, 'build', 'https')
const PORT = Number(process.env.PORT || 8443)
const LAN_IP = process.env.LAN_IP || '192.168.3.67'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pem': 'application/x-pem-file',
}

const server = createServer(
  {
    key: readFileSync(join(HTTPS_DIR, 'server-key.pem')),
    cert: readFileSync(join(HTTPS_DIR, 'server-cert.pem')),
  },
  async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'https://x').pathname)
      if (path === '/ca.pem') {
        res.writeHead(200, { 'Content-Type': MIME['.pem'], 'Content-Disposition': 'attachment; filename="jiage-ca.pem"' })
        createReadStream(join(HTTPS_DIR, 'rootCA.pem')).pipe(res)
        return
      }
      if (path === '/') path = '/index.html'
      const file = normalize(join(DIST, path))
      if (!file.startsWith(DIST) || !existsSync(file)) {
        // SPA 兜底：任何未知路径回 index.html
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Service-Worker-Allowed': '/' })
        createReadStream(join(DIST, 'index.html')).pipe(res)
        return
      }
      const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream'
      // SW 需要全路径 scope 权限
      const extra = file.endsWith('sw.js') ? { 'Service-Worker-Allowed': '/' } : {}
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': file.includes('assets/') ? 'max-age=31536000, immutable' : 'no-cache', ...extra })
      createReadStream(file).pipe(res)
    } catch (err) {
      res.writeHead(500)
      res.end(String(err))
    }
  }
)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[迦哥闯天下] iPad 版已启动（固定链接，长期不变）：`)
  console.log(`  iPad:   https://jiagedeMac-mini.local:${PORT}/`)
  console.log(`  备用:   https://${LAN_IP}:${PORT}/（IP 变化时用这个域名）`)
  console.log(`  本机:   https://localhost:${PORT}/`)
  console.log(`  根证书: http://${LAN_IP}:3000/ca.pem（iPad 上先装这个）`)
})
