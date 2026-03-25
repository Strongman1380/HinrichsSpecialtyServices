// Aspire Impact Network - Main JavaScript File

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize Supabase
    await initializeSupabase();

    // Mobile Navigation Toggle
    initMobileNavigation();

    // Scroll Reveal Animations
    initScrollReveal();

    // Blog Search and Filter Functionality
    initBlogSearch();

    // Contact Form Handling
    initContactForm();

    // Newsletter Signup
    initNewsletterSignup();

    // Smooth Scrolling for Anchor Links
    initSmoothScrolling();

    // Load More Articles
    initLoadMoreArticles();

    // Custom Checkboxes
    initCustomCheckboxes();

    // Form Validation
    initFormValidation();

    // Billing Toggle for Membership Plans
    initBillingToggle();

    // Membership Enrollment Forms
    initMembershipEnrollment();

    // Digital Services Signup
    initDigitalServicesSignup();
});

// Scroll Reveal Animations
function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;

    // Auto-tag elements for reveal on first load
    const autoRevealSelectors = [
        '.panel',
        '.impact-stats .stat',
        '.service-card',
        '.method-card',
        '.action-card',
        '.package-card',
        '.story-card',
        '.testimonial-card',
        '.step',
        '.faq-item',
        '.article-card',
        '.benefit-item',
        '.category-card',
        '.feature-item',
        '.plan-card',
        '.referral-item',
        '.form-container',
    ];

    // Apply reveal class to matching elements not already tagged
    autoRevealSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, i) => {
            if (!el.classList.contains('reveal') &&
                !el.classList.contains('reveal-left') &&
                !el.classList.contains('reveal-right') &&
                !el.classList.contains('reveal-stagger')) {
                el.classList.add('reveal');
                // Stagger sibling cards
                el.style.transitionDelay = `${Math.min(i * 0.07, 0.42)}s`;
            }
        });
    });

    // Also handle explicit section headers
    document.querySelectorAll(
        '.program-header, .plan-header, .impact-content, .cta-content, .form-header, .page-header-content'
    ).forEach(el => {
        if (!el.classList.contains('reveal')) {
            el.classList.add('reveal');
        }
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-stagger').forEach(el => {
        observer.observe(el);
    });
}

// Mobile Navigation
function initMobileNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navToggle.contains(event.target) && !navMenu.contains(event.target)) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            }
        });

        // Close menu when clicking on a link
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            });
        });
    }
}

// Blog Search and Filter
function initBlogSearch() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const articleCards = document.querySelectorAll('.article-card');

    if (!searchInput) return;

    // Search functionality
    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const activeFilter = document.querySelector('.filter-btn.active')?.dataset.category;

        articleCards.forEach(card => {
            const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
            const content = card.querySelector('p')?.textContent.toLowerCase() || '';
            const category = card.dataset.category;

            const matchesSearch = searchTerm === '' ||
                                title.includes(searchTerm) ||
                                content.includes(searchTerm);

            const matchesFilter = activeFilter === 'all' ||
                                activeFilter === category;

            if (matchesSearch && matchesFilter) {
                card.style.display = 'block';
                card.classList.remove('hidden');
            } else {
                card.style.display = 'none';
                card.classList.add('hidden');
            }
        });
    }

    // Search input event listeners
    searchInput.addEventListener('input', performSearch);
    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }

    // Filter button functionality
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            // Perform search with new filter
            performSearch();
        });
    });
}

// Contact Form Handling
function initContactForm() {
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
        contactForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            // Basic form validation
            if (!validateForm(contactForm)) {
                return;
            }

            // Show loading state
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true;

            try {
                // Submit to Web3Forms
                const formData = new FormData(contactForm);
                const fullName = `${contactForm.firstName.value || ''} ${contactForm.lastName.value || ''}`.trim();
                formData.set('name', fullName || 'Website Visitor');

                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        Accept: 'application/json'
                    }
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    showMessage('Thank you for your message! We\'ll respond within 24 hours.', 'success');

                    // Reset form
                    contactForm.reset();

                    // Reset custom checkboxes
                    const checkboxes = contactForm.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = false;
                    });
                    
                    // Redirect to success page automatically
                    setTimeout(() => {
                        window.location.href = 'success.html';
                    }, 1500);
                } else {
                    throw new Error(result.message || 'Submission failed');
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                showMessage('There was an error sending your message. Please try again or contact us directly.', 'error');
            } finally {
                // Reset button
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
}

