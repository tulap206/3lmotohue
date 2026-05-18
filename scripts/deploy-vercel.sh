#!/bin/bash
# Push code lên GitHub và mở Vercel import (chạy sau khi: gh auth login)
set -e
cd "$(dirname "$0")/.."

if ! git remote get-url origin &>/dev/null; then
  git remote add origin https://github.com/tulap206/3l-moto.git
fi

if ! gh auth status &>/dev/null; then
  echo "Chưa đăng nhập GitHub CLI. Chạy: gh auth login"
  gh auth login -h github.com -p https -w
fi

gh auth setup-git
git push -u origin main

echo ""
echo "✓ Đã push lên https://github.com/tulap206/3l-moto"
echo "Tiếp theo: https://vercel.com/new → Import repo 3l-moto"
echo "Thêm Environment Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
