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

    // CRM Integration (HSS Business Platform)
    const CRM_FIREBASE_CONFIG = {
        apiKey: window.HSST_ENV?.CRM_FIREBASE_API_KEY || "",
        authDomain: window.HSST_ENV?.CRM_FIREBASE_AUTH_DOMAIN || "",
        projectId: window.HSST_ENV?.CRM_FIREBASE_PROJECT_ID || "",
        storageBucket: window.HSST_ENV?.CRM_FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: window.HSST_ENV?.CRM_FIREBASE_MESSAGING_SENDER_ID || "",
        appId: window.HSST_ENV?.CRM_FIREBASE_APP_ID || ""
    };

    // ── State ────────────────────────────────────────────────────
    let isOpen = false;
    let isTyping = false;
    let messageHistory = []; // { role: 'user'|'assistant', content: string }
    let pendingLead = null;

    // ── Inject Styles ────────────────────────────────────────────
    const styles = `
        /* ── Launch Button ── */
        #hsst-chat-btn {
            position: fixed;
            bottom: 28px;
            right: 28px;
            width: 58px;
            height: 58px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1a78e6 0%, #0f52a0 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 24px rgba(26,120,230,0.5), 0 1px 4px rgba(0,0,0,0.15);
            z-index: 9000;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
            outline: none;
        }
        #hsst-chat-btn:hover {
            transform: scale(1.1) translateY(-2px);
            box-shadow: 0 8px 32px rgba(26,120,230,0.6);
        }
        #hsst-chat-btn svg { pointer-events: none; }

        #hsst-chat-badge {
            position: absolute;
            top: -3px;
            right: -3px;
            width: 16px;
            height: 16px;
            background: #f58220;
            border-radius: 50%;
            border: 2.5px solid #fff;
            display: none;
        }
        #hsst-chat-badge.visible { display: block; animation: hsstPulse 2s ease-in-out infinite; }
        @keyframes hsstPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(245,130,32,0.4); }
            50% { box-shadow: 0 0 0 5px rgba(245,130,32,0); }
        }

        /* ── Chat Window ── */
        #hsst-chat-window {
            position: fixed;
            bottom: 100px;
            right: 28px;
            width: 375px;
            max-width: calc(100vw - 32px);
            height: 560px;
            max-height: calc(100vh - 120px);
            background: #f8fafc;
            border-radius: 20px;
            box-shadow: 0 32px 72px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06);
            z-index: 8999;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: translateY(16px) scale(0.96);
            opacity: 0;
            pointer-events: none;
            transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease;
        }
        #hsst-chat-window.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: all;
        }

        /* ── Header ── */
        #hsst-chat-header {
            background: #0f172a;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            gap: 11px;
            flex-shrink: 0;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        #hsst-chat-avatar-wrap {
            position: relative;
            flex-shrink: 0;
        }
        #hsst-chat-avatar {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: linear-gradient(135deg, #1a78e6 0%, #0f52a0 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(26,120,230,0.4);
        }
        #hsst-chat-status-dot {
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 11px;
            height: 11px;
            background: #22c55e;
            border-radius: 50%;
            border: 2px solid #0f172a;
        }
        #hsst-chat-header-info { flex: 1; min-width: 0; }
        #hsst-chat-header-info strong {
            display: block;
            color: #f8fafc;
            font-size: 0.9rem;
            font-weight: 600;
            letter-spacing: -0.01em;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #hsst-chat-header-info span {
            display: flex;
            align-items: center;
            gap: 4px;
            color: #22c55e;
            font-size: 0.72rem;
            font-weight: 500;
            margin-top: 1px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #hsst-chat-close {
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            width: 30px;
            height: 30px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, color 0.15s;
            flex-shrink: 0;
        }
        #hsst-chat-close:hover {
            background: rgba(255,255,255,0.14);
            color: #fff;
        }

        /* ── Message Area ── */
        #hsst-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px 16px 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            scroll-behavior: smooth;
            background: #f8fafc;
        }
        #hsst-chat-messages::-webkit-scrollbar { width: 3px; }
        #hsst-chat-messages::-webkit-scrollbar-track { background: transparent; }
        #hsst-chat-messages::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.1);
            border-radius: 4px;
        }

        /* ── Message Rows ── */
        .hsst-msg-row {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            animation: hsstMsgIn 0.28s cubic-bezier(0.16,1,0.3,1);
        }
        .hsst-msg-row-bot { justify-content: flex-start; }
        .hsst-msg-row-user { justify-content: flex-end; }

        @keyframes hsstMsgIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        .hsst-msg-avatar {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            background: linear-gradient(135deg, #1a78e6 0%, #0f52a0 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-bottom: 2px;
        }

        .hsst-msg {
            max-width: 78%;
            padding: 10px 14px;
            font-size: 0.875rem;
            line-height: 1.55;
            word-wrap: break-word;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .hsst-msg-bot {
            background: #ffffff;
            color: #1e293b;
            border-radius: 16px 16px 16px 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
        }
        .hsst-msg-user {
            background: linear-gradient(135deg, #1a78e6 0%, #0f52a0 100%);
            color: #fff;
            border-radius: 16px 16px 4px 16px;
            box-shadow: 0 2px 8px rgba(26,120,230,0.3);
        }
        .hsst-msg strong { font-weight: 600; }
        .hsst-msg-user strong { color: rgba(255,255,255,0.95); }
        .hsst-msg-bot strong { color: #0f172a; }

        /* spacer between consecutive same-side messages */
        .hsst-msg-row + .hsst-msg-row-bot { margin-top: 2px; }
        .hsst-msg-row + .hsst-msg-row-user { margin-top: 2px; }
        .hsst-msg-row-bot + .hsst-msg-row-user,
        .hsst-msg-row-user + .hsst-msg-row-bot { margin-top: 12px; }

        /* ── Typing Indicator ── */
        .hsst-typing-row {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            animation: hsstMsgIn 0.28s cubic-bezier(0.16,1,0.3,1);
            margin-top: 4px;
        }
        .hsst-typing {
            display: flex;
            gap: 5px;
            align-items: center;
            padding: 12px 16px;
            background: #ffffff;
            border-radius: 16px 16px 16px 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
        }
        .hsst-typing span {
            width: 7px;
            height: 7px;
            background: #94a3b8;
            border-radius: 50%;
            animation: hsstDot 1.4s ease-in-out infinite;
        }
        .hsst-typing span:nth-child(2) { animation-delay: 0.18s; }
        .hsst-typing span:nth-child(3) { animation-delay: 0.36s; }
        @keyframes hsstDot {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-5px); opacity: 1; }
        }

        /* ── Quick Replies ── */
        #hsst-quick-replies {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 8px 16px 10px;
            flex-shrink: 0;
            background: #f8fafc;
        }
        .hsst-qr {
            padding: 7px 13px;
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 999px;
            font-size: 0.8rem;
            font-weight: 500;
            color: #334155;
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            transition: border-color 0.15s, background 0.15s, transform 0.15s, color 0.15s;
            white-space: nowrap;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .hsst-qr:hover {
            border-color: #1a78e6;
            color: #1a78e6;
            background: rgba(26,120,230,0.04);
            transform: translateY(-1px);
        }

        /* ── Input Bar ── */
        #hsst-chat-form {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            background: #ffffff;
            border-top: 1px solid #e8eef4;
            flex-shrink: 0;
        }
        #hsst-chat-input {
            flex: 1;
            padding: 9px 14px;
            border: 1.5px solid #e2e8f0;
            border-radius: 12px;
            font-size: 0.875rem;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            background: #f8fafc;
            color: #0f172a;
            resize: none;
        }
        #hsst-chat-input::placeholder { color: #94a3b8; }
        #hsst-chat-input:focus {
            border-color: #1a78e6;
            background: #fff;
            box-shadow: 0 0 0 3px rgba(26,120,230,0.08);
        }
        #hsst-chat-send {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: linear-gradient(135deg, #1a78e6 0%, #0f52a0 100%);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
            box-shadow: 0 2px 8px rgba(26,120,230,0.35);
        }
        #hsst-chat-send:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(26,120,230,0.45);
        }
        #hsst-chat-send:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        /* ── Lead Success Banner ── */
        #hsst-lead-success {
            margin: 0 12px 8px;
            padding: 9px 13px;
            background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(26,120,230,0.06));
            border: 1px solid rgba(34,197,94,0.25);
            border-radius: 10px;
            font-size: 0.78rem;
            font-weight: 500;
            color: #166534;
            text-align: center;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #hsst-lead-success.visible { display: block; }

        /* ── Mobile ── */
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
                <div id="hsst-chat-avatar-wrap">
                    <div id="hsst-chat-avatar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="rgba(255,255,255,0.3)"/>
                            <path d="M9 9h2v6H9zm4 0h2v6h-2z" fill="white"/>
                            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none"/>
                            <path d="M8 12.5c0 2.21 1.79 4 4 4s4-1.79 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                            <circle cx="9.5" cy="10" r="1" fill="white"/>
                            <circle cx="14.5" cy="10" r="1" fill="white"/>
                        </svg>
                    </div>
                    <div id="hsst-chat-status-dot"></div>
                </div>
                <div id="hsst-chat-header-info">
                    <strong>HSST Assistant</strong>
                    <span>
                        <svg width="7" height="7" viewBox="0 0 8 8" fill="#22c55e"><circle cx="4" cy="4" r="4"/></svg>
                        Online now
                    </span>
                </div>
                <button id="hsst-chat-close" aria-label="Close chat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div id="hsst-chat-messages"></div>
            <div id="hsst-quick-replies"></div>
            <div id="hsst-lead-success">✓ Info saved — Brandon will be in touch soon!</div>
            <form id="hsst-chat-form" autocomplete="off">
                <input id="hsst-chat-input" type="text" placeholder="Ask a question..." maxlength="400" autocomplete="off" />
                <button id="hsst-chat-send" type="submit" aria-label="Send">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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

    // ── Markdown renderer (bold, line breaks, links) ─────────────
    function renderMarkdown(text) {
        return text
            // Escape HTML entities first
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            // Bold: **text**
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:4px;font-size:0.85em">$1</code>')
            // Line breaks
            .replace(/\n/g, '<br>');
    }

    // ── Message Rendering ────────────────────────────────────────
    const BOT_AVATAR_SVG = `
        <div class="hsst-msg-avatar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="9.5" cy="10" r="1.2" fill="white"/>
                <circle cx="14.5" cy="10" r="1.2" fill="white"/>
                <path d="M8.5 14.5c1 1.2 2.5 1.8 3.5 1.8s2.5-.6 3.5-1.8" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                <rect x="3" y="5" width="18" height="13" rx="4" stroke="white" stroke-width="1.5" fill="none"/>
            </svg>
        </div>`;

    function appendBotMessage(text) {
        const msgs = document.getElementById('hsst-chat-messages');
        const row = document.createElement('div');
        row.className = 'hsst-msg-row hsst-msg-row-bot';
        const bubble = document.createElement('div');
        bubble.className = 'hsst-msg hsst-msg-bot';
        bubble.innerHTML = renderMarkdown(text);
        row.innerHTML = BOT_AVATAR_SVG;
        row.appendChild(bubble);
        msgs.appendChild(row);
        scrollToBottom();
    }

    function appendUserMessage(text) {
        const msgs = document.getElementById('hsst-chat-messages');
        const row = document.createElement('div');
        row.className = 'hsst-msg-row hsst-msg-row-user';
        const bubble = document.createElement('div');
        bubble.className = 'hsst-msg hsst-msg-user';
        bubble.textContent = text;
        row.appendChild(bubble);
        msgs.appendChild(row);
        scrollToBottom();
    }

    function showTyping() {
        const msgs = document.getElementById('hsst-chat-messages');
        const row = document.createElement('div');
        row.className = 'hsst-typing-row';
        row.id = 'hsst-typing-indicator';
        row.innerHTML = BOT_AVATAR_SVG + '<div class="hsst-typing"><span></span><span></span><span></span></div>';
        msgs.appendChild(row);
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
            // 1. Save to Supabase (existing Database helper)
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

            // 2. Save to HSS CRM (Firebase Firestore)
            await saveToHSSCRM(lead);

            // Show success notice inside chat
            const notice = document.getElementById('hsst-lead-success');
            if (notice) notice.classList.add('visible');
        } catch (err) {
            console.error('Lead save error:', err);
        }
    }

    async function saveToHSSCRM(lead) {
        try {
            // Dynamically load Firebase if needed
            if (!window.firebase) {
                await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
                await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js');
            }

            if (!window.crmApp) {
                window.crmApp = window.firebase.initializeApp(CRM_FIREBASE_CONFIG, 'hss-crm');
                window.crmDb = window.firebase.firestore(window.crmApp);
            }

            const nameParts = (lead.name || '').trim().split(' ');
            
            await window.crmDb.collection('contacts').add({
                firstName: nameParts[0] || lead.name,
                lastName: nameParts.slice(1).join(' ') || 'User',
                email: (lead.email || '').toLowerCase(),
                phone: '',
                company: 'Website Chatbot',
                status: 'lead',
                interest: lead.interest || 'General Inquiry',
                notes: `Chatbot inquiry recorded from ${window.location.hostname}`,
                createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            });

            // Also log a response to trigger CRM dashboard counts
            await window.crmDb.collection('responses').add({
                surveyTitle: 'Chatbot Inquiry',
                submittedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                response: {
                    name: lead.name,
                    email: lead.email,
                    interest: lead.interest,
                    source: 'HSST Chatbot'
                }
            });

            console.log('Successfully synced lead with HSS CRM');
        } catch (err) {
            console.error('CRM Sync Error:', err);
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // ── Boot ─────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
