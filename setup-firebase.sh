#!/bin/bash

echo "🔥 Firebase Project Setup for 1584 Design"
echo "================================================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "   npm install -g firebase-tools"
    echo ""
    echo "📖 Installation guide: https://firebase.google.com/docs/cli"
    exit 1
fi

echo "✅ Firebase CLI is installed"

# Check if user is logged in
echo ""
echo "🔐 Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "❌ You're not logged in to Firebase. Please login:"
    echo "   firebase login"
    exit 1
fi

echo "✅ Firebase authentication verified"

echo ""
echo "📋 Next steps to set up your Firebase project:"
echo ""

echo "1️⃣ Create a new Firebase project:"
echo "   Go to: https://console.firebase.google.com/"
echo "   Click 'Create a project' or use an existing one"
echo "   Project name: '1584-inventory-management' (or your preferred name)"
echo ""

echo "2️⃣ Enable required services:"
echo "   - Firestore Database"
echo "   - Authentication"
echo "   - Storage (for images)"
echo "   - Hosting"
echo ""

echo "3️⃣ Configure Firestore:"
echo "   - Start in test mode for development"
echo "   - Location: Choose the region closest to your users"
echo ""

echo "4️⃣ Get your Firebase configuration:"
echo "   - Go to Project Settings > General"
echo "   - Scroll down to 'Your apps' section"
echo "   - Click 'Web app' icon or create one"
echo "   - Copy the config object"
echo ""

echo "5️⃣ Update the Firebase config file:"
echo "   - Open src/services/firebase.ts"
echo "   - Replace the placeholder config with your actual Firebase config"
echo ""

echo "6️⃣ Deploy security rules and indexes:"
echo "   firebase deploy --only firestore:rules,firestore:indexes"
echo ""

echo "7️⃣ Set up authentication providers (optional):"
echo "   - Go to Authentication > Sign-in method"
echo "   - Enable Email/Password, Google, etc."
echo ""

echo "📁 Files created:"
echo "   - firebase.json (hosting configuration)"
echo "   - firestore.rules (security rules)"
echo "   - firestore.indexes.json (query indexes)"
echo "   - setup-firebase.sh (this script)"
echo ""

echo "🔗 Helpful links:"
echo "   - Firebase Console: https://console.firebase.google.com/"
echo "   - Firestore Documentation: https://firebase.google.com/docs/firestore"
echo "   - Firebase Hosting: https://firebase.google.com/docs/hosting"
echo ""

echo "💡 After setup, you can:"
echo "   - Run 'firebase deploy' to deploy the app"
echo "   - Run 'firebase serve' for local development"
echo "   - Run 'firebase emulators:start' for local testing"
echo ""

read -p "Press Enter to continue when you've completed the Firebase setup..."
