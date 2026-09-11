/**
 * Enhanced Form Experience
 * - Multi-step forms
 * - Auto-save to localStorage
 * - Real-time validation
 * - Progress indicators
 */

import { sanitizeInput, isValidEmail, isValidPhone } from './security.js';
import { announceFormError, announceFormSuccess } from './accessibility.js';

// Auto-save form data to localStorage
export class FormAutoSave {
  constructor(formId, saveKey) {
    this.form = document.getElementById(formId);
    this.saveKey = saveKey || `form_autosave_${formId}`;
    this.debounceTimer = null;
  }

  init() {
    if (!this.form) return;

    // Load saved data
    this.loadFormData();

    // Save on input with debounce
    this.form.addEventListener('input', (e) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.saveFormData();
      }, 500);
    });

    // Clear on successful submission
    this.form.addEventListener('submit', () => {
      this.clearSavedData();
    });
  }

  saveFormData() {
    const formData = new FormData(this.form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      // Don't save sensitive fields
      if (key.includes('password') || key.includes('card') || key.includes('cvv')) {
        continue;
      }
      data[key] = value;
    }

    try {
      localStorage.setItem(this.saveKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to auto-save form:', error);
    }
  }

  loadFormData() {
    try {
      const saved = localStorage.getItem(this.saveKey);
      if (!saved) return;

      const { data, timestamp } = JSON.parse(saved);

      // Check if data is less than 24 hours old
      const age = Date.now() - timestamp;
      if (age > 24 * 60 * 60 * 1000) {
        this.clearSavedData();
        return;
      }

      // Restore form values
      for (const [key, value] of Object.entries(data)) {
        const field = this.form.elements[key];
        if (field) {
          if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = value === 'on' || value === field.value;
          } else {
            field.value = value;
          }
        }
      }

      // Show notification
      this.showRestoreNotification();
    } catch (error) {
      console.warn('Failed to load saved form data:', error);
    }
  }

  showRestoreNotification() {
    const notification = document.createElement('div');
    notification.className = 'form-restore-notification';
    notification.innerHTML = `
      <p>📝 We've restored your previous entries.</p>
      <button type="button" class="btn-clear-saved">Clear</button>
    `;
    notification.style.cssText = `
      background: var(--blue, #3b82f6);
      color: #ffffff;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow-sm);
    `;

    this.form.insertBefore(notification, this.form.firstChild);

    notification.querySelector('.btn-clear-saved').addEventListener('click', () => {
      this.clearSavedData();
      this.form.reset();
      notification.remove();
    });

    // Auto-remove after 10 seconds
    setTimeout(() => notification.remove(), 10000);
  }

  clearSavedData() {
    try {
      localStorage.removeItem(this.saveKey);
    } catch (error) {
      console.warn('Failed to clear saved data:', error);
    }
  }
}

// Multi-step form wizard
export class MultiStepForm {
  constructor(formId) {
    this.form = document.getElementById(formId);
    this.steps = [];
    this.currentStep = 0;
    this.progressBar = null;
  }

  init() {
    if (!this.form) return;

    // Find all form steps
    this.steps = Array.from(this.form.querySelectorAll('[data-form-step]'));
    if (this.steps.length === 0) return;

    // Create progress bar
    this.createProgressBar();

    // Show first step
    this.showStep(0);

    // Setup navigation
    this.setupNavigation();
  }

  createProgressBar() {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'form-progress';
    progressContainer.innerHTML = `
      <div class="progress-steps">
        ${this.steps.map((step, index) => `
          <div class="progress-step ${index === 0 ? 'active' : ''}" data-step="${index}">
            <div class="step-number">${index + 1}</div>
            <div class="step-label">${step.dataset.stepLabel || `Step ${index + 1}`}</div>
          </div>
        `).join('')}
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${(1 / this.steps.length) * 100}%"></div>
      </div>
    `;

    this.form.insertBefore(progressContainer, this.form.firstChild);
    this.progressBar = progressContainer.querySelector('.progress-fill');
  }

  showStep(stepIndex) {
    // Hide all steps
    this.steps.forEach(step => step.style.display = 'none');

    // Show current step
    this.steps[stepIndex].style.display = 'block';
    this.currentStep = stepIndex;

    // Update progress bar
    const progress = ((stepIndex + 1) / this.steps.length) * 100;
    if (this.progressBar) {
      this.progressBar.style.width = `${progress}%`;
    }

    // Update step indicators
    const stepIndicators = this.form.querySelectorAll('.progress-step');
    stepIndicators.forEach((indicator, index) => {
      if (index < stepIndex) {
        indicator.classList.add('completed');
        indicator.classList.remove('active');
      } else if (index === stepIndex) {
        indicator.classList.add('active');
        indicator.classList.remove('completed');
      } else {
        indicator.classList.remove('active', 'completed');
      }
    });

    // Scroll to top of form
    this.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setupNavigation() {
    // Next buttons
    this.steps.forEach((step, index) => {
      const nextBtn = step.querySelector('[data-form-next]');
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.validateStep(index)) {
            this.nextStep();
          }
        });
      }
    });

    // Previous buttons
    this.steps.forEach((step) => {
      const prevBtn = step.querySelector('[data-form-prev]');
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.prevStep();
        });
      }
    });
  }

  validateStep(stepIndex) {
    const step = this.steps[stepIndex];
    const inputs = step.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;

    inputs.forEach(input => {
      if (!input.checkValidity()) {
        input.reportValidity();
        isValid = false;
      }
    });

    return isValid;
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.showStep(this.currentStep + 1);
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  getCurrentStep() {
    return this.currentStep;
  }

  getTotalSteps() {
    return this.steps.length;
  }
}

