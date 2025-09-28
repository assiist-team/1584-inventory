# 1584 Design

A modern, mobile-first inventory management application built with React, TypeScript, and Firebase.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase account and project

### 1. Clone and Setup

```bash
# Install dependencies
npm install

# Set up Firebase (follow the prompts)
./setup-firebase.sh
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable the following services:
   - **Firestore Database** (in test mode for development)
   - **Authentication** (Email/Password provider)
   - **Storage** (for images)
   - **Hosting**

#### 🔧 Configure Firebase Storage CORS (Required for Image Uploads)

Firebase Storage requires CORS configuration to work with web applications. If you encounter CORS errors during image uploads:

1. **Deploy Storage Rules:**
   ```bash
   npm run firebase:deploy
   ```

2. **Configure CORS (if you have Google Cloud SDK installed):**
   ```bash
   npm run firebase:setup-cors
   ```

3. **Alternative CORS Setup:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your Firebase project
   - Go to Storage > Browser
   - Click the bucket name
   - Go to Permissions > CORS
   - Add the following configuration:
   ```json
   [
     {
       "origin": ["http://localhost:3000", "http://localhost:3004"],
       "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
       "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
4. Get your Firebase configuration:
   - Go to Project Settings > General
   - Scroll to "Your apps" section
   - Click the web app icon (</>) or create one
   - Copy the config object

### 3. Update Configuration

Update `src/services/firebase.ts` with your Firebase configuration:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 4. Deploy Security Rules

```bash
# Deploy Firestore security rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### 5. Run Development Server

```bash
# Start the development server
npm run dev

# Or use Firebase for local development
firebase serve
```

### 6. Deploy to Production

```bash
# Build and deploy to Firebase Hosting
npm run build
firebase deploy
```

## 📁 Project Structure

```
├── docs/                    # Planning and architecture documents
│   ├── ARCHITECTURE.md      # System architecture and design
│   ├── DATA_SCHEMA.md       # Firestore data structure
│   ├── COMPONENT_ARCHITECTURE.md # Component hierarchy
│   ├── STYLE_GUIDE.md       # Design system and styling
│   ├── ROADMAP.md           # Development timeline
│   ├── API_DESIGN.md        # Firestore queries and optimization
│   └── SECURITY_PLAN.md     # Security rules and performance
├── public/                  # Static assets
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── layout/          # Layout components (Header, Sidebar, MobileMenu)
│   │   └── ui/              # Reusable UI components (LoadingSpinner)
│   ├── pages/               # Route components
│   │   ├── Projects.tsx     # Project overview (default landing page)
│   │   ├── ProjectDetail.tsx # Project details with Inventory/Transactions tabs
│   │   ├── InventoryList.tsx # Project-specific inventory management
│   │   ├── TransactionsList.tsx # Project-specific transaction management
│   │   └── ItemDetail.tsx   # Individual item detail view
│   ├── services/            # Firebase and external services
│   ├── types/               # TypeScript type definitions
│   └── index.css            # Global styles
├── firebase.json            # Firebase hosting configuration
├── firestore.rules          # Firestore security rules
└── firestore.indexes.json   # Firestore query indexes
```

## 🎯 Key Features

- **Project-Centric Design**: Organized around Projects as the main entities
- **Mobile-First Design**: Optimized for mobile devices with responsive layout
- **Clean Navigation**: Focused interface without unnecessary settings or analytics
- **Project-Based Inventory**: Inventory and transactions organized within projects
- **List View Interface**: Clean, efficient inventory management in list format
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- **Scalable Architecture**: Firebase Firestore ready for data storage

## 🛠 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Firebase
firebase serve          # Local development with Firebase
firebase deploy         # Deploy to Firebase Hosting

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode

# Linting
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint errors
```

### Development Guidelines

1. **Mobile-First**: Design for mobile (320px+) first, then scale up
2. **Component Structure**: Use functional components with TypeScript
3. **State Management**: Use Zustand for global state
4. **Styling**: Use Tailwind CSS with custom design tokens
5. **Accessibility**: Follow WCAG AA guidelines

## 📱 Mobile Optimization

- Touch-friendly interfaces (44px minimum touch targets)
- Responsive typography and spacing
- Optimized images for different screen densities
- Progressive Web App capabilities
- Project-focused navigation for mobile workflows

## 🔒 Security

- Firestore security rules for data protection
- Authentication with Firebase Auth
- Input validation and sanitization
- HTTPS-only hosting
- Row-level security for multi-user support

## 🚀 Deployment

The application is configured for automatic deployment with Firebase Hosting:

1. **Staging**: `firebase serve` for local testing
2. **Production**: `firebase deploy` for live deployment
3. **Monitoring**: Built-in Firebase monitoring and analytics

## 📊 Performance

- **Lighthouse Score**: Target 90+ for all categories
- **Core Web Vitals**: All metrics in "Good" range
- **Bundle Size**: Optimized for fast loading
- **Real-time Updates**: Efficient Firestore listeners

## 🤝 Contributing

1. Follow the established code style and architecture
2. Write tests for new features
3. Update documentation as needed
4. Use meaningful commit messages
5. Ensure mobile responsiveness

## 📄 License

This project is private and proprietary.

## 🆘 Support

For support and questions, please refer to the documentation in the `docs/` directory or contact the development team.

---

**Built with ❤️ for 1584 Design**
