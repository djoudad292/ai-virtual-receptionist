(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var apiUrl = script.getAttribute('data-api-url') || 'https://ai-receptionist-backend-h14q.onrender.com';
  var wsUrl = script.getAttribute('data-ws-url') || 'https://ai-receptionist-backend-h14q.onrender.com';
  var companyId = script.getAttribute('data-company-id');
  var primaryColor = script.getAttribute('data-primary-color') || '#3b82f6';
  var position = script.getAttribute('data-position') || 'right';
  var title = script.getAttribute('data-title') || 'Customer Support';

  var socket = null;
  var conversationId = null;
  var messages = [];
  var isOpen = false;
  var isConnected = false;
  var unreadCount = 0;
  var typingTimer = null;
  var publishedDocs = [];

  var root;
  var bubble;
  var panel;
  var msgContainer;
  var inputEl;
  var sendBtn;
  var typingEl;
  var statusDot;
  var badgeEl;
  var connectionBanner;
  var docStrip;

  /* ---- voice (STT + TTS) ---- */
  var micBtn;
  var micSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  var recognition = null;
  var isListening = false;
  var speechSupported = typeof window.speechSynthesis !== 'undefined';
  var currentUtterance = null;
  var inputRowEl;
  var callBtn;
  var callScreen;
  var callStatusEl;
  var callMicEl;
  var callEndEl;
  var inCall = false;
  var voice = null;

  var SOCKET_CDN = 'https://cdn.socket.io/4.7.5/socket.io.min.js';

  /* ---- inject global styles ---- */
  function injectStyles() {
    var id = 'ai-widget-styles';
    if (document.getElementById(id)) return;
    var style = document.createElement('style');
    style.id = id;
    style.textContent = getCSS();
    document.head.appendChild(style);
  }

  function getCSS() {
    var p = primaryColor;
    var side = position === 'left' ? 'left' : 'right';
    var opp = position === 'left' ? 'right' : 'left';
    return [
      '#ai-widget-root * { box-sizing:border-box; margin:0; padding:0; }',
      '#ai-widget-root { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,sans-serif; }',
      '#ai-widget-root .ai-bubble {',
      '  position:fixed; bottom:24px; ' + side + ':24px; z-index:999999;',
      '  width:60px; height:60px; border-radius:50%;',
      '  background:' + p + '; border:none; cursor:pointer;',
      '  display:flex; align-items:center; justify-content:center;',
      '  box-shadow:0 4px 20px rgba(0,0,0,.2);',
      '  transition:transform .2s, box-shadow .2s;',
      '}',
      '#ai-widget-root .ai-bubble:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(0,0,0,.28); }',
      '#ai-widget-root .ai-bubble svg { width:28px; height:28px; fill:#fff; }',
      '#ai-widget-root .ai-badge {',
      '  position:absolute; top:-4px; ' + opp + ':-4px;',
      '  background:#ef4444; color:#fff; font-size:11px; font-weight:700;',
      '  min-width:20px; height:20px; border-radius:10px;',
      '  display:flex; align-items:center; justify-content:center;',
      '  padding:0 5px; box-shadow:0 2px 6px rgba(0,0,0,.2);',
      '  display:none;',
      '}',
      '#ai-widget-root .ai-badge.show { display:flex; }',
      '@keyframes ai-pulse { 0%,100%{box-shadow:0 0 0 0 ' + p + '88} 50%{box-shadow:0 0 0 12px ' + p + '00} }',
      '#ai-widget-root .ai-bubble.pulse { animation:ai-pulse 1.5s infinite; }',
      '#ai-widget-root .ai-panel {',
      '  position:fixed; bottom:96px; ' + side + ':24px; z-index:999998;',
      '  width:380px; max-width:calc(100vw - 48px); height:580px; max-height:calc(100vh - 140px);',
      '  background:#fff; border-radius:16px; overflow:hidden;',
      '  display:flex; flex-direction:column;',
      '  box-shadow:0 8px 40px rgba(0,0,0,.18);',
      '  transform:translateY(20px) scale(.96); opacity:0; pointer-events:none;',
      '  transition:transform .25s, opacity .2s;',
      '}',
      '#ai-widget-root .ai-panel.open { transform:translateY(0) scale(1); opacity:1; pointer-events:auto; }',
      '#ai-widget-root .ai-header {',
      '  display:flex; align-items:center; gap:10px; padding:16px 18px;',
      '  background:' + p + '; color:#fff; flex-shrink:0;',
      '}',
      '#ai-widget-root .ai-header h3 { flex:1; font-size:16px; font-weight:600; }',
      '#ai-widget-root .ai-status { display:flex; align-items:center; gap:6px; font-size:12px; }',
      '#ai-widget-root .ai-status-dot { width:8px; height:8px; border-radius:50%; background:#ccc; }',
      '#ai-widget-root .ai-status-dot.online { background:#22c55e; }',
      '#ai-widget-root .ai-minimize { background:rgba(255,255,255,.2); border:none; color:#fff; width:28px; height:28px; border-radius:6px; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; transition:background .15s; }',
      '#ai-widget-root .ai-minimize:hover { background:rgba(255,255,255,.35); }',
      '#ai-widget-root .ai-connection-banner {',
      '  font-size:12px; text-align:center; padding:6px; flex-shrink:0; display:none;',
      '}',
      '#ai-widget-root .ai-connection-banner.show { display:block; }',
      '#ai-widget-root .ai-connection-banner.lost { background:#fee2e2; color:#b91c1c; }',
      '#ai-widget-root .ai-connection-banner.reconnect { background:#fef3c7; color:#92400e; }',
      '#ai-widget-root .ai-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; background:#f8fafc; }',
      '#ai-widget-root .ai-docstrip { flex-shrink:0; background:#fff; border-bottom:1px solid #e2e8f0; padding:10px 16px; display:flex; gap:8px; flex-wrap:wrap; }',
      '#ai-widget-root .ai-docstrip-empty { font-size:12px; color:#94a3b8; padding:2px 0; }',
      '#ai-widget-root .ai-docchip {',
      '  border:1px solid #e2e8f0; background:#f8fafc; color:#475569;',
      '  font-size:12px; font-weight:600; border-radius:999px; padding:5px 11px;',
      '  cursor:pointer; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;',
      '  transition:background .15s, border-color .15s;',
      '}',
      '#ai-widget-root .ai-docchip:hover { background:' + p + '14; border-color:' + p + '66; color:#1e293b; }',
      '#ai-widget-root .ai-msg { max-width:82%; padding:10px 14px; border-radius:14px; font-size:14px; line-height:1.45; word-wrap:break-word; animation:fadeIn .2s; }',
      '#ai-widget-root .ai-msg.user { align-self:flex-end; background:' + p + '; color:#fff; border-bottom-' + opp + '-radius:4px; }',
      '#ai-widget-root .ai-msg.bot { align-self:flex-start; background:#e2e8f0; color:#1e293b; border-bottom-' + side + '-radius:4px; }',
      '#ai-widget-root .ai-msg .ai-sender { font-size:11px; opacity:.7; margin-bottom:3px; }',
      '#ai-widget-root .ai-msg .ai-time { font-size:10px; opacity:.6; margin-top:4px; text-align:' + opp + '; }',
      '#ai-widget-root .ai-sources { margin-top:6px; border-top:1px solid rgba(0,0,0,.08); padding-top:4px; }',
      '#ai-widget-root .ai-sources summary { cursor:pointer; font-size:11px; color:#64748b; user-select:none; outline:none; }',
      '#ai-widget-root .ai-sources ul { list-style:none; margin:4px 0 0; padding:0; }',
      '#ai-widget-root .ai-sources li { font-size:11px; color:#475569; padding:2px 0; word-break:break-word; }',
      '#ai-widget-root .ai-typing { align-self:flex-start; display:flex; gap:4px; padding:12px 16px; background:#e2e8f0; border-radius:14px; border-bottom-' + side + '-radius:4px; display:none; }',
      '#ai-widget-root .ai-typing.show { display:flex; }',
      '#ai-widget-root .ai-typing span { width:7px; height:7px; border-radius:50%; background:#94a3b8; animation:ai-bounce 1.4s infinite; }',
      '#ai-widget-root .ai-typing span:nth-child(2) { animation-delay:.2s; }',
      '#ai-widget-root .ai-typing span:nth-child(3) { animation-delay:.4s; }',
      '@keyframes ai-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }',
      '@keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }',
      '#ai-widget-root .ai-msg.system { align-self:center; background:transparent; color:#64748b; font-size:12px; max-width:100%; text-align:center; }',
      '#ai-widget-root .ai-footer { text-align:center; font-size:10px; color:#94a3b8; padding:6px 16px; border-top:1px solid #e2e8f0; background:#fff; flex-shrink:0; }',
      '#ai-widget-root .ai-footer a { color:#3b82f6; text-decoration:none; }',
      '#ai-widget-root .ai-footer a:hover { text-decoration:underline; }',
      '#ai-widget-root .ai-input-row { display:flex; gap:8px; padding:12px 16px; background:#fff; flex-shrink:0; }',
      '#ai-widget-root .ai-input-row input { flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; font-size:14px; outline:none; transition:border .15s; }',
      '#ai-widget-root .ai-input-row input:focus { border-color:' + p + '; }',
      '#ai-widget-root .ai-input-row input:disabled { background:#f1f5f9; }',
      '#ai-widget-root .ai-input-row button {',
      '  background:' + p + '; border:none; color:#fff; width:42px; height:42px; border-radius:10px;',
      '  cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;',
      '  transition:opacity .15s;',
      '}',
      '#ai-widget-root .ai-input-row button:disabled { opacity:.5; cursor:default; }',
      '#ai-widget-root .ai-input-row button svg { width:18px; height:18px; fill:#fff; }',
      '#ai-widget-root .ai-input-row button.ai-mic-btn {',
      '  background:transparent; color:#6b7280; border-radius:50%;',
      '  transition:background .15s, color .15s;',
      '}',
      '#ai-widget-root .ai-input-row button.ai-mic-btn:hover { background:#f3f4f6; color:' + p + '; }',
      '#ai-widget-root .ai-input-row button.ai-mic-btn.listening { background:' + p + '; color:#fff; animation:ai-pulse 1.2s infinite; }',
      '#ai-widget-root .ai-input-row button.ai-mic-btn svg { fill:currentColor; }',
      '#ai-widget-root .ai-speak-btn {',
      '  display:inline-flex; align-items:center; justify-content:center;',
      '  width:24px; height:24px; border:none; border-radius:50%;',
      '  background:transparent; color:#9ca3af; cursor:pointer;',
      '  margin-left:8px; vertical-align:middle;',
      '  transition:background .15s, color .15s;',
      '}',
      '#ai-widget-root .ai-speak-btn:hover { background:#f3f4f6; color:' + p + '; }',
      '#ai-widget-root .ai-speak-btn.speaking { background:' + p + '; color:#fff; animation:ai-pulse 1s infinite; }',
      '#ai-widget-root .ai-speak-btn svg { width:14px; height:14px; fill:currentColor; }',
      '#ai-widget-root .ai-call-btn { background:rgba(255,255,255,.2); border:none; color:#fff; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; }',
      '#ai-widget-root .ai-call-btn:hover { background:rgba(255,255,255,.35); }',
      '#ai-widget-root .ai-call-btn svg { width:15px; height:15px; fill:currentColor; }',
      '#ai-widget-root .ai-callscreen { position:absolute; inset:0; z-index:30; display:none; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:linear-gradient(160deg,#0f172a,#1e293b); color:#fff; border-radius:16px; padding:24px; text-align:center; }',
      '#ai-widget-root .ai-callscreen.open { display:flex; }',
      '#ai-widget-root .ai-call-avatar { width:84px; height:84px; border-radius:50%; background:' + p + '; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 0 ' + p + '88; animation:ai-ring 1.6s infinite; }',
      '#ai-widget-root .ai-call-avatar svg { width:40px; height:40px; fill:#fff; }',
      '#ai-widget-root .ai-call-title { font-size:17px; font-weight:600; }',
      '#ai-widget-root .ai-call-status { font-size:13px; opacity:.75; min-height:18px; }',
      '#ai-widget-root .ai-call-controls { display:flex; gap:22px; align-items:center; margin-top:8px; }',
      '#ai-widget-root .ai-call-mic { width:64px; height:64px; border-radius:50%; border:none; background:rgba(255,255,255,.14); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; }',
      '#ai-widget-root .ai-call-mic svg { width:28px; height:28px; fill:currentColor; }',
      '#ai-widget-root .ai-call-mic.active { background:' + p + '; animation:ai-ring 1.4s infinite; }',
      '#ai-widget-root .ai-call-end { width:60px; height:60px; border-radius:50%; border:none; background:#ef4444; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; }',
      '#ai-widget-root .ai-call-end svg { width:24px; height:24px; fill:currentColor; }',
      '@keyframes ai-ring { 0%{box-shadow:0 0 0 0 ' + p + '66} 70%{box-shadow:0 0 0 22px ' + p + '00} 100%{box-shadow:0 0 0 0 ' + p + '00} }',
      '@media (max-width:480px) { #ai-widget-root .ai-callscreen { border-radius:16px; } }',
      '@media (max-width:480px) {',
      '  #ai-widget-root .ai-panel {',
      '    ' + side + ':0; bottom:0; top:auto;',
      '    width:100vw; max-width:100vw;',
      '    max-height:none; height:100vh; height:100dvh;',
      '    border-radius:16px 16px 0 0;',
      '    transform:translateY(100%); opacity:1;',
      '    transition:transform .28s ease;',
      '    padding-bottom:env(safe-area-inset-bottom);',
      '  }',
      '  #ai-widget-root .ai-panel.open {',
      '    transform:translateY(0) scale(1);',
      '  }',
      '  #ai-widget-root .ai-header { padding:14px 16px calc(14px + env(safe-area-inset-top)); }',
      '  #ai-widget-root .ai-header h3 { font-size:17px; }',
      '  #ai-widget-root .ai-minimize { width:32px; height:32px; }',
      '  #ai-widget-root .ai-messages { padding:12px; gap:12px; padding-bottom:20px; }',
      '  #ai-widget-root .ai-msg { max-width:88%; font-size:15px; padding:11px 15px; }',
      '  #ai-widget-root .ai-typing { padding:13px 17px; }',
      '  #ai-widget-root .ai-input-row { padding:12px 14px calc(12px + env(safe-area-inset-bottom)); gap:10px; }',
      '  #ai-widget-root .ai-input-row input { font-size:16px; padding:12px 16px; border-radius:22px; }',
      '  #ai-widget-root .ai-input-row button { width:46px; height:46px; border-radius:50%; }',
      '  #ai-widget-root .ai-bubble { bottom:16px; ' + side + ':16px; width:56px; height:56px; }',
      '  #ai-widget-root .ai-bubble svg { width:26px; height:26px; }',
      '  #ai-widget-root .ai-footer { padding:8px 16px calc(8px + env(safe-area-inset-bottom)); font-size:10px; }',
      '}',
      '/* keep background from scrolling when the mobile sheet is open */',
      '@media (max-width:480px) {',
      '  html.ai-widget-lock, html.ai-widget-lock body { overflow:hidden; height:100%; }',
      '}',
    ].join('\n');
  }

  /* ---- DOM creation ---- */
  function createDOM() {
    root = document.createElement('div');
    root.id = 'ai-widget-root';

    /* bubble */
    bubble = document.createElement('button');
    bubble.className = 'ai-bubble';
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7z"/></svg>';
    badgeEl = document.createElement('span');
    badgeEl.className = 'ai-badge';
    bubble.appendChild(badgeEl);
    root.appendChild(bubble);

    /* panel */
    panel = document.createElement('div');
    panel.className = 'ai-panel';

    /* header */
    var hdr = document.createElement('div');
    hdr.className = 'ai-header';
    var h3 = document.createElement('h3');
    h3.textContent = title;
    var st = document.createElement('div');
    st.className = 'ai-status';
    statusDot = document.createElement('span');
    statusDot.className = 'ai-status-dot';
    var stTxt = document.createElement('span');
    stTxt.className = 'ai-status-txt';
    stTxt.textContent = 'Connecting…';
    st.appendChild(statusDot);
    st.appendChild(stTxt);
    var mini = document.createElement('button');
    mini.className = 'ai-minimize';
    mini.setAttribute('aria-label', 'Minimize');
    mini.textContent = '−';
    mini.addEventListener('click', toggle);
    callBtn = document.createElement('button');
    callBtn.className = 'ai-call-btn';
    callBtn.setAttribute('aria-label', 'Voice call');
    callBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.21 2.2z"/></svg>';
    callBtn.addEventListener('click', toggleCall);
    hdr.appendChild(h3);
    hdr.appendChild(st);
    hdr.appendChild(callBtn);
    hdr.appendChild(mini);
    panel.appendChild(hdr);

    /* connection banner */
    connectionBanner = document.createElement('div');
    connectionBanner.className = 'ai-connection-banner';
    panel.appendChild(connectionBanner);

    /* published documents strip */
    docStrip = document.createElement('div');
    docStrip.className = 'ai-docstrip';
    docStrip.style.display = 'none';
    panel.appendChild(docStrip);

    /* messages */
    msgContainer = document.createElement('div');
    msgContainer.className = 'ai-messages';
    panel.appendChild(msgContainer);

    /* typing indicator */
    typingEl = document.createElement('div');
    typingEl.className = 'ai-typing';
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement('span');
      typingEl.appendChild(dot);
    }
    msgContainer.appendChild(typingEl);

    /* footer */
    var footer = document.createElement('div');
    footer.className = 'ai-footer';
    footer.innerHTML = 'Demo by <a href="https://djaouad.tech" target="_blank">djaouad.tech</a> &mdash; Developer <a href="https://djaouad.tech" target="_blank" style="font-weight:600">djaouad frih</a>';
    panel.appendChild(footer);

    /* input */
    var row = document.createElement('div');
    row.className = 'ai-input-row';
    inputRowEl = row;
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'Type a message…';
    inputEl.disabled = true;
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    sendBtn = document.createElement('button');
    sendBtn.disabled = true;
    sendBtn.setAttribute('aria-label', 'Send');
    sendBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    sendBtn.addEventListener('click', sendMessage);
    row.appendChild(inputEl);
    row.appendChild(sendBtn);
    if (micSupported) {
      micBtn = document.createElement('button');
      micBtn.type = 'button';
      micBtn.className = 'ai-mic-btn';
      micBtn.setAttribute('aria-label', 'Speak');
      micBtn.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';
      micBtn.addEventListener('click', toggleVoiceInput);
      row.insertBefore(micBtn, sendBtn);
    }
    panel.appendChild(row);

    /* voice call screen */
    callScreen = document.createElement('div');
    callScreen.className = 'ai-callscreen';
    var av = document.createElement('div');
    av.className = 'ai-call-avatar';
    av.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';
    var ct = document.createElement('div');
    ct.className = 'ai-call-title';
    ct.textContent = title;
    callStatusEl = document.createElement('div');
    callStatusEl.className = 'ai-call-status';
    callStatusEl.textContent = 'Starting…';
    var cc = document.createElement('div');
    cc.className = 'ai-call-controls';
    callMicEl = document.createElement('button');
    callMicEl.className = 'ai-call-mic';
    callMicEl.setAttribute('aria-label', 'Toggle microphone');
    callMicEl.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';
    callMicEl.addEventListener('click', function () {
      if (isListening) {
        stopVoiceInput();
        setCallStatus('Mic paused — tap mic to resume');
        callMicEl.classList.remove('active');
      } else {
        startRecognition();
      }
    });
    callEndEl = document.createElement('button');
    callEndEl.className = 'ai-call-end';
    callEndEl.setAttribute('aria-label', 'End call');
    callEndEl.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.38.39 1.04 0 1.42l-2.48 2.48a.996.996 0 0 1-1.41 0c-.79-.73-1.68-1.36-2.66-1.85a.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>';
    callEndEl.addEventListener('click', endCall);
    cc.appendChild(callMicEl);
    cc.appendChild(callEndEl);
    callScreen.appendChild(av);
    callScreen.appendChild(ct);
    callScreen.appendChild(callStatusEl);
    callScreen.appendChild(cc);
    panel.appendChild(callScreen);

    root.appendChild(panel);
    document.body.appendChild(root);

    bubble.addEventListener('click', toggle);
  }

  /* ---- helpers ---- */
  function toggle() {
    isOpen ? close() : open();
  }

  function isMobile() {
    return window.matchMedia('(max-width:480px)').matches;
  }

  function lockScroll(lock) {
    if (!isMobile()) return;
    document.documentElement.classList.toggle('ai-widget-lock', lock);
  }

  function open() {
    isOpen = true;
    panel.classList.add('open');
    unreadCount = 0;
    badgeEl.classList.remove('show');
    bubble.classList.remove('pulse');
    lockScroll(true);
    scrollBottom();
    inputEl.focus();
  }

  function close() {
    isOpen = false;
    panel.classList.remove('open');
    lockScroll(false);
    if (inCall) endCall();
    stopVoiceInput();
    stopSpeak();
  }

  function scrollBottom() {
    requestAnimationFrame(function () {
      msgContainer.scrollTop = msgContainer.scrollHeight;
    });
  }

  function timeStr() {
    var d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }

  function addMessage(msg) {
    var div = document.createElement('div');
    div.className = 'ai-msg ' + (msg.senderType === 'user' ? 'user' : 'bot');
    if (msg.senderType === 'system') {
      div.className = 'ai-msg system';
    }
    div.textContent = msg.content;
    if (msg.senderType === 'user') {
      var t = document.createElement('div');
      t.className = 'ai-time';
      t.textContent = msg.timestamp || timeStr();
      div.appendChild(t);
    } else if (msg.senderType === 'bot') {
      var s = document.createElement('div');
      s.className = 'ai-sender';
      s.textContent = 'AI Assistant';
      var t2 = document.createElement('div');
      t2.className = 'ai-time';
      t2.textContent = msg.timestamp || timeStr();
      div.insertBefore(s, div.firstChild);
      div.appendChild(t2);
      if (speechSupported && msg.content) {
        var speakBtn = document.createElement('button');
        speakBtn.type = 'button';
        speakBtn.className = 'ai-speak-btn';
        speakBtn.setAttribute('aria-label', 'Read aloud');
        speakBtn.innerHTML =
          '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
        speakBtn.addEventListener('click', function () {
          toggleSpeak(msg.content, speakBtn);
        });
        div.insertBefore(speakBtn, t2);
      }
      if (Array.isArray(msg.sources) && msg.sources.length) {
        div.appendChild(buildSources(msg.sources));
      }
    }
    msgContainer.insertBefore(div, typingEl);
    scrollBottom();
  }

  function buildSources(sources) {
    var details = document.createElement('details');
    details.className = 'ai-sources';
    var summary = document.createElement('summary');
    summary.textContent = 'Sources';
    details.appendChild(summary);
    var ul = document.createElement('ul');
    var seen = {};
    sources.forEach(function (src) {
      var title = (src.documentTitle || '').trim();
      var text = (src.chunkText || '').trim();
      var label = title || (text.length > 60 ? text.slice(0, 57) + '…' : text);
      if (!label || seen[label]) return;
      seen[label] = true;
      var li = document.createElement('li');
      li.textContent = '• ' + label;
      ul.appendChild(li);
    });
    if (ul.childNodes.length === 0) return null;
    details.appendChild(ul);
    return details;
  }

  function showTyping(show) {
    typingEl.classList.toggle('show', show);
    scrollBottom();
  }

  function setConnected(connected) {
    isConnected = connected;
    statusDot.classList.toggle('online', connected);
    var txt = panel.querySelector('.ai-status-txt');
    txt.textContent = connected ? 'Online' : 'Offline';
    inputEl.disabled = !connected;
    sendBtn.disabled = !connected;
  }

  function showBanner(msg, type) {
    connectionBanner.textContent = msg;
    connectionBanner.className = 'ai-connection-banner show ' + type;
  }

  function hideBanner() {
    connectionBanner.className = 'ai-connection-banner';
  }

  function notify(msg) {
    var div = document.createElement('div');
    div.className = 'ai-msg system';
    div.textContent = msg;
    msgContainer.insertBefore(div, typingEl);
    scrollBottom();
  }

  /* ---- published documents strip ---- */
  function renderDocStrip() {
    if (!docStrip) return;
    docStrip.textContent = '';
    if (publishedDocs.length === 0) {
      var empty = document.createElement('span');
      empty.className = 'ai-docstrip-empty';
      empty.textContent = 'No documents published yet.';
      docStrip.appendChild(empty);
      docStrip.style.display = 'flex';
      return;
    }
    docStrip.style.display = 'flex';
    publishedDocs.forEach(function (doc) {
      var chip = document.createElement('button');
      chip.className = 'ai-docchip';
      chip.textContent = doc.title;
      chip.title = 'Ask about ' + doc.title;
      chip.addEventListener('click', function () {
        inputEl.value = 'Tell me about ' + doc.title;
        inputEl.focus();
      });
      docStrip.appendChild(chip);
    });
  }

  /* ---- socket.io loader ---- */
  function loadSocketIO(cb) {
    if (typeof io !== 'undefined') return cb();
    var el = document.createElement('script');
    el.src = SOCKET_CDN;
    el.async = true;
    el.onload = cb;
    el.onerror = function () {
      showBanner('Failed to load chat. Please refresh.', 'lost');
    };
    document.head.appendChild(el);
  }
  /* ---- WebSocket ---- */
  function connect() {
    loadSocketIO(function () {
      warmUp(function () {
        if (socket) {
          socket.disconnect();
        }
        socket = io(wsUrl, {
          transports: ['websocket', 'polling'],
          timeout: 30000,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
        });

        socket.on('connect', function () {
          hideBanner();
          setConnected(true);
          socket.emit('joinConversation', { conversationId: conversationId, companyId: companyId });
        });

        socket.on('disconnect', function () {
          setConnected(false);
          showBanner('Reconnecting…', 'reconnect');
        });

        socket.on('newMessage', function (data) {
          var content = typeof data.content === 'string' ? data.content : '';
          var msg = {
            content: content,
            senderType: data.senderType || 'assistant',
            timestamp: data.timestamp || timeStr(),
          };
          messages.push(msg);
          addMessage(msg);
          if (!isOpen) {
            unreadCount++;
            badgeEl.textContent = unreadCount;
            badgeEl.classList.add('show');
            bubble.classList.add('pulse');
          }
        });

        socket.on('aiThinking', function (data) {
          showTyping(!!data.isThinking);
        });

        socket.on('aiResponse', function (data) {
          showTyping(false);
          var content = '';
          if (typeof data.content === 'string') content = data.content;
          else if (data.message && typeof data.message.content === 'string') content = data.message.content;
          else if (typeof data.message === 'string') content = data.message;
          var sources = Array.isArray(data.sources) ? data.sources : [];
          var msg = {
            content: content,
            senderType: 'bot',
            timestamp: data.timestamp || timeStr(),
            sources: sources,
          };
          messages.push(msg);
          addMessage(msg);
          if (inCall && content) callSpeak(content);
          if (data.appointment && data.appointment.date) {
            notify('Appointment requested: ' + (data.appointment.date || '') + (data.appointment.time ? ' at ' + data.appointment.time : '') + '. We will confirm shortly.');
          } else if (data.lead && (data.lead.email || data.lead.phone)) {
            notify('Thank you! Your details have been saved. A team member will get back to you soon.');
          }
          if (data.department) {
            notify('This conversation has been routed to our ' + data.department + ' team.');
          }
        });

        socket.on('typing', function (data) {
          showTyping(data.isTyping || data.typing || false);
        });

        socket.on('agentJoin', function (data) {
          notify('An agent has joined the conversation.');
        });

        socket.on('takeover', function (data) {
          notify('An agent has taken over the conversation.');
        });

        socket.on('connect_error', function (err) {
          setConnected(false);
          showBanner('Reconnecting…', 'reconnect');
        });
      });
    });
  }

  /* ---- REST helpers ---- */
  function createConversation(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl + '/conversations', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        var data = JSON.parse(xhr.responseText);
        conversationId = data.id || data.conversationId;
        if (cb) cb(null, conversationId);
      } else {
        if (cb) cb(new Error('Failed to create conversation'));
      }
    };
    xhr.onerror = function () {
      if (cb) cb(new Error('Network error'));
    };
    xhr.send(JSON.stringify({ companyId: companyId }));
  }

  /* ---- warm-up: wakes a sleeping backend before the socket connects ---- */
  var wakingUp = false;

  function warmUp(cb) {
    wakingUp = true;
    setConnected(false);
    var txt = panel.querySelector('.ai-status-txt');
    txt.textContent = 'Waking up…';
    showBanner('Waking up the assistant…', 'reconnect');

    var xhr = new XMLHttpRequest();
    xhr.timeout = 90000;
    xhr.open('GET', apiUrl + '/api/health', true);
    xhr.onload = function () {
      wakingUp = false;
      if (cb) cb();
    };
    xhr.onerror = function () {
      wakingUp = false;
      if (cb) cb();
    };
    xhr.ontimeout = function () {
      wakingUp = false;
      if (cb) cb();
    };
    xhr.send();
  }

  /* ---- send message ---- */
  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || !isConnected || !socket) return;
    inputEl.value = '';

    if (!conversationId) {
      inputEl.disabled = true;
      sendBtn.disabled = true;
      createConversation(function (err, id) {
        inputEl.disabled = !isConnected;
        sendBtn.disabled = !isConnected;
        if (err) {
          addMessage({ content: 'Could not connect to server. Please try again.', senderType: 'system' });
          return;
        }
        conversationId = id;
        socket.emit('joinConversation', { conversationId: conversationId, companyId: companyId });
        doSend(text);
      });
      return;
    }

    doSend(text);
  }

  function doSend(text) {
    var msg = { content: text, senderType: 'user', timestamp: timeStr() };
    messages.push(msg);
    addMessage(msg);
    showTyping(true);
    socket.emit('sendMessage', { conversationId: conversationId, content: text, senderType: 'user', companyId: companyId });
    scrollBottom();
  }

  /* ---- voice input (speech-to-text) ---- */
  function createRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var r = new SR();
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = function (e) {
      var last = e.results[e.results.length - 1];
      inputEl.value = last[0].transcript;
      scrollBottom();
      if (last.isFinal) {
        var text = inputEl.value.trim();
        stopVoiceInput();
        if (inCall) {
          callMicEl.classList.remove('active');
          setCallStatus('Thinking…');
        }
        if (text && isConnected && socket) sendMessage();
      }
    };
    r.onerror = function (e) {
      stopVoiceInput();
      if (inCall) {
        if (e.error === 'no-speech') {
          setTimeout(function () { if (inCall) startRecognition(); }, 350);
        } else if (e.error !== 'aborted') {
          callMicEl.classList.remove('active');
          setCallStatus('Mic error — tap mic to retry');
          notify('Voice input error: ' + e.error);
        }
        return;
      }
      if (e.error && e.error !== 'aborted' && e.error !== 'no-speech') {
        notify('Voice input error: ' + e.error);
      }
    };
    r.onend = function () {
      stopVoiceInput();
    };
    return r;
  }

  function toggleVoiceInput() {
    if (!micSupported) {
      notify('Voice input is not supported in this browser.');
      return;
    }
    if (isListening) {
      stopVoiceInput();
      return;
    }
    stopSpeak();
    recognition = recognition || createRecognition();
    if (!recognition) return;
    isListening = true;
    micBtn.classList.add('listening');
    inputEl.placeholder = 'Listening…';
    try { recognition.start(); } catch (e) {}
  }

  function stopVoiceInput() {
    isListening = false;
    if (micBtn) micBtn.classList.remove('listening');
    if (inputEl) inputEl.placeholder = 'Type a message…';
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
  }

  /* ---- voice output (text-to-speech) ---- */
  function stopSpeak() {
    if (currentUtterance) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
      currentUtterance = null;
    }
    syncSpeakButtons();
  }

  function syncSpeakButtons() {
    if (!root) return;
    var btns = root.querySelectorAll('.ai-speak-btn.speaking');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('speaking');
  }

  function toggleSpeak(text, btn) {
    if (!speechSupported || !text) return;
    var isSpeaking = currentUtterance && currentUtterance._speakBtn === btn;
    if (isSpeaking) {
      stopSpeak();
      return;
    }
    if (currentUtterance) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
      currentUtterance = null;
    }
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    u._speakBtn = btn;
    u.onend = function () {
      currentUtterance = null;
      btn.classList.remove('speaking');
    };
    u.onerror = function () {
      currentUtterance = null;
      btn.classList.remove('speaking');
    };
    currentUtterance = u;
    btn.classList.add('speaking');
    try { window.speechSynthesis.speak(u); } catch (e) { btn.classList.remove('speaking'); }
  }

  /* ---- voice call mode (Gemini/ChatGPT-style hands-free) ---- */
  function setCallStatus(txt) { if (callStatusEl) callStatusEl.textContent = txt; }

  function pickVoice() {
    if (voice) return voice;
    try {
      var vs = window.speechSynthesis.getVoices();
      for (var i = 0; i < vs.length; i++) {
        if ((vs[i].lang || '').toLowerCase().indexOf('en') === 0) { voice = vs[i]; break; }
      }
      if (!voice && vs.length) voice = vs[0];
    } catch (e) {}
    return voice;
  }
  if (speechSupported) {
    try { window.speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {}
    try { pickVoice(); } catch (e) {}
  }

  function toggleCall() {
    if (inCall) endCall();
    else startCall();
  }

  function startCall() {
    if (inCall) return;
    if (!micSupported) { notify('Voice call is not supported in this browser.'); return; }
    if (!isConnected || !socket) { notify('Please wait, still connecting…'); return; }
    inCall = true;
    if (inputRowEl) inputRowEl.style.display = 'none';
    callScreen.classList.add('open');
    setCallStatus('Starting…');
    var greeting = 'Hello! I am ' + title + '. How can I help you?';
    addMessage({ content: greeting, senderType: 'bot', timestamp: timeStr() });
    callSpeak(greeting);
  }

  function endCall() {
    if (!inCall) return;
    inCall = false;
    stopVoiceInput();
    stopSpeak();
    callScreen.classList.remove('open');
    if (inputRowEl) inputRowEl.style.display = '';
    if (callMicEl) callMicEl.classList.remove('active');
    setCallStatus('');
  }

  function startRecognition() {
    if (!micSupported || !inCall || isListening) return;
    stopSpeak();
    recognition = recognition || createRecognition();
    if (!recognition) return;
    isListening = true;
    if (callMicEl) callMicEl.classList.add('active');
    setCallStatus('Listening — speak now');
    try { recognition.start(); } catch (e) {}
  }

  function callSpeak(text) {
    if (!speechSupported || !text) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    if (callMicEl) callMicEl.classList.remove('active');
    setCallStatus('AI is speaking…');
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    u.voice = pickVoice();
    u.onend = function () {
      if (inCall) setTimeout(function () { if (inCall) startRecognition(); }, 250);
    };
    u.onerror = function () {
      if (inCall) setTimeout(function () { if (inCall) startRecognition(); }, 250);
    };
    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(u);
    } catch (e) {
      if (inCall) startRecognition();
    }
  }

  /* ---- init ---- */
  function fetchConfig(cb) {
    var xhr = new XMLHttpRequest();
    xhr.timeout = 20000;
    xhr.open('GET', apiUrl + '/widget/' + companyId + '/config', true);
    xhr.onload = function () {
      try {
        var cfg = JSON.parse(xhr.responseText);
        if (cfg) {
          title = cfg.title || title;
          if (cfg.color) primaryColor = cfg.color;
          if (cfg.position === 'left' || cfg.position === 'right') position = cfg.position;
          if (Array.isArray(cfg.documents)) publishedDocs = cfg.documents;
        }
      } catch (e) {}
      cb();
    };
    xhr.onerror = function () { cb(); };
    xhr.ontimeout = function () { cb(); };
    xhr.send();
  }

  function init() {
    if (!companyId) {
      console.warn('[AI Widget] data-company-id is required');
      return;
    }
    fetchConfig(function () {
      injectStyles();
      createDOM();
      renderDocStrip();
      setConnected(false);
      connect();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