// Real-time validation
export class RealTimeValidator {
  constructor(formId) {
    this.form = document.getElementById(formId);
    this.validators = {
      email: isValidEmail,
      phone: isValidPhone,
      url: (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      required: (value) => value.trim().length > 0,
      minlength: (value, min) => value.length >= min,
      maxlength: (value, max) => value.length <= max,
      pattern: (value, pattern) => new RegExp(pattern).test(value)
    };
  }

  init() {
    if (!this.form) return;

    const inputs = this.form.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
      // Validate on blur
      input.addEventListener('blur', () => {
        this.validateField(input);
      });

      // Clear error on input
      input.addEventListener('input', () => {
        this.clearFieldError(input);
      });
    });
  }

  validateField(field) {
    const validationRules = this.getValidationRules(field);
    const value = field.value;

    for (const [rule, param] of Object.entries(validationRules)) {
      const validator = this.validators[rule];
      if (validator && !validator(value, param)) {
        this.showFieldError(field, this.getErrorMessage(field, rule));
        announceFormError(field.name, this.getErrorMessage(field, rule));
        return false;
      }
    }

    this.clearFieldError(field);
    return true;
  }

  getValidationRules(field) {
    const rules = {};

    if (field.required) rules.required = true;
    if (field.type === 'email') rules.email = true;
    if (field.type === 'tel') rules.phone = true;
    if (field.type === 'url') rules.url = true;
    if (field.minLength > 0) rules.minlength = field.minLength;
    if (field.maxLength > 0) rules.maxlength = field.maxLength;
    if (field.pattern) rules.pattern = field.pattern;

    return rules;
  }

  getErrorMessage(field, rule) {
    const customMessage = field.dataset[`error${rule.charAt(0).toUpperCase() + rule.slice(1)}`];
    if (customMessage) return customMessage;

    const messages = {
      required: 'This field is required',
      email: 'Please enter a valid email address',
      phone: 'Please enter a valid phone number',
      url: 'Please enter a valid URL',
      minlength: `Minimum length is ${field.minLength} characters`,
      maxlength: `Maximum length is ${field.maxLength} characters`,
      pattern: 'Please match the requested format'
    };

    return messages[rule] || 'Invalid input';
  }

  showFieldError(field, message) {
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');

    let errorElement = field.parentElement.querySelector('.field-error');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      errorElement.setAttribute('role', 'alert');
      field.parentElement.appendChild(errorElement);
    }

    errorElement.textContent = message;
    field.setAttribute('aria-describedby', errorElement.id || 'error-' + field.name);
  }

  clearFieldError(field) {
    field.classList.remove('error');
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');

    const errorElement = field.parentElement.querySelector('.field-error');
    if (errorElement) {
      errorElement.remove();
    }
  }

  validateForm() {
    const inputs = this.form.querySelectorAll('input, textarea, select');
    let isValid = true;

    inputs.forEach(input => {
      if (!this.validateField(input)) {
        isValid = false;
      }
    });

    return isValid;
  }
}

// Password strength indicator
export function createPasswordStrengthIndicator(passwordFieldId) {
  const passwordField = document.getElementById(passwordFieldId);
  if (!passwordField) return;

  const indicator = document.createElement('div');
  indicator.className = 'password-strength';
  indicator.innerHTML = `
    <div class="strength-bar">
      <div class="strength-fill"></div>
    </div>
    <div class="strength-text"></div>
  `;

  passwordField.parentElement.appendChild(indicator);

  const fill = indicator.querySelector('.strength-fill');
  const text = indicator.querySelector('.strength-text');

  passwordField.addEventListener('input', () => {
    const strength = calculatePasswordStrength(passwordField.value);

    fill.style.width = `${strength.percentage}%`;
    fill.className = `strength-fill strength-${strength.level}`;
    text.textContent = strength.message;
  });
}

function calculatePasswordStrength(password) {
  let score = 0;

  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 25;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z\d]/.test(password)) score += 10;

  let level = 'weak';
  let message = 'Weak password';

  if (score >= 75) {
    level = 'strong';
    message = 'Strong password';
  } else if (score >= 50) {
    level = 'medium';
    message = 'Medium password';
  }

  return { percentage: score, level, message };
}

// Export utilities
export default {
  FormAutoSave,
  MultiStepForm,
  RealTimeValidator,
  createPasswordStrengthIndicator
};
