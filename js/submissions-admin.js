// Submissions Admin Dashboard JavaScript
// Updated for Firebase Firestore

let currentTab = 'contact';
let adminDb = null;
let adminAuth = null;
const ALLOWED_EMAIL = 'bhinrichs1380@gmail.com';
const submissionTypes = ['contact', 'newsletter', 'membership', 'digital', 'dv', 'referrals'];

// Initialize the dashboard when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Submissions dashboard initializing...');
    
    // Initialize Firebase
    if (typeof window.initializeFirebase === 'function') {
        const success = window.initializeFirebase();
        if (success) {
            adminDb = window.getFirebaseDB();
            adminAuth = window.getFirebaseAuth();
        }
    }
    
    // Setup tab functionality
    setupTabs();
    
    // Setup Auth State Listener
    if (adminAuth) {
        adminAuth.onAuthStateChanged(async function(user) {
            const loader = document.getElementById('admin-auth-loading');
            const loginContainer = document.getElementById('admin-login-container');
            const dashboardContent = document.getElementById('admin-dashboard-content');
            const signoutNav = document.getElementById('signout-nav-item');

            if (loader) loader.style.display = 'none';

            if (user) {
                if (user.email === ALLOWED_EMAIL) {
                    console.log('User authenticated as admin:', user.email);
                    setLoginButtonLoading(false);
                    if (loginContainer) loginContainer.style.display = 'none';
                    if (dashboardContent) dashboardContent.style.display = 'block';
                    if (signoutNav) signoutNav.style.display = 'block';

                    // Load initial data once authenticated
                    await loadSubmissions(currentTab);
                } else {
                    console.warn('Unauthorized user tried to access:', user.email);
                    clearSubmissions();
                    if (dashboardContent) dashboardContent.style.display = 'none';
                    if (signoutNav) signoutNav.style.display = 'none';
                    if (loginContainer) loginContainer.style.display = 'block';
                    setLoginButtonLoading(false);
                    showLoginError('Access Denied: Your email is not authorized.');
                    await adminAuth.signOut();
                }
            } else {
                console.log('No user signed in.');
                clearSubmissions();
                setLoginButtonLoading(false);
                if (dashboardContent) dashboardContent.style.display = 'none';
                if (signoutNav) signoutNav.style.display = 'none';
                if (loginContainer) loginContainer.style.display = 'block';
            }
        });
    } else {
        console.error('Firebase Auth not available');
        const loader = document.getElementById('admin-auth-loading');
        if (loader) {
            loader.innerHTML = '<div class="error">Firebase Authentication is not available. Please verify the Auth SDK load.</div>';
        }
    }
});

// Helper to display login errors
function showLoginError(message) {
    const errDiv = document.getElementById('login-error');
    if (errDiv) {
        errDiv.textContent = message;
        errDiv.style.display = 'block';
    }
}

function setLoginButtonLoading(isLoading) {
    const btn = document.getElementById('login-submit-btn');
    if (btn) {
        btn.disabled = isLoading;
        btn.textContent = isLoading ? 'Signing in...' : 'Sign In';
    }
}

function clearSubmissions() {
    submissionTypes.forEach(type => {
        const container = document.getElementById(`${type}-submissions`);
        if (container) container.innerHTML = '';
        showLoading(type, false);
        hideError(type);
        updateCount(type, 0);
    });
}

function isAuthorizedAdmin() {
    return Boolean(adminAuth && adminAuth.currentUser && adminAuth.currentUser.email === ALLOWED_EMAIL);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function jsStringLiteral(value) {
    return escapeAttribute(JSON.stringify(String(value ?? '')));
}

function escapeStatus(value) {
    return String(value || 'pending').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'pending';
}

// Handle Email/Password Login
async function handleEmailLogin(event) {
    event.preventDefault();
    if (!adminAuth) {
        showLoginError('Firebase Authentication is not available. Please refresh and try again.');
        return;
    }

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errDiv = document.getElementById('login-error');

    if (errDiv) errDiv.style.display = 'none';
    setLoginButtonLoading(true);

    try {
        await adminAuth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Email sign in failed:', error);
        showLoginError('Invalid email or password.');
        setLoginButtonLoading(false);
    }
}
window.handleEmailLogin = handleEmailLogin;

// Handle Google Login
async function handleGoogleLogin() {
    if (!adminAuth) {
        showLoginError('Firebase Authentication is not available. Please refresh and try again.');
        return;
    }

    const errDiv = document.getElementById('login-error');
    if (errDiv) errDiv.style.display = 'none';

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await adminAuth.signInWithPopup(provider);
    } catch (error) {
        console.error('Google sign in failed:', error);
        if (error.code === 'auth/unauthorized-domain') {
            showLoginError('This domain is not authorized in Firebase Auth. Add it in Firebase Console.');
        } else {
            showLoginError('Failed to log in with Google.');
        }
    }
}
window.handleGoogleLogin = handleGoogleLogin;

