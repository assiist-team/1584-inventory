/**
 * Browser Console Test for Firebase Storage Rules
 *
 * To run this test:
 * 1. Open the app in your browser
 * 2. Open Developer Tools (F12)
 * 3. Go to Console tab
 * 4. Paste and run this code
 */

console.log('=== FIREBASE STORAGE RULES TEST ===')

// Check if Firebase is loaded
if (typeof firebase === 'undefined') {
  console.error('❌ Firebase not loaded. Make sure the app is running.')
} else {
  console.log('✅ Firebase is loaded')

  // Test 1: Check authentication
  console.log('\n--- Testing Authentication ---')
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ User authenticated:', user.uid)

      // Test 2: Test storage reference creation
      console.log('\n--- Testing Storage Reference ---')
      const storage = firebase.storage()
      const testProjectId = 'test-project-123'
      const testFileName = 'test-receipt.jpg'
      const testPath = `receipts/${testProjectId}/test-upload/${testFileName}`

      console.log('Test path:', testPath)

      const storageRef = storage.ref(testPath)
      console.log('✅ Storage reference created successfully')

      // Test 3: Create a test file and attempt upload
      console.log('\n--- Testing Upload Permissions ---')
      const testFile = new Blob(['test content'], { type: 'image/jpeg' })

      console.log('Attempting to upload test file...')

      const uploadTask = storageRef.put(testFile)

      uploadTask.on('state_changed',
        (snapshot) => {
          console.log('Upload progress:', (snapshot.bytesTransferred / snapshot.totalBytes) * 100 + '%')
        },
        (error) => {
          console.error('❌ Upload failed:', error)
          if (error.code === 'storage/unauthorized') {
            console.error('❌ Storage rules still blocking authenticated users')
            console.error('❌ Check that storage.rules allows authenticated users to write to receipts/{projectId}/** paths')
          }
        },
        () => {
          console.log('✅ Upload completed successfully!')
          console.log('✅ Storage rules are working correctly')

          // Clean up test file
          storageRef.delete().then(() => {
            console.log('✅ Test file cleaned up')
          }).catch((error) => {
            console.log('⚠️ Could not clean up test file:', error)
          })
        }
      )

    } else {
      console.error('❌ No user authenticated')
      console.log('💡 Make sure anonymous authentication is enabled in Firebase')
    }
  })
}

console.log('\n=== TEST INSTRUCTIONS ===')
console.log('1. If test fails with "storage/unauthorized", check storage.rules')
console.log('2. Verify storage.rules allows authenticated users to write to receipts/{projectId}/**')
console.log('3. Check that Firebase Storage is properly configured')
console.log('4. Try refreshing the page to ensure authentication is working')
