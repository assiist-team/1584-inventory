#!/bin/bash

# Firebase Storage CORS Setup Script
# This script helps configure CORS for Firebase Storage to allow image uploads from web apps

echo "🔧 Setting up Firebase Storage CORS configuration..."
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
echo "🔐 Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "❌ You need to login to Firebase first:"
    echo "firebase login"
    exit 1
fi

# Get the project ID from firebase.json or ask user
if [ -f "firebase.json" ]; then
    PROJECT_ID=$(grep -o '"projectId":\s*"[^"]*"' src/services/firebase.ts | grep -o '[^"]*$' | tail -1)
    if [ -n "$PROJECT_ID" ]; then
        echo "📋 Using project ID from configuration: $PROJECT_ID"
    else
        echo "❓ Please enter your Firebase project ID:"
        read PROJECT_ID
    fi
else
    echo "❓ Please enter your Firebase project ID:"
    read PROJECT_ID
fi

# Set the project
echo "🔧 Setting Firebase project to: $PROJECT_ID"
firebase use $PROJECT_ID

# Check if Storage is enabled
echo "🔍 Checking if Firebase Storage is enabled..."
if ! firebase storage:rules &> /dev/null; then
    echo "❌ Firebase Storage is not enabled or not properly configured."
    echo "Please enable Storage in your Firebase project:"
    echo "1. Go to Firebase Console: https://console.firebase.google.com/"
    echo "2. Select your project"
    echo "3. Go to Storage and click 'Get started'"
    exit 1
fi

# Deploy storage rules
echo "📝 Deploying storage rules..."
firebase deploy --only storage

# Try to configure CORS using gsutil (if available)
if command -v gsutil &> /dev/null; then
    echo "🌐 Configuring CORS using gsutil..."
    gsutil cors set cors.json gs://${PROJECT_ID}.appspot.com

    if [ $? -eq 0 ]; then
        echo "✅ CORS configuration applied successfully!"
    else
        echo "❌ Failed to apply CORS configuration with gsutil."
        echo "Please configure CORS manually in Google Cloud Console."
    fi
else
    echo "⚠️  gsutil not found. Please configure CORS manually:"
    echo "1. Go to Google Cloud Console: https://console.cloud.google.com/"
    echo "2. Select your project: $PROJECT_ID"
    echo "3. Go to Storage > Browser"
    echo "4. Click on your bucket (should be: ${PROJECT_ID}.appspot.com)"
    echo "5. Go to Permissions tab > CORS"
    echo "6. Add the configuration from cors.json file"
fi

echo ""
echo "🎉 Firebase Storage setup complete!"
echo ""
echo "If you're still getting CORS errors:"
echo "1. Try refreshing your browser"
echo "2. Clear browser cache"
echo "3. Make sure you're running the dev server on the configured ports"
echo ""
echo "For more help, check the README.md file."
