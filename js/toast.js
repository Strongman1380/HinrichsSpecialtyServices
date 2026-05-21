/**
 * Toast Notification System
 * Provides consistent UI feedback for user actions
 */

const Toast = {
    container: null,
    
    init() {
        if (this.container) return;
        
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'true');
        
        // Inject styles if not already present
        if (!document.getElementById('toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'toast-styles';
            styles.textContent = `
                .toast-container {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    pointer-events: none;
                }
                .toast {
                    pointer-events: auto;
                    padding: 14px 20px;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 14px;
                    font-weight: 500;
                    max-width: 360px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    animation: toast-slide-in 0.3s ease-out;
                    border-left: 4px solid;
                }
                .toast.success {
                    background: #10b981;
                    color: white;
                    border-color: #059669;
                }
                .toast.error {
                    background: #ef4444;
                    color: white;
                    border-color: #dc2626;
                }
                .toast.warning {
                    background: #f59e0b;
                    color: white;
                    border-color: #d97706;
                }
                .toast.info {
                    background: #3b82f6;
                    color: white;
                    border-color: #2563eb;
                }
                .toast-icon {
                    flex-shrink: 0;
                    width: 20px;
                    height: 20px;
                }
                .toast-message {
                    flex: 1;
                }
                .toast-close {
                    flex-shrink: 0;
                    background: transparent;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    padding: 4px;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                .toast-close:hover {
                    opacity: 1;
                }
                .toast.toast-exit {
                    animation: toast-slide-out 0.3s ease-in forwards;
                }
                @keyframes toast-slide-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes toast-slide-out {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                @media (max-width: 480px) {
                    .toast-container {
                        left: 10px;
                        right: 10px;
                        bottom: 10px;
                    }
                    .toast {
                        max-width: 100%;
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(this.container);
    },
    
    icons: {
        success: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
        error: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
        warning: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
        info: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`
    },
    
    show(message, type = 'info', duration = 5000) {
        this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            ${this.icons[type] || this.icons.info}
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
            </button>
        `;
        
        // Close handler
        const close = () => this.dismiss(toast);
        toast.querySelector('.toast-close').addEventListener('click', close);
        
        this.container.appendChild(toast);
        
        // Auto dismiss
        if (duration > 0) {
            setTimeout(close, duration);
        }
        
        return toast;
    },
    
    dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    },
    
    dismissAll() {
        if (!this.container) return;
        this.container.querySelectorAll('.toast').forEach(t => this.dismiss(t));
    },
    
    // Convenience methods
    success(message, duration) {
        return this.show(message, 'success', duration);
    },
    
    error(message, duration = 7000) {
        return this.show(message, 'error', duration);
    },
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    },
    
    info(message, duration) {
        return this.show(message, 'info', duration);
    }
};

// Global error handler setup
function setupGlobalErrorHandler() {
    // Capture uncaught errors
    window.addEventListener('error', (event) => {
        // Don't capture resource loading errors
        if (event.target !== window) return;
        
        console.error('Uncaught error:', event.error);
        Toast.error('An unexpected error occurred. Please try again.');
    });
    
    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled rejection:', event.reason);
        Toast.error('An unexpected error occurred. Please try again.');
    });
    
    // Handle fetch errors globally
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch.apply(this, args);
            
            // Check for HTTP errors on the response
            if (!response.ok && response.status >= 400) {
                console.error(`HTTP ${response.status}:`, response.url);
            }
            
            return response;
        } catch (error) {
            console.error('Network error:', error);
            Toast.error('Network error. Please check your connection.');
            throw error;
        }
    };
}

// Export
window.Toast = Toast;
window.setupGlobalErrorHandler = setupGlobalErrorHandler;
