# Task 8.1: Remove Firebase Dependencies

## Objective
Remove all Firebase packages and configuration files from the project.

## Steps

### 1. Remove Firebase Packages

Update `package.json`:

```json
{
  "dependencies": {
    // Remove these:
    // "firebase": "^10.7.1",
    // "firebase-admin": "^13.5.0",
    
    // Keep Supabase:
    "@supabase/supabase-js": "^2.x.x"
  }
}
```

Run:
```bash
npm uninstall firebase firebase-admin
```

### 2. Remove Firebase Configuration Files

Delete or archive:
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `setup-firebase.sh`
- `setup-storage-cors.sh`

### 3. Remove Firebase Service File

Delete or rename:
- `src/services/firebase.ts` → Can be deleted after migration is complete

### 4. Remove Firebase Environment Variables

Update `.env.example`:
```env
# Remove Firebase variables:
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_AUTH_DOMAIN=
# VITE_FIREBASE_PROJECT_ID=
# VITE_FIREBASE_STORAGE_BUCKET=
# VITE_FIREBASE_MESSAGING_SENDER_ID=
# VITE_FIREBASE_APP_ID=
# VITE_FIREBASE_MEASUREMENT_ID=

# Keep Supabase variables:
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 5. Remove Firebase Scripts

Update `package.json` scripts:
```json
{
  "scripts": {
    // Remove these:
    // "firebase:deploy": "firebase deploy",
    // "firebase:setup-cors": "gsutil cors set cors.json gs://..."
  }
}
```

### 6. Search for Remaining Firebase References

```bash
# Search for Firebase imports
grep -r "from 'firebase" src/
grep -r 'from "firebase' src/

# Search for Firebase usage
grep -r "firebase" src/ --ignore-case

# Search for Firestore
grep -r "firestore" src/ --ignore-case
```

### 7. Update Documentation

Update `README.md` to remove Firebase references and add Supabase setup instructions.

## Verification
- [ ] Firebase packages removed from package.json
- [ ] Firebase configuration files removed
- [ ] No Firebase imports in codebase
- [ ] No Firebase references in code
- [ ] Environment variables updated
- [ ] Scripts updated

## Next Steps
- Proceed to Task 8.2: Update Build Configuration

