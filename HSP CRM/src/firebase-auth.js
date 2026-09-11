import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import administrator from '../functions/data/admin-identity.json';
import publicConfig from './firebase-public-config.json';
export const ADMIN_EMAIL = administrator.email;
export const ADMIN_UID = administrator.uid;
export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
const config = useEmulators ? { apiKey: 'demo', authDomain: 'demo-hsst.firebaseapp.com', projectId: 'demo-hsst', appId: 'demo-hsst' } : {
  // Firebase web configuration is public, not an administrator credential.
  // Checked-in defaults keep CI releases reproducible without a local .env.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || publicConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || publicConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || publicConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || publicConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || publicConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || publicConfig.appId,
};
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);
export const app = initializeApp(config);
export const auth = getAuth(app);
if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
