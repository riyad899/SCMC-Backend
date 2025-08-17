# Sports Club Management System API

## Vercel Deployment Setup

### 1. Environment Variables

You need to set these environment variables in your Vercel dashboard:

#### MongoDB Configuration
- `MONGO_URI` - Your MongoDB connection string
- `DB_NAME` - Your database name

#### Stripe Configuration  
- `STRIPE_SECRET_KEY` - Your Stripe secret key

#### Firebase Configuration
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_PRIVATE_KEY_ID` - Firebase private key ID
- `FIREBASE_PRIVATE_KEY` - Firebase private key (including newlines)
- `FIREBASE_CLIENT_EMAIL` - Firebase client email
- `FIREBASE_CLIENT_ID` - Firebase client ID
- `FIREBASE_CLIENT_X509_CERT_URL` - Firebase cert URL

### 2. How to get Firebase environment variables

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key (JSON file)
3. Extract the values from the JSON file:
   - `private_key_id` → `FIREBASE_PRIVATE_KEY_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `client_id` → `FIREBASE_CLIENT_ID`
   - `client_x509_cert_url` → `FIREBASE_CLIENT_X509_CERT_URL`

### 3. Deployment Commands

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### 4. Key Changes Made for Serverless

- Modified Express app to work with Vercel serverless functions
- Updated Firebase initialization to use environment variables instead of JSON file
- Fixed MongoDB connection for serverless environment
- Added proper error handling and function exports
- Fixed malformed routes

### 5. API Endpoints

- Base URL: `https://your-vercel-url.vercel.app`
- All existing endpoints remain the same
- Health check: `GET /`
