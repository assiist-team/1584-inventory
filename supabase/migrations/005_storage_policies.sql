-- Storage Policies Migration
-- This migration creates storage bucket policies to replace Firebase Storage rules

-- ============================================================================
-- 1. Helper Function for Storage Policies
-- ============================================================================

-- Function to extract account ID from storage path
-- Path format: accounts/{accountId}/business_profile/logo/{fileName}
-- Uses storage.foldername() helper function which returns an array of folder names
-- Returns NULL if path doesn't match expected format
CREATE OR REPLACE FUNCTION extract_account_id_from_path(file_path text) RETURNS uuid AS $$
  SELECT CASE
    WHEN (storage.foldername(file_path))[1] = 'accounts' AND array_length(storage.foldername(file_path), 1) >= 2
    THEN (storage.foldername(file_path))[2]::uuid
    ELSE NULL
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================================
-- 2. Business Logos Bucket Policies
-- ============================================================================

-- Public read access for business logos
CREATE POLICY "Public read access for business logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-logos');

-- Account admins can upload business logos
CREATE POLICY "Account admins can upload business logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  is_account_admin(extract_account_id_from_path(name))
);

-- Account admins can update business logos
CREATE POLICY "Account admins can update business logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  is_account_admin(extract_account_id_from_path(name))
)
WITH CHECK (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  is_account_admin(extract_account_id_from_path(name))
);

-- Account admins can delete business logos
CREATE POLICY "Account admins can delete business logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-logos' AND
  (storage.foldername(name))[1] = 'accounts' AND
  extract_account_id_from_path(name) IS NOT NULL AND
  is_account_admin(extract_account_id_from_path(name))
);

-- ============================================================================
-- 3. Item Images Bucket Policies
-- ============================================================================

-- Authenticated users can read item images
CREATE POLICY "Authenticated users can read item images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'item-images');

-- Authenticated users can upload item images
CREATE POLICY "Authenticated users can upload item images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'item-images');

-- Authenticated users can update item images
CREATE POLICY "Authenticated users can update item images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'item-images')
WITH CHECK (bucket_id = 'item-images');

-- Authenticated users can delete item images
CREATE POLICY "Authenticated users can delete item images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'item-images');

-- ============================================================================
-- 4. Transaction Images Bucket Policies
-- ============================================================================

-- Authenticated users can read transaction images
CREATE POLICY "Authenticated users can read transaction images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'transaction-images');

-- Authenticated users can upload transaction images
CREATE POLICY "Authenticated users can upload transaction images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transaction-images');

-- Authenticated users can update transaction images
CREATE POLICY "Authenticated users can update transaction images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'transaction-images')
WITH CHECK (bucket_id = 'transaction-images');

-- Authenticated users can delete transaction images
CREATE POLICY "Authenticated users can delete transaction images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transaction-images');

-- ============================================================================
-- 5. Receipt Images Bucket Policies
-- ============================================================================

-- Authenticated users can read receipt images
CREATE POLICY "Authenticated users can read receipt images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipt-images');

-- Authenticated users can upload receipt images
CREATE POLICY "Authenticated users can upload receipt images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipt-images');

-- Authenticated users can update receipt images
CREATE POLICY "Authenticated users can update receipt images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipt-images')
WITH CHECK (bucket_id = 'receipt-images');

-- Authenticated users can delete receipt images
CREATE POLICY "Authenticated users can delete receipt images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipt-images');

-- ============================================================================
-- 6. Other Images Bucket Policies
-- ============================================================================

-- Authenticated users can read other images
CREATE POLICY "Authenticated users can read other images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'other-images');

-- Authenticated users can upload other images
CREATE POLICY "Authenticated users can upload other images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'other-images');

-- Authenticated users can update other images
CREATE POLICY "Authenticated users can update other images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'other-images')
WITH CHECK (bucket_id = 'other-images');

-- Authenticated users can delete other images
CREATE POLICY "Authenticated users can delete other images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'other-images');

