#!/bin/bash
# Production Security Verification Script
# Verifies that debug panel is disabled in production builds

set -e

echo "🔍 Verifying production security..."

# Step 1: Check if build script exists
if ! grep -q "vite build" package.json; then
  echo "❌ ERROR: vite build not found in package.json"
  exit 1
fi

# Step 2: Build the app
echo "📦 Building production bundle..."
npm run build > /dev/null 2>&1

# Step 3: Check if dist directory exists
if [ ! -d "dist" ]; then
  echo "❌ ERROR: dist directory not found after build"
  exit 1
fi

# Step 4: Search for debug-related code in bundle
echo "🔎 Checking for debug panel code in bundle..."

DEBUG_FOUND=false

# Check for DebugView component (should be tree-shaken)
if grep -r "DebugView" dist/assets/*.js > /dev/null 2>&1; then
  echo "⚠️  WARNING: DebugView found in production bundle"
  DEBUG_FOUND=true
fi

# Check for debug panel strings (should not exist)
if grep -r "debug-panel" dist/assets/*.js > /dev/null 2>&1; then
  echo "⚠️  WARNING: debug-panel class found in production bundle"
  DEBUG_FOUND=true
fi

# Check for VITE_DEBUG_PANEL references (should be dead code eliminated)
if grep -r "VITE_DEBUG_PANEL" dist/assets/*.js > /dev/null 2>&1; then
  echo "⚠️  WARNING: VITE_DEBUG_PANEL found in production bundle"
  DEBUG_FOUND=true
fi

# Final result
if [ "$DEBUG_FOUND" = false ]; then
  echo "✅ SUCCESS: No debug panel code found in production bundle"
  echo "✅ Production build is secure"
  exit 0
else
  echo "❌ FAIL: Debug panel code detected in production bundle"
  echo "❌ Review tree-shaking configuration"
  exit 1
fi
