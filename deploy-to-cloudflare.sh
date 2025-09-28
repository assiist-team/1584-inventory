#!/bin/bash

# Cloudflare Pages Deployment Script
# This script builds and prepares your app for deployment to Cloudflare Pages

echo "🚀 Starting Cloudflare Pages deployment preparation..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please use Node.js 18+."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies."
    exit 1
fi

# Type check
echo ""
echo "🔍 Running type check..."
npm run type-check

if [ $? -ne 0 ]; then
    echo "❌ Type check failed. Please fix TypeScript errors before deploying."
    exit 1
fi

# Build the application
echo ""
echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix build errors before deploying."
    exit 1
fi

# Verify build output
if [ ! -d "dist" ]; then
    echo "❌ Build output directory 'dist' not found."
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo "❌ Build output missing index.html."
    exit 1
fi

echo ""
echo "✅ Build completed successfully!"
echo ""

# Check if Wrangler CLI is available for deployment
if command -v wrangler &> /dev/null; then
    echo "🔧 Wrangler CLI found. You can deploy with:"
    echo "wrangler pages deploy dist --project-name=1584-inventory-management"
else
    echo "💡 Wrangler CLI not found. Install with: npm install -g wrangler"
fi

echo ""
echo "📋 Next steps:"
echo "1. Upload the 'dist' folder to your Cloudflare Pages project"
echo "2. Set environment variables in Cloudflare Pages dashboard"
echo "3. Configure custom domain: inventory.1584design.com"
echo "4. Update Firebase CORS configuration"
echo ""
echo "📖 For detailed instructions, see CLOUDFLARE_DEPLOYMENT.md"
echo ""
echo "🎉 Deployment preparation complete!"
