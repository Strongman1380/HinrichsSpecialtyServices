// Form Validation Utility
const Validation = {
    emailPattern: /^[\s@]+@[\s@]+\.[\s@]+$/,
    phonePattern: /^[\d\-\(\)\+]{10,}$/,
    zipPattern: /^\d{5}(-\d{4})?$/,
    
    rules: {
        required: (value) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string') return value.trim().length > 0;
            if (Array.isArray(value)) return value.length > 0;
            return true;
        },
        email: (value) => !value || Validation.emailPattern.test(value),
        phone: (value) => !value || Validation.phonePattern.test(value.replace(/\D/g, '')),
        zip: (value) => !value || Validation.zipPattern.test(value),
        minLength: (value, len) => !value || value.length >= len,
        maxLength: (value, len) => !value || value.length <= len,
        checkboxRequired: (value) => value === true
    },
    
    messages: {
        required: 'This field is required',
        email: 'Please enter a valid email',
        phone: 'Please enter a valid phone number',
        zip: 'Please enter a valid ZIP code',
        minLength: (f, l) => `Must be at least ${l} characters`,
        maxLength: (f, l) => `Must be no more than ${l} characters`,
        checkboxRequired: 'You must accept this to continue'
    },
    
    validateField(field, rules) {
        const value = field.type === 'checkbox' ? field.checked : field.value;
        const errors = [];
        
        for (const [rule, ruleValue] of Object.entries(rules)) {
            if (!this.rules[rule](value, ruleValue)) {
                const name = field.name || field.id || 'This field';
                let msg = this.messages[rule];
                if (typeof msg === 'function') msg = msg(name, ruleValue);
                errors.push(msg);
            }
        }
        return errors;
    },
    
    validateForm(form, validationRules) {
        const errors = {};
        this.clearErrors(form);
        
        for (const [fieldName, rules] of Object.entries(validationRules)) {
            const field = form.querySelector(`[name="${fieldName}"]`) || form.querySelector(`#${fieldName}`);
            if (!field) continue;
            
            const fieldErrors = this.validateField(field, rules);
            if (fieldErrors.length > 0) {
                errors[fieldName] = fieldErrors;
                this.showFieldError(field, fieldErrors[0]);
            }
        }
        
        return { isValid: Object.keys(errors).length === 0, errors };
    },
    
    showFieldError(field, message) {
        field.classList.add('error');
        let errorEl = field.parentElement.querySelector('.field-error');
        if (!errorEl) {
            errorEl = document.createElement('span');
            errorEl.className = 'field-error';
            field.parentElement.appendChild(errorEl);
        }
        errorEl.textContent = message;
    },
    
    clearErrors(form) {
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.field-error').forEach(el => el.remove());
    },
    
    clearFieldError(field) {
        field.classList.remove('error');
        field.parentElement?.querySelector('.field-error')?.remove();
    },
    
    sanitize(value) {
        if (typeof value !== 'string') return value;
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
};

Validation.presets = {
    contactForm: {
        firstName: { required: true, minLength: 1 },
        lastName: { required: true, minLength: 1 },
        email: { required: true, email: true },
        message: { required: true, minLength: 10 }
    },
    newsletterForm: { email: { required: true, email: true } },
    enrollmentForm: {
        firstName: { required: true },
        lastName: { required: true },
        email: { required: true, email: true },
        phone: { required: true, phone: true },
        consent: { checkboxRequired: true }
    }
};

window.Validation = Validation;
