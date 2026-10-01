#!/bin/bash
# 迦哥闯天下 — 一键部署到 GitHub Pages
# 用法：bash scripts/deploy.sh ["提交说明"]
# 流程：构建 → dist 拷贝到 docs → 提交 → 推送（公网自动更新）
set -e
cd "$(dirname "$0")/.."

MSG="${1:-更新游戏}"

echo "==> 构建..."
npm run build

echo "==> 同步 docs/ ..."
rm -rf docs
cp -R dist docs

echo "==> 提交并推送..."
git add docs
if git diff --cached --quiet; then
  echo "没有变化，无需部署。"
else
  git commit -m "$MSG"
  git push
  echo "==> 完成！公网版本已更新：https://jiage228.github.io/jiage-wordquest/"
fi
