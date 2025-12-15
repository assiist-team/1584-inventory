# Task 5.2: Storage Policies

## Objective
Create storage bucket policies in Supabase to replace Firebase Storage security rules.

## Steps

### 1. Create Storage Policies in Supabase Dashboard

Go to Supabase Dashboard → Storage → Policies for each bucket.

### 2. Business Logos Bucket Policies

#### Policy: Public Read
```sql
-- Allow public read access to business logos
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-logos');
```

#### Policy: Account Admins Can Upload
```sql
-- Account admins can upload logos
CREATE POLICY "Account admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  is_account_admin((storage.foldername(name))[2]::uuid)
);
```

#### Policy: Account Admins Can Update/Delete
```sql
-- Account admins can update/delete their logos
CREATE POLICY "Account admins can update/delete logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  is_account_admin((storage.foldername(name))[2]::uuid)
);

CREATE POLICY "Account admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  is_account_admin((storage.foldername(name))[2]::uuid)
);
```

### 3. Item Images Bucket Policies

#### Policy: Authenticated Read
```sql
-- Authenticated users can read item images
CREATE POLICY "Authenticated users can read item images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'item-images' AND
  auth.uid() IS NOT NULL
);
```

#### Policy: Account Members Can Upload
```sql
-- Account members can upload item images
CREATE POLICY "Account members can upload item images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-images' AND
  auth.uid() IS NOT NULL
);
```

#### Policy: Account Members Can Delete
```sql
-- Account members can delete item images
CREATE POLICY "Account members can delete item images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'item-images' AND
  auth.uid() IS NOT NULL
);
```

### 4. Transaction Images Bucket Policies

Similar policies to item images:

```sql
-- Authenticated users can read transaction images
CREATE POLICY "Authenticated users can read transaction images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'transaction-images' AND
  auth.uid() IS NOT NULL
);

-- Account members can upload transaction images
CREATE POLICY "Account members can upload transaction images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'transaction-images' AND
  auth.uid() IS NOT NULL
);

-- Account members can delete transaction images
CREATE POLICY "Account members can delete transaction images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'transaction-images' AND
  auth.uid() IS NOT NULL
);
```

### 5. Receipt Images Bucket Policies

Same pattern as transaction images.

### 6. Other Images Bucket Policies

Same pattern as transaction images.

## Alternative: Simplified Policies

If the folder-based policies are too complex, you can use simpler authenticated-only policies:

```sql
-- For all image buckets (except business-logos)
CREATE POLICY "Authenticated users can read images"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('item-images', 'transaction-images', 'receipt-images', 'other-images') AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('item-images', 'transaction-images', 'receipt-images', 'other-images') AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('item-images', 'transaction-images', 'receipt-images', 'other-images') AND
  auth.uid() IS NOT NULL
);
```

## Testing Storage Policies

Test upload/download/delete operations:
1. As authenticated user
2. As account member
3. As account admin (for business logos)
4. As unauthenticated user (should fail)

## Verification
- [ ] Storage policies created for all buckets
- [ ] Public read works for business logos
- [ ] Authenticated upload works
- [ ] Authenticated delete works
- [ ] Unauthenticated access is blocked

## Next Steps
- Proceed to Task 6.1: Real-time Subscriptions

