import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { app, useEmulators } from './firebase-auth';
export { auth, isFirebaseConfigured } from './firebase-auth';
export const db = getFirestore(app);
if (useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080);
