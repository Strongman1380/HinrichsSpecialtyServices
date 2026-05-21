# Firebase Setup Guide

This guide walks you through setting up Firebase for your HSST website.

## Prerequisites

1. A Google account
2. Access to the [Firebase Console](https://console.firebase.google.com)

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Enter project name: `hsst-website` (or your preferred name)
4. Disable Google Analytics (optional) or enable it for better insights
5. Click "Create project"

## Step 2: Register Your App

1. In your project, click the web icon (`</>`) to add a web app
2. Register app nickname: `hsst-web`
3. **Don't** check "Also set up Firebase Hosting" (we're using Vercel)
4. Click "Register app"

## Step 3: Get Your Configuration

1. Copy the `firebaseConfig` object provided - you'll need these values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

## Step 4: Configure Environment Variables

Update your `.env` file with your Firebase credentials:

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## Step 5: Enable Firestore Database

1. In Firebase Console, go to "Build" > "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location closest to your users
5. Click "Enable"

### Firestore Security Rules

For production, update your security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read
    match /{document=**} {
      allow read: if request.auth != null;
      // Only authenticated admins can write
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

## Step 6: Create Collections

Create these collections in Firestore to match your existing data structure:

### Collection: `contact_submissions`
```javascript
{
  firstName: string,
  lastName: string,
  email: string,
  phone: string (optional),
  organization: string (optional),
  interest: string,
  budget: string (optional),
  timeline: string (optional),
  message: string,
  newsletterSignup: boolean,
  privacyConsent: boolean,
  createdAt: timestamp
}
```

### Collection: `newsletter_subscriptions`
```javascript
{
  email: string,
  subscribedAt: timestamp,
  isActive: boolean
}
```

### Collection: `membership_enrollments`
```javascript
{
  firstName: string,
  lastName: string,
  email: string,
  phone: string (optional),
  organization: string (optional),
  membershipType: string,
  billingFrequency: string,
  createdAt: timestamp
}
```

### Collection: `dv_enrollments`
```javascript
{
  firstName: string,
  middleName: string (optional),
  lastName: string,
  email: string,
  phone: string,
  dateOfBirth: string,
  address: string,
  city: string,
  state: string,
  zip: string,
  enrollmentType: string,
  courtInfo: string (optional),
  preferredSchedule: string,
  classFormat: string,
  emergencyContact: string,
  emergencyRelationship: string,
  emergencyPhone: string,
  consent: boolean,
  createdAt: timestamp
}
```

### Collection: `membership_signups`
```javascript
{
  membershipTier: string,
  firstName: string,
  lastName: string,
  email: string,
  phone: string (optional),
  organization: string (optional),
  role: string (optional),
  industry: string,
  city: string,
  state: string,
  country: string,
  interests: array,
  goals: string (optional),
  expertise: string (optional),
  referralSource: string (optional),
  newsletterSignup: boolean,
  directoryListing: boolean,
  createdAt: timestamp
}
```

### Collection: `digital_services_signups`
```javascript
{
  firstName: string,
  lastName: string,
  email: string,
  phone: string (optional),
  organization: string (optional),
  websiteUrl: string (optional),
  businessType: string (optional),
  goals: string (optional),
  currentChallenges: string (optional),
  createdAt: timestamp
}
```

### Collection: `referrals`
```javascript
{
  cspIdentified: boolean,
  youthName: string,
  youthGender: string (optional),
  youthAge: number (optional),
  youthDob: string (optional),
  currentPlacement: string (optional),
  placementReason: string (optional),
  parentName: string (optional),
  parentPhone: string (optional),
  crossoverStatus: string,
  caseworkerName: string (optional),
  probationOfficer: string (optional),
  probationDistrict: string (optional),
  judgeName: string (optional),
  county: string (optional),
  serviceType: string,
  serviceDuration: string,
  status: string,
  createdAt: timestamp
}
```

## Step 7: Enable Authentication (Optional)

If you need user authentication:

1. Go to "Build" > "Authentication"
2. Click "Get started"
3. Enable "Email/Password" provider
4. Configure settings as needed

## Step 8: Deploy Rules

After setting up your collections, deploy Firestore security rules:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
# Select your project and rules file
firebase deploy --only firestore:rules
```

## Migration from Supabase

If migrating from Supabase:

1. Export your Supabase data as JSON
2. Use Firebase Admin SDK or console to import data
3. Update field names from `snake_case` to `camelCase` to match the new schema
4. Test all form submissions

## Troubleshooting

### "Firebase SDK not loaded"
- Make sure the CDN scripts are included in your HTML
- Check that `firebase-config.js` loads after the CDN

### "Permission denied"
- Check Firestore security rules
- Ensure you're authenticated if rules require it

### "Network error"
- Check your internet connection
- Verify Firebase project is active
- Check browser console for specific errors

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
