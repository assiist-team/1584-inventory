# Task 1.3: Storage Bucket Configuration

## Objective
Set up Supabase Storage buckets to replace Firebase Storage for file uploads (images, logos, etc.).

## Steps

### Option 1: Automated Setup (Recommended)

Use the provided setup script to create all buckets programmatically:

```bash
# Set your Supabase service role key (get it from Supabase Dashboard → Settings → API)
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run the setup script
npm run setup:storage
```

The script will:
- Create all required buckets with proper configuration
- Skip buckets that already exist
- Display success/failure status for each bucket

### Option 2: Manual Setup via Dashboard

Go to Supabase Dashboard → Storage and create the following buckets:

#### Bucket: `item-images`
- **Public**: Yes (or No if you want to use signed URLs)
- **File size limit**: 10MB (or your preferred limit)
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

#### Bucket: `transaction-images`
- **Public**: Yes
- **File size limit**: 10MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

#### Bucket: `receipt-images`
- **Public**: Yes
- **File size limit**: 10MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

#### Bucket: `business-logos`
- **Public**: Yes
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/svg+xml`, `image/webp`

#### Bucket: `other-images`
- **Public**: Yes
- **File size limit**: 10MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

### 2. Configure CORS (if needed)

Supabase Storage handles CORS automatically for authenticated requests. However, if you need to configure CORS for direct browser uploads:

1. Go to Supabase Dashboard → Storage → Settings
2. Configure CORS settings if needed (usually not required for authenticated requests)

Note: Supabase Storage uses the same CORS configuration as your Supabase project. For most use cases, no additional CORS configuration is needed.

If you need custom CORS configuration, you can set it via the Supabase Dashboard or API. Example configuration:
```json
{
  "allowedOrigins": ["http://localhost:3000", "http://localhost:5173", "https://yourdomain.com"],
  "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
  "allowedHeaders": ["*"],
  "maxAge": 3600
}
```

### 3. Storage Path Structure

Maintain similar path structure to Firebase Storage:
- `{projectName}/{imageType}/{dateTime}/{timestamp}_{sanitizedFileName}`

Example:
- `ProjectName/item_images/2024-01-15T10-30-00/1705321800000_image.jpg`
- `BusinessInventory/receipt_images/2024-01-15T10-30-00/1705321800000_receipt.jpg`

### 3. Test Storage Access

Run the test script to verify that all buckets are accessible:

```bash
npm run test:storage
```

The test script will:
- Verify each bucket exists and is accessible
- Test public URL generation
- Display test results for each bucket

For manual testing, you can use this code snippet:

```typescript
import { supabase } from './supabase'

async function testStorage() {
  // Test upload (requires authentication)
  const testFile = new File(['test'], 'test.txt', { type: 'text/plain' })
  const { data, error } = await supabase.storage
    .from('item-images')
    .upload('test/test.txt', testFile)
  
  if (error) {
    console.error('Upload error:', error)
    return
  }
  
  console.log('Upload successful:', data)
  
  // Test download URL
  const { data: urlData } = supabase.storage
    .from('item-images')
    .getPublicUrl('test/test.txt')
  
  console.log('Public URL:', urlData.publicUrl)
  
  // Clean up
  await supabase.storage
    .from('item-images')
    .remove(['test/test.txt'])
}

testStorage()
```

## Storage Policies

Storage policies will be configured in Task 5.2, but buckets need to exist first.

## Verification
- [ ] All buckets created
- [ ] CORS configured (if needed)
- [ ] Can upload test files
- [ ] Can get public URLs
- [ ] Can delete files

## Next Steps
- Proceed to Task 2.1: Supabase Auth Client Setup

