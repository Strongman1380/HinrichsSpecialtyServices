// Firebase Configuration for HSST Website
// Initialize Firebase once and export for use throughout the app

const firebaseConfig = {
    apiKey: window.HSST_ENV?.FIREBASE_API_KEY || "",
    authDomain: window.HSST_ENV?.FIREBASE_AUTH_DOMAIN || "",
    projectId: window.HSST_ENV?.FIREBASE_PROJECT_ID || "",
    storageBucket: window.HSST_ENV?.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: window.HSST_ENV?.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: window.HSST_ENV?.FIREBASE_APP_ID || "",
    measurementId: window.HSST_ENV?.FIREBASE_MEASUREMENT_ID || ""
};

// Initialize Firebase
let app = null;
let db = null;
let auth = null;

function initializeFirebase() {
    try {
        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded. Add the Firebase CDN script to your HTML.');
            return false;
        }

        // Initialize Firebase app
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;

        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        return false;
    }
}

// Export for use in other files
window.firebaseConfig = firebaseConfig;
window.initializeFirebase = initializeFirebase;
window.getFirebaseApp = () => app;
window.getFirebaseDB = () => db;
window.getFirebaseAuth = () => auth;
