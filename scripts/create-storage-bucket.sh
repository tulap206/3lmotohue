#!/bin/bash

# Supabase credentials
SUPABASE_URL="https://fpiupgmknsydqrihqdbo.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaXVwZ21rbnN5ZHFyaWhxZGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTYzNzAsImV4cCI6MjA5NDYzMjM3MH0.0YK7DmgpA8YuWEaIt1wh07dOQXW5GFlQzo3JydfFaL8"

echo "🔨 Creating 'vehicles' storage bucket..."

# Create bucket
curl -X POST "$SUPABASE_URL/storage/v1/b" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vehicles",
    "public": true,
    "file_size_limit": 52428800
  }' 2>&1

echo ""
echo "✅ Bucket creation request sent!"
echo ""
echo "Next: Setup RLS policies in Supabase Dashboard"

