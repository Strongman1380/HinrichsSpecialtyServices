// HSST Chatbot Widget — self-contained floating chat assistant
(function () {
    'use strict';

    // ── Config ──────────────────────────────────────────────────
    const API_ENDPOINT = '/api/chat';
    const WELCOME_MESSAGE = "Hi! I'm the HSST assistant. I can answer questions about our digital services, pricing, or help connect you with Brandon. What can I help you with?";
    const QUICK_REPLIES = [
        'What services do you offer?',
        'How much does a website cost?',
        'Get a quote',
    ];

    // ── State ────────────────────────────────────────────────────
    let isOpen = false;
    let isTyping = false;
    let messageHistory = []; // { role: 'user'|'assistant', content: string }
    let pendingLead = null;

    // ── Inject Styles ────────────────────────────────────────────
    const styles = `
        #hsst-chat-btn {
            position: fixed;
            bottom: 28px;
            right: 28px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1a78e6 0%, #132e54 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(26,120,230,0.45);
            z-index: 9000;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
            outline: none;
        }
        #hsst-chat-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 8px 28px rgba(26,120,230,0.55);
        }
        #hsst-chat-btn svg { pointer-events: none; }

        #hsst-chat-badge {
            position: absolute;
            top: -4px;
            right: -4px;
            width: 18px;
            height: 18px;
            background: #f58220;
            border-radius: 50%;
            border: 2px solid #fff;
            display: none;
        }
        #hsst-chat-badge.visible { display: block; }

        #hsst-chat-window {
            position: fixed;
            bottom: 96px;
            right: 28px;
            width: 360px;
            max-width: calc(100vw - 32px);
            height: 520px;
            max-height: calc(100vh - 120px);
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.16), 0 0 0 1px rgba(26,120,230,0.1);
            z-index: 8999;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: translateY(20px) scale(0.95);
            opacity: 0;
            pointer-events: none;
            transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease;
        }
        #hsst-chat-window.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: all;
        }

        #hsst-chat-header {
            background: linear-gradient(135deg, #132e54 0%, #1a78e6 100%);
            padding: 16px 18px;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }
        #hsst-chat-avatar {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: rgba(255,255,255,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 18px;
        }
        #hsst-chat-header-info { flex: 1; }
        #hsst-chat-header-info strong {
            display: block;
            color: #fff;
            font-size: 0.95rem;
            font-weight: 600;
        }
        #hsst-chat-header-info span {
            color: rgba(255,255,255,0.75);
            font-size: 0.75rem;
        }
        #hsst-chat-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.8);
            cursor: pointer;
            padding: 4px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s, background 0.2s;
        }
        #hsst-chat-close:hover {
            color: #fff;
            background: rgba(255,255,255,0.15);
        }

        #hsst-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            scroll-behavior: smooth;
        }
        #hsst-chat-messages::-webkit-scrollbar { width: 4px; }
        #hsst-chat-messages::-webkit-scrollbar-track { background: transparent; }
        #hsst-chat-messages::-webkit-scrollbar-thumb {
            background: rgba(26,120,230,0.2);
            border-radius: 4px;
        }

        .hsst-msg {
            max-width: 84%;
            padding: 10px 14px;
            border-radius: 16px;
            font-size: 0.875rem;
            line-height: 1.5;
            word-wrap: break-word;
            animation: hsstMsgIn 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes hsstMsgIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .hsst-msg-bot {
            background: #f1f5f9;
            color: #0f172a;
            border-bottom-left-radius: 4px;
            align-self: flex-start;
        }
        .hsst-msg-user {
            background: linear-gradient(135deg, #1a78e6, #132e54);
            color: #fff;
            border-bottom-right-radius: 4px;
            align-self: flex-end;
        }

        .hsst-typing {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 12px 14px;
            background: #f1f5f9;
            border-radius: 16px;
            border-bottom-left-radius: 4px;
            align-self: flex-start;
        }
        .hsst-typing span {
            width: 7px;
            height: 7px;
            background: #94a3b8;
            border-radius: 50%;
            animation: hsstDot 1.2s infinite;
        }
        .hsst-typing span:nth-child(2) { animation-delay: 0.2s; }
        .hsst-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes hsstDot {
            0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
            40%            { transform: scale(1);   opacity: 1; }
        }

        #hsst-quick-replies {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 0 16px 10px;
            flex-shrink: 0;
        }
        .hsst-qr {
            padding: 6px 12px;
            background: rgba(26,120,230,0.06);
            border: 1px solid rgba(26,120,230,0.2);
            border-radius: 999px;
            font-size: 0.78rem;
            color: #1a78e6;
            cursor: pointer;
            font-family: inherit;
            transition: background 0.2s, transform 0.15s;
            white-space: nowrap;
        }
        .hsst-qr:hover {
            background: rgba(26,120,230,0.12);
            transform: translateY(-1px);
        }

        #hsst-chat-form {
            display: flex;
            gap: 8px;
            padding: 12px 14px;
            border-top: 1px solid #f1f5f9;
            flex-shrink: 0;
        }
        #hsst-chat-input {
            flex: 1;
            padding: 9px 14px;
            border: 1.5px solid #e2e8f0;
            border-radius: 999px;
            font-size: 0.875rem;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            background: #fff;
            color: #0f172a;
        }
        #hsst-chat-input:focus {
            border-color: #1a78e6;
            box-shadow: 0 0 0 3px rgba(26,120,230,0.1);
        }
        #hsst-chat-send {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1a78e6, #132e54);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 2px 8px rgba(26,120,230,0.3);
        }
        #hsst-chat-send:hover {
            transform: scale(1.08);
            box-shadow: 0 4px 14px rgba(26,120,230,0.4);
        }
        #hsst-chat-send:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        #hsst-lead-success {
            background: linear-gradient(135deg, rgba(26,120,230,0.06), rgba(245,130,32,0.04));
            border: 1px solid rgba(26,120,230,0.2);
            border-radius: 12px;
            padding: 10px 14px;
            font-size: 0.8rem;
            color: #334155;
            margin: 0 16px 10px;
            text-align: center;
            display: none;
        }
        #hsst-lead-success.visible { display: block; }

        @media (max-width: 480px) {
            #hsst-chat-window {
                bottom: 0;
                right: 0;
                width: 100vw;
                max-width: 100vw;
                height: 100dvh;
                max-height: 100dvh;
                border-radius: 0;
            }
            #hsst-chat-btn {
                bottom: 16px;
                right: 16px;
            }
        }
    `;

    // ── Build DOM ────────────────────────────────────────────────
    function init() {
        // Inject CSS
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);

        // Floating button
        const btn = document.createElement('button');
        btn.id = 'hsst-chat-btn';
        btn.setAttribute('aria-label', 'Open chat');
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="white"/>
                <path d="M7 9H17M7 13H13" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span id="hsst-chat-badge"></span>
        `;

        // Chat window
        const win = document.createElement('div');
        win.id = 'hsst-chat-window';
        win.setAttribute('role', 'dialog');
        win.setAttribute('aria-label', 'HSST Chat Assistant');
        win.innerHTML = `
            <div id="hsst-chat-header">
                <div id="hsst-chat-avatar">💬</div>
                <div id="hsst-chat-header-info">
                    <strong>HSST Assistant</strong>
                    <span>Hinrichs Specialty Services &amp; Technology</span>
                </div>
                <button id="hsst-chat-close" aria-label="Close chat">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div id="hsst-chat-messages"></div>
            <div id="hsst-quick-replies"></div>
            <div id="hsst-lead-success">Your info has been saved — Brandon will be in touch soon!</div>
            <form id="hsst-chat-form" autocomplete="off">
                <input id="hsst-chat-input" type="text" placeholder="Type a message..." maxlength="400" autocomplete="off" />
                <button id="hsst-chat-send" type="submit" aria-label="Send">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </form>
        `;

        document.body.appendChild(btn);
        document.body.appendChild(win);

        // Event listeners
        btn.addEventListener('click', toggleChat);
        document.getElementById('hsst-chat-close').addEventListener('click', closeChat);
        document.getElementById('hsst-chat-form').addEventListener('submit', handleSubmit);
        document.getElementById('hsst-chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
            }
        });

        // Show badge after 4s to draw attention
        setTimeout(() => {
            const badge = document.getElementById('hsst-chat-badge');
            if (badge && !isOpen) badge.classList.add('visible');
        }, 4000);

        // Show welcome message and quick replies
        appendBotMessage(WELCOME_MESSAGE);
        renderQuickReplies(QUICK_REPLIES);
    }

    // ── Toggle / Open / Close ────────────────────────────────────
    function toggleChat() {
        isOpen ? closeChat() : openChat();
    }

    function openChat() {
        isOpen = true;
        document.getElementById('hsst-chat-window').classList.add('open');
        document.getElementById('hsst-chat-badge').classList.remove('visible');
        document.getElementById('hsst-chat-btn').setAttribute('aria-label', 'Close chat');
        setTimeout(() => document.getElementById('hsst-chat-input').focus(), 100);
    }

    function closeChat() {
        isOpen = false;
        document.getElementById('hsst-chat-window').classList.remove('open');
        document.getElementById('hsst-chat-btn').setAttribute('aria-label', 'Open chat');
    }

    // ── Message Rendering ────────────────────────────────────────
    function appendBotMessage(text) {
        const msgs = document.getElementById('hsst-chat-messages');
        const el = document.createElement('div');
        el.className = 'hsst-msg hsst-msg-bot';
        el.textContent = text;
        msgs.appendChild(el);
        scrollToBottom();
    }

    function appendUserMessage(text) {
        const msgs = document.getElementById('hsst-chat-messages');
        const el = document.createElement('div');
        el.className = 'hsst-msg hsst-msg-user';
        el.textContent = text;
        msgs.appendChild(el);
        scrollToBottom();
    }

    function showTyping() {
        const msgs = document.getElementById('hsst-chat-messages');
        const el = document.createElement('div');
        el.className = 'hsst-typing';
        el.id = 'hsst-typing-indicator';
        el.innerHTML = '<span></span><span></span><span></span>';
        msgs.appendChild(el);
        scrollToBottom();
    }

    function hideTyping() {
        const el = document.getElementById('hsst-typing-indicator');
        if (el) el.remove();
    }

    function scrollToBottom() {
        const msgs = document.getElementById('hsst-chat-messages');
        msgs.scrollTop = msgs.scrollHeight;
    }

    // ── Quick Replies ────────────────────────────────────────────
    function renderQuickReplies(replies) {
        const container = document.getElementById('hsst-quick-replies');
        container.innerHTML = '';
        replies.forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'hsst-qr';
            btn.textContent = text;
            btn.type = 'button';
            btn.addEventListener('click', () => {
                container.innerHTML = '';
                sendMessage(text);
            });
            container.appendChild(btn);
        });
    }

    // ── Send / Receive ───────────────────────────────────────────
    function handleSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('hsst-chat-input');
        const text = input.value.trim();
        if (!text || isTyping) return;
        input.value = '';
        document.getElementById('hsst-quick-replies').innerHTML = '';
        sendMessage(text);
    }

    async function sendMessage(userText) {
        if (isTyping) return;

        appendUserMessage(userText);
        messageHistory.push({ role: 'user', content: userText });

        isTyping = true;
        document.getElementById('hsst-chat-send').disabled = true;
        showTyping();

        try {
            const res = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messageHistory })
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                throw new Error(data.error || 'Request failed');
            }

            let reply = data.content || '';

            // Extract and process lead tag if present
            const leadMatch = reply.match(/\[LEAD:(\{[^}]+\})\]/);
            if (leadMatch) {
                reply = reply.replace(/\[LEAD:[^\]]+\]/, '').trim();
                try {
                    const leadData = JSON.parse(leadMatch[1]);
                    saveLead(leadData);
                } catch (parseErr) {
                    console.warn('Lead parse error:', parseErr);
                }
            }

            hideTyping();
            appendBotMessage(reply);
            messageHistory.push({ role: 'assistant', content: reply });

        } catch (err) {
            hideTyping();
            appendBotMessage("Sorry, I'm having trouble connecting. You can reach Brandon directly at (402) 759-2210 or bhinrichs1380@gmail.com.");
            console.error('Chatbot error:', err);
        } finally {
            isTyping = false;
            document.getElementById('hsst-chat-send').disabled = false;
        }
    }

    // ── Lead Capture ─────────────────────────────────────────────
    async function saveLead(lead) {
        if (pendingLead) return; // only save once per session
        pendingLead = lead;

        try {
            // Use existing Database helper if available (loaded via supabase-config.js)
            if (window.Database && typeof window.Database.saveContactSubmission === 'function') {
                const nameParts = (lead.name || '').trim().split(' ');
                await window.Database.saveContactSubmission({
                    firstName: nameParts[0] || lead.name,
                    lastName: nameParts.slice(1).join(' ') || '',
                    email: lead.email,
                    phone: '',
                    organization: '',
                    interest: lead.interest || 'Chatbot inquiry',
                    message: `Chatbot lead — Interest: ${lead.interest || 'general inquiry'}`,
                    newsletter: false,
                    privacy: true
                });
            }

            // Show success notice inside chat
            const notice = document.getElementById('hsst-lead-success');
            if (notice) notice.classList.add('visible');
        } catch (err) {
            console.error('Lead save error:', err);
        }
    }

    // ── Boot ─────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