// Newsletter Signup
function initNewsletterSignup() {
    const newsletterForms = document.querySelectorAll('.newsletter-form');

    newsletterForms.forEach(form => {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            const emailInput = form.querySelector('input[type="email"]');
            const submitButton = form.querySelector('button[type="submit"]');

            if (!emailInput.value) {
                showMessage('Please enter a valid email address.', 'error');
                return;
            }

            // Show loading state
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Subscribing...';
            submitButton.disabled = true;

            try {
                // Save to Supabase
                const result = await Database.saveNewsletterSubscription(emailInput.value);

                if (result.success) {
                    showMessage('Thank you for subscribing! Check your email for confirmation.', 'success');
                    form.reset();
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error subscribing to newsletter:', error);
                showMessage('There was an error subscribing. Please try again.', 'error');
            } finally {
                // Reset button
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    });
}

// Smooth Scrolling
function initSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', function(event) {
            const href = this.getAttribute('href');

            // Skip if it's just '#'
            if (href === '#') return;

            const targetElement = document.querySelector(href);

            if (targetElement) {
                event.preventDefault();

                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Load More Articles
function initLoadMoreArticles() {
    const loadMoreButton = document.getElementById('load-more-btn');

    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', function() {
            // Show loading state
            const originalText = this.textContent;
            this.textContent = 'Loading...';
            this.disabled = true;

            // Simulate loading more articles
            setTimeout(() => {
                showMessage('No more articles to load at this time.', 'info');

                // Hide the button or reset it
                this.textContent = originalText;
                this.disabled = false;
            }, 1000);
        });
    }
}

// Custom Checkboxes
function initCustomCheckboxes() {
    const checkboxLabels = document.querySelectorAll('.checkbox-label');

    checkboxLabels.forEach(label => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        const checkmark = label.querySelector('.checkmark');

        if (checkbox && checkmark) {
            // Hide the default checkbox
            checkbox.style.display = 'none';

            // Handle label clicks
            label.addEventListener('click', function(event) {
                event.preventDefault();
                checkbox.checked = !checkbox.checked;

                // Trigger change event
                checkbox.dispatchEvent(new Event('change'));
            });
        }
    });
}

// Form Validation
function initFormValidation() {
    const forms = document.querySelectorAll('form');

    forms.forEach(form => {
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');

        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                validateField(this);
            });

            input.addEventListener('input', function() {
                // Remove error styling when user starts typing
                if (this.classList.contains('error')) {
                    this.classList.remove('error');
                    const errorMessage = this.parentNode.querySelector('.error-message');
                    if (errorMessage) {
                        errorMessage.remove();
                    }
                }
            });
        });
    });
}

// Validate individual field
function validateField(field) {
    const value = field.value.trim();
    const fieldType = field.type;
    const isRequired = field.hasAttribute('required');

    // Remove existing error styling
    field.classList.remove('error');
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    // Check if required field is empty
    if (isRequired && !value) {
        showFieldError(field, 'This field is required.');
        return false;
    }

    // Email validation
    if (fieldType === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            showFieldError(field, 'Please enter a valid email address.');
            return false;
        }
    }

    // Phone validation (basic)
    if (fieldType === 'tel' && value) {
        const phoneRegex = /^[\d\s\-\(\)\+\.]+$/;
        if (!phoneRegex.test(value)) {
            showFieldError(field, 'Please enter a valid phone number.');
            return false;
        }
    }

    return true;
}