// Handle Sign Out
async function handleSignOut(event) {
    if (event) event.preventDefault();
    try {
        if (adminAuth) await adminAuth.signOut();
        clearSubmissions();
    } catch (error) {
        console.error('Sign out failed:', error);
    }
}
window.handleSignOut = handleSignOut;

// Setup tab switching functionality
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            if (!isAuthorizedAdmin()) return;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Load data for this tab if not already loaded
            currentTab = tabName;
            loadSubmissions(tabName);
        });
    });
}

// Map tab names to collection names
const collectionMap = {
    'contact': 'contact_submissions',
    'newsletter': 'newsletter_subscriptions',
    'membership': 'membership_enrollments',
    'digital': 'digital_services_signups',
    'dv': 'dv_enrollments',
    'referrals': 'referrals'
};

// Load submissions for a specific type
async function loadSubmissions(type) {
    if (!adminDb) {
        console.error('Firebase not initialized');
        showError(type, 'Database connection not available');
        return;
    }

    // Guard: Check if user is authenticated and is the admin
    if (!isAuthorizedAdmin()) {
        console.warn('loadSubmissions blocked: User not authenticated as admin.');
        return;
    }

    showLoading(type, true);
    hideError(type);

    try {
        const collectionName = collectionMap[type];
        if (!collectionName) {
            throw new Error(`Unknown submission type: ${type}`);
        }

        console.log(`Loading ${type} submissions from ${collectionName}...`);

        const snapshot = await adminDb.collection(collectionName)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        const submissions = [];
        snapshot.forEach(doc => {
            submissions.push({ id: doc.id, ...doc.data() });
        });

        console.log(`Loaded ${submissions.length} ${type} submissions`);
        
        displaySubmissions(type, submissions);
        updateCount(type, submissions.length);

    } catch (error) {
        console.error(`Error loading ${type} submissions:`, error);
        showError(type, `Failed to load ${type} submissions: ${error.message}`);
    } finally {
        showLoading(type, false);
    }
}

