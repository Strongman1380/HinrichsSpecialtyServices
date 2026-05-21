// Submissions Admin Dashboard JavaScript
// Updated for Firebase Firestore

let currentTab = 'contact';
let db = null;

// Initialize the dashboard when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Submissions dashboard initializing...');
    
    // Initialize Firebase
    if (typeof window.initializeFirebase === 'function') {
        const success = window.initializeFirebase();
        if (success) {
            db = window.getFirebaseDB();
        }
    }
    
    // Setup tab functionality
    setupTabs();
    
    // Load initial data
    await loadSubmissions('contact');
});

// Setup tab switching functionality
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
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
    if (!db) {
        console.error('Firebase not initialized');
        showError(type, 'Database connection not available');
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

        const snapshot = await db.collection(collectionName)
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

// Render contact form submission
function renderContactSubmission(submission) {
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${submission.firstName || ''} ${submission.lastName || ''}</div>
                <div class="submission-date">${formatDate(submission.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${submission.email || ''}</div></div>
                ${submission.phone ? `<div class="detail-row"><div class="detail-label">Phone:</div><div class="detail-value">${submission.phone}</div></div>` : ''}
                ${submission.organization ? `<div class="detail-row"><div class="detail-label">Organization:</div><div class="detail-value">${submission.organization}</div></div>` : ''}
                <div class="detail-row"><div class="detail-label">Interest:</div><div class="detail-value">${submission.interest || ''}</div></div>
                <div class="detail-row"><div class="detail-label">Message:</div><div class="detail-value"><div class="message-text">${submission.message || ''}</div></div></div>
            </div>
        </div>
    `;
}

// Render newsletter subscription
function renderNewsletterSubmission(signup) {
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${signup.email || ''}</div>
                <div class="submission-date">${formatDate(signup.subscribedAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${signup.email || ''}</div></div>
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
                <div class="submission-name">${signup.firstName || ''} ${signup.lastName || ''}</div>
                <div class="submission-date">${formatDate(signup.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${signup.email || ''}</div></div>
                <div class="detail-row"><div class="detail-label">Type:</div><div class="detail-value">${signup.membershipType || 'N/A'}</div></div>
                ${signup.organization ? `<div class="detail-row"><div class="detail-label">Organization:</div><div class="detail-value">${signup.organization}</div></div>` : ''}
            </div>
        </div>
    `;
}

// Render digital services signup
function renderDigitalSubmission(signup) {
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${signup.firstName || ''} ${signup.lastName || ''}</div>
                <div class="submission-date">${formatDate(signup.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${signup.email || ''}</div></div>
                ${signup.organization ? `<div class="detail-row"><div class="detail-label">Organization:</div><div class="detail-value">${signup.organization}</div></div>` : ''}
                ${signup.websiteUrl ? `<div class="detail-row"><div class="detail-label">Website:</div><div class="detail-value">${signup.websiteUrl}</div></div>` : ''}
                ${signup.goals ? `<div class="detail-row"><div class="detail-label">Goals:</div><div class="detail-value"><div class="message-text">${signup.goals}</div></div></div>` : ''}
            </div>
        </div>
    `;
}

// Render DV class enrollment
function renderDVSubmission(enrollment) {
    const status = enrollment.status || 'pending';
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">${enrollment.firstName || ''} ${enrollment.lastName || ''}</div>
                <div class="submission-date">${formatDate(enrollment.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${enrollment.email || ''}</div></div>
                <div class="detail-row"><div class="detail-label">Phone:</div><div class="detail-value">${enrollment.phone || ''}</div></div>
                <div class="detail-row"><div class="detail-label">Enrollment Type:</div><div class="detail-value">${enrollment.enrollmentType || ''}</div></div>
                <div class="detail-row"><div class="detail-label">Status:</div><div class="detail-value"><span class="status-badge status-${status}">${status}</span></div></div>
            </div>
        </div>
    `;
}

// Render Referral submission
function renderReferralSubmission(referral) {
    const status = referral.status || 'pending';
    return `
        <div class="submission-card">
            <div class="submission-header">
                <div class="submission-name">
                    ${referral.youthName || ''} 
                    ${referral.cspIdentified ? '<span class="csp-badge">CSP</span>' : ''}
                </div>
                <div class="submission-date">${formatDate(referral.createdAt)}</div>
            </div>
            <div class="submission-details">
                <div class="detail-row">
                    <div class="detail-label">Youth Info:</div>
                    <div class="detail-value">${referral.youthGender || 'N/A'}, ${referral.youthAge || 'N/A'} yrs (DOB: ${referral.youthDob || 'N/A'})</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">P.O. Name:</div>
                    <div class="detail-value">${referral.probationOfficer || 'N/A'} (${referral.probationDistrict || 'N/A'})</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Service:</div>
                    <div class="detail-value">${referral.serviceType || 'N/A'} (${referral.serviceDuration || 'N/A'})</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">
                        <span class="status-badge status-${status}">${status}</span>
                        <select onchange="updateReferralStatus('${referral.id}', this.value)" style="margin-left: 10px; padding: 2px;">
                            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="reviewed" ${status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                            <option value="accepted" ${status === 'accepted' ? 'selected' : ''}>Accepted</option>
                            <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Update Referral Status
async function updateReferralStatus(id, newStatus) {
    try {
        await db.collection('referrals').doc(id).update({
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
    if (currentTab) loadSubmissions(currentTab);
}, 60000);

window.loadSubmissions = loadSubmissions;
