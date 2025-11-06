# Task 1.3: Storage Bucket Configuration

## Objective
Set up Supabase Storage buckets to replace Firebase Storage for file uploads (images, logos, etc.).

## Steps

### 1. Create Storage Buckets in Supabase Dashboard

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

If you need CORS for direct browser uploads, configure it in Supabase Dashboard → Storage → Settings.

Example CORS configuration:
```json
{
  "allowedOrigins": ["http://localhost:5173", "https://yourdomain.com"],
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

### 4. Test Storage Access

Create a test script to verify storage access:

```typescript
import { supabase } from './supabase'

async function testStorage() {
  // Test upload
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

