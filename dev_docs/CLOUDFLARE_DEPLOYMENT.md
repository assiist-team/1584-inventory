# 🚀 Cloudflare Pages Deployment Guide

This guide explains how to deploy your 1584 Design inventory management application to Cloudflare Pages on the subdomain `https://inventory.1584design.com`.

## 📋 Prerequisites

- **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
- **Node.js 18+**: Required for the build process
- **Supabase Project**: Already configured (from existing setup)
- **Git Repository**: Your code should be in a Git repository

## 🛠 Step 1: Configure Cloudflare Pages

### 1.1 Create a Cloudflare Pages Project

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** → **Create a project**
3. Choose **Direct upload** (since we'll connect via Git later)
4. Or connect your Git repository directly if hosted on GitHub/GitLab

### 1.2 Build Configuration

The project includes the following Cloudflare Pages configuration files:

- **`wrangler.toml`**: Build configuration
- **`public/_headers`**: Cache headers for static assets
- **`public/_redirects`**: SPA routing configuration

### 1.3 Environment Variables

**⚠️ CRITICAL:** Set the following environment variables in your Cloudflare Pages dashboard. These must be set for **both Production and Preview** environments, and they must be available during the build process.

1. Go to your Cloudflare Pages project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables for **Production** environment:
   - Click **Add variable** for each one
   - Make sure to check **"Available during build"** for each variable

```bash
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**To get these values:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Project Settings** → **API**
4. Copy the **Project URL** (this is your `VITE_SUPABASE_URL`)
5. Copy the **anon/public key** (this is your `VITE_SUPABASE_ANON_KEY`)

**Important Notes:**
- These variables are **public** and will be embedded in your client-side bundle
- The anon key is safe to expose - it's designed for client-side use and respects Row Level Security policies
- **You must set these for both Production AND Preview environments**
- **You must enable "Available during build"** - this is critical for Vite to embed them in the bundle
- If these are missing, you'll see: `Missing Supabase environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY`

## 🌐 Step 2: Configure Custom Domain

### 2.1 Add Custom Domain

1. In your Cloudflare Pages project dashboard:
   - Go to **Custom domains**
   - Click **Set up a custom domain**
   - Enter: `inventory.1584design.com`
   - Choose **CNAME setup** (if using Cloudflare DNS)

### 2.2 DNS Configuration

If you're using Cloudflare DNS (recommended):

1. Go to **DNS** in your Cloudflare dashboard
2. Add a CNAME record:
   - **Type**: CNAME
   - **Name**: `inventory`
   - **Target**: `[your-pages-project].pages.dev`
   - **TTL**: Auto
   - **Proxy status**: ✅ Proxied (orange cloud)

If you're using another DNS provider, add a CNAME record pointing to your Pages project URL.

### 2.3 SSL/TLS Certificate

Cloudflare will automatically provision an SSL certificate. This usually takes 5-15 minutes.

## 🔧 Step 3: Configure Supabase Storage CORS (if needed)

If you're using Supabase Storage for images, ensure CORS is configured:

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Storage** → **Settings**
4. Configure CORS settings to allow requests from `https://inventory.1584design.com`

## 🚀 Step 4: Deploy

### Option A: Git Integration (Recommended)

1. **Connect Repository**: Link your Git repository to Cloudflare Pages
2. **Automatic Deployments**: Every push to your main branch will trigger a deployment
3. **Build Command**: `npm run build`
4. **Build Output Directory**: `dist`

### Option B: Manual Deploy

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
# Upload the 'dist' folder contents to your Pages project
```

### Option C: Wrangler CLI

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler auth login

# Deploy
wrangler pages deploy dist --project-name=1584-inventory-management
```

## 🔍 Step 5: Verify Deployment

1. **Check Deployment Status**: Monitor in Cloudflare Pages dashboard
2. **Test the Application**: Visit `https://inventory.1584design.com`
3. **Verify Features**:
   - ✅ App loads without errors
   - ✅ Supabase authentication works
   - ✅ Image uploads function properly (if using Supabase Storage)
   - ✅ All routes work correctly (SPA routing)
   - ✅ PWA features work (if enabled)

## 🛠 Troubleshooting

### Common Issues

**1. Build Failures / Missing Environment Variables**
- Ensure Node.js 18+ is used
- Check that all dependencies are installed: `npm install`
- **Verify environment variables are set correctly:**
  - Go to Cloudflare Pages → Settings → Environment Variables
  - Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
  - **Critical:** Check "Available during build" for both variables
  - Set them for both Production AND Preview environments
  - If missing, you'll see: `Missing Supabase environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY`

**2. CORS Errors**
- Confirm CORS configuration includes the new domain in Supabase Storage settings
- Check Supabase Storage policies allow the domain

**3. Authentication Issues**
- Verify Supabase Auth is enabled and configured
- Check that the Supabase project allows the new domain in Auth settings
- Ensure Google OAuth provider is configured in Supabase Auth settings

**4. Routing Problems**
- Ensure `_redirects` file is properly configured
- Check that all routes redirect to `index.html`

**5. SSL/Certificate Issues**
- Wait 5-15 minutes for SSL provisioning
- Check DNS configuration is correct
- Verify CNAME record is properly set

### Debug Commands

```bash
# Check build locally
npm run build
npm run preview

# Test Firebase connection
curl https://your-project.firebaseio.com/.json

# Check CORS headers
curl -I -H "Origin: https://inventory.1584design.com" \
  https://your-project.appspot.com/your-file.jpg
```

## 📊 Performance Optimization

Cloudflare Pages automatically provides:
- ✅ Global CDN distribution
- ✅ Automatic compression (gzip/brotli)
- ✅ HTTP/2 and HTTP/3 support
- ✅ DDoS protection
- ✅ SSL/TLS encryption

Your app includes:
- ✅ Optimized bundle splitting
- ✅ Cache headers for static assets
- ✅ Service worker for offline support
- ✅ Image optimization

## 🔒 Security Considerations

- ✅ HTTPS enforced by default
- ✅ Firebase security rules protect data
- ✅ CORS properly configured
- ✅ Input validation and sanitization
- ✅ Authentication required for sensitive operations

## 📞 Support

For issues specific to Cloudflare Pages:
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Community](https://community.cloudflare.com/)

For Supabase-related issues:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Support](https://supabase.com/support)

---

**🎉 Your inventory management app is now live at `https://inventory.1584design.com`!**
