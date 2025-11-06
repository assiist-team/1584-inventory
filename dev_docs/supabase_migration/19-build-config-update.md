# Task 8.2: Update Build Configuration

## Objective
Update build and deployment configuration to work with Supabase instead of Firebase.

## Steps

### 1. Update `vite.config.ts`

Remove any Firebase-specific configuration:

```typescript
// Remove Firebase-related plugins or configs if any
// Keep Vite configuration as-is, Supabase works with standard Vite setup
```

### 2. Update Deployment Configuration

#### If using Firebase Hosting

Remove `firebase.json` hosting configuration (already removed in Task 8.1).

#### Update to use alternative hosting

Options:
- **Vercel**: Works great with Supabase
- **Netlify**: Works great with Supabase
- **Cloudflare Pages**: Works great with Supabase
- **Supabase Hosting**: If available

#### Example: Vercel Configuration

Create `vercel.json` (if using Vercel):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 3. Update Environment Variables Documentation

Create or update `.env.example`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Service Role Key (for server-side operations only)
# VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Update `README.md`

Update deployment instructions:

```markdown
## Deployment

### Environment Variables

Set these environment variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key

### Build

```bash
npm run build
```

### Deploy

Deploy the `dist` folder to your hosting provider.
```

### 5. Update CI/CD (if applicable)

If you have GitHub Actions or other CI/CD:

```yaml
# Example GitHub Actions workflow
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

### 6. Update Public Headers/Redirects

If you have `public/_headers` or `public/_redirects`:

Update `public/_redirects`:
```
/*    /index.html   200
```

Keep `public/_headers` if needed for caching, CORS, etc.

### 7. Remove Firebase-Specific Build Steps

Remove any Firebase CLI commands from build scripts.

## Verification
- [ ] Build configuration updated
- [ ] Deployment configuration updated
- [ ] Environment variables documented
- [ ] README updated
- [ ] CI/CD updated (if applicable)
- [ ] Build succeeds
- [ ] Deployment works

## Next Steps
- Proceed to Task 8.3: Testing & Validation

