/**
 * Authentication Module using Firebase Auth
 * Handles user login, registration, and session management
 */

import { getFirebaseAuth } from '../../firebase-config.js';

const auth = getFirebaseAuth();

// Firebase Auth imports (lazy loaded)
let firebaseAuth = null;

async function getAuth() {
    if (!firebaseAuth) {
        const { getAuth: fbGetAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
                signInWithEmailAndPassword, signOut as fbSignOut,
                sendPasswordResetEmail, updatePassword as fbUpdatePassword,
                updateProfile as fbUpdateProfile } = await import('firebase/auth');
        firebaseAuth = {
            getAuth: fbGetAuth,
            onAuthStateChanged,
            createUserWithEmailAndPassword,
            signInWithEmailAndPassword,
            signOut: fbSignOut,
            sendPasswordResetEmail,
            updatePassword: fbUpdatePassword,
            updateProfile: fbUpdateProfile
        };
    }
    return firebaseAuth;
}

// Sign up new user
export async function signUp(email, password, metadata = {}) {
    try {
        const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
        const authInstance = getFirebaseAuth();
        
        const { user } = await createUserWithEmailAndPassword(authInstance, email, password);
        
        // Update profile with metadata
        if (Object.keys(metadata).length > 0) {
            await updateProfile(user, {
                displayName: metadata.displayName || metadata.firstName + ' ' + metadata.lastName
            });
        }
        
        return { success: true, user };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
    }
}

// Sign in existing user
export async function signIn(email, password) {
    try {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const authInstance = getFirebaseAuth();
        
        const { user } = await signInWithEmailAndPassword(authInstance, email, password);
        return { success: true, user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

// Sign out
export async function signOut() {
    try {
        const { signOut: fbSignOut } = await import('firebase/auth');
        const authInstance = getFirebaseAuth();
        
        await fbSignOut(authInstance);
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

// Get current user
export function getCurrentUser() {
    const authInstance = getFirebaseAuth();
    return authInstance?.currentUser || null;
}

// Get current session (Firebase doesn't have explicit sessions, use user)
export function getSession() {
    const user = getCurrentUser();
    return user ? { user, expires: 'session' } : null;
}

// Reset password
export async function resetPassword(email) {
    try {
        const { sendPasswordResetEmail } = await import('firebase/auth');
        const authInstance = getFirebaseAuth();
        
        await sendPasswordResetEmail(authInstance, email);
        return { success: true };
    } catch (error) {
        console.error('Reset password error:', error);
        return { success: false, error: error.message };
    }
}

// Update user password
export async function updatePassword(newPassword) {
    try {
        const { updatePassword: fbUpdatePassword } = await import('firebase/auth');
        const authInstance = getFirebaseAuth();
        
        if (!authInstance.currentUser) {
            throw new Error('No user logged in');
        }
        
        await fbUpdatePassword(authInstance.currentUser, newPassword);
        return { success: true };
    } catch (error) {
        console.error('Update password error:', error);
        return { success: false, error: error.message };
    }
}

// Update user profile
export async function updateProfile(updates) {
    try {
        const { updateProfile: fbUpdateProfile } = await import('firebase/auth');
        const authInstance = getFirebaseAuth();
        
        if (!authInstance.currentUser) {
            throw new Error('No user logged in');
        }
        
        await fbUpdateProfile(authInstance.currentUser, updates);
        return { success: true };
    } catch (error) {
        console.error('Update profile error:', error);
        return { success: false, error: error.message };
    }
}

// Check if user is authenticated
export function isAuthenticated() {
    return !!getCurrentUser();
}

// Auth state change listener
export function onAuthStateChange(callback) {
    const { onAuthStateChanged } = require('firebase/auth');
    const authInstance = getFirebaseAuth();
    return onAuthStateChanged(authInstance, callback);
}

// Protected route guard
export function requireAuth() {
    const authenticated = isAuthenticated();

    if (!authenticated) {
        const currentPath = window.location.pathname;
        window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
        return false;
    }

    return true;
}

// Export all auth functions
export default {
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    getSession,
    resetPassword,
    updatePassword,
    updateProfile,
    isAuthenticated,
    onAuthStateChange,
    requireAuth
};
