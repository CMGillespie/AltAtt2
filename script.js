// Wordly Secure Viewer Script (v12 - Final Scroll Fix)
document.addEventListener('DOMContentLoaded', () => {

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered.'))
      .catch(err => console.error('Service Worker registration failed:', err));
  }

  // --- DOM Elements ---
  const configInputArea = document.getElementById('config-input-area');
  const tempSessionIdInput = document.getElementById('temp-session-id');
  const tempPasscodeInput = document.getElementById('temp-passcode');
  const tempConnectBtn = document.getElementById('temp-connect-btn');
  const tempStatus = document.getElementById('temp-status');
  const appPage = document.getElementById('app-page');
  const sessionDisplayHeader = document.getElementById('session-display-header');
  const languageSelect = document.getElementById('language-select');
  const audioToggle = document.getElementById('audio-toggle');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const transcriptArea = document.getElementById('transcript-area');
  const connectionStatusLight = document.getElementById('connection-status');
  const wakeLockBtn = document.getElementById('wake-lock-btn');
  const mainAudioPlayer = document.getElementById('main-audio-player');
  const scrollDirectionBtn = document.getElementById('scroll-direction-btn');
  const appHeader = document.getElementById('app-header');
  const headerToggleButton = document.getElementById('header-toggle-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const loginThemeToggleBtn = document.getElementById('login-theme-toggle-btn');
  const collapseBtn = document.getElementById('collapse-btn');
  const mainContent = document.getElementById('main-content');
  const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
  const newMessageCountSpan = document.getElementById('new-message-count');
  const fontSizeDecreaseBtn = document.getElementById('font-size-decrease-btn');
  const fontSizeIncreaseBtn = document.getElementById('font-size-increase-btn');
  const fontBoldToggleBtn = document.getElementById('font-bold-toggle-btn');
  
  let screenWakeLock = null;

  // --- Application State ---
  const state = {
    sessionId: null, passcode: '', websocket: null, audioEnabled: false,
    isPlayingAudio: false, audioQueue: [], reconnectInterval: null,
    isDeliberateDisconnect: false, scrollDirection: 'down',
    headerCollapsed: false, headerCollapseTimeout: null, contentHidden: false,
    userScrolledUp: false, newMessagesWhileScrolled: 0, fontSize: 'normal',
    fontBold: false, darkMode: false,
  };

  const languageMap = { 'af': 'Afrikaans', 'sq': 'Albanian', 'ar': 'Arabic', 'hy': 'Armenian', 'bn': 'Bengali', 'bg': 'Bulgarian', 'zh-HK': 'Cantonese', 'ca': 'Catalan', 'zh-CN': 'Chinese (Simplified)', 'zh-TW': 'Chinese (Traditional)', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch', 'en': 'English (US)', 'en-AU': 'English (AU)', 'en-GB': 'English (UK)', 'et': 'Estonian', 'fi': 'Finnish', 'fr': 'French (FR)', 'fr-CA': 'French (CA)', 'ka': 'Georgian', 'de': 'German', 'el': 'Greek', 'gu': 'Gujarati', 'he': 'Hebrew', 'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 'id': 'Indonesian', 'ga': 'Irish', 'it': 'Italian', 'ja': 'Japanese', 'kn': 'Kannada', 'ko': 'Korean', 'lv': 'Latvian', 'lt': 'Lithuanian', 'mk': 'Macedonian', 'ms': 'Malay', 'mt': 'Maltese', 'no': 'Norwegian', 'fa': 'Persian', 'pl': 'Polish', 'pt': 'Portuguese (PT)', 'pt-BR': 'Portuguese (BR)', 'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian', 'sk': 'Slovak', 'sl': 'Slovenian', 'es': 'Spanish (ES)', 'es-MX': 'Spanish (MX)', 'sv': 'Swedish', 'tl': 'Tagalog', 'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'vi': 'Vietnamese', 'cy': 'Welsh', 'pa': 'Punjabi', 'sw': 'Swahili', 'ta': 'Tamil', 'ur': 'Urdu', 'zh': 'Chinese' };
  const HEADER_AUTO_COLLAPSE_DELAY = 10000;

  // --- Initialization ---
  init();

  function init() {
    loadFontSettings();
    loadThemeSettings();
    applyTheme();
    tempConnectBtn.addEventListener('click', connect);
    tempSessionIdInput.addEventListener('input', formatSessionIdInput);
    tempSessionIdInput.addEventListener('keydown', handleTempInputKeydown);
    tempPasscodeInput.addEventListener('keydown', handleTempInputKeydown);
    setupAppControls();
  }

  function setupAppControls() {
    disconnectBtn.addEventListener('click', disconnect);
    audioToggle.addEventListener('change', handleAudioToggle);
    languageSelect.addEventListener('change', handleLanguageChange);
    mainAudioPlayer.addEventListener('ended', onAudioEnded);
    mainAudioPlayer.addEventListener('error', handleAudioError);
    scrollDirectionBtn.addEventListener('click', handleScrollDirectionToggle);
    wakeLockBtn.addEventListener('click', handleWakeLockButtonClick);
    collapseBtn.addEventListener('click', toggleContentVisibility);
    headerToggleButton.addEventListener('click', toggleHeaderCollapseManual);
    themeToggleBtn.addEventListener('click', toggleTheme);
    loginThemeToggleBtn.addEventListener('click', toggleTheme);
    transcriptArea.addEventListener('scroll', handleTranscriptScroll);
    scrollToBottomBtn.addEventListener('click', handleScrollToTranscriptBottomClick);
    fontSizeDecreaseBtn.addEventListener('click', handleFontSizeDecrease);
    fontSizeIncreaseBtn.addEventListener('click', handleFontSizeIncrease);
    fontBoldToggleBtn.addEventListener('click', handleFontBoldToggle);
  }

  function connect() {
    state.sessionId = tempSessionIdInput.value;
    state.passcode = tempPasscodeInput.value;
    if (!isValidSessionId(state.sessionId)) {
      tempStatus.textContent = "Invalid Session ID format (XXXX-0000).";
      return;
    }
    configInputArea.style.display = 'none';
    appPage.style.display = 'flex';
    state.isDeliberateDisconnect = false;
    
    if (sessionDisplayHeader) {
        sessionDisplayHeader.textContent = `Session: ${maskSessionId(state.sessionId)}`;
    }
    populateLanguageSelect(languageSelect, 'en');
    resetHeaderCollapseTimer();
    connectWebSocket();
  }
  
  function disconnect() {
    state.isDeliberateDisconnect = true;
    if (state.reconnectInterval) clearInterval(state.reconnectInterval);
    if (state.websocket) state.websocket.close(1000, "User disconnected");
    stopAndClearAudio();
    appPage.style.display = 'none';
    configInputArea.style.display = 'block';
    updateStatus('disconnected');
  }

  function handleAudioToggle() {
    state.audioEnabled = audioToggle.checked;
    resetHeaderCollapseTimer();
    if (state.audioEnabled) {
      sendVoiceRequest(true);
      processAudioQueue();
    } else {
      sendVoiceRequest(false);
      stopAndClearAudio();
    }
  }

  function handleLanguageChange() {
    resetHeaderCollapseTimer();
    const newLanguage = languageSelect.value;
    if (state.websocket && state.websocket.readyState === WebSocket.OPEN) {
        const wasAudioEnabled = state.audioEnabled;
        if(wasAudioEnabled) sendVoiceRequest(false);
        stopAndClearAudio();
        state.websocket.send(JSON.stringify({ type: 'change', languageCode: newLanguage }));
        if(wasAudioEnabled) setTimeout(() => sendVoiceRequest(true), 500);
    }
  }

  function connectWebSocket() {
    if (state.websocket) return;
    updateStatus('connecting');
    state.websocket = new WebSocket('wss://endpoint.wordly.ai/attend');

    state.websocket.onopen = () => {
      if (state.reconnectInterval) clearInterval(state.reconnectInterval);
      const connectRequest = {
        type: 'connect', presentationCode: state.sessionId,
        languageCode: languageSelect.value || 'en',
        identifier: `stable-viewer-${Date.now()}`
      };
      if (state.passcode) connectRequest.accessKey = state.passcode;
      state.websocket.send(JSON.stringify(connectRequest));
    };

    state.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'status':
          if (message.success) {
            updateStatus('connected');
            if (state.audioEnabled) sendVoiceRequest(true);
          } else { updateStatus('error'); }
          break;
        case 'phrase': handlePhrase(message); break;
        case 'speech':
          if (message.synthesizedSpeech && message.synthesizedSpeech.data) {
            state.audioQueue.push({ data: message.synthesizedSpeech.data, phraseId: message.phraseId });
            processAudioQueue();
          }
          break;
        case 'end': disconnect(); break;
      }
    };

    state.websocket.onclose = () => {
      state.websocket = null;
      if (state.isDeliberateDisconnect) return;
      updateStatus('error');
      if (state.reconnectInterval) clearInterval(state.reconnectInterval);
      state.reconnectInterval = setInterval(connectWebSocket, 3000);
    };
    state.websocket.onerror = () => updateStatus('error');
  }

  function handlePhrase(message) {
    const isUserNearBottom = isScrolledToTranscriptBottom();
    let phraseElement = document.getElementById(`phrase-${message.phraseId}`);
    
    if (!phraseElement) {
        phraseElement = document.createElement('div');
        phraseElement.id = `phrase-${message.phraseId}`;
        phraseElement.className = 'phrase';
        phraseElement.innerHTML = `
            <div class="phrase-header">
                <span class="speaker-name">${message.name || `Speaker ${message.speakerId.slice(-4)}`}</span>
            </div>
            <div class="phrase-text"></div>`;
        
        transcriptArea.appendChild(phraseElement);
    }
    
    phraseElement.querySelector('.phrase-text').textContent = message.translatedText;

    // --- MODIFIED: Final Scrolling Logic ---
    if (message.isFinal) {
        if (state.scrollDirection === 'up') {
            // In reverse mode, we always scroll to the top to see the newest message.
            scrollToTranscriptTop();
        } else if (isUserNearBottom) {
            // In standard mode, only scroll if the user is already at the bottom.
            scrollToTranscriptBottom();
        } else {
            // If user has scrolled up in standard mode, show the "new messages" button.
            state.newMessagesWhileScrolled++;
            newMessageCountSpan.textContent = `(${state.newMessagesWhileScrolled})`;
            scrollToBottomBtn.style.display = 'flex';
        }
    }
  }

  function processAudioQueue() {
    if (state.isPlayingAudio || !state.audioEnabled || state.audioQueue.length === 0) {
      return;
    }
    state.isPlayingAudio = true;
    
    const audioItem = state.audioQueue.shift();
    const blob = new Blob([new Uint8Array(audioItem.data)], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    const phraseElement = document.getElementById(`phrase-${audioItem.phraseId}`);
    if (phraseElement) {
        const playing = transcriptArea.querySelector('.phrase-playing');
        if(playing) playing.classList.remove('phrase-playing');
        phraseElement.classList.add('phrase-playing');
    }
    mainAudioPlayer.src = url;
    mainAudioPlayer.play().catch(handleAudioError);
  }

  function onAudioEnded() {
      state.isPlayingAudio = false;
      const playingElement = transcriptArea.querySelector('.phrase-playing');
      if(playingElement) playingElement.classList.remove('phrase-playing');
      if(mainAudioPlayer.src.startsWith('blob:')) {
          URL.revokeObjectURL(mainAudioPlayer.src);
      }
      processAudioQueue();
  }

  function handleAudioError(e) {
    console.error("Audio playback error:", e);
    onAudioEnded();
  }

  function stopAndClearAudio() {
    mainAudioPlayer.pause();
    mainAudioPlayer.src = "";
    state.audioQueue = [];
    state.isPlayingAudio = false;
    const playingElement = transcriptArea.querySelector('.phrase-playing');
    if(playingElement) playingElement.classList.remove('phrase-playing');
  }

  function sendVoiceRequest(enabled) {
    if (state.websocket && state.websocket.readyState === WebSocket.OPEN) {
      state.websocket.send(JSON.stringify({ type: 'voice', enabled }));
    }
  }
  
  function updateStatus(status) {
    connectionStatusLight.className = `status-light ${status}`;
  }

  function handleScrollDirectionToggle() {
      resetHeaderCollapseTimer();
      state.scrollDirection = state.scrollDirection === 'down' ? 'up' : 'down';
      
      const icon = scrollDirectionBtn.querySelector('.text-flow-icon');
      icon.innerHTML = state.scrollDirection === 'down' ? 'T&darr;' : 'T&uarr;';
      
      transcriptArea.classList.toggle('reversed', state.scrollDirection === 'up');

      if (state.scrollDirection === 'down') {
          scrollToTranscriptBottom();
      } else {
          scrollToTranscriptTop();
      }
  }

  // --- All other UI and utility functions ---
  function populateLanguageSelect(selectElement, selectedLanguage) { if (!selectElement) return; selectElement.innerHTML = ''; Object.entries(languageMap).forEach(([code, name]) => { const option = document.createElement('option'); option.value = code; option.textContent = name; selectElement.appendChild(option); }); selectElement.value = selectedLanguage; }
  async function handleWakeLockButtonClick() { resetHeaderCollapseTimer(); if (screenWakeLock) { await releaseWakeLock(); } else { await requestWakeLock(); } }
  async function requestWakeLock() { try { screenWakeLock = await navigator.wakeLock.request('screen'); wakeLockBtn.classList.add('active'); showNotification('Screen will stay on.', 'info'); screenWakeLock.addEventListener('release', () => { wakeLockBtn.classList.remove('active'); screenWakeLock = null; }); } catch (err) { wakeLockBtn.textContent = 'Wake Lock Failed'; showNotification('Could not activate screen lock.', 'error'); } }
  async function releaseWakeLock() { if (screenWakeLock) { await screenWakeLock.release(); screenWakeLock = null; showNotification('Screen lock released.', 'info'); } }
  function toggleContentVisibility() { resetHeaderCollapseTimer(); state.contentHidden = !state.contentHidden; mainContent.classList.toggle('transcript-hidden', state.contentHidden); collapseBtn.textContent = state.contentHidden ? 'View Text' : 'Hide Text'; }
  function toggleHeaderCollapseManual() { clearTimeout(state.headerCollapseTimeout); state.headerCollapsed = !state.headerCollapsed; appHeader.classList.toggle('collapsed', state.headerCollapsed); if (!state.headerCollapsed) { resetHeaderCollapseTimer(); } }
  function resetHeaderCollapseTimer() { clearTimeout(state.headerCollapseTimeout); if (state.headerCollapsed) { state.headerCollapsed = false; appHeader.classList.remove('collapsed'); } state.headerCollapseTimeout = setTimeout(() => { if (!state.headerCollapsed && document.visibilityState === 'visible') { state.headerCollapsed = true; appHeader.classList.add('collapsed'); } }, HEADER_AUTO_COLLAPSE_DELAY); }
  function isScrolledToTranscriptBottom() { if (!transcriptArea) return true; const { scrollTop, scrollHeight, clientHeight } = transcriptArea; if (clientHeight === 0) return true; return scrollHeight - Math.ceil(scrollTop) - clientHeight < 50; }
  function scrollToTranscriptBottom() { if (transcriptArea) { requestAnimationFrame(() => { transcriptArea.scrollTo({ top: transcriptArea.scrollHeight, behavior: 'smooth' }); }); state.userScrolledUp = false; state.newMessagesWhileScrolled = 0; scrollToBottomBtn.style.display = 'none'; } }
  function scrollToTranscriptTop() { if (transcriptArea) { requestAnimationFrame(() => { transcriptArea.scrollTo({ top: 0, behavior: 'smooth' }); }); } }
  function handleTranscriptScroll() { if (!transcriptArea) return; if (state.scrollDirection === 'down') { const isNearBottom = isScrolledToTranscriptBottom(); if (!isNearBottom) { state.userScrolledUp = true; } else { if (state.userScrolledUp) { state.userScrolledUp = false; state.newMessagesWhileScrolled = 0; scrollToBottomBtn.style.display = 'none'; } } } }
  function handleScrollToTranscriptBottomClick() { scrollToTranscriptBottom(); }
  function isValidSessionId(sessionId) { return /^[A-Z0-9]{4}-\d{4}$/.test(sessionId); }
  function formatSessionIdInput(event) { const input = event.target; let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); let formattedValue = ""; if (value.length > 4) { formattedValue = value.slice(0, 4) + '-' + value.slice(4, 8); } else { formattedValue = value; } if (input.value !== formattedValue) { const start = input.selectionStart; const end = input.selectionEnd; const delta = formattedValue.length - input.value.length; input.value = formattedValue; try { input.setSelectionRange(start + delta, end + delta); } catch (e) {} } }
  function handleTempInputKeydown(event) { if (event.key === 'Enter') { event.preventDefault(); connect(); } }
  function maskSessionId(sessionId) { if (!sessionId || typeof sessionId !== 'string') { return "Unknown Session"; } const parts = sessionId.split('-'); if (parts.length !== 2 || parts[0].length !== 4 || parts[1].length !== 4) { return sessionId; } return `${parts[0].substring(0, 2)}XX-##${parts[1].substring(2, 4)}`; }
  function loadFontSettings() { try { const settings = localStorage.getItem('wordlyViewerFontSettings'); if (settings) { const parsed = JSON.parse(settings); state.fontSize = parsed.size === 'large' ? 'large' : 'normal'; state.fontBold = !!parsed.bold; } applyFontSettings(); } catch (e) {} }
  function applyFontSettings() { appPage.classList.remove('font-normal', 'font-large', 'font-bold'); appPage.classList.add(state.fontSize === 'large' ? 'font-large' : 'font-normal'); if (state.fontBold) appPage.classList.add('font-bold'); fontBoldToggleBtn.classList.toggle('active', state.fontBold); fontSizeIncreaseBtn.classList.toggle('active', state.fontSize === 'large'); fontSizeDecreaseBtn.classList.toggle('active', state.fontSize === 'normal'); fontBoldToggleBtn.style.fontWeight = state.fontBold ? 'normal' : 'bold'; }
  function saveFontSettings() { localStorage.setItem('wordlyViewerFontSettings', JSON.stringify({ size: state.fontSize, bold: state.fontBold })); }
  function handleFontSizeDecrease() { resetHeaderCollapseTimer(); if (state.fontSize !== 'normal') { state.fontSize = 'normal'; applyFontSettings(); saveFontSettings(); } }
  function handleFontSizeIncrease() { resetHeaderCollapseTimer(); if (state.fontSize !== 'large') { state.fontSize = 'large'; applyFontSettings(); saveFontSettings(); } }
  function handleFontBoldToggle() { resetHeaderCollapseTimer(); state.fontBold = !state.fontBold; applyFontSettings(); saveFontSettings(); }
  function loadThemeSettings() { try { const themeSetting = localStorage.getItem('wordlyViewerTheme'); if (themeSetting) state.darkMode = themeSetting === 'dark'; applyTheme();} catch (e) {} }
  function applyTheme() { const themeValue = state.darkMode ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', themeValue); updateThemeIcons(themeToggleBtn); updateThemeIcons(loginThemeToggleBtn); }
  function updateThemeIcons(button) { if (!button) return; const moonIcon = button.querySelector('.moon-icon'); const sunIcon = button.querySelector('.sun-icon'); if (moonIcon && sunIcon) { if (state.darkMode) { moonIcon.style.display = 'none'; sunIcon.style.display = 'block'; } else { moonIcon.style.display = 'block'; sunIcon.style.display = 'none'; } } }
  function saveThemeSettings() { localStorage.setItem('wordlyViewerTheme', state.darkMode ? 'dark' : 'light'); }
  function toggleTheme() { state.darkMode = !state.darkMode; applyTheme(); saveThemeSettings(); showNotification(`${state.darkMode ? 'Dark' : 'Light'} mode enabled`, 'info'); }
  function showNotification(message, type = 'info') { const existing = document.querySelector('.notification'); if (existing) existing.remove(); const notification = document.createElement('div'); notification.className = `notification ${type}`; notification.textContent = message; document.body.appendChild(notification); requestAnimationFrame(() => { notification.classList.add('visible'); }); const notificationDuration = 3000; setTimeout(() => { notification.classList.remove('visible'); setTimeout(() => notification.remove(), 500); }, notificationDuration - 500); }
});
