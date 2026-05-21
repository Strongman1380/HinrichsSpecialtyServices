// Firebase Database Service
// Handles all database operations using Firestore

// Collection references - matches your existing form submissions
const collections = {
    contacts: 'contact_submissions',
    newsletter: 'newsletter_subscriptions',
    memberships: 'membership_enrollments',
    dvEnrollments: 'dv_enrollments',
    memberSignups: 'membership_signups',
    digitalServices: 'digital_services_signups',
    referrals: 'referrals'
};

const Database = {
    // Save contact form submission
    async saveContactSubmission(formData) {
        try {
            const docRef = await getFirebaseDB().collection(collections.contacts).add({
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone || null,
                organization: formData.organization || null,
                interest: formData.interest,
                budget: formData.budget || null,
                timeline: formData.timeline || null,
                message: formData.message,
                newsletterSignup: formData.newsletter || false,
                privacyConsent: formData.privacy || false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Contact submission saved with ID:', docRef.id);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error saving contact submission:', error);
            return { success: false, error: error.message };
        }
    },

    // Save newsletter subscription
    async saveNewsletterSubscription(email) {
        try {
            const docRef = await getFirebaseDB().collection(collections.newsletter).add({
                email: email,
                subscribedAt: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: true
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error saving newsletter subscription:', error);
            return { success: false, error: error.message };
        }
    },

    // Save membership enrollment
    async saveMembershipEnrollment(membershipData) {
        try {
            const docRef = await getFirebaseDB().collection(collections.memberships).add({
                firstName: membershipData.firstName,
                lastName: membershipData.lastName,
                email: membershipData.email,
                phone: membershipData.phone || null,
                organization: membershipData.organization || null,
                membershipType: membershipData.membershipType,
                billingFrequency: membershipData.billingFrequency || 'monthly',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error saving membership enrollment:', error);
            return { success: false, error: error.message };
        }
    },

    // Save domestic violence class enrollment
    async saveDVEnrollment(enrollmentData) {
        try {
            const docRef = await getFirebaseDB().collection(collections.dvEnrollments).add({
                firstName: enrollmentData.firstName,
                middleName: enrollmentData.middleName || null,
                lastName: enrollmentData.lastName,
                email: enrollmentData.email,
                phone: enrollmentData.phone,
                dateOfBirth: enrollmentData.dob,
                address: enrollmentData.address,
                city: enrollmentData.city,
                state: enrollmentData.state,
                zip: enrollmentData.zip,
                enrollmentType: enrollmentData.enrollmentType,
                courtInfo: enrollmentData.courtInfo || null,
                preferredSchedule: enrollmentData.preferredSchedule,
                classFormat: enrollmentData.classFormat,
                emergencyContact: enrollmentData.emergencyContact,
                emergencyRelationship: enrollmentData.emergencyRelationship,
                emergencyPhone: enrollmentData.emergencyPhone,
                consent: enrollmentData.consent || false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error saving DV enrollment:', error);
            return { success: false, error: error.message };
        }
    },

    // Save comprehensive membership signup
    async saveMembershipSignup(signupData) {
        try {
            const docRef = await getFirebaseDB().collection(collections.memberSignups).add({
                membershipTier: signupData.membershipTier,
                firstName: signupData.firstName,
                lastName: signupData.lastName,
                email: signupData.email,
                phone: signupData.phone || null,
                organization: signupData.organization || null,
                role: signupData.role || null,
                industry: signupData.industry,
                city: signupData.city,
                state: signupData.state,
                country: signupData.country,
                interests: signupData.interests || [],
                goals: signupData.goals || null,
                expertise: signupData.expertise || null,
                referralSource: signupData.referralSource || null,
                newsletterSignup: signupData.newsletter || false,
                directoryListing: signupData.directory || false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error saving membership signup:', error);
            return { success: false, error: error.message };
        }
    },

    // Save digital services signup
    async saveDigitalServicesSignup(signupData) {
        try {
            const docRef = await getFirebaseDB().collection(collections.digitalServices).add({
                firstName: signupData.firstName,
                lastName: signupData.lastName,
                email: signupData.email,
                phone: signupData.phone || null,
                organization: signupData.organization || null,
                websiteUrl: signupData.websiteUrl || null,
                businessType: signupData.businessType || null,
                goals: signupData.goals || null,
                currentChallenges: signupData.currentChallenges || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error saving digital services signup:', error);
            return { success: false, error: error.message };
        }
    },

    // Save probation referral intake
    async saveReferral(referralData) {
        try {
            const docRef = await getFirebaseDB().collection(collections.referrals).add({
                cspIdentified: referralData.csp_identified === 'on' || referralData.csp_identified === true,
                youthName: referralData.youth_name,
                youthGender: referralData.youth_gender || null,
                youthAge: referralData.youth_age ? parseInt(referralData.youth_age) : null,
                youthDob: referralData.youth_dob || null,
                currentPlacement: referralData.current_placement || null,
                placementReason: referralData.placement_reason || null,
                parentName: referralData.parent_name || null,
                parentPhone: referralData.parent_phone || null,
                crossoverStatus: referralData.crossover_status || 'N/A',
                caseworkerName: referralData.caseworker_name || null,
                probationOfficer: referralData.probation_officer || null,
                probationDistrict: referralData.probation_district || null,
                judgeName: referralData.judge_name || null,
                county: referralData.county || null,
                serviceType: referralData.service_type || 'Non-Treatment',
                serviceDuration: referralData.service_duration || 'Long Term',
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error saving referral intake:', error);
            return { success: false, error: error.message };
        }
    },

    // Get submissions (for admin page)
    async getSubmissions(collectionName, limit = 50) {
        try {
            const snapshot = await getFirebaseDB()
                .collection(collectionName)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
            
            const submissions = [];
            snapshot.forEach(doc => {
                submissions.push({ id: doc.id, ...doc.data() });
            });
            return { success: true, data: submissions };
        } catch (error) {
            console.error('Error fetching submissions:', error);
            return { success: false, error: error.message };
        }
    }
};

// Export for use in other files
window.Database = Database;