// Display submissions in the UI
function displaySubmissions(type, submissions) {
    const container = document.getElementById(`${type}-submissions`);
    
    if (!submissions || submissions.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #666;">
                <h3>No ${type} submissions found</h3>
                <p>When users submit forms, they will appear here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = submissions.map(submission => {
        switch(type) {
            case 'contact':
                return renderContactSubmission(submission);
            case 'newsletter':
                return renderNewsletterSubmission(submission);
            case 'membership':
                return renderMembershipSubmission(submission);
            case 'digital':
                return renderDigitalSubmission(submission);
            case 'dv':
                return renderDVSubmission(submission);
            case 'referrals':
                return renderReferralSubmission(submission);
            default:
                return '';
        }
    }).join('');
}

// CRM sync status badge + retry button
function renderCrmStatus(type, id, doc) {
    const safeType = escapeAttribute(type);
    const safeId = escapeAttribute(id);
    const typeArg = jsStringLiteral(type);
    const idArg = jsStringLiteral(id);

    if (doc.crmSynced === true) {
        return `<span class="crm-badge crm-badge-synced">&#10003; CRM Synced</span>`;
    }
    if (doc.crmSynced === false) {
        const errTip = doc.crmError ? ` title="${escapeAttribute(doc.crmError)}"` : '';
        return `
            <span class="crm-badge crm-badge-failed"${errTip}>&#x26A0; Sync Failed</span>
            <button class="crm-sync-btn" data-crm-type="${safeType}" data-crm-id="${safeId}" onclick="syncRecordToCRM(${typeArg}, ${idArg})" title="Retry CRM sync">&#x21BA; Retry</button>
        `;
    }
    return `
        <span class="crm-badge crm-badge-pending">&#8230; Pending</span>
        <button class="crm-sync-btn" data-crm-type="${safeType}" data-crm-id="${safeId}" onclick="syncRecordToCRM(${typeArg}, ${idArg})" title="Sync to CRM">&#x2191; Sync</button>
    `;
}

// Render contact form submission
function renderContactSubmission(submission) {
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${escapeHtml(submission.firstName)} ${escapeHtml(submission.lastName)}</div>
                <div class="submission-date">${formatDate(submission.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${escapeHtml(submission.email)}</div></div>
                ${submission.phone ? `<div class="detail-row"><div class="detail-label">Phone:</div><div class="detail-value">${escapeHtml(submission.phone)}</div></div>` : ''}
                ${submission.organization ? `<div class="detail-row"><div class="detail-label">Organization:</div><div class="detail-value">${escapeHtml(submission.organization)}</div></div>` : ''}
                <div class="detail-row"><div class="detail-label">Interest:</div><div class="detail-value">${escapeHtml(submission.interest)}</div></div>
                <div class="detail-row"><div class="detail-label">Message:</div><div class="detail-value"><div class="message-text">${escapeHtml(submission.message)}</div></div></div>
                <div class="detail-row"><div class="detail-label">CRM:</div><div class="detail-value">${renderCrmStatus('contact', submission.id, submission)}</div></div>
            </div>
        </div>
    `;
}

// Render newsletter subscription
function renderNewsletterSubmission(signup) {
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${escapeHtml(signup.email)}</div>
                <div class="submission-date">${formatDate(signup.subscribedAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${escapeHtml(signup.email)}</div></div>
                <div class="detail-row"><div class="detail-label">Active:</div><div class="detail-value">${signup.isActive ? 'Yes' : 'No'}</div></div>
            </div>
        </div>
    `;
}

// Render membership enrollment
function renderMembershipSubmission(signup) {
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${escapeHtml(signup.firstName)} ${escapeHtml(signup.lastName)}</div>
                <div class="submission-date">${formatDate(signup.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${escapeHtml(signup.email)}</div></div>
                <div class="detail-row"><div class="detail-label">Type:</div><div class="detail-value">${escapeHtml(signup.membershipType || 'N/A')}</div></div>
                ${signup.organization ? `<div class="detail-row"><div class="detail-label">Organization:</div><div class="detail-value">${escapeHtml(signup.organization)}</div></div>` : ''}
                <div class="detail-row"><div class="detail-label">CRM:</div><div class="detail-value">${renderCrmStatus('membership', signup.id, signup)}</div></div>
            </div>
        </div>
    `;
}

// Render digital services signup
function renderDigitalSubmission(signup) {
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${escapeHtml(signup.firstName)} ${escapeHtml(signup.lastName)}</div>
                <div class="submission-date">${formatDate(signup.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${escapeHtml(signup.email)}</div></div>
                ${signup.organization ? `<div class="detail-row"><div class="detail-label">Organization:</div><div class="detail-value">${escapeHtml(signup.organization)}</div></div>` : ''}
                ${signup.websiteUrl ? `<div class="detail-row"><div class="detail-label">Website:</div><div class="detail-value">${escapeHtml(signup.websiteUrl)}</div></div>` : ''}
                ${signup.goals ? `<div class="detail-row"><div class="detail-label">Goals:</div><div class="detail-value"><div class="message-text">${escapeHtml(signup.goals)}</div></div></div>` : ''}
                <div class="detail-row"><div class="detail-label">CRM:</div><div class="detail-value">${renderCrmStatus('digital', signup.id, signup)}</div></div>
            </div>
        </div>
    `;
}

// Render DV class enrollment
function renderDVSubmission(enrollment) {
    const status = escapeStatus(enrollment.status);
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${escapeHtml(enrollment.firstName)} ${escapeHtml(enrollment.lastName)}</div>
                <div class="submission-date">${formatDate(enrollment.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${escapeHtml(enrollment.email)}</div></div>
                <div class="detail-row"><div class="detail-label">Phone:</div><div class="detail-value">${escapeHtml(enrollment.phone)}</div></div>
                <div class="detail-row"><div class="detail-label">Enrollment Type:</div><div class="detail-value">${escapeHtml(enrollment.enrollmentType)}</div></div>
                <div class="detail-row"><div class="detail-label">Status:</div><div class="detail-value"><span class="status-badge status-${status}">${status}</span></div></div>
            </div>
        </div>
    `;
}

// Render Referral submission
function renderReferralSubmission(referral) {
    const status = escapeStatus(referral.status);
    const referralIdArg = jsStringLiteral(referral.id);
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">
                    ${escapeHtml(referral.youthName)}
                    ${referral.cspIdentified ? '<span class="csp-badge">CSP</span>' : ''}
                </div>
                <div class="submission-date">${formatDate(referral.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row">
                    <div class="detail-label">Youth Info:</div>
                    <div class="detail-value">${escapeHtml(referral.youthGender || 'N/A')}, ${escapeHtml(referral.youthAge || 'N/A')} yrs (DOB: ${escapeHtml(referral.youthDob || 'N/A')})</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">P.O. Name:</div>
                    <div class="detail-value">${escapeHtml(referral.probationOfficer || 'N/A')} (${escapeHtml(referral.probationDistrict || 'N/A')})</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Service:</div>
                    <div class="detail-value">${escapeHtml(referral.serviceType || 'N/A')} (${escapeHtml(referral.serviceDuration || 'N/A')})</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">
                        <span class="status-badge status-${status}">${status}</span>
                        <select onchange="updateReferralStatus(${referralIdArg}, this.value)" style="margin-left: 10px; padding: 2px;">
                            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="reviewed" ${status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                            <option value="accepted" ${status === 'accepted' ? 'selected' : ''}>Accepted</option>
                            <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">CRM:</div>
                    <div class="detail-value">${renderCrmStatus('referrals', referral.id, referral)}</div>
                </div>
            </div>
        </div>
    `;
}

// Sync a specific record to CRM on demand
async function syncRecordToCRM(type, id) {
    if (!isAuthorizedAdmin()) {
        console.warn('syncRecordToCRM blocked: User not authenticated as admin.');
        return;
    }

    const collectionName = collectionMap[type];
    if (!collectionName || !adminDb) return;

    const btn = Array.from(document.querySelectorAll('.crm-sync-btn'))
        .find(element => element.dataset.crmType === type && element.dataset.crmId === id);
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    try {
        const docSnap = await adminDb.collection(collectionName).doc(id).get();
        if (!docSnap.exists) throw new Error('Document not found');

        const doc = { id: docSnap.id, ...docSnap.data() };

        // Build CRM payload from stored document fields
        const crmData = {
            firstName: doc.firstName || doc.youthName?.split(' ')[0] || 'Unknown',
            lastName: doc.lastName || (doc.youthName?.split(' ').slice(1).join(' ')) || '',
            email: doc.email || doc.parentEmail || '',
            phone: doc.phone || doc.parentPhone || '',
            interest: doc.interest || doc.membershipType || doc.serviceType || type,
            message: doc.message || doc.notes || doc.goals || '',
            organization: doc.organization || doc.company || '',
            source: `admin-resync-${type}`
        };

        await window.Database.reSyncToCRM(collectionName, id, crmData);

        // Refresh tab to show updated badge
        loadSubmissions(currentTab);
    } catch (error) {
        console.error('[syncRecordToCRM] Error:', error);
        alert('CRM sync failed: ' + error.message);
        if (btn) { btn.disabled = false; btn.textContent = '↑ Sync'; }
    }
}
window.syncRecordToCRM = syncRecordToCRM;

// Update Referral Status
async function updateReferralStatus(id, newStatus) {
    if (!isAuthorizedAdmin()) {
        console.warn('updateReferralStatus blocked: User not authenticated as admin.');
        return;
    }

    const allowedStatuses = ['pending', 'reviewed', 'accepted', 'rejected'];
    if (!allowedStatuses.includes(newStatus)) {
        alert('Invalid referral status.');
        return;
    }

    try {
        await adminDb.collection('referrals').doc(id).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Refresh the current tab
        if (currentTab) loadSubmissions(currentTab);
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status: ' + error.message);
    }
}
window.updateReferralStatus = updateReferralStatus;

// Utility functions
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function showLoading(type, show) {
    const loading = document.getElementById(`${type}-loading`);
    if (loading) loading.style.display = show ? 'block' : 'none';
}

function hideError(type) {
    const error = document.getElementById(`${type}-error`);
    if (error) error.style.display = 'none';
}

function showError(type, message) {
    const error = document.getElementById(`${type}-error`);
    if (error) {
        error.textContent = message;
        error.style.display = 'block';
    }
}

function updateCount(type, count) {
    const countElement = document.getElementById(`${type}-count`);
    if (countElement) {
        countElement.textContent = `${count} submission${count !== 1 ? 's' : ''}`;
    }
}

// Auto-refresh every 60 seconds
setInterval(() => {
    if (adminAuth && adminAuth.currentUser && adminAuth.currentUser.email === ALLOWED_EMAIL && currentTab) {
        loadSubmissions(currentTab);
    }
}, 60000);

window.loadSubmissions = loadSubmissions;