// Show field error
function showFieldError(field, message) {
    field.classList.add('error');

    const errorElement = document.createElement('span');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.color = '#dc2626';
    errorElement.style.fontSize = '0.875rem';
    errorElement.style.marginTop = '0.25rem';
    errorElement.style.display = 'block';

    field.parentNode.appendChild(errorElement);
}

// Validate entire form
function validateForm(form) {
    const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });

    return isValid;
}

// Show message to user
function showMessage(message, type = 'info') {
    // Remove existing message
    const existingMessage = document.querySelector('.message-notification');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message-notification message-${type}`;
    messageElement.textContent = message;

    // Style the message
    messageElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            messageElement.style.backgroundColor = '#10b981';
            break;
        case 'error':
            messageElement.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            messageElement.style.backgroundColor = '#f59e0b';
            break;
        default:
            messageElement.style.backgroundColor = '#3b82f6';
    }

    // Add to page
    document.body.appendChild(messageElement);

    // Animate in
    setTimeout(() => {
        messageElement.style.transform = 'translateX(0)';
        messageElement.style.opacity = '1';
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
        messageElement.style.transform = 'translateX(100%)';
        messageElement.style.opacity = '0';
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 300);
    }, 5000);

    // Allow manual close
    messageElement.addEventListener('click', function() {
        this.style.transform = 'translateX(100%)';
        this.style.opacity = '0';
        setTimeout(() => {
            if (this.parentNode) {
                this.remove();
            }
        }, 300);
    });
}

// Utility function to debounce function calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add error styles to CSS if not already present
function addErrorStyles() {
    const styleId = 'form-error-styles';

    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .form-group input.error,
            .form-group select.error,
            .form-group textarea.error {
                border-color: #dc2626;
                box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
            }

            .message-notification {
                transform: translateX(100%);
                opacity: 0;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize error styles
addErrorStyles();

// Billing Toggle for Membership Plans
function initBillingToggle() {
    // Handle Premier plan billing toggle
    const premierMonthly = document.getElementById('premier-monthly');
    const premierYearly = document.getElementById('premier-yearly');
    const premierMonthlyPrice = document.querySelector('.premier .monthly-price');
    const premierYearlyPrice = document.querySelector('.premier .yearly-price');
    const premierMonthlyCta = document.querySelector('.premier-cta-btn .monthly-cta');
    const premierYearlyCta = document.querySelector('.premier-cta-btn .yearly-cta');

    if (premierMonthly && premierYearly) {
        premierMonthly.addEventListener('change', function() {
            if (this.checked) {
                premierMonthlyPrice?.classList.add('active');
                premierYearlyPrice?.classList.remove('active');
                if (premierMonthlyCta && premierYearlyCta) {
                    premierMonthlyCta.style.display = 'inline';
                    premierYearlyCta.style.display = 'none';
                }
            }
        });

        premierYearly.addEventListener('change', function() {
            if (this.checked) {
                premierYearlyPrice?.classList.add('active');
                premierMonthlyPrice?.classList.remove('active');
                if (premierMonthlyCta && premierYearlyCta) {
                    premierMonthlyCta.style.display = 'none';
                    premierYearlyCta.style.display = 'inline';
                }
            }
        });
    }

    // Handle Pro plan billing toggle
    const proMonthly = document.getElementById('pro-monthly');
    const proYearly = document.getElementById('pro-yearly');
    const proMonthlyPrice = document.querySelector('.pro .monthly-price');
    const proYearlyPrice = document.querySelector('.pro .yearly-price');
    const proMonthlyCta = document.querySelector('.pro-cta-btn .monthly-cta');
    const proYearlyCta = document.querySelector('.pro-cta-btn .yearly-cta');

    if (proMonthly && proYearly) {
        proMonthly.addEventListener('change', function() {
            if (this.checked) {
                proMonthlyPrice?.classList.add('active');
                proYearlyPrice?.classList.remove('active');
                if (proMonthlyCta && proYearlyCta) {
                    proMonthlyCta.style.display = 'inline';
                    proYearlyCta.style.display = 'none';
                }
            }
        });

        proYearly.addEventListener('change', function() {
            if (this.checked) {
                proYearlyPrice?.classList.add('active');
                proMonthlyPrice?.classList.remove('active');
                if (proMonthlyCta && proYearlyCta) {
                    proMonthlyCta.style.display = 'none';
                    proYearlyCta.style.display = 'inline';
                }
            }
        });
    }
}

// Membership Enrollment Forms
function initMembershipEnrollment() {
    // Handle membership plan CTA buttons
    const membershipButtons = document.querySelectorAll('a[href^="#signup-"]');

    membershipButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            const membershipType = this.href.split('#signup-')[1];
            showMembershipEnrollmentModal(membershipType);
        });
    });
}

// Digital Services Signup
function initDigitalServicesSignup() {
    // Handle digital services CTA buttons
    const digitalServiceButtons = document.querySelectorAll('a[href="#subscribe"], a[href*="digital-solutions"]');

    digitalServiceButtons.forEach(button => {
        if (button.textContent.includes('Subscribe') || button.textContent.includes('Start Your Digital')) {
            button.addEventListener('click', function(event) {
                if (this.href.includes('#subscribe')) {
                    event.preventDefault();
                    showDigitalServicesSignupModal();
                }
            });
        }
    });
}

// Show Membership Enrollment Modal
function showMembershipEnrollmentModal(membershipType) {
    const modalHtml = `
        <div class="modal-overlay" id="membershipModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Join ${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Membership</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <form class="enrollment-form" id="membershipEnrollmentForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="memberFirstName">First Name *</label>
                            <input type="text" id="memberFirstName" name="firstName" required>
                        </div>
                        <div class="form-group">
                            <label for="memberLastName">Last Name *</label>
                            <input type="text" id="memberLastName" name="lastName" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="memberEmail">Email Address *</label>
                            <input type="email" id="memberEmail" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="memberPhone">Phone Number</label>
                            <input type="tel" id="memberPhone" name="phone">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="memberOrganization">Organization/Company</label>
                        <input type="text" id="memberOrganization" name="organization">
                    </div>
                    <div class="form-group">
                        <label for="billingFrequency">Billing Frequency</label>
                        <select id="billingFrequency" name="billingFrequency">
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly (20% discount)</option>
                        </select>
                    </div>
                    <input type="hidden" name="membershipType" value="${membershipType}">
                    <div class="form-submit">
                        <button type="submit" class="btn btn-primary">Complete Enrollment</button>
                        <button type="button" class="btn btn-outline modal-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setupModalHandlers('membershipModal', 'membershipEnrollmentForm', handleMembershipEnrollment);
}

