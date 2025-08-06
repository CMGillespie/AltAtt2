// Wordly Secure Viewer Script
document.addEventListener('DOMContentLoaded', () => {

  // --- NEW: Service Worker Registration ---
  // We register a service worker to help keep the audio alive in the background.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  }

  // --- TEMPORARY Configuration Input Elements ---
  const configInputArea = document.getElementById('config-input-area');
  const tempSessionIdInput = document.getElementById('temp-session-id');
  const tempPasscodeInput = document.getElementById('temp-passcode');
  const tempConnectBtn = document.getElementById('temp-connect-btn');
  const tempStatus = document.getElementById('temp-status');

  // --- Main App DOM Elements ---
  const appPage = document.getElementById('app-page');
  const appHeader = document.getElementById('app-header');
  const languageSelect = document.getElementById('language-select');
  const audioToggle = document.getElementById('audio-toggle');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const transcriptArea = document.getElementById('transcript-area');
  const statusMessage = document.getElementById('status-message');
  const audioStatus = document.getElementById('audio-status');
  // ... (the rest of your element selections are unchanged) ...
  const collapseBtn = document.getElementById('collapse-btn'); // "Hide/View Text" button
  const headerToggleButton = document.getElementById('header-toggle-btn');
  const sessionDisplayHeader = document.getElementById('session-display-header');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const loginThemeToggleBtn = document.getElementById('login-theme-toggle-btn');
  const connectionStatusLight = document.getElementById('connection-status');
  const mainContent = document.getElementById('main-content');
  const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
  const newMessageCountSpan = document.getElementById('new-message-count');
  const fontSizeDecreaseBtn = document.getElementById('font-size-decrease-btn');
  const fontSizeIncreaseBtn = document.getElementById('font-size-increase-btn');
  const fontBoldToggleBtn = document.getElementById('font-bold-toggle-btn');

  // --- NEW: Wake Lock Elements ---
  const wakeLockBtn = document.getElementById('wake-lock-btn');
  let screenWakeLock = null;

  // --- Application State ---
  const state = {
    // ... (your existing state is unchanged) ...
    sessionId: null,
    passcode: '',
    language: 'en',
    audioEnabled: false,
    headerCollapsed: false,
    headerCollapseTimeout: null,
    contentHidden: false,
    websocket: null,
    status: 'disconnected',
    phrases: {},
    audioQueue: [],
    isPlayingAudio: false,
    currentAudioElement: null,
    userScrolledUp: false,
    newMessagesWhileScrolled: 0,
    fontSize: 'normal',
    fontBold: false,
    darkMode: false
  };

  // ... (your languageMap and constants are unchanged) ...
  const languageMap = { 'af': 'Afrikaans', 'sq': 'Albanian', 'ar': 'Arabic', 'hy': 'Armenian', 'bn': 'Bengali', 'bg': 'Bulgarian', 'zh-HK': 'Cantonese', 'ca': 'Catalan', 'zh-CN': 'Chinese (Simplified)', 'zh-TW': 'Chinese (Traditional)', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch', 'en': 'English (US)', 'en-AU': 'English (AU)', 'en-GB': 'English (UK)', 'et': 'Estonian', 'fi': 'Finnish', 'fr': 'French (FR)', 'fr-CA': 'French (CA)', 'ka': 'Georgian', 'de': 'German', 'el': 'Greek', 'gu': 'Gujarati', 'he': 'Hebrew', 'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 'id': 'Indonesian', 'ga': 'Irish', 'it': 'Italian', 'ja': 'Japanese', 'kn': 'Kannada', 'ko': 'Korean', 'lv': 'Latvian', 'lt': 'Lithuanian', 'mk': 'Macedonian', 'ms': 'Malay', 'mt': 'Maltese', 'no': 'Norwegian', 'fa': 'Persian', 'pl': 'Polish', 'pt': 'Portuguese (PT)', 'pt-BR': 'Portuguese (BR)', 'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian', 'sk': 'Slovak', 'sl': 'Slovenian', 'es': 'Spanish (ES)', 'es-MX': 'Spanish (MX)', 'sv': 'Swedish', 'tl': 'Tagalog', 'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'vi': 'Vietnamese', 'cy': 'Welsh', 'pa': 'Punjabi', 'sw': 'Swahili', 'ta': 'Tamil', 'ur': 'Urdu', 'zh': 'Chinese' };
  const HEADER_AUTO_COLLAPSE_DELAY = 10000;
  const SCROLL_THRESHOLD = 50;

  // --- Initialization ---
  init();

  function init() {
    // ... (your init logic is unchanged) ...
    state.darkMode = false;
    document.documentElement.setAttribute('data-theme', 'light');
    loadFontSettings();
    loadThemeSettings();
    applyTheme();
    tempConnectBtn.addEventListener('click', handleTempConnect);
    tempSessionIdInput.addEventListener('input', formatSessionIdInput);
    tempSessionIdInput.addEventListener('keydown', handleTempInputKeydown);
    tempPasscodeInput.addEventListener('keydown', handleTempInputKeydown);
    tempSessionIdInput.focus();
    if (loginThemeToggleBtn) {
      loginThemeToggleBtn.addEventListener('click', toggleTheme);
    }
  }

  // ... (handleTempConnect, formatSessionIdInput, handleTempInputKeydown are unchanged) ...
  function handleTempConnect() {
    const formattedSessionId = tempSessionIdInput.value;
    const inputPasscode = tempPasscodeInput.value.trim();
    if (!isValidSessionId(formattedSessionId)) {
        tempStatus.textContent = 'Invalid Session ID format (XXXX-0000).';
        return;
    }
    console.log("Attempting connection with manually entered details.");
    tempStatus.textContent = '';
    state.sessionId = formattedSessionId;
    state.passcode = inputPasscode;
    configInputArea.style.display = 'none';
    appPage.style.display = 'flex';
    initializeApp();
  }
  function formatSessionIdInput(event) {
    const input = event.target;
    let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formattedValue = "";
    if (value.length > 4) {
        formattedValue = value.slice(0, 4) + '-' + value.slice(4, 8);
    } else {
        formattedValue = value;
    }
    if (input.value !== formattedValue) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const delta = formattedValue.length - input.value.length;
        input.value = formattedValue;
        try {
            input.setSelectionRange(start + delta, end + delta);
        } catch (e) {
            console.warn("Couldn't set selection range during format.");
        }
    }
  }
  function handleTempInputKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleTempConnect();
    }
  }

  function initializeApp() {
    // ... (your initializeApp logic is mostly aunchanged) ...
    console.log(`Initializing app for Session ID: ${state.sessionId}`);
    if (sessionDisplayHeader) {
        const maskedSessionId = maskSessionId(state.sessionId);
        sessionDisplayHeader.textContent = `Session: ${maskedSessionId}`;
    }
    populateLanguageSelect(languageSelect, state.language);
    setupAppControls();
    applyFontSettings();
    applyTheme();
    audioToggle.checked = state.audioEnabled;
    audioStatus.textContent = state.audioEnabled ? "Audio Ready" : "Audio Off";
    state.contentHidden = false;
    mainContent.classList.remove('transcript-hidden');
    collapseBtn.textContent = "Hide Text";
    resetHeaderCollapseTimer();
    updateConnectionStatus('connecting', 'Connecting...');
    connectWebSocket();
    // --- NEW: Setup Media Session on App Init ---
    setupMediaSession();
  }

  function setupAppControls() {
    languageSelect.addEventListener('change', handleLanguageChange);
    audioToggle.addEventListener('change', handleAudioToggle);
    collapseBtn.addEventListener('click', toggleContentVisibility);
    headerToggleButton.addEventListener('click', toggleHeaderCollapseManual);
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', toggleTheme);
    }
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', disconnectSession);
    }
    transcriptArea.addEventListener('scroll', handleTranscriptScroll);
    scrollToBottomBtn.addEventListener('click', handleScrollToTranscriptBottomClick);
    fontSizeDecreaseBtn.addEventListener('click', handleFontSizeDecrease);
    fontSizeIncreaseBtn.addEventListener('click', handleFontSizeIncrease);
    fontBoldToggleBtn.addEventListener('click', handleFontBoldToggle);

    // --- NEW: Wake Lock Event Listener ---
    if (wakeLockBtn) {
      wakeLockBtn.addEventListener('click', handleWakeLockButtonClick);
    }
  }

  // --- NEW: Media Session API Setup ---
  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      console.log('Setting up Media Session...');
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Wordly Session Audio',
        artist: 'Live Translation',
        album: `Session: ${maskSessionId(state.sessionId)}`,
        // You can add artwork here if you have a logo
        // artwork: [{ src: 'path/to/image.png', sizes: '96x96', type: 'image/png' }]
      });

      // Set up handlers for lock screen controls
      navigator.mediaSession.setActionHandler('play', () => {
        if (!state.audioEnabled) {
          audioToggle.checked = true;
          handleAudioToggle({ target: { checked: true } });
        }
        processAudioQueue();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (state.audioEnabled) {
          audioToggle.checked = false;
          handleAudioToggle({ target: { checked: false } });
        }
      });
    }
  }

  // --- NEW: Screen Wake Lock Functions ---
  async function handleWakeLockButtonClick() {
    if (screenWakeLock) {
      await releaseWakeLock();
    } else {
      await requestWakeLock();
    }
  }

  async function requestWakeLock() {
    try {
      screenWakeLock = await navigator.wakeLock.request('screen');
      wakeLockBtn.textContent = 'Screen Lock Active';
      wakeLockBtn.classList.add('active');
      showNotification('Screen will stay on.', 'info');

      // Listen for release events
      screenWakeLock.addEventListener('release', () => {
        console.log('Screen Wake Lock was released.');
        wakeLockBtn.textContent = 'Keep Screen On';
        wakeLockBtn.classList.remove('active');
        screenWakeLock = null; // Important to nullify
      });

    } catch (err) {
      console.error(`Could not acquire wake lock: ${err.name}, ${err.message}`);
      wakeLockBtn.textContent = 'Wake Lock Failed';
      showNotification('Could not activate screen lock.', 'error');
    }
  }

  async function releaseWakeLock() {
    if (screenWakeLock) {
      await screenWakeLock.release();
      screenWakeLock = null;
      // The 'release' event listener will handle the UI changes.
      showNotification('Screen lock released.', 'info');
    }
  }

  // --- MODIFIED: processAudioQueue ---
  // We add Media Session state updates to this function
  function processAudioQueue() {
    if (state.isPlayingAudio || state.audioQueue.length === 0 || !state.audioEnabled) {
      // NEW: Update media session state even if not playing
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      return;
    }
    state.isPlayingAudio = true;
    const audioItem = state.audioQueue.shift();
    const phraseElement = transcriptArea.querySelector(`#phrase-${audioItem.phraseId}`);

    try {
      const audioType = 'audio/wav';
      const blob = new Blob([new Uint8Array(audioItem.data)], { type: audioType });
      const audioUrl = URL.createObjectURL(blob);

      const audioElement = new Audio();
      state.currentAudioElement = audioElement;
      audioElement.src = audioUrl;

      audioElement.play().then(() => {
        audioStatus.textContent = 'Playing audio...';
        if (phraseElement) phraseElement.classList.add('phrase-playing');
        // --- NEW: Update Media Session state to 'playing' ---
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }).catch(playError => {
        console.error(`Error playing audio:`, playError);
        audioStatus.textContent = 'Audio playback error';
        cleanupAudio(audioUrl, phraseElement);
      });

      audioElement.onended = () => {
        cleanupAudio(audioUrl, phraseElement);
      };
      audioElement.onerror = (errorEvent) => {
        console.error(`Audio element error event occurred.`);
        audioStatus.textContent = 'Audio playback error';
        cleanupAudio(audioUrl, phraseElement);
      };

    } catch (error) {
      console.error(`Error processing audio blob:`, error);
      audioStatus.textContent = 'Error processing audio';
      state.isPlayingAudio = false;
      processAudioQueue();
    }
  }

  // --- MODIFIED: cleanupAudio ---
  function cleanupAudio(audioUrl, phraseElement) {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (phraseElement) {
      phraseElement.classList.remove('phrase-playing');
    }
    state.isPlayingAudio = false;
    state.currentAudioElement = null;
    // --- NEW: Update Media Session state to 'paused' ---
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
    setTimeout(processAudioQueue, 0);
  }
  
  // ... (All other functions from your original script.js remain here, unchanged) ...
  // Functions like handleLanguageChange, handleAudioToggle, connectWebSocket, etc.
  // do not need to be modified for these specific fixes. Just ensure they are
  // present in your final script.
  function handleLanguageChange(e) { const newLanguage = e.target.value; if (newLanguage === state.language) return; const oldLanguageName = getLanguageName(state.language); state.language = newLanguage; const newLanguageName = getLanguageName(newLanguage); console.log(`Language changed to ${newLanguage} (${newLanguageName})`); resetHeaderCollapseTimer(); if (state.websocket && state.websocket.readyState === WebSocket.OPEN) { const changeRequest = { type: 'change', languageCode: newLanguage }; console.log(`Sending language change request:`, JSON.stringify(changeRequest)); try { const wasAudioEnabled = state.audioEnabled; if (wasAudioEnabled) sendVoiceRequest(false); stopPlayerAudio(); state.websocket.send(JSON.stringify(changeRequest)); addSystemMessage(`Language changed to ${newLanguageName}.`); if (wasAudioEnabled) { setTimeout(() => { if (state.websocket && state.websocket.readyState === WebSocket.OPEN) { sendVoiceRequest(true); } }, 500); } } catch (e) { console.error(`Error sending language change:`, e); addSystemMessage(`Error changing language: ${e.message}`, true); languageSelect.value = state.language; } } else { console.warn(`WebSocket not open. Language change will apply on next connection.`); } }
  function handleAudioToggle(e) { state.audioEnabled = e.target.checked; resetHeaderCollapseTimer(); if (state.audioEnabled) { audioStatus.textContent = 'Audio Ready'; addSystemMessage('Audio translations enabled.'); if (state.websocket && state.websocket.readyState === WebSocket.OPEN) { sendVoiceRequest(true); } processAudioQueue(); } else { audioStatus.textContent = 'Audio Off'; addSystemMessage('Audio translations disabled.'); stopPlayerAudio(); if (state.websocket && state.websocket.readyState === WebSocket.OPEN) { sendVoiceRequest(false); } } }
  function toggleContentVisibility() { state.contentHidden = !state.contentHidden; mainContent.classList.toggle('transcript-hidden', state.contentHidden); collapseBtn.textContent = state.contentHidden ? 'View Text' : 'Hide Text'; collapseBtn.title = state.contentHidden ? 'Show Transcript View' : 'Hide Transcript View'; resetHeaderCollapseTimer(); }
  function toggleHeaderCollapseManual() { clearTimeout(state.headerCollapseTimeout); state.headerCollapsed = !state.headerCollapsed; appHeader.classList.toggle('collapsed', state.headerCollapsed); if (!state.headerCollapsed) { resetHeaderCollapseTimer(); } }
  function resetHeaderCollapseTimer() { clearTimeout(state.headerCollapseTimeout); if (state.headerCollapsed) { state.headerCollapsed = false; appHeader.classList.remove('collapsed'); } state.headerCollapseTimeout = setTimeout(() => { if (!state.headerCollapsed) { console.log("Auto-collapsing header"); state.headerCollapsed = true; appHeader.classList.add('collapsed'); } }, HEADER_AUTO_COLLAPSE_DELAY); }
  function disconnectSession() { console.log("Disconnecting session..."); stopPlayerAudio(); if (state.websocket && state.websocket.readyState !== WebSocket.CLOSED) { try { state.websocket.close(1000, "User disconnected"); } catch (e) { console.error("Error closing WebSocket:", e); } } state.websocket = null; updateConnectionStatus('disconnected', 'Disconnected by user.'); configInputArea.style.display = 'block'; appPage.style.display = 'none'; tempSessionIdInput.value = ''; tempPasscodeInput.value = ''; tempSessionIdInput.focus(); }
  function isValidSessionId(sessionId) { return /^[A-Z0-9]{4}-\d{4}$/.test(sessionId); }
  function maskSessionId(sessionId) { if (!sessionId || typeof sessionId !== 'string') { return "Unknown Session"; } const parts = sessionId.split('-'); if (parts.length !== 2 || parts[0].length !== 4 || parts[1].length !== 4) { return sessionId; } const firstPart = parts[0].substring(0, 2) + "XX"; const secondPart = "##" + parts[1].substring(2, 4); return `${firstPart}-${secondPart}`; }
  function loadFontSettings() { try { const settings = localStorage.getItem('wordlyViewerFontSettings'); if (settings) { const parsed = JSON.parse(settings); state.fontSize = parsed.size === 'large' ? 'large' : 'normal'; state.fontBold = !!parsed.bold; console.log("Loaded font settings:", state.fontSize, state.fontBold); } } catch (e) { console.error("Error loading font settings:", e); state.fontSize = 'normal'; state.fontBold = false; } }
  function applyFontSettings() { appPage.classList.remove('font-normal', 'font-large', 'font-bold'); appPage.classList.add(state.fontSize === 'large' ? 'font-large' : 'font-normal'); if (state.fontBold) { appPage.classList.add('font-bold'); } fontBoldToggleBtn.classList.toggle('active', state.fontBold); fontSizeIncreaseBtn.classList.toggle('active', state.fontSize === 'large'); fontSizeDecreaseBtn.classList.toggle('active', state.fontSize === 'normal'); }
  function saveFontSettings() { try { const settings = { size: state.fontSize, bold: state.fontBold }; localStorage.setItem('wordlyViewerFontSettings', JSON.stringify(settings)); console.log("Saved font settings:", settings); } catch (e) { console.error("Error saving font settings:", e); } }
  function handleFontSizeDecrease() { if (state.fontSize !== 'normal') { state.fontSize = 'normal'; applyFontSettings(); saveFontSettings(); resetHeaderCollapseTimer(); } }
  function handleFontSizeIncrease() { if (state.fontSize !== 'large') { state.fontSize = 'large'; applyFontSettings(); saveFontSettings(); resetHeaderCollapseTimer(); } }
  function handleFontBoldToggle() { state.fontBold = !state.fontBold; applyFontSettings(); saveFontSettings(); resetHeaderCollapseTimer(); }
  function loadThemeSettings() { try { const themeSetting = localStorage.getItem('wordlyViewerTheme'); if (themeSetting) { state.darkMode = themeSetting === 'dark'; console.log("Loaded theme setting:", state.darkMode ? 'dark' : 'light'); } else { state.darkMode = false; console.log("Using default light theme for new user"); } } catch (e) { console.error("Error loading theme settings:", e); state.darkMode = false; } }
  function applyTheme() { const themeValue = state.darkMode ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', themeValue); updateThemeIcons(themeToggleBtn); updateThemeIcons(loginThemeToggleBtn); }
  function updateThemeIcons(button) { if (!button) return; const moonIcon = button.querySelector('.moon-icon'); const sunIcon = button.querySelector('.sun-icon'); if (moonIcon && sunIcon) { if (state.darkMode) { moonIcon.style.display = 'none'; sunIcon.style.display = 'block'; } else { moonIcon.style.display = 'block'; sunIcon.style.display = 'none'; } } }
  function saveThemeSettings() { try { localStorage.setItem('wordlyViewerTheme', state.darkMode ? 'dark' : 'light'); console.log("Saved theme setting:", state.darkMode ? 'dark' : 'light'); } catch (e) { console.error("Error saving theme setting:", e); } }
  function toggleTheme() { state.darkMode = !state.darkMode; applyTheme(); saveThemeSettings(); if (appPage.style.display !== 'none') { resetHeaderCollapseTimer(); } showNotification(`${state.darkMode ? 'Dark' : 'Light'} mode enabled`, 'info'); }
  function connectWebSocket() { if (state.websocket && state.websocket.readyState === WebSocket.OPEN) { console.log(`WebSocket already open.`); return; } if (!state.sessionId) { showErrorState("Cannot connect: Session ID missing."); return; } updateConnectionStatus('connecting', 'Connecting...'); try { if (state.websocket) { try { state.websocket.close(); } catch (e) { /* ignore */ } state.websocket = null; } state.websocket = new WebSocket('wss://endpoint.wordly.ai/attend'); state.websocket.onopen = handleWebSocketOpen; state.websocket.onmessage = handleWebSocketMessage; state.websocket.onclose = handleWebSocketClose; state.websocket.onerror = handleWebSocketError; } catch (error) { console.error(`Error creating WebSocket:`, error); showErrorState('Connection error.'); } }
  function handleWebSocketOpen() { console.log(`WebSocket connection established.`); const connectRequest = { type: 'connect', presentationCode: state.sessionId, languageCode: state.language, identifier: `secure-viewer-${Math.random().toString(16).substring(2, 8)}` }; if (state.passcode) { connectRequest.accessKey = state.passcode; } try { state.websocket.send(JSON.stringify(connectRequest)); } catch (error) { console.error(`Error sending connect request:`, error); showErrorState('Connection error during handshake.'); } }
  function handleWebSocketMessage(event) { try { const message = JSON.parse(event.data); switch (message.type) { case 'status': handleStatusMessage(message); break; case 'phrase': handlePhraseMessage(message); break; case 'speech': handleSpeechMessage(message); break; case 'users': handleUsersMessage(message); break; case 'end': handleEndMessage(message); break; case 'error': handleErrorMessage(message); break; case 'echo': console.log(`Echo received.`); break; default: console.warn(`Unhandled message type: ${message.type}`, message); } } catch (error) { console.error(`Error processing message:`, error, event.data); } }
  function handleWebSocketClose(event) { console.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}, Was Clean: ${event.wasClean}`); stopPlayerAudio(); const status = (event.wasClean || event.code === 1000) ? 'disconnected' : 'error'; if (state.status !== 'disconnected' && state.status !== 'ended') { const message = status === 'disconnected' ? 'Disconnected' : `Connection lost (Code: ${event.code})`; updateConnectionStatus(status, message); } state.websocket = null; }
  function handleWebSocketError(error) { console.error(`WebSocket error:`, error); stopPlayerAudio(); if (state.status !== 'disconnected' && state.status !== 'ended') { showErrorState('Connection error.'); } if (state.websocket && state.websocket.readyState !== WebSocket.CLOSED) { try { state.websocket.close(1011, "WebSocket error"); } catch (e) { /* ignore */ } } state.websocket = null; }
  function handleStatusMessage(message) { if (message.success) { updateConnectionStatus('connected', 'Connected'); addSystemMessage('Connected. Waiting for translations...'); if (state.audioEnabled) { sendVoiceRequest(true); } } else { const errorMessage = message.message || 'Connection failed'; showErrorState(errorMessage); addSystemMessage(`Connection error: ${errorMessage}`, true); if (state.websocket) { try { state.websocket.close(1011, "Status error received"); } catch(e){} } } }
  function handlePhraseMessage(message) { const phraseId = message.phraseId; let phraseElement = transcriptArea.querySelector(`#phrase-${phraseId}`); const isUserNearBottom = isScrolledToTranscriptBottom(); if (!phraseElement) { phraseElement = document.createElement('div'); phraseElement.id = `phrase-${phraseId}`; phraseElement.className = 'phrase'; phraseElement.innerHTML = ` <div class="phrase-header"> <span class="speaker-name">${message.name || `Speaker ${message.speakerId.slice(-4)}`}</span> <span class="phrase-time">${new Date().toLocaleTimeString()}</span> </div> <div class="phrase-text"></div>`; transcriptArea.appendChild(phraseElement); limitTranscriptSize(transcriptArea); } const textElement = phraseElement.querySelector('.phrase-text'); if (textElement) { textElement.textContent = message.translatedText; } state.phrases[phraseId] = message; if (isUserNearBottom) { scrollToTranscriptBottom(); state.userScrolledUp = false; state.newMessagesWhileScrolled = 0; scrollToBottomBtn.style.display = 'none'; } else { if (state.userScrolledUp) { state.newMessagesWhileScrolled++; newMessageCountSpan.textContent = `(${state.newMessagesWhileScrolled})`; scrollToBottomBtn.style.display = 'flex'; } else { scrollToTranscriptBottom(); } } }
  function limitTranscriptSize(container, maxPhrases = 150) { while (container.children.length > maxPhrases) { container.removeChild(container.firstChild); } }
  function isScrolledToTranscriptBottom() { if (!transcriptArea) return true; const { scrollTop, scrollHeight, clientHeight } = transcriptArea; if (clientHeight === 0) return true; return scrollHeight - Math.ceil(scrollTop) - clientHeight < SCROLL_THRESHOLD; }
  function scrollToTranscriptBottom() { if (transcriptArea) { transcriptArea.scrollTo({ top: transcriptArea.scrollHeight, behavior: 'smooth' }); state.userScrolledUp = false; state.newMessagesWhileScrolled = 0; scrollToBottomBtn.style.display = 'none'; } }
  function handleTranscriptScroll() { if (!transcriptArea) return; const isNearBottom = isScrolledToTranscriptBottom(); if (!isNearBottom) { if (!state.userScrolledUp) { state.userScrolledUp = true; } } else { if (state.userScrolledUp) { state.userScrolledUp = false; state.newMessagesWhileScrolled = 0; scrollToBottomBtn.style.display = 'none'; } } }
  function handleScrollToTranscriptBottomClick() { scrollToTranscriptBottom(); }
  function handleSpeechMessage(message) { if (!state.audioEnabled) { return; } if (message.synthesizedSpeech && message.synthesizedSpeech.data && message.synthesizedSpeech.data.length > 0) { const audioData = message.synthesizedSpeech.data; state.audioQueue.push({ data: audioData, phraseId: message.phraseId }); processAudioQueue(); } else { console.warn(`Received speech message with empty or invalid audio data for phrase ${message.phraseId}.`); audioStatus.textContent = 'Received empty audio data'; } }
  function handleUsersMessage(message) {}
  function handleEndMessage(message) { const endReason = message.message ? `Reason: ${message.message}` : 'Session ended.'; updateConnectionStatus('ended', endReason); addSystemMessage('The presentation has ended.'); stopPlayerAudio(); if (state.websocket && state.websocket.readyState === WebSocket.OPEN) { try { state.websocket.close(1000, "Presentation ended"); } catch (e) { /* ignore */ } } state.websocket = null; }
  function handleErrorMessage(message) { const errorMessage = message.message || 'Unknown error occurred'; if (state.status !== 'disconnected' && state.status !== 'ended') { showErrorState(errorMessage); } addSystemMessage(`Error: ${errorMessage}`, true); }
  function stopPlayerAudio() { console.log(`Stopping audio and clearing queue.`); const currentAudio = state.currentAudioElement; if (currentAudio) { try { if (!currentAudio.paused && !currentAudio.ended) { currentAudio.pause(); console.log(`Paused current audio element.`); } currentAudio.onended = null; currentAudio.onerror = null; currentAudio.src = ''; } catch (e) { console.error(`Error during explicit audio stop:`, e); } finally { state.currentAudioElement = null; } } if (state.audioQueue.length > 0) { console.log(`Clearing ${state.audioQueue.length} items from audio queue.`); state.audioQueue = []; } state.isPlayingAudio = false; audioStatus.textContent = state.audioEnabled ? "Audio Ready" : "Audio Off"; const playingPhrase = transcriptArea ? transcriptArea.querySelector('.phrase-playing') : null; if (playingPhrase) { playingPhrase.classList.remove('phrase-playing'); } }
  function updateConnectionStatus(status, message) { state.status = status; if (connectionStatusLight) { connectionStatusLight.className = `status-light ${status}`; } if (statusMessage) { statusMessage.textContent = message || status; } }
  function showErrorState(message) { updateConnectionStatus('error', message); showNotification(message, 'error'); }
  function addSystemMessage(message, isError = false) { if (isError) { console.error(`SYSTEM (Error): ${message}`); } else { console.log(`SYSTEM: ${message}`); } }
  function populateLanguageSelect(selectElement, selectedLanguage) { if (!selectElement) return; selectElement.innerHTML = ''; Object.entries(languageMap).forEach(([code, name]) => { const option = document.createElement('option'); option.value = code; option.textContent = name; selectElement.appendChild(option); }); selectElement.value = selectedLanguage; }
  function getLanguageName(code) { return languageMap[code] || code; }
  function sendVoiceRequest(enabled) { if (state.websocket && state.websocket.readyState === WebSocket.OPEN) { try { const voiceRequest = { type: 'voice', enabled: enabled }; state.websocket.send(JSON.stringify(voiceRequest)); console.log(`Voice request sent (enabled=${enabled})`); } catch (e) { console.error(`Error sending voice request (enabled=${enabled}):`, e); } } else { console.warn(`Cannot send voice request, WebSocket not open.`); } }
  function showNotification(message, type = 'info') { const existing = document.querySelector('.notification'); if (existing) { existing.remove(); } const notification = document.createElement('div'); notification.className = `notification ${type}`; notification.textContent = message; document.body.appendChild(notification); requestAnimationFrame(() => { notification.classList.add('visible'); }); const notificationDuration = 3000; setTimeout(() => { notification.classList.remove('visible'); setTimeout(() => notification.remove(), 500); }, notificationDuration - 500); }
});