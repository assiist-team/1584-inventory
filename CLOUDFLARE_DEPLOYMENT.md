# 🚀 Cloudflare Pages Deployment Guide

This guide explains how to deploy your 1584 Design inventory management application to Cloudflare Pages on the subdomain `https://inventory.1584design.com`.

## 📋 Prerequisites

- **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
- **Node.js 18+**: Required for the build process
- **Firebase Project**: Already configured (from existing setup)
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

Set the following environment variables in your Cloudflare Pages dashboard:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

**To get these values:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **General**
4. Scroll to **Your apps** section
5. Click **Web app** or create one if needed
6. Copy the config object values

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

## 🔧 Step 3: Update Firebase CORS Configuration

Your Firebase Storage needs to allow requests from the new domain:

```bash
# Update CORS configuration
npm run firebase:setup-cors
```

Or manually update in Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **Storage** → **Browser**
4. Click your storage bucket
5. Go to **Permissions** → **CORS**
6. Add `https://inventory.1584design.com` to the allowed origins

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
   - ✅ Firebase authentication works
   - ✅ Image uploads function properly
   - ✅ All routes work correctly (SPA routing)
   - ✅ PWA features work (if enabled)

## 🛠 Troubleshooting

### Common Issues

**1. Build Failures**
- Ensure Node.js 18+ is used
- Check that all dependencies are installed: `npm install`
- Verify environment variables are set correctly

**2. CORS Errors**
- Confirm CORS configuration includes the new domain
- Check Firebase Storage rules allow the domain

**3. Authentication Issues**
- Verify Firebase Auth domain settings
- Check that the Firebase project allows the new domain

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

For Firebase-related issues:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Support](https://firebase.google.com/support)

---

**🎉 Your inventory management app is now live at `https://inventory.1584design.com`!**