// Show Digital Services Signup Modal
function showDigitalServicesSignupModal() {
    const modalHtml = `
        <div class="modal-overlay" id="digitalServicesModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Start Your Digital Transformation</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <form class="enrollment-form" id="digitalServicesForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="digitalFirstName">First Name *</label>
                            <input type="text" id="digitalFirstName" name="firstName" required>
                        </div>
                        <div class="form-group">
                            <label for="digitalLastName">Last Name *</label>
                            <input type="text" id="digitalLastName" name="lastName" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="digitalEmail">Email Address *</label>
                            <input type="email" id="digitalEmail" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="digitalPhone">Phone Number</label>
                            <input type="tel" id="digitalPhone" name="phone">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="digitalOrganization">Organization/Business Name *</label>
                        <input type="text" id="digitalOrganization" name="organization" required>
                    </div>
                    <div class="form-group">
                        <label for="websiteUrl">Current Website URL (if any)</label>
                        <input type="url" id="websiteUrl" name="websiteUrl" placeholder="https://yourwebsite.com">
                    </div>
                    <div class="form-group">
                        <label for="businessType">Business/Organization Type</label>
                        <select id="businessType" name="businessType">
                            <option value="">Select type...</option>
                            <option value="nonprofit">Nonprofit Organization</option>
                            <option value="small-business">Small Business</option>
                            <option value="professional-services">Professional Services</option>
                            <option value="healthcare">Healthcare</option>
                            <option value="education">Education</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="digitalGoals">What are your main digital goals?</label>
                        <textarea id="digitalGoals" name="goals" rows="3" placeholder="e.g., increase online visibility, improve website performance, generate more leads..."></textarea>
                    </div>
                    <div class="form-submit">
                        <button type="submit" class="btn btn-primary">Start Digital Services - $150/month</button>
                        <button type="button" class="btn btn-outline modal-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setupModalHandlers('digitalServicesModal', 'digitalServicesForm', handleDigitalServicesSignup);
}

// Setup Modal Event Handlers
function setupModalHandlers(modalId, formId, submitHandler) {
    const modal = document.getElementById(modalId);
    const form = document.getElementById(formId);
    const closeButton = modal.querySelector('.modal-close');
    const cancelButton = modal.querySelector('.modal-cancel');

    // Close modal events
    closeButton.addEventListener('click', () => closeModal(modalId));
    cancelButton.addEventListener('click', () => closeModal(modalId));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modalId);
    });

    // Form submission
    form.addEventListener('submit', submitHandler);

    // Add modal styles
    addModalStyles();
}

// Handle Membership Enrollment Submission
async function handleMembershipEnrollment(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    submitButton.textContent = 'Processing...';
    submitButton.disabled = true;

    try {
        const formData = {
            firstName: form.firstName.value,
            lastName: form.lastName.value,
            email: form.email.value,
            phone: form.phone.value,
            organization: form.organization.value,
            membershipType: form.membershipType.value,
            billingFrequency: form.billingFrequency.value
        };

        const result = await Database.saveMembershipEnrollment(formData);

        if (result.success) {
            showMessage(`Thank you for joining our ${formData.membershipType} membership! We'll send you enrollment details shortly.`, 'success');
            closeModal('membershipModal');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error enrolling in membership:', error);
        showMessage('There was an error processing your enrollment. Please try again.', 'error');
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Handle Digital Services Signup Submission
async function handleDigitalServicesSignup(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    submitButton.textContent = 'Processing...';
    submitButton.disabled = true;

    try {
        const formData = {
            firstName: form.firstName.value,
            lastName: form.lastName.value,
            email: form.email.value,
            phone: form.phone.value,
            organization: form.organization.value,
            websiteUrl: form.websiteUrl.value,
            businessType: form.businessType.value,
            goals: form.goals.value
        };

        const result = await Database.saveDigitalServicesSignup(formData);

        if (result.success) {
            showMessage('Thank you for signing up for our digital services! We\'ll contact you within 24 hours to get started.', 'success');
            closeModal('digitalServicesModal');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error signing up for digital services:', error);
        showMessage('There was an error processing your signup. Please try again.', 'error');
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Close Modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

// Add Modal Styles
function addModalStyles() {
    const styleId = 'modal-styles';

    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                padding: 20px;
            }

            .modal-content {
                background: white;
                border-radius: 8px;
                width: 100%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
            }

            .modal-header {
                padding: 20px 20px 0;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .modal-header h2 {
                margin: 0;
                color: #1f2937;
            }

            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6b7280;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .modal-close:hover {
                color: #1f2937;
            }

            .enrollment-form {
                padding: 0 20px 20px;
            }

            .enrollment-form .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-bottom: 15px;
            }

            .enrollment-form .form-group {
                margin-bottom: 15px;
            }

            .enrollment-form .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
                color: #374151;
            }

            .enrollment-form .form-group input,
            .enrollment-form .form-group select,
            .enrollment-form .form-group textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 16px;
            }

            .enrollment-form .form-submit {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
            }

            @media (max-width: 640px) {
                .enrollment-form .form-row {
                    grid-template-columns: 1fr;
                }

                .enrollment-form .form-submit {
                    flex-direction: column-reverse;
                }
            }
        `;
        document.head.appendChild(style);
    }
}