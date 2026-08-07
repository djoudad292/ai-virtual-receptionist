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
    hdr.appendChild(h3);
    hdr.appendChild(st);
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
    panel.appendChild(row);

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
    }
    msgContainer.insertBefore(div, typingEl);
    scrollBottom();
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
          var msg = {
            content: content,
            senderType: 'bot',
            timestamp: data.timestamp || timeStr(),
          };
          messages.push(msg);
          addMessage(msg);
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
