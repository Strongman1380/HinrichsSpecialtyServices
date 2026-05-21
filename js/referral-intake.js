// Referral Intake Form Logic
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase
    if (typeof window.initializeSupabase === 'function') {
        window.initializeSupabase();
    } else {
        console.error('Supabase initialization function not found');
    }

    const form = document.getElementById('referral-intake-form');
    const steps = document.querySelectorAll('.form-step');
    const stepIndicators = document.querySelectorAll('.step-indicator');
    const progressFill = document.getElementById('progress-fill');
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnSubmit = document.getElementById('btn-submit');
    
    let currentStep = 1;
    const totalSteps = steps.length;

    // Navigation logic
    function updateStep() {
        // Show/hide steps
        steps.forEach(step => {
            step.classList.remove('active');
            if (parseInt(step.id.split('-')[1]) === currentStep) {
                step.classList.add('active');
            }
        });

        // Update indicators
        stepIndicators.forEach(indicator => {
            const stepNum = parseInt(indicator.getAttribute('data-step'));
            indicator.classList.remove('active', 'completed');
            if (stepNum === currentStep) {
                indicator.classList.add('active');
            } else if (stepNum < currentStep) {
                indicator.classList.add('completed');
                indicator.innerHTML = '✓';
            } else {
                indicator.innerHTML = stepNum;
            }
        });

        // Update progress bar
        const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressFill.style.width = `${progress}%`;

        // Update buttons
        if (currentStep === 1) {
            btnPrev.style.visibility = 'hidden';
        } else {
            btnPrev.style.visibility = 'visible';
        }

        if (currentStep === totalSteps) {
            btnNext.style.display = 'none';
            btnSubmit.style.display = 'inline-block';
        } else {
            btnNext.style.display = 'inline-block';
            btnSubmit.style.display = 'none';
        }

        // Scroll to top of card on step change
        const card = document.querySelector('.intake-card');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    btnNext.addEventListener('click', () => {
        // Validate current step before proceeding
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                currentStep++;
                updateStep();
            }
        }
    });

    btnPrev.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateStep();
        }
    });

    // Basic validation for required fields
    function validateStep(step) {
        const currentStepEl = document.getElementById(`step-${step}`);
        const requiredInputs = currentStepEl.querySelectorAll('[required]');
        let isValid = true;

        requiredInputs.forEach(input => {
            if (!input.value.trim()) {
                isValid = false;
                input.style.borderColor = '#ef4444';
                // Add shake animation
                input.parentElement.classList.add('shake');
                setTimeout(() => input.parentElement.classList.remove('shake'), 500);
            } else {
                input.style.borderColor = '#d1d5db';
            }
        });

        return isValid;
    }

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = 'Submitting...';

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Handle checkbox specially
        data.csp_identified = document.getElementById('csp_identified').checked;

        try {
            if (typeof window.Database.saveReferral === 'function') {
                const result = await window.Database.saveReferral(data);
                
                if (result.success) {
                    showSuccess();
                } else {
                    throw new Error(result.error || 'Submission failed');
                }
            } else {
                throw new Error('Database save function not found');
            }
        } catch (error) {
            console.error('Referral submission error:', error);
            alert('There was an error submitting your referral. Please try again or contact support.');
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Submit Referral';
        }
    });

    function showSuccess() {
        const body = document.querySelector('.intake-form-body');
        body.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; animation: fadeIn 0.8s ease;">
                <div style="width: 80px; height: 80px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 2rem; box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);">✓</div>
                <h2 style="font-size: 2rem; color: #132e54; margin-bottom: 1rem;">Referral Submitted!</h2>
                <p style="font-size: 1.125rem; color: #64748b; margin-bottom: 2.5rem;">The probation referral has been securely received. Our team will review the information and follow up shortly.</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <a href="index.html" class="btn btn-primary" style="text-decoration: none;">Return Home</a>
                    <button onclick="window.location.reload()" class="btn btn-outline">Submit Another</button>
                </div>
            </div>
        `;
        progressFill.style.width = '100%';
        stepIndicators.forEach(ind => {
            ind.classList.add('completed');
            ind.innerHTML = '✓';
        });
    }

    // Add CSS for shake animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .shake { animation: shake 0.5s ease; }
    `;
    document.head.appendChild(style);
});
