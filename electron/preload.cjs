// 预加载脚本：向页面暴露安全的桌面端信息
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('wordquestDesktop', {
  platform: process.platform,
  version: process.versions.electron,
})
