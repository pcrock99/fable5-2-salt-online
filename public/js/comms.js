(() => {
  'use strict';

  const config = window.__SALT_I18N__ || {};
  const messages = config.messages || {};
  const dictionary = messages.comms || {};
  const uiRoot = document.getElementById('ui');
  const mp = window.__mp;
  if (!uiRoot || !mp) return;

  const MAX_TEXT = 80;
  const BANNER_MS = 6200;
  const RTC_CONFIG = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
    ],
    bundlePolicy: 'max-bundle'
  };

  function t(key, vars) {
    const raw = dictionary[key];
    const text = typeof raw === 'string' ? raw : key;
    return text.replace(/\{(\w+)\}/g, (match, name) => (
      vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
    ));
  }

  function toast(text) {
    if (typeof mp.toast === 'function') mp.toast(text);
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TEXT);
  }

  const ui = document.createElement('div');
  ui.id = 'vc-ui';
  ui.innerHTML = `
    <div class="vc-banner" id="vc-banner" hidden aria-live="polite">
      <div class="vc-banner-card">
        <div class="vc-banner-kicker"><span class="vc-banner-signal"></span><span data-vc-label="bigText"></span></div>
        <div class="vc-banner-name" id="vc-banner-name"></div>
        <div class="vc-banner-text" id="vc-banner-text"></div>
      </div>
    </div>
    <div class="vc-rail" id="vc-rail">
      <button class="vc-mic" id="vc-mic" type="button" aria-pressed="false">
        <span class="vc-mic-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img"><path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z"/><path d="M5.5 11.7a6.5 6.5 0 0 0 13 0M12 18.2V22M8.4 22h7.2"/></svg>
        </span>
        <span class="vc-mic-copy"><b id="vc-mic-label"></b><em id="vc-mic-hint"></em></span>
        <span class="vc-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      </button>
      <button class="vc-chat-toggle" id="vc-chat-toggle" type="button" aria-expanded="false">
        <span class="vc-aa" aria-hidden="true">Aa</span>
        <span class="vc-chat-copy"><b data-vc-label="bigText"></b><em id="vc-chat-shortcut"></em></span>
      </button>
      <span class="vc-voice-count" id="vc-voice-count" hidden>0</span>
    </div>
    <section class="vc-panel" id="vc-panel" hidden aria-label="Big text channel">
      <header class="vc-panel-head">
        <div>
          <span class="vc-kicker" data-vc-label="kicker"></span>
          <h2 id="vc-panel-title"></h2>
          <p id="vc-panel-subtitle"></p>
        </div>
        <button class="vc-close" id="vc-close" type="button">×</button>
      </header>
      <div class="vc-voice-block">
        <div class="vc-voice-head">
          <b data-vc-label="voice"></b>
          <span id="vc-voice-summary"></span>
          <button class="vc-voice-off" id="vc-voice-off" type="button" hidden></button>
        </div>
        <div class="vc-peers" id="vc-peers"></div>
        <p class="vc-voice-hint" id="vc-voice-hint"></p>
      </div>
      <div class="vc-quick-block">
        <div class="vc-section-label" data-vc-label="quick"></div>
        <div class="vc-quick" id="vc-quick"></div>
      </div>
      <form class="vc-form" id="vc-form">
        <div class="vc-input-wrap">
          <input id="vc-input" maxlength="80" autocomplete="off" spellcheck="false" />
          <span class="vc-count" id="vc-count">0/80</span>
        </div>
        <button class="vc-send" id="vc-send" type="submit"><span data-vc-label="send"></span><kbd>↵</kbd></button>
      </form>
      <div class="vc-history-wrap">
        <div class="vc-section-label" data-vc-label="recent"></div>
        <ol class="vc-history" id="vc-history"></ol>
        <p class="vc-empty" id="vc-empty"></p>
      </div>
    </section>
    <div class="vc-audio" id="vc-audio" aria-hidden="true"></div>
  `;
  uiRoot.appendChild(ui);

  const el = {
    banner: ui.querySelector('#vc-banner'),
    bannerName: ui.querySelector('#vc-banner-name'),
    bannerText: ui.querySelector('#vc-banner-text'),
    rail: ui.querySelector('#vc-rail'),
    mic: ui.querySelector('#vc-mic'),
    micLabel: ui.querySelector('#vc-mic-label'),
    micHint: ui.querySelector('#vc-mic-hint'),
    chatToggle: ui.querySelector('#vc-chat-toggle'),
    chatShortcut: ui.querySelector('#vc-chat-shortcut'),
    voiceCount: ui.querySelector('#vc-voice-count'),
    panel: ui.querySelector('#vc-panel'),
    panelTitle: ui.querySelector('#vc-panel-title'),
    panelSubtitle: ui.querySelector('#vc-panel-subtitle'),
    close: ui.querySelector('#vc-close'),
    voiceSummary: ui.querySelector('#vc-voice-summary'),
    voiceOff: ui.querySelector('#vc-voice-off'),
    peers: ui.querySelector('#vc-peers'),
    voiceHint: ui.querySelector('#vc-voice-hint'),
    quick: ui.querySelector('#vc-quick'),
    form: ui.querySelector('#vc-form'),
    input: ui.querySelector('#vc-input'),
    send: ui.querySelector('#vc-send'),
    count: ui.querySelector('#vc-count'),
    history: ui.querySelector('#vc-history'),
    empty: ui.querySelector('#vc-empty'),
    audio: ui.querySelector('#vc-audio')
  };

  const labels = {
    kicker: t('kicker'),
    bigText: t('bigText'),
    voice: t('voice'),
    quick: t('quick'),
    recent: t('recent'),
    send: t('send')
  };
  for (const node of ui.querySelectorAll('[data-vc-label]')) {
    node.textContent = labels[node.getAttribute('data-vc-label')] || '';
  }
  el.panelTitle.textContent = t('panelTitle');
  el.panelSubtitle.textContent = t('panelSubtitle');
  el.panel.setAttribute('aria-label', t('panelTitle'));
  el.close.textContent = '×';
  el.close.setAttribute('aria-label', t('close'));
  el.chatShortcut.textContent = t('shortcutChat');
  el.input.placeholder = t('placeholder');
  el.input.setAttribute('aria-label', t('placeholder'));
  el.voiceOff.textContent = t('closeMic');
  el.empty.textContent = t('noRecent');
  el.mic.setAttribute('aria-label', t('openMic'));
  el.mic.title = t('voiceHint');
  el.chatToggle.setAttribute('aria-label', t('bigText'));

  const quickCalls = [
    { key: 'quickHelp', tone: 'alarm' },
    { key: 'quickPush', tone: 'signal' },
    { key: 'quickEnemy', tone: 'alarm' },
    { key: 'quickNice', tone: 'cool' },
    { key: 'quickThanks', tone: 'cool' }
  ];
  for (const item of quickCalls) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vc-quick-btn ' + item.tone;
    button.dataset.call = item.key;
    button.textContent = t(item.key);
    el.quick.appendChild(button);
  }

  let myId = null;
  let myName = '';
  let micEnabled = false;
  let micPending = false;
  let localMuted = false;
  let localStream = null;
  let audioContext = null;
  let analyser = null;
  let analyserData = null;
  let analyserTimer = 0;
  let speaking = false;
  let lastSpokenAt = 0;
  let lastVoiceSentAt = 0;
  let voicePeers = new Map();
  let lastVoiceSignature = '__init';
  const peers = new Map();
  const audioNeedsGesture = new Set();
  let audioUnlockBound = false;
  let wasOnline = false;

  const chatQueue = [];
  let bannerTimer = 0;
  let bannerActive = false;
  const recent = [];
  let panelOpen = false;

  function send(payload) {
    return typeof mp.send === 'function' ? mp.send(payload) : false;
  }

  function sendVoiceState(extraSpeaking) {
    const now = performance.now();
    const nextSpeaking = typeof extraSpeaking === 'boolean' ? extraSpeaking : speaking;
    if (now - lastVoiceSentAt < 220 && nextSpeaking === speaking) return;
    speaking = nextSpeaking;
    lastVoiceSentAt = now;
    send({
      type: 'voiceState',
      enabled: micEnabled,
      muted: micEnabled ? localMuted : true,
      speaking: micEnabled && !localMuted && speaking
    });
  }

  function sortedVoicePeers() {
    return [...voicePeers.values()].sort((a, b) => {
      if (a.id === myId) return -1;
      if (b.id === myId) return 1;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function renderVoice() {
    const list = sortedVoicePeers().filter((peer) => peer.enabled);
    const count = list.length;
    const others = list.filter((peer) => peer.id !== myId).length;
    el.voiceCount.hidden = count === 0;
    el.voiceCount.textContent = String(count);
    el.mic.classList.toggle('is-live', micEnabled && !localMuted);
    el.mic.classList.toggle('is-muted', micEnabled && localMuted);
    el.mic.classList.toggle('is-pending', micPending);
    el.mic.classList.toggle('is-speaking', micEnabled && !localMuted && speaking);
    el.mic.setAttribute('aria-pressed', micEnabled ? 'true' : 'false');
    el.micLabel.textContent = micPending
      ? t('voiceConnecting')
      : micEnabled
        ? t('closeMic')
        : t('openMic');
    el.micHint.textContent = micEnabled
      ? (localMuted ? t('voiceMuted') : t('voiceLive'))
      : t('shortcutMic');
    el.mic.setAttribute('aria-label', micEnabled ? t('closeMic') : t('openMic'));
    el.voiceOff.hidden = !micEnabled;

    if (count === 0) {
      el.voiceSummary.textContent = t('voiceIdle');
      el.voiceHint.textContent = t('voiceHint');
    } else if (others === 0) {
      el.voiceSummary.textContent = t('voicePeers', { n: count });
      el.voiceHint.textContent = t('voiceNoPeers');
    } else {
      el.voiceSummary.textContent = t('voicePeers', { n: count });
      el.voiceHint.textContent = t('voiceEnabledToast');
    }

    const signature = list.map((peer) => (
      peer.id + ':' + peer.name + ':' + peer.color + ':' + (peer.speaking ? 1 : 0) + ':' + (peer.muted ? 1 : 0)
    )).join('|');
    if (signature === lastVoiceSignature) return;
    lastVoiceSignature = signature;
    el.peers.innerHTML = '';
    if (!list.length) {
      const idle = document.createElement('span');
      idle.className = 'vc-peer-empty';
      idle.textContent = t('voiceNoPeers');
      el.peers.appendChild(idle);
      return;
    }
    for (const peer of list) {
      const chip = document.createElement('span');
      chip.className = 'vc-peer' +
        (peer.id === myId ? ' self' : '') +
        (peer.speaking ? ' speaking' : '') +
        (peer.muted ? ' muted' : '');
      chip.style.setProperty('--peer-color', peer.color || '#ffb347');
      const dot = document.createElement('i');
      const name = document.createElement('b');
      name.textContent = peer.id === myId ? t('you') : peer.name;
      const state = document.createElement('em');
      state.textContent = peer.muted ? t('voiceMuted') : peer.speaking ? t('speaking') : t('voiceLive');
      chip.append(dot, name, state);
      chip.title = peer.name + ' · ' + state.textContent;
      el.peers.appendChild(chip);
    }
  }

  function upsertVoicePeer(player) {
    if (!player || !player.id) return;
    if (player.enabled) {
      voicePeers.set(player.id, { ...player });
    } else {
      voicePeers.delete(player.id);
      closePeer(player.id);
    }
    renderVoice();
    if (micEnabled) connectVoicePeers();
  }

  function replaceVoiceRoster(list) {
    const next = new Map();
    for (const item of Array.isArray(list) ? list : []) {
      if (!item || !item.id || !item.enabled) continue;
      next.set(item.id, { ...item });
    }
    for (const id of peers.keys()) {
      if (!next.has(id)) closePeer(id);
    }
    voicePeers = next;
    renderVoice();
    if (micEnabled) connectVoicePeers();
  }

  function closePeer(id) {
    const entry = peers.get(id);
    if (!entry) return;
    peers.delete(id);
    try { entry.pc.onicecandidate = null; } catch (err) { /* ignore */ }
    try { entry.pc.ontrack = null; } catch (err) { /* ignore */ }
    try { entry.pc.close(); } catch (err) { /* ignore */ }
    if (entry.audio) {
      try { entry.audio.pause(); } catch (err) { /* ignore */ }
      entry.audio.srcObject = null;
      entry.audio.remove();
    }
  }

  function closeAllPeers() {
    for (const id of [...peers.keys()]) closePeer(id);
  }

  function attachRemoteAudio(id, stream) {
    const entry = peers.get(id);
    if (!entry || !stream) return;
    if (entry.audio) {
      entry.audio.srcObject = stream;
    } else {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.setAttribute('playsinline', '');
      audio.srcObject = stream;
      el.audio.appendChild(audio);
      entry.audio = audio;
    }
    const play = () => entry.audio.play().catch(() => {
      audioNeedsGesture.add(id);
      bindAudioUnlock();
      toast(t('popupBlocked'));
    });
    play();
  }

  function bindAudioUnlock() {
    if (audioUnlockBound) return;
    audioUnlockBound = true;
    document.addEventListener('pointerdown', resumeRemoteAudio, true);
  }

  function resumeRemoteAudio() {
    for (const entry of peers.values()) {
      if (!entry.audio || !entry.audio.srcObject) continue;
      entry.audio.play().catch(() => { /* still blocked */ });
    }
    if (!audioNeedsGesture.size) {
      document.removeEventListener('pointerdown', resumeRemoteAudio, true);
      audioUnlockBound = false;
    }
  }

  function sendSignal(targetId, signal) {
    send({ type: 'rtcSignal', targetId, signal });
  }

  async function createPeer(id, initiator) {
    if (!localStream || !micEnabled) return null;
    if (peers.has(id)) return peers.get(id);
    let pc;
    try {
      pc = new RTCPeerConnection(RTC_CONFIG);
    } catch (err) {
      toast(t('voiceFailed'));
      return null;
    }
    const entry = {
      id,
      pc,
      audio: null,
      pendingCandidates: [],
      initiator: !!initiator,
      remoteReady: false,
      retryAt: 0
    };
    peers.set(id, entry);
    for (const track of localStream.getTracks()) {
      try { pc.addTrack(track, localStream); } catch (err) { /* ignore */ }
    }
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      let candidate = null;
      try { candidate = event.candidate.toJSON(); } catch (err) { candidate = event.candidate; }
      sendSignal(id, { kind: 'ice', candidate });
    };
    pc.ontrack = (event) => {
      attachRemoteAudio(id, event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]));
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed') {
        closePeer(id);
        if (micEnabled && voicePeers.has(id)) {
          window.setTimeout(() => {
            if (micEnabled && voicePeers.has(id)) createPeer(id, String(myId) < String(id));
          }, 1600);
        }
      }
      renderVoice();
    };
    if (initiator) {
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable' || !peers.has(id)) return entry;
        await pc.setLocalDescription(offer);
        sendSignal(id, { kind: 'offer', sdp: pc.localDescription.sdp });
      } catch (err) {
        closePeer(id);
      }
    }
    return entry;
  }

  function connectVoicePeers() {
    if (!micEnabled || !myId) return;
    for (const peer of voicePeers.values()) {
      if (!peer.enabled || peer.id === myId || peers.has(peer.id)) continue;
      createPeer(peer.id, String(myId) < String(peer.id));
    }
  }

  async function handleSignal(msg) {
    if (!micEnabled || !msg.from || !msg.from.id || !msg.signal) return;
    const fromId = String(msg.from.id);
    if (fromId === myId) return;
    let entry = peers.get(fromId);
    const signal = msg.signal;
    try {
      if (signal.kind === 'offer') {
        if (!entry) entry = await createPeer(fromId, false);
        if (!entry) return;
        if (entry.pc.signalingState !== 'stable') {
          if (String(myId) < fromId) return;
          await entry.pc.setLocalDescription({ type: 'rollback' });
        }
        await entry.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        entry.remoteReady = true;
        await flushCandidates(entry);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        sendSignal(fromId, { kind: 'answer', sdp: entry.pc.localDescription.sdp });
      } else if (signal.kind === 'answer') {
        if (!entry || !entry.pc.localDescription) return;
        if (entry.pc.signalingState !== 'have-local-offer') return;
        await entry.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        entry.remoteReady = true;
        await flushCandidates(entry);
      } else if (signal.kind === 'ice') {
        if (!entry) return;
        if (!signal.candidate) return;
        if (!entry.remoteReady) {
          entry.pendingCandidates.push(signal.candidate);
        } else {
          await entry.pc.addIceCandidate(signal.candidate);
        }
      }
    } catch (err) {
      console.warn('[vc] signal failed', err && err.message);
    }
  }

  async function flushCandidates(entry) {
    const pending = entry.pendingCandidates.splice(0);
    for (const candidate of pending) {
      try { await entry.pc.addIceCandidate(candidate); } catch (err) { /* ignore */ }
    }
  }

  function startAnalyser(stream) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.62;
      source.connect(analyser);
      analyserData = new Uint8Array(analyser.fftSize);
      window.clearInterval(analyserTimer);
      analyserTimer = window.setInterval(() => {
        if (!analyser || !analyserData || !micEnabled || localMuted) return;
        analyser.getByteTimeDomainData(analyserData);
        let sum = 0;
        for (let i = 0; i < analyserData.length; i += 1) {
          const value = (analyserData[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / analyserData.length);
        const now = performance.now();
        if (rms > 0.045) lastSpokenAt = now;
        const nowSpeaking = now - lastSpokenAt < 460;
        el.mic.style.setProperty('--level', String(Math.min(1, rms * 14)));
        el.mic.classList.toggle('is-speaking', nowSpeaking);
        if (nowSpeaking !== speaking) sendVoiceState(nowSpeaking);
      }, 120);
    } catch (err) {
      console.warn('[vc] analyser unavailable', err && err.message);
    }
  }

  function stopAnalyser() {
    window.clearInterval(analyserTimer);
    analyserTimer = 0;
    analyser = null;
    analyserData = null;
    if (audioContext) {
      try { audioContext.close(); } catch (err) { /* ignore */ }
    }
    audioContext = null;
  }

  async function enableMic() {
    if (micPending || micEnabled) return;
    if (!window.isSecureContext) {
      toast(t('voiceRequiresSecure'));
      return;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' || !window.RTCPeerConnection) {
      toast(t('voiceUnsupported'));
      return;
    }
    micPending = true;
    renderVoice();
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });
      micEnabled = true;
      micPending = false;
      localMuted = false;
      speaking = false;
      lastSpokenAt = 0;
      startAnalyser(localStream);
      lastVoiceSentAt = 0;
      sendVoiceState(false);
      renderVoice();
      connectVoicePeers();
      toast(t('voiceEnabledToast'));
    } catch (err) {
      micPending = false;
      micEnabled = false;
      localStream = null;
      renderVoice();
      toast(err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
        ? t('voiceDenied')
        : t('voiceFailed'));
    }
  }

  function disableMic(showToast) {
    if (!micEnabled && !micPending) return;
    micEnabled = false;
    micPending = false;
    localMuted = true;
    speaking = false;
    stopAnalyser();
    if (localStream) {
      for (const track of localStream.getTracks()) {
        try { track.stop(); } catch (err) { /* ignore */ }
      }
    }
    localStream = null;
    closeAllPeers();
    lastVoiceSentAt = 0;
    sendVoiceState(false);
    renderVoice();
    if (showToast) toast(t('voiceDisabledToast'));
  }

  function toggleMic() {
    resumeRemoteAudio();
    if (micEnabled) disableMic(true);
    else enableMic();
  }

  function updateCounter() {
    el.count.textContent = t('count', { n: el.input.value.length });
  }

  function openPanel(focus) {
    panelOpen = true;
    el.panel.hidden = false;
    el.chatToggle.setAttribute('aria-expanded', 'true');
    el.rail.dataset.open = '1';
    document.body.classList.add('vc-panel-open');
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (err) { /* ignore */ }
    updateCounter();
    if (focus) {
      window.requestAnimationFrame(() => {
        try { el.input.focus({ preventScroll: true }); } catch (err) { el.input.focus(); }
      });
    }
  }

  function closePanel() {
    panelOpen = false;
    el.panel.hidden = true;
    el.chatToggle.setAttribute('aria-expanded', 'false');
    delete el.rail.dataset.open;
    document.body.classList.remove('vc-panel-open');
    try { el.input.blur(); } catch (err) { /* ignore */ }
  }

  function renderHistory() {
    el.history.innerHTML = '';
    el.empty.hidden = recent.length > 0;
    for (const item of recent) {
      const row = document.createElement('li');
      row.className = item.id === myId ? 'self' : '';
      row.style.setProperty('--speaker-color', item.color || '#ffb347');
      const who = document.createElement('b');
      who.textContent = item.id === myId ? t('you') : item.name;
      const text = document.createElement('span');
      text.textContent = item.text;
      row.append(who, text);
      el.history.appendChild(row);
    }
  }

  function showNextBanner() {
    if (bannerActive || !chatQueue.length) return;
    const item = chatQueue.shift();
    bannerActive = true;
    el.bannerName.textContent = item.id === myId ? t('you') : item.name;
    el.bannerName.style.color = item.color || 'var(--signal)';
    el.bannerText.textContent = item.text;
    el.banner.dataset.size = item.text.length > 54 ? 'long' : item.text.length > 30 ? 'medium' : 'short';
    el.banner.style.setProperty('--speaker-color', item.color || '#ffb347');
    el.banner.hidden = false;
    el.banner.classList.remove('on');
    void el.banner.offsetWidth;
    el.banner.classList.add('on');
    window.clearTimeout(bannerTimer);
    const duration = Math.min(9000, BANNER_MS + Math.max(0, item.text.length - 36) * 55);
    bannerTimer = window.setTimeout(() => {
      el.banner.classList.remove('on');
      window.setTimeout(() => {
        el.banner.hidden = true;
        bannerActive = false;
        showNextBanner();
      }, 300);
    }, duration);
  }

  function receiveChat(msg) {
    const item = {
      id: String(msg.id || ''),
      name: cleanText(msg.name) || '—',
      color: msg.color || '#ffb347',
      text: cleanText(msg.text),
      at: Number(msg.at) || Date.now()
    };
    if (!item.text) return;
    recent.unshift(item);
    while (recent.length > 5) recent.pop();
    renderHistory();
    chatQueue.push(item);
    showNextBanner();
  }

  function sendChat(raw) {
    const text = cleanText(raw);
    if (!text) {
      toast(t('empty'));
      return false;
    }
    if (!send({ type: 'chat', text })) {
      toast(messages.mp && messages.mp.disconnected ? messages.mp.disconnected : t('voiceFailed'));
      return false;
    }
    return true;
  }

  el.mic.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMic();
  });

  el.chatToggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (panelOpen) closePanel();
    else openPanel(true);
  });
  el.close.addEventListener('click', (event) => {
    event.preventDefault();
    closePanel();
  });
  el.voiceOff.addEventListener('click', (event) => {
    event.preventDefault();
    disableMic(true);
  });
  el.quick.addEventListener('click', (event) => {
    const button = event.target && event.target.closest ? event.target.closest('[data-call]') : null;
    if (!button) return;
    event.preventDefault();
    if (sendChat(t(button.dataset.call))) {
      closePanel();
    }
  });
  el.input.addEventListener('input', updateCounter);
  el.input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
    }
  });
  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!sendChat(el.input.value)) return;
    el.input.value = '';
    updateCounter();
    closePanel();
  });
  ui.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  ui.addEventListener('keydown', (event) => {
    event.stopPropagation();
  });
  ui.addEventListener('click', (event) => {
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'FORM' || tag === 'SECTION') {
      event.stopPropagation();
    }
  });

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );
    if (typing) {
      if (event.key === 'Escape') closePanel();
      event.stopPropagation();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === 'KeyM') {
      event.preventDefault();
      event.stopPropagation();
      toggleMic();
    } else if (event.code === 'KeyT') {
      event.preventDefault();
      event.stopPropagation();
      openPanel(true);
    } else if (event.key === 'Escape' && panelOpen) {
      event.preventDefault();
      closePanel();
    }
  }, true);

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement && panelOpen) closePanel();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!panelOpen) return;
    if (ui.contains(event.target)) return;
    closePanel();
  }, true);

  function handleMessage(msg) {
    if (!msg || typeof msg.type !== 'string') return;
    switch (msg.type) {
      case 'welcome':
        myId = msg.id || myId;
        myName = msg.name || myName;
        if (micEnabled) sendVoiceState(speaking);
        break;
      case 'joined':
        myId = msg.id || myId;
        myName = msg.name || myName;
        if (micEnabled) sendVoiceState(speaking);
        break;
      case 'snapshot':
        if (msg.you && msg.you.id) {
          myId = msg.you.id;
          myName = msg.you.name || myName;
        }
        replaceVoiceRoster(msg.voice);
        break;
      case 'voiceState':
        if (msg.player) upsertVoicePeer(msg.player);
        break;
      case 'rtcSignal':
        handleSignal(msg);
        break;
      case 'chat':
        receiveChat(msg);
        break;
      case 'chatDenied':
        toast(msg.reason === 'rate' ? t('rate') : t('empty'));
        break;
      default:
        break;
    }
  }

  mp.onMessage(handleMessage);

  window.setInterval(() => {
    const online = !!(mp && mp.connected);
    if (wasOnline && !online) {
      closeAllPeers();
      voicePeers.clear();
      lastVoiceSignature = '__init';
      renderVoice();
    } else if (!wasOnline && online && micEnabled) {
      sendVoiceState(speaking);
    }
    wasOnline = online;
  }, 1400);

  renderVoice();
  renderHistory();
  updateCounter();

  window.__vc = {
    get micEnabled() { return micEnabled; },
    get micPending() { return micPending; },
    get peers() { return peers.size; },
    get peerStates() { return [...peers.values()].map((entry) => ({ id: entry.id, state: entry.pc.connectionState })); },
    get voicePeers() { return sortedVoicePeers(); },
    get panelOpen() { return panelOpen; },
    openPanel,
    closePanel,
    sendChat,
    toggleMic,
    enableMic,
    disableMic
  };
})();
