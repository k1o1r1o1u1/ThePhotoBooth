document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // DOM Elements
  // =========================================================================
  const screenLogin = document.getElementById('screen-login');
  const screenDashboard = document.getElementById('screen-dashboard');
  const screenCapture = document.getElementById('screen-capture');
  const screenReview = document.getElementById('screen-review');
  const screenThankYou = document.getElementById('screen-thank-you');
  const screenGallery = document.getElementById('screen-gallery');

  const inputName = document.getElementById('customer-name');
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const dashboardName = document.getElementById('dashboard-name');

  const btnNewSession = document.getElementById('btn-new-session');

  const videoWebcam = document.getElementById('webcam');
  const flashOverlay = document.getElementById('flash');
  const countdownOverlay = document.getElementById('countdown');
  const countdownNum = document.getElementById('countdown-num');
  const thumbsBar = document.getElementById('thumbs-bar');
  const btnCapture = document.getElementById('btn-capture');
  const captureStatus = document.getElementById('capture-status');
  const captureInstruction = document.getElementById('capture-instruction');

  const imgCollagePreview = document.getElementById('collage-preview');
  const btnTakeMore = document.getElementById('btn-take-more');
  const btnGotoGallery = document.getElementById('btn-goto-gallery');
  const btnCaptureGallery = document.getElementById('btn-capture-gallery');
  const btnEndSession = document.getElementById('btn-end-session');
  const btnCaptureExit = document.getElementById('btn-capture-exit');
  const btnReturnWelcome = document.getElementById('btn-return-welcome');
  const thankYouMessage = document.getElementById('thank-you-message');

  const gallerySessionsContainer = document.getElementById('gallery-sessions-container');
  const galleryEmpty = document.getElementById('gallery-empty');
  const galleryContent = document.querySelector('.gallery-content');
  const btnGalleryBack = document.getElementById('btn-gallery-back');

  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const btnLightboxClose = document.getElementById('btn-lightbox-close');
  const btnLightboxDownload = document.getElementById('btn-lightbox-download');
  const btnLightboxDelete = document.getElementById('btn-lightbox-delete');
  const btnLightboxEdit = document.getElementById('btn-lightbox-edit');
  let currentLightboxImgUrl = null;
  let currentLightboxSession = null;

  // =========================================================================
  // Application State
  // =========================================================================
  let isEditingGallerySession = false;
  let currentGallerySessionTimestamp = null;
  let savedFrameColor = '#ffffff';
  let customerName = '';
  let customerToken = '';
  const TARGET_PHOTO_COUNT = 4; // always 4 photos
  let currentSessionDir = '';
  let webcamStream = null;
  let webcamStreamRequestId = 0;
  let capturedImages = [];
  let captureUploadTasks = [];
  let uploadedCaptureFiles = [];
  let currentCaptureTimestamp = '';
  let idleTimer = null;
  let currentScreen = null;
  let isCapturing = false;
  let burstAborted = false;
  const IDLE_TIMEOUT_MS = 120000; // 2 minutes
  let sessionDurationMinutes = 4;
  let SESSION_DURATION_MS = sessionDurationMinutes * 60 * 1000;
  const TIMER_END_STORAGE_KEY = 'photobooth_session_timer_end';
  const TIMER_CUSTOMER_STORAGE_KEY = 'photobooth_session_timer_customer';
  let sessionTimer = null;
  let sessionTimerEnd = 0;
  let thankYouTimer = null;

  // =========================================================================
  // Idle Timeout Management
  // =========================================================================
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (customerName) {
      idleTimer = setTimeout(() => {
        void finishSession('Your session ended after a period of inactivity. Thank you for visiting Chini Champra Creations.');
      }, IDLE_TIMEOUT_MS);
    }
  }

  function startIdleWatcher() {
    ['mousemove', 'touchstart', 'keydown', 'click', 'scroll'].forEach(evt => {
      document.addEventListener(evt, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();
  }

  function stopIdleWatcher() {
    if (idleTimer) clearTimeout(idleTimer);
    ['mousemove', 'touchstart', 'keydown', 'click', 'scroll'].forEach(evt => {
      document.removeEventListener(evt, resetIdleTimer);
    });
  }

  // =========================================================================
  // Screen Navigation
  // =========================================================================
  function stopWebcam() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      webcamStream = null;
    }
    if (videoWebcam) {
      videoWebcam.srcObject = null;
    }
  }

  function showScreen(screen) {
    [screenLogin, screenDashboard, screenCapture, screenReview, screenThankYou, screenGallery]
      .forEach(s => { if (s) s.classList.add('hidden'); });
    screen.classList.remove('hidden');
    currentScreen = screen;

    if (screen === screenLogin) {
      stopWebcam();
    }

    // Re-trigger the fade-in animation
    screen.style.animation = 'none';
    screen.offsetHeight; // force reflow
    screen.style.animation = '';

    // Auto-focus for keyboard friendliness
    if (screen === screenLogin) {
      setTimeout(() => inputName.focus(), 100);
    } else if (screen === screenDashboard) {
      setTimeout(() => btnNewSession.focus(), 100);
      startWebcamStream();
    } else if (screen === screenCapture) {
      setTimeout(() => btnCapture.focus(), 100);
    } else if (screen === screenReview) {
      setTimeout(() => btnTakeMore.focus(), 100);
      if (!isEditingGallerySession && (!kioskPhotoImages || kioskPhotoImages.length === 0)) {
        autoLoadLatestKioskPhotos();
      }
    } else if (screen === screenThankYou) {
      setTimeout(() => btnReturnWelcome.focus(), 100);
    } else if (screen === screenGallery) {
      setTimeout(() => btnGalleryBack.focus(), 100);
    }

    updateSessionUserBadge(screen);
    document.body.classList.toggle('on-dashboard', screen === screenDashboard);
    document.body.classList.toggle('on-capture', screen === screenCapture);
    if (btnEndSession) btnEndSession.classList.toggle('hidden', screen !== screenReview);
  }

  // =========================================================================
  // Session Timer (5 minutes)
  // =========================================================================
  const timerContainer = document.getElementById('session-timer');
  const timerDisplay = document.getElementById('timer-display');
  const sessionUser = document.getElementById('session-user');
  const sessionDurationLabel = document.getElementById('session-duration-label');

  async function loadSessionDuration() {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      const minutes = Number(data.session_duration_minutes);
      if (!response.ok || !Number.isInteger(minutes) || minutes < 1) return;
      sessionDurationMinutes = minutes;
      SESSION_DURATION_MS = minutes * 60 * 1000;
      if (sessionDurationLabel) {
        sessionDurationLabel.textContent = `${minutes} minute${minutes === 1 ? '' : 's'}`;
      }
    } catch (err) {
      console.warn('Using the default session duration:', err);
    }
  }

  function updateSessionUserBadge(screen) {
    const show = screen === screenCapture || screen === screenReview;
    if (sessionUser) {
      sessionUser.classList.toggle('hidden', !show);
      sessionUser.textContent = show && customerName ? customerName : '';
    }
    const btnGotoGalleryCorner = document.getElementById('btn-goto-gallery');
    if (btnGotoGalleryCorner) {
      // Only show the top-left corner gallery button on the review screen
      btnGotoGalleryCorner.classList.toggle('hidden', screen !== screenReview);
    }
  }

  function getPersistedTimerEnd() {
    const raw = localStorage.getItem(TIMER_END_STORAGE_KEY);
    if (!raw) return null;
    const end = parseInt(raw, 10);
    if (!Number.isFinite(end)) return null;
    const savedCustomer = localStorage.getItem(TIMER_CUSTOMER_STORAGE_KEY);
    if (savedCustomer && customerToken && savedCustomer !== customerToken) return null;
    return end;
  }

  function persistTimerEnd(end) {
    if (end) {
      localStorage.setItem(TIMER_END_STORAGE_KEY, String(end));
      if (customerToken) {
        localStorage.setItem(TIMER_CUSTOMER_STORAGE_KEY, customerToken);
      }
    } else {
      localStorage.removeItem(TIMER_END_STORAGE_KEY);
      localStorage.removeItem(TIMER_CUSTOMER_STORAGE_KEY);
    }
  }

  async function handleSessionTimerExpired() {
    stopSessionTimer();
    await finishSession(`Your ${sessionDurationMinutes}-minute photo session has ended. Thank you for visiting Chini Champra Creations.`);
  }

  async function tickSessionTimer() {
    const remaining = sessionTimerEnd - Date.now();
    if (remaining <= 0) {
      handleSessionTimerExpired();
      return;
    }
    updateTimerDisplay();
  }

  function runSessionTimerInterval() {
    if (sessionTimer) clearInterval(sessionTimer);
    sessionTimer = setInterval(tickSessionTimer, 500);
  }

  function startSessionTimer() {
    const persistedEnd = getPersistedTimerEnd();
    if (persistedEnd && persistedEnd > Date.now()) {
      resumeSessionTimer(persistedEnd);
      return;
    }
    if (persistedEnd && persistedEnd <= Date.now()) {
      handleSessionTimerExpired();
      return;
    }

    sessionTimerEnd = Date.now() + SESSION_DURATION_MS;
    persistTimerEnd(sessionTimerEnd);
    timerContainer.classList.remove('hidden');
    updateTimerDisplay();
    runSessionTimerInterval();
  }

  function resumeSessionTimer(endTime) {
    sessionTimerEnd = endTime;
    persistTimerEnd(sessionTimerEnd);
    timerContainer.classList.remove('hidden');
    updateTimerDisplay();
    runSessionTimerInterval();
  }

  function restoreSessionTimerIfActive() {
    const persistedEnd = getPersistedTimerEnd();
    if (!persistedEnd) return;
    if (persistedEnd <= Date.now()) {
      handleSessionTimerExpired();
      return;
    }
    resumeSessionTimer(persistedEnd);
  }

  function updateTimerDisplay() {
    const remaining = Math.max(0, sessionTimerEnd - Date.now());
    const totalSec = Math.ceil(remaining / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    timerDisplay.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    // Color changes as time runs low
    if (totalSec <= 30) {
      timerContainer.classList.add('timer-critical');
      timerContainer.classList.remove('timer-warning');
    } else if (totalSec <= 60) {
      timerContainer.classList.add('timer-warning');
      timerContainer.classList.remove('timer-critical');
    } else {
      timerContainer.classList.remove('timer-warning', 'timer-critical');
    }
  }

  function stopSessionTimer() {
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }
    sessionTimerEnd = 0;
    persistTimerEnd(null);
    if (timerContainer) timerContainer.classList.add('hidden');
    if (timerContainer) timerContainer.classList.remove('timer-warning', 'timer-critical');
  }

  // =========================================================================
  // Login Persistence (localStorage)
  // =========================================================================
  async function checkExistingLogin() {
    const saved = localStorage.getItem('photobooth_token');
    if (saved) {
      customerToken = saved;
      // Re-establish server-side session so gallery and other APIs work
      try {
        const response = await fetch('/api/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_number: customerToken })
        });
        if (!response.ok) throw new Error('Token session expired');
        const data = await response.json();
        customerName = data.customer_name;
        dashboardName.textContent = customerName;
      } catch (_) {
        localStorage.removeItem('photobooth_token');
        customerToken = '';
        showScreen(screenLogin);
        return;
      }
      showScreen(screenDashboard);
      startIdleWatcher();
      restoreSessionTimerIfActive();
      await startWebcamStream();
    } else {
      showScreen(screenLogin);
    }
  }

  // =========================================================================
  // Login
  // =========================================================================
  btnLogin.addEventListener('click', async () => {
    const token = inputName.value.trim();
    if (!token) {
      inputName.focus();
      inputName.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.5)';
      inputName.style.borderColor = '#ef4444';
      setTimeout(() => {
        inputName.style.boxShadow = '';
        inputName.style.borderColor = '';
      }, 1500);
      return;
    }
    btnLogin.disabled = true;
    try {
      const response = await fetch('/api/token/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_number: token })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not validate token');
      customerToken = data.token_number;
      customerName = data.customer_name;
      localStorage.setItem('photobooth_token', customerToken);
      dashboardName.textContent = customerName;
      stopSessionTimer();
      showScreen(screenDashboard);
      startIdleWatcher();
      await startWebcamStream();
    } catch (error) {
      alert(error.message);
      inputName.focus();
    } finally {
      btnLogin.disabled = false;
    }
  });

  inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnLogin.click();
  });

  // =========================================================================
  // Logout
  // =========================================================================
  function stopThankYouTimer() {
    if (thankYouTimer) {
      clearInterval(thankYouTimer);
      thankYouTimer = null;
    }
  }

  function returnToWelcome() {
    stopThankYouTimer();
    performLogout();
  }

  function startThankYouTimer() {
    let secondsRemaining = 60;
    stopThankYouTimer();
    thankYouTimer = setInterval(() => {
      secondsRemaining -= 1;
      if (secondsRemaining <= 0) returnToWelcome();
    }, 1000);
  }

  async function finishSession(message) {
    if (currentScreen === screenThankYou) return;
    if (currentScreen === screenReview) {
      await autoSaveKioskCustomization({ force: true });
    }
    stopIdleWatcher();
    stopSessionTimer();
    burstAborted = true;
    isCapturing = false;
    capturedImages = [];
    countdownOverlay.classList.add('hidden');
    localStorage.removeItem('photobooth_token');
    customerName = '';
    customerToken = '';
    currentSessionDir = '';
    webcamStreamRequestId++;
    stopWebcam();
    if (thankYouMessage) thankYouMessage.textContent = message;
    showScreen(screenThankYou);
    startThankYouTimer();
    fetch('/api/customer/logout', { method: 'POST' }).catch(() => { });
  }

  async function performLogout() {
    if (currentScreen === screenReview) {
      await autoSaveKioskCustomization({ force: true });
    }
    stopThankYouTimer();
    stopIdleWatcher();
    stopSessionTimer();
    localStorage.removeItem('photobooth_token');
    customerName = '';
    customerToken = '';
    webcamStreamRequestId++;
    stopWebcam();
    inputName.value = '';
    showScreen(screenLogin);
    fetch('/api/customer/logout', { method: 'POST' }).catch(() => { });
  }

  btnLogout.addEventListener('click', performLogout);
  if (btnEndSession) {
    btnEndSession.addEventListener('click', async () => {
      await finishSession('Thank you for creating great memories with Chini Champra Creations. We hope to see you again soon!');
    });
  }
  if (btnReturnWelcome) btnReturnWelcome.addEventListener('click', returnToWelcome);

  // =========================================================================
  // Dashboard Navigation
  // =========================================================================
  btnNewSession.addEventListener('click', async () => {
    await loadSessionDuration();
    startCaptureSession();
  });
  btnGalleryBack.addEventListener('click', async () => {
    resetCaptureView();
    showScreen(screenCapture);
    await startWebcamStream();
  });
  btnGotoGallery.addEventListener('click', async () => {
    await autoSaveKioskCustomization({ force: true });
    loadGallery();
  });
  if (btnCaptureGallery) {
    btnCaptureGallery.addEventListener('click', async () => {
      await autoSaveKioskCustomization({ force: true });
      loadGallery();
    });
  }

  // Review → Start Over
  // Capture → Cancel/Exit
  if (btnCaptureExit) {
    btnCaptureExit.addEventListener('click', () => {
      // Signal the burst loop to stop
      burstAborted = true;
      isCapturing = false;
      // Hide countdown if visible
      countdownOverlay.classList.add('hidden');
      capturedImages = [];
      showScreen(screenDashboard);
    });
  }

  // Reset capture UI to a ready state (not starting a new session)
  function resetCaptureView() {
    burstAborted = false;
    isCapturing = false;
    // Stop countdown & flash
    if (countdownOverlay) countdownOverlay.classList.add('hidden');
    if (flashOverlay) flashOverlay.classList.remove('flash-animation');

    // Reset texts
    if (captureStatus) captureStatus.textContent = 'Get Ready!';
    if (captureInstruction) captureInstruction.textContent = 'Press the button or Space or to start!';

    // Clear thumbnails
    if (thumbsBar) thumbsBar.innerHTML = '';
    for (let i = 0; i < TARGET_PHOTO_COUNT; i++) {
      const slot = document.createElement('div');
      slot.className = 'thumbnail-slot';
      slot.id = `thumb-slot-${i}`;
      thumbsBar.appendChild(slot);
    }

    // Reset progress counter & dots
    const progressCount = document.getElementById('capture-progress-count');
    if (progressCount) progressCount.textContent = `0 / ${TARGET_PHOTO_COUNT}`;
    const progressDots = document.querySelectorAll('#capture-progress-dots .dot');
    progressDots.forEach(d => d.classList.remove('active'));

    // Make sure capture button is enabled
    if (btnCapture) {
      btnCapture.disabled = false;
      btnCapture.classList.remove('disabled');
    }

    // clear capturedImages state
    capturedImages = [];
  }

  // Ensure webcam stream is active (used when returning from gallery)
  async function startWebcamStream() {
    try {
      if (webcamStream) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Webcam API is not available (secure HTTPS context or localhost is required)');
        return;
      }
      const requestId = ++webcamStreamRequestId;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // Prefer the front/selfie camera on phones and tablets. This remains
          // an ideal constraint so external desktop cameras such as GoPro
          // Webcam continue to work when they do not report a facing mode.
          facingMode: { ideal: 'user' },
          // Prefer the highest profile exposed by an external camera (such as
          // GoPro Webcam). "ideal" gracefully falls back to the highest
          // profile the camera offers when 4K is unavailable.
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          aspectRatio: { ideal: 16 / 9 },
          frameRate: { ideal: 30 },
          resizeMode: 'none'
        },
        audio: false
      });
      if (requestId !== webcamStreamRequestId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      webcamStream = stream;
      if (videoWebcam) {
        videoWebcam.srcObject = webcamStream;
        const settings = webcamStream.getVideoTracks()[0]?.getSettings();
        console.info('Webcam stream:', `${settings?.width || '?'}x${settings?.height || '?'}`, `${settings?.frameRate || '?'} fps`);
        // try to play — ignore promise rejection that occurs when autoplay is blocked
        videoWebcam.play().catch(() => { });
      }
    } catch (err) {
      console.warn('Unable to start webcam:', err);
    }
  }

  // Allow Enter/Space on all focusable action buttons
  [btnNewSession].forEach(el => {
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  // (Layout selection removed — hardcoded to 4 photos)

  // =========================================================================
  // Start Capture Session
  // =========================================================================
  async function startCaptureSession() {
    try {
      // Show a loading state on the dashboard button
      btnNewSession.disabled = true;

      const response = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_number: customerToken })
      });

      const sessionData = await response.json();
      if (sessionData.error) throw new Error(sessionData.error);

      currentSessionDir = sessionData.session_dir;
      isEditingGallerySession = false;
      currentGallerySessionTimestamp = null;

      // Reset UI customizations for new capture
      selectedFrameColor = '#ffffff';
      const colorDots = document.querySelectorAll('#frame-color-palette .color-dot');
      if (colorDots) {
        colorDots.forEach(d => d.classList.toggle('active', d.dataset.color === '#ffffff'));
      }

      // Ensure webcam is started and attached
      await startWebcamStream();
      if (videoWebcam && webcamStream) {
        videoWebcam.srcObject = webcamStream;
      }

      // Setup Thumbnail Slots
      thumbsBar.innerHTML = '';
      for (let i = 0; i < TARGET_PHOTO_COUNT; i++) {
        const slot = document.createElement('div');
        slot.className = 'thumbnail-slot';
        slot.id = `thumb-slot-${i}`;
        thumbsBar.appendChild(slot);
      }

      // Show Capture Screen
      capturedImages = [];
      isCapturing = false;
      burstAborted = false;
      captureStatus.textContent = 'Get Ready!';
      captureInstruction.textContent = 'Press the button or Space to start!';
      btnCapture.classList.remove('disabled');
      btnCapture.disabled = false;
      showScreen(screenCapture);

      // The session timer will now start when the first photo is taken.

    } catch (err) {
      console.error(err);
      alert('Error initializing camera/session: ' + err.message);
    } finally {
      btnNewSession.disabled = false;
    }
  }

  // =========================================================================
  // Auto-Burst Capture (4 photos × 5-second countdown each)
  // =========================================================================
  async function startBurstCapture() {
    if (isCapturing) return;

    // Start the session timer on the first capture click
    if (!sessionTimer && !getPersistedTimerEnd()) {
      startSessionTimer();
    } else if (!sessionTimer) {
      restoreSessionTimerIfActive();
    }

    isCapturing = true;
    burstAborted = false;
    currentCaptureTimestamp = String(Math.floor(Date.now() / 1000));
    captureUploadTasks = [];
    uploadedCaptureFiles = [];

    // Disable the manual trigger — it's all automatic now
    btnCapture.classList.add('disabled');
    btnCapture.disabled = true;

    for (let i = 0; i < TARGET_PHOTO_COUNT; i++) {
      // Check if burst was aborted (Escape / timer expiry)
      if (burstAborted) break;

      highlightSlot(i);
      captureStatus.textContent = `Photo ${i + 1} of ${TARGET_PHOTO_COUNT}`;
      captureInstruction.textContent = i === 0 ? 'Strike a pose! 📸' : 'Change pose!';

      await runCountdown(5);
      if (burstAborted) break;

      triggerFlash();
      const imageBlob = await captureSnapshot();
      if (!imageBlob) throw new Error('Unable to encode camera photo');
      const previewUrl = URL.createObjectURL(imageBlob);
      capturedImages.push({ blob: imageBlob, previewUrl });
      fillSlot(i, previewUrl);
      // Start transferring immediately while the next countdown runs. This
      // hides most ngrok upload time without changing image resolution.
      captureUploadTasks.push(uploadCapturedImage(imageBlob, i + 1));

      captureStatus.textContent = `✓ Photo ${i + 1} captured!`;

      // Brief pause between shots so the flash animation is visible
      if (i < TARGET_PHOTO_COUNT - 1) {
        await delayAbortable(600);
        if (burstAborted) break;
      }
    }

    isCapturing = false;
    // Only finish if we weren't aborted
    if (!burstAborted) {
      await finishCapture();
    }
  }

  // Keep the manual capture button as a fallback (hidden by default)
  btnCapture.addEventListener('click', () => {
    if (!isCapturing) startBurstCapture();
  });

  function highlightSlot(idx) {
    const slots = document.querySelectorAll('.thumbnail-slot');
    slots.forEach(s => s.classList.remove('active'));
    const activeSlot = document.getElementById(`thumb-slot-${idx}`);
    if (activeSlot) activeSlot.classList.add('active');
  }

  function fillSlot(idx, previewUrl) {
    const slot = document.getElementById(`thumb-slot-${idx}`);
    if (slot) slot.style.backgroundImage = `url(${previewUrl})`;

    // Update progress counter & dots
    const taken = idx + 1;
    const progressCount = document.getElementById('capture-progress-count');
    if (progressCount) progressCount.textContent = `${taken} / ${TARGET_PHOTO_COUNT}`;
    const dots = document.querySelectorAll('#capture-progress-dots .dot');
    if (dots[idx]) dots[idx].classList.add('active');
  }

  async function uploadCapturedImage(imageBlob, captureIndex) {
    const uploadData = new FormData();
    uploadData.append('session_dir', currentSessionDir);
    uploadData.append('session_timestamp', currentCaptureTimestamp);
    uploadData.append('capture_index', String(captureIndex));
    uploadData.append('images', imageBlob, `capture-${captureIndex}.jpg`);
    const response = await fetch('/api/session/upload', { method: 'POST', body: uploadData });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || 'Photo upload failed');
    uploadedCaptureFiles[captureIndex - 1] = result.files[0];
    return result;
  }

  // =========================================================================
  // KIOSK STUDIO: Interactive Canvas, Kawaii Stickers & Text Overlay
  // =========================================================================
  const kioskCollageCanvas = document.getElementById('kioskCollageCanvas');
  const kioskCtx = kioskCollageCanvas ? kioskCollageCanvas.getContext('2d') : null;
if(kioskCtx) { kioskCtx.imageSmoothingEnabled = true; kioskCtx.imageSmoothingQuality = 'high'; }
  const COLLAGE_WIDTH = 1182;
  const COLLAGE_HEIGHT = 3700;

  let selectedFrameColor = '#ffffff';
  savedFrameColor = '#ffffff';
  let selectedPhotoBorderStyle = 'none';
  let selectedPhotoRadius = 8;
  let hasUnsavedCustomization = false;

  const colorDots = document.querySelectorAll('#frame-color-palette .color-dot');
  const customColorPicker = document.getElementById('custom-color-picker');
  const btnSaveCustomization = document.getElementById('btn-save-customization');
  const frameColorBadge = document.getElementById('kiosk-frame-color-badge');
  const frameColorText = document.getElementById('kiosk-frame-color-text');

  function updateFrameColorBadge(hex, name) {
    if (frameColorBadge) {
      const dot = frameColorBadge.querySelector('.badge-dot');
      if (dot) dot.style.background = hex;
    }
    if (frameColorText) {
      frameColorText.textContent = name ? `${name} (${hex.toUpperCase()})` : hex.toUpperCase();
    }
  }

  // Interactive Layered Rendering State
  let kioskPhotoImages = [];
  let kioskPreviewTimer = null;

  // Frame and sticker edits may arrive rapidly (especially from touch input).
  // Coalesce them into one canvas draw rather than redrawing for every event.
  function scheduleKioskPreviewDraw() {
    if (kioskPreviewTimer) clearTimeout(kioskPreviewTimer);
    kioskPreviewTimer = setTimeout(() => {
      kioskPreviewTimer = null;
      drawKioskCanvas();
    }, 80);
  }

  // Kawaii Stickers Catalog (33 transparent stickers)
  const DEFAULT_KAWAII_STICKERS = [
    { id: 'cake', name: 'Cake', file: 'cake.png' },
    { id: 'camera', name: 'Camera', file: 'camera.png' },
    { id: 'milk-box', name: 'Milk Box', file: 'milk-box.png' },
    { id: 'movie-ticket', name: 'Movie Ticket', file: 'movie-ticket.png' },
    { id: 'pancake', name: 'Pancake', file: 'pancake.png' },
    { id: 'card_game', name: 'Card Game', file: 'card_game.png' },
    { id: 'beat_around_bush', name: 'Beat Around Bush', file: 'beat_around_bush.png' },
    { id: 'finger_heart', name: 'Finger Heart', file: 'finger_heart.png' },
    { id: 'anime_finger_heart', name: 'Anime Heart Girl', file: 'anime_finger_heart.png' },
    { id: 'cute_bunny_love', name: 'Cute Bunny Love', file: 'cute_bunny_love.png' },
    { id: 'rose_apple', name: 'Rose Apple', file: 'rose_apple.png' },
    { id: 'star_heart_duo', name: 'Star & Heart', file: 'star_heart_duo.png' },
    { id: 'kawaii_fluffy_puppy', name: 'Fluffy Puppy', file: 'kawaii_fluffy_puppy.png' },
    { id: 'kawaii_bunny_heart', name: 'Bunny & Heart', file: 'kawaii_bunny_heart.png' },
    { id: 'kawaii_flower_ghost', name: 'Flower Ghost', file: 'kawaii_flower_ghost.png' },
    { id: 'kawaii_donut_stack', name: 'Donut Stack', file: 'kawaii_donut_stack.png' },
    { id: 'kawaii_cute_kitten', name: 'Cute Kitten', file: 'kawaii_cute_kitten.png' },
    { id: 'kawaii_shiba_dog', name: 'Strawberry Shiba', file: 'kawaii_shiba_dog.png' },
    { id: 'kawaii_golden_puppy', name: 'Golden Puppy', file: 'kawaii_golden_puppy.png' },
    { id: 'kawaii_heart_wings', name: 'Angel Heart', file: 'kawaii_heart_wings.png' },
    { id: 'kawaii_paws', name: 'Kawaii Paws', file: 'kawaii_paws.png' },
    { id: 'kawaii_banana_cat', name: 'Banana Cat', file: 'kawaii_banana_cat.png' },
    { id: 'kawaii_apple_cat', name: 'Apple Cat', file: 'kawaii_apple_cat.png' },
    { id: 'kawaii_baby_patrick', name: 'Baby Patrick', file: 'kawaii_baby_patrick.png' },
    { id: 'kawaii_shinchan_belly', name: 'Shinchan Belly', file: 'kawaii_shinchan_belly.png' },
    { id: 'kawaii_piggy_heart', name: 'Winking Piggy', file: 'kawaii_piggy_heart.png' },
    { id: 'kawaii_piggy_pose', name: 'Piggy Pose', file: 'kawaii_piggy_pose.png' },
    { id: 'kawaii_pink_bow_cat', name: 'Pink Bow Cat', file: 'kawaii_pink_bow_cat.png' },
    { id: 'kawaii_happy_chick', name: 'Happy Chick', file: 'kawaii_happy_chick.png' },
    { id: 'kawaii_sparkle_eyes', name: 'Sparkle Eyes', file: 'kawaii_sparkle_eyes.png' },
    { id: 'kawaii_sweet_kiss', name: 'Sweet Kiss', file: 'kawaii_sweet_kiss.png' },
    { id: 'kawaii_jerry_kiss', name: 'Jerry Kiss', file: 'kawaii_jerry_kiss.png' },
    { id: 'kawaii_jerry_heartbeat', name: 'Jerry Heartbeat', file: 'kawaii_jerry_heartbeat.png' }
  ];

  let kioskCustomStickers = [];
  let kioskSelectedSticker = null;
  let kioskActiveDrag = null;

  // Text Overlay State
  let kioskTextOverlay = '';
  let kioskTextX = COLLAGE_WIDTH / 2;
  let kioskTextY = COLLAGE_HEIGHT - 170;
  let kioskTextRotation = 0;
  let kioskFontSize = 90;
  let kioskIsBold = false;
  let kioskIsItalic = false;
  let kioskIsUnderline = false;
  let kioskFontFamily = 'Courier Prime';
  let kioskFontColor = '#000000';
  let kioskIsTextSelected = false;

  // MS Word Color Picker Palettes
  const MSWORD_THEME_BASE = [
    { hex: '#ffffff', name: 'White' },
    { hex: '#000000', name: 'Black' },
    { hex: '#eeece1', name: 'Warm Gray' },
    { hex: '#1f497d', name: 'Dark Blue' },
    { hex: '#4f81bd', name: 'Blue' },
    { hex: '#c0504d', name: 'Red' },
    { hex: '#9bbb59', name: 'Olive Green' },
    { hex: '#8064a2', name: 'Purple' },
    { hex: '#4bacc6', name: 'Aqua' },
    { hex: '#f79646', name: 'Orange' }
  ];

  const MSWORD_THEME_SHADES = [
    ['#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#7f7f7f'],
    ['#7f7f7f', '#595959', '#3f3f3f', '#262626', '#0d0d0d'],
    ['#ddd9c3', '#c4bd97', '#948a54', '#4a452a', '#1e1c11'],
    ['#c6d9f1', '#8eb4e3', '#558ed5', '#17375e', '#10243f'],
    ['#dce6f2', '#b9cde5', '#95b3d7', '#376092', '#254061'],
    ['#f2dcdb', '#e6b9b8', '#d99694', '#963634', '#632523'],
    ['#ebf1de', '#d7e4bd', '#c3d69b', '#77933c', '#4f6228'],
    ['#e6e0ec', '#ccc1db', '#b3a2c7', '#604a7b', '#403152'],
    ['#dbeef4', '#b7dde8', '#93cddd', '#31859c', '#215968'],
    ['#fdeada', '#fcd5b5', '#fac090', '#e46c0a', '#984807']
  ];

  const MSWORD_STANDARD_COLORS = [
    { hex: '#c00000', name: 'Dark Red' },
    { hex: '#ff0000', name: 'Red' },
    { hex: '#ffc000', name: 'Orange' },
    { hex: '#ffff00', name: 'Yellow' },
    { hex: '#92d050', name: 'Light Green' },
    { hex: '#00b050', name: 'Green' },
    { hex: '#00b0f0', name: 'Light Blue' },
    { hex: '#0070c0', name: 'Blue' },
    { hex: '#002060', name: 'Dark Blue' },
    { hex: '#7030a0', name: 'Purple' }
  ];

  // =========================================================================
  // Canvas Rendering Function & Photo Border Accents
  // =========================================================================
  function drawPhotoBorderAccent(x, y, w, h, radius) {
    if (!selectedPhotoBorderStyle || selectedPhotoBorderStyle === 'none') return;

    kioskCtx.save();
    const r = radius || 0;

    function buildRoundRectPath(inset = 0) {
      kioskCtx.beginPath();
      const ix = x + inset;
      const iy = y + inset;
      const iw = w - inset * 2;
      const ih = h - inset * 2;
      const ir = Math.max(0, r - inset);
      if (ir > 0) {
        kioskCtx.moveTo(ix + ir, iy);
        kioskCtx.lineTo(ix + iw - ir, iy);
        kioskCtx.quadraticCurveTo(ix + iw, iy, ix + iw, iy + ir);
        kioskCtx.lineTo(ix + iw, iy + ih - ir);
        kioskCtx.quadraticCurveTo(ix + iw, iy + ih, ix + iw - ir, iy + ih);
        kioskCtx.lineTo(ix + ir, iy + ih);
        kioskCtx.quadraticCurveTo(ix, iy + ih, ix, iy + ih - ir);
        kioskCtx.lineTo(ix, iy + ir);
        kioskCtx.quadraticCurveTo(ix, iy, ix + ir, iy);
        kioskCtx.closePath();
      } else {
        kioskCtx.rect(ix, iy, iw, ih);
      }
    }

    if (selectedPhotoBorderStyle === 'white') {
      kioskCtx.strokeStyle = '#ffffff';
      kioskCtx.lineWidth = 12;
      buildRoundRectPath(6);
      kioskCtx.stroke();
    } else if (selectedPhotoBorderStyle === 'dark') {
      kioskCtx.strokeStyle = '#1a1a1a';
      kioskCtx.lineWidth = 12;
      buildRoundRectPath(6);
      kioskCtx.stroke();
    } else if (selectedPhotoBorderStyle === 'double') {
      // Outer line
      kioskCtx.strokeStyle = '#222222';
      kioskCtx.lineWidth = 6;
      buildRoundRectPath(3);
      kioskCtx.stroke();
      // Inner line
      kioskCtx.strokeStyle = '#ffffff';
      kioskCtx.lineWidth = 4;
      buildRoundRectPath(14);
      kioskCtx.stroke();
    } else if (selectedPhotoBorderStyle === 'gold') {
      kioskCtx.strokeStyle = '#d4af37';
      kioskCtx.lineWidth = 12;
      buildRoundRectPath(6);
      kioskCtx.stroke();
    }

    kioskCtx.restore();
  }

  function drawKioskCanvas(isExporting = false) {
    if (!kioskCtx || !kioskCollageCanvas) return;

    // 1. Clear background with active frame color
    kioskCtx.fillStyle = selectedFrameColor;
    kioskCtx.fillRect(0, 0, COLLAGE_WIDTH, COLLAGE_HEIGHT);

    // 2. Draw Captured Photos or Full Photostrip Collage
    const photoW = 1022;
    const photoH = 752;
    const leftMargin = 80;
    const topMargin = 80;
    const gutter = 80;

    if (kioskPhotoImages.length === 1 && kioskPhotoImages[0].naturalHeight > kioskPhotoImages[0].naturalWidth * 1.8) {
      // Full photostrip collage
      kioskCtx.drawImage(kioskPhotoImages[0], 0, 0, COLLAGE_WIDTH, COLLAGE_HEIGHT);
    } else if (kioskPhotoImages.length > 0) {
      for (let i = 0; i < Math.min(4, kioskPhotoImages.length); i++) {
        const img = kioskPhotoImages[i];
        if (!img) continue;
        const y = topMargin + i * (photoH + gutter);

        // Clip corners for photo
        kioskCtx.save();
        kioskCtx.beginPath();
        const r = selectedPhotoRadius;
        if (r > 0) {
          kioskCtx.moveTo(leftMargin + r, y);
          kioskCtx.lineTo(leftMargin + photoW - r, y);
          kioskCtx.quadraticCurveTo(leftMargin + photoW, y, leftMargin + photoW, y + r);
          kioskCtx.lineTo(leftMargin + photoW, y + photoH - r);
          kioskCtx.quadraticCurveTo(leftMargin + photoW, y + photoH, leftMargin + photoW - r, y + photoH);
          kioskCtx.lineTo(leftMargin + r, y + photoH);
          kioskCtx.quadraticCurveTo(leftMargin, y + photoH, leftMargin, y + photoH - r);
          kioskCtx.lineTo(leftMargin, y + r);
          kioskCtx.quadraticCurveTo(leftMargin, y, leftMargin + r, y);
          kioskCtx.closePath();
          kioskCtx.clip();
        } else {
          kioskCtx.rect(leftMargin, y, photoW, photoH);
          kioskCtx.clip();
        }

        kioskCtx.drawImage(img, leftMargin, y, photoW, photoH);
        kioskCtx.restore();

        // Draw photo accent border if active
        drawPhotoBorderAccent(leftMargin, y, photoW, photoH, selectedPhotoRadius);
      }
    }

    // 3. Draw Custom Kawaii Stickers
    kioskCustomStickers.forEach(s => {
      kioskCtx.save();
      kioskCtx.translate(s.x, s.y);
      kioskCtx.rotate(s.rotation);
      if (s.flipX) kioskCtx.scale(-1, 1);
      kioskCtx.drawImage(s.img, -s.width / 2, -s.height / 2, s.width, s.height);
      kioskCtx.restore();

      // MS Word-style selection box & handles (on screen only)
      if (!isExporting && kioskSelectedSticker === s) {
        kioskCtx.save();
        kioskCtx.translate(s.x, s.y);
        kioskCtx.rotate(s.rotation);
        const hw = s.width / 2;
        const hh = s.height / 2;

        // Bounding box
        kioskCtx.strokeStyle = '#FF4696';
        kioskCtx.lineWidth = 6;
        kioskCtx.setLineDash([18, 12]);
        kioskCtx.strokeRect(-hw - 12, -hh - 12, s.width + 24, s.height + 24);
        kioskCtx.setLineDash([]);

        // Rotation stem & top handle
        kioskCtx.beginPath();
        kioskCtx.moveTo(0, -hh - 12);
        kioskCtx.lineTo(0, -hh - 120);
        kioskCtx.strokeStyle = '#FF4696';
        kioskCtx.lineWidth = 6;
        kioskCtx.stroke();

        kioskCtx.beginPath();
        kioskCtx.arc(0, -hh - 120, 60, 0, Math.PI * 2);
        kioskCtx.fillStyle = '#ffffff';
        kioskCtx.fill();
        kioskCtx.lineWidth = 6;
        kioskCtx.strokeStyle = '#FF4696';
        kioskCtx.stroke();

        kioskCtx.font = 'bold 75px sans-serif';
        kioskCtx.textAlign = 'center';
        kioskCtx.textBaseline = 'middle';
        kioskCtx.fillStyle = '#FF4696';
        kioskCtx.fillText('↻', 0, -hh - 114);

        // Top-right Delete handle (✕)
        kioskCtx.beginPath();
        kioskCtx.arc(hw + 60, -hh - 60, 56, 0, Math.PI * 2);
        kioskCtx.fillStyle = '#ef4444';
        kioskCtx.fill();
        kioskCtx.lineWidth = 8;
        kioskCtx.strokeStyle = '#1E1033';
        kioskCtx.stroke();

        kioskCtx.font = 'bold 65px sans-serif';
        kioskCtx.textAlign = 'center';
        kioskCtx.textBaseline = 'middle';
        kioskCtx.fillStyle = '#ffffff';
        kioskCtx.fillText('✕', hw + 60, -hh - 58);

        // Top-left Flip handle (⇄)
        kioskCtx.beginPath();
        kioskCtx.arc(-hw - 60, -hh - 60, 56, 0, Math.PI * 2);
        kioskCtx.fillStyle = '#3b82f6';
        kioskCtx.fill();
        kioskCtx.lineWidth = 8;
        kioskCtx.strokeStyle = '#1E1033';
        kioskCtx.stroke();

        kioskCtx.font = 'bold 65px sans-serif';
        kioskCtx.textAlign = 'center';
        kioskCtx.textBaseline = 'middle';
        kioskCtx.fillStyle = '#ffffff';
        kioskCtx.fillText('⇄', -hw - 60, -hh - 60);

        // 4 Corner resize handles
        const corners = [
          [-hw - 12, -hh - 12],
          [hw + 12, -hh - 12],
          [hw + 12, hh + 12],
          [-hw - 12, hh + 12]
        ];
        corners.forEach(([cx, cy]) => {
          kioskCtx.beginPath();
          kioskCtx.arc(cx, cy, 32, 0, Math.PI * 2);
          kioskCtx.fillStyle = '#ffffff';
          kioskCtx.fill();
          kioskCtx.lineWidth = 7;
          kioskCtx.strokeStyle = '#FF4696';
          kioskCtx.stroke();
        });

        kioskCtx.restore();
      }
    });

    // 5. Draw Text Overlay
    if (kioskTextOverlay) {
      kioskCtx.save();
      kioskCtx.translate(kioskTextX, kioskTextY);
      kioskCtx.rotate(kioskTextRotation);

      const fontStyle = `${kioskIsItalic ? 'italic ' : ''}${kioskIsBold ? 'bold ' : ''}${kioskFontSize}px "${kioskFontFamily}", sans-serif`;
      kioskCtx.font = fontStyle;
      kioskCtx.textAlign = 'center';
      kioskCtx.textBaseline = 'middle';

      const metrics = kioskCtx.measureText(kioskTextOverlay);
      const tw = metrics.width;
      const th = kioskFontSize;

      // Crisp contrast outline
      const activeColor = kioskFontColor || '#000000';
      kioskCtx.strokeStyle = (activeColor.toLowerCase() === '#ffffff' || activeColor.toLowerCase() === '#fff') ? '#000000' : '#ffffff';
      kioskCtx.lineWidth = Math.max(3, kioskFontSize * 0.06);
      kioskCtx.strokeText(kioskTextOverlay, 0, 0);

      kioskCtx.fillStyle = activeColor;
      kioskCtx.fillText(kioskTextOverlay, 0, 0);

      // Underline
      if (kioskIsUnderline) {
        kioskCtx.beginPath();
        const lineY = th * 0.48;
        kioskCtx.moveTo(-tw / 2, lineY);
        kioskCtx.lineTo(tw / 2, lineY);
        kioskCtx.lineWidth = Math.max(3, kioskFontSize * 0.08);
        kioskCtx.strokeStyle = activeColor;
        kioskCtx.stroke();
      }

      // MS Word-style text selection handles (on screen only)
      if (!isExporting && kioskIsTextSelected) {
        const hw = tw / 2 + 25;
        const hh = th * 0.6 + 20;

        // Bounding box
        kioskCtx.strokeStyle = '#FF4696';
        kioskCtx.lineWidth = 6;
        kioskCtx.setLineDash([18, 12]);
        kioskCtx.strokeRect(-hw, -hh, hw * 2, hh * 2);
        kioskCtx.setLineDash([]);

        // Rotation stem & top handle
        kioskCtx.beginPath();
        kioskCtx.moveTo(0, -hh);
        kioskCtx.lineTo(0, -hh - 80);
        kioskCtx.strokeStyle = '#FF4696';
        kioskCtx.lineWidth = 5;
        kioskCtx.stroke();

        kioskCtx.beginPath();
        kioskCtx.arc(0, -hh - 80, 36, 0, Math.PI * 2);
        kioskCtx.fillStyle = '#ffffff';
        kioskCtx.fill();
        kioskCtx.lineWidth = 6;
        kioskCtx.strokeStyle = '#FF4696';
        kioskCtx.stroke();

        kioskCtx.font = 'bold 36px sans-serif';
        kioskCtx.textAlign = 'center';
        kioskCtx.textBaseline = 'middle';
        kioskCtx.fillStyle = '#FF4696';
        kioskCtx.fillText('↻', 0, -hh - 78);

        // Top-right Delete handle (✕)
        kioskCtx.beginPath();
        kioskCtx.arc(hw + 40, -hh - 40, 36, 0, Math.PI * 2);
        kioskCtx.fillStyle = '#ef4444';
        kioskCtx.fill();
        kioskCtx.lineWidth = 6;
        kioskCtx.strokeStyle = '#1E1033';
        kioskCtx.stroke();

        kioskCtx.font = 'bold 30px sans-serif';
        kioskCtx.textAlign = 'center';
        kioskCtx.textBaseline = 'middle';
        kioskCtx.fillStyle = '#ffffff';
        kioskCtx.fillText('✕', hw + 40, -hh - 38);

        // 4 Corner resize handles
        const corners = [
          [-hw, -hh],
          [hw, -hh],
          [hw, hh],
          [-hw, hh]
        ];
        corners.forEach(([cx, cy]) => {
          kioskCtx.beginPath();
          kioskCtx.arc(cx, cy, 26, 0, Math.PI * 2);
          kioskCtx.fillStyle = '#ffffff';
          kioskCtx.fill();
          kioskCtx.lineWidth = 6;
          kioskCtx.strokeStyle = '#FF4696';
          kioskCtx.stroke();
        });
      }

      kioskCtx.restore();
    }
  }

  // Preload photo images from URLs with CORS safety and fallback
  async function loadKioskPhotosFromUrls(urls) {
    if (!urls || !urls.length) return;
    const loadPromises = urls.map(url => {
      return new Promise((resolve) => {
        const img = new Image();
        const isExternal = url.startsWith('http://') || url.startsWith('https://');
        if (isExternal && !url.startsWith(window.location.origin)) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => resolve(img);
        img.onerror = () => {
          if (img.crossOrigin) {
            const fallback = new Image();
            fallback.onload = () => resolve(fallback);
            fallback.onerror = () => {
              console.warn('Failed to load image even without CORS:', url);
              resolve(null);
            };
            fallback.src = url;
          } else {
            console.warn('Failed to load image:', url);
            resolve(null);
          }
        };
        const cacheBuster = (url.includes('?') ? '&' : '?') + 't=' + Date.now();
        img.src = url.startsWith('data:') ? url : (url + cacheBuster);
      });
    });
    const loaded = await Promise.all(loadPromises);
    const validImages = loaded.filter(Boolean);
    if (validImages.length > 0) {
      kioskPhotoImages = validImages;
      scheduleKioskPreviewDraw();
    }
  }

  // Automatically load the latest session photos if canvas is empty
  async function autoLoadLatestKioskPhotos() {
    if (kioskPhotoImages && kioskPhotoImages.length > 0) return;

    if (capturedImages && capturedImages.length > 0) {
      await loadKioskPhotosFromUrls(capturedImages.map(image => image.previewUrl || image));
      return;
    }

    try {
      const res = await fetch('/api/customer/gallery');
      if (res.ok) {
        const data = await res.json();
        const sessions = data.sessions || [];
        if (sessions.length > 0) {
          const latest = sessions[0];
          currentGallerySessionTimestamp = latest.timestamp;
          if (latest.files && latest.files.length >= 4) {
            await loadKioskPhotosFromUrls(latest.files);
          } else if (latest.collage_url) {
            await loadKioskPhotosFromUrls([latest.collage_url]);
          }
        }
      }
    } catch (err) {
      console.warn('Auto-load latest session error:', err);
    }
  }

  // Save State Watcher
  function updateSaveCustomizationState(isHistoryRestore = false, skipHistory = false) {
    if (!btnSaveCustomization) return;
    
    let isUnsaved = hasUnsavedCustomization;
    if (typeof window.isKioskEdited === 'function') {
      isUnsaved = isUnsaved || window.isKioskEdited();
    } else {
      const hasUnsavedFrameChange = selectedFrameColor !== savedFrameColor;
      const hasActiveStickers = kioskCustomStickers.length > 0;
      const hasActiveText = kioskTextOverlay.trim().length > 0;
      isUnsaved = hasUnsavedFrameChange || hasActiveStickers || hasActiveText || hasUnsavedCustomization;
    }
    
    btnSaveCustomization.disabled = !isUnsaved;
    btnSaveCustomization.innerHTML = isUnsaved ? 'Save Your Edits' : 'Saved ✓';
    if (!isHistoryRestore && !skipHistory && typeof debouncedPushHistory === 'function') {
      debouncedPushHistory();
    }
  }

  // Color dots click events (Frame Color)
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      selectedFrameColor = dot.dataset.color;
      updateFrameColorBadge(selectedFrameColor, dot.dataset.name || dot.title);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      scheduleKioskPreviewDraw();
    });
  });

  if (customColorPicker) {
    customColorPicker.addEventListener('input', (e) => {
      colorDots.forEach(d => d.classList.remove('active'));
      selectedFrameColor = e.target.value;
      updateFrameColorBadge(selectedFrameColor, 'Custom Color');
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      scheduleKioskPreviewDraw();
    });
  }

  // Photo Accent Border Click Events
  const photoBorderBtns = document.querySelectorAll('#kiosk-photo-border-options .frame-accent-btn');
  photoBorderBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      photoBorderBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPhotoBorderStyle = btn.dataset.border || 'none';
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      scheduleKioskPreviewDraw();
    });
  });

  // Photo Corner Radius Click Events
  const photoCornerBtns = document.querySelectorAll('#kiosk-photo-corner-options .frame-corner-btn');
  photoCornerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      photoCornerBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPhotoRadius = Number(btn.dataset.radius) || 0;
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      scheduleKioskPreviewDraw();
    });
  });

  // =========================================================================
  // Studio Segmented Tabs Navigation
  // =========================================================================
  const studioTabBtns = document.querySelectorAll('#kiosk-studio-tabs .studio-tab-btn');
  studioTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      studioTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.dataset.tab;
      document.querySelectorAll('.studio-tab-panel').forEach(p => p.classList.remove('active'));
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');

      if (targetId === 'tab-text') {
        if (kioskTextOverlay) {
          kioskIsTextSelected = true;
          kioskSelectedSticker = null;
          updateKioskStickerControlsUI();
          drawKioskCanvas();
        }
      } else if (targetId === 'tab-stickers') {
        kioskIsTextSelected = false;
        drawKioskCanvas();
      }
    });
  });

  // =========================================================================
  // Kawaii Stickers Tray & Micro-Toolbar Logic
  // =========================================================================
  async function initKioskStickersTray() {
    const tray = document.getElementById('kiosk-stickers-tray');
    if (!tray) return;

    let stickersList = DEFAULT_KAWAII_STICKERS;
    try {
      const res = await fetch('/api/stickers');
      if (res.ok) {
        const data = await res.json();
        if (data.stickers && data.stickers.length > 0) {
          stickersList = data.stickers;
        }
      }
    } catch (err) {
      console.warn('Using default kawaii stickers list:', err);
    }

    tray.innerHTML = '';
    stickersList.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kiosk-sticker-item-btn';
      btn.title = `Add ${item.name} to photostrip`;
      btn.innerHTML = `
        <img src="${item.url || '/static/stickers/kawaii/' + item.file}" alt="${item.name}">
        <span>${item.name}</span>
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        addKioskSticker(item);
      });
      tray.appendChild(btn);
    });

    const koreaTray = document.getElementById('kiosk-korea-stickers-tray');
    if (koreaTray) {
      try {
        const koreaRes = await fetch('/api/stickers/korea');
        if (koreaRes.ok) {
          const koreaData = await koreaRes.json();
          const koreaStickersList = koreaData.stickers || [];
          koreaTray.innerHTML = '';
          koreaStickersList.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'kiosk-sticker-item-btn';
            btn.title = `Add ${item.name} to photostrip`;
            btn.innerHTML = `
              <img src="${item.url}" alt="${item.name}">
              <span>${item.name}</span>
            `;
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              addKioskSticker(item);
            });
            koreaTray.appendChild(btn);
          });
        }
      } catch (err) {
        console.warn('Error loading korea stickers:', err);
      }
    }
  }

  function addKioskSticker(item, targetX, targetY) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const baseW = 280;
      const baseH = Math.round(baseW / aspectRatio);

      let spawnX = targetX;
      let spawnY = targetY;
      if (spawnX === undefined || spawnY === undefined) {
        const offset = (kioskCustomStickers.length % 5) * 50;
        spawnX = Math.round(COLLAGE_WIDTH / 2 + (kioskCustomStickers.length % 2 === 0 ? offset : -offset));
        spawnY = Math.round(COLLAGE_HEIGHT * 0.45 + offset);
      }

      const newSticker = {
        id: 'stk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: item.name,
        file: item.file,
        img: img,
        x: spawnX,
        y: spawnY,
        width: baseW,
        height: baseH,
        aspectRatio: aspectRatio,
        rotation: 0,
        flipX: false
      };

      kioskCustomStickers.push(newSticker);
      kioskSelectedSticker = newSticker;
      kioskIsTextSelected = false;
      hasUnsavedCustomization = true;
      updateKioskStickerControlsUI();
      updateSaveCustomizationState();
      scheduleKioskPreviewDraw();
    };
    img.src = item.url || `/static/stickers/kawaii/${item.file}`;
  }

  function updateKioskStickerControlsUI() {
    const controls = document.getElementById('kiosk-selected-sticker-controls');
    const badge = document.getElementById('kiosk-stickers-badge');
    const btnClearAll = document.getElementById('btn-kiosk-clear-stickers');
    const nameLabel = document.getElementById('kiosk-selected-sticker-name');

    if (badge) {
      if (kioskCustomStickers.length > 0) {
        badge.textContent = kioskCustomStickers.length;
        badge.style.display = 'inline-block';
        if (btnClearAll) btnClearAll.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
        if (btnClearAll) btnClearAll.style.display = 'none';
      }
    }

    if (controls) {
      if (kioskSelectedSticker) {
        controls.style.display = 'flex';
        if (nameLabel) nameLabel.textContent = kioskSelectedSticker.name || 'Sticker';
      } else {
        controls.style.display = 'none';
      }
    }
  }

  function deleteSelectedKioskSticker() {
    if (!kioskSelectedSticker) return;
    kioskCustomStickers = kioskCustomStickers.filter(s => s.id !== kioskSelectedSticker.id);
    kioskSelectedSticker = null;
    hasUnsavedCustomization = true;
    updateKioskStickerControlsUI();
    updateSaveCustomizationState();
    drawKioskCanvas();
  }

  function clearAllKioskStickers() {
    if (!kioskCustomStickers.length) return;
    if (confirm('Remove all stickers from this photostrip?')) {
      kioskCustomStickers = [];
      kioskSelectedSticker = null;
      hasUnsavedCustomization = true;
      updateKioskStickerControlsUI();
      updateSaveCustomizationState();
      drawKioskCanvas();
    }
  }

  const btnKioskDeleteSticker = document.getElementById('btn-kiosk-delete-sticker');
  if (btnKioskDeleteSticker) btnKioskDeleteSticker.addEventListener('click', deleteSelectedKioskSticker);

  const btnKioskClearStickers = document.getElementById('btn-kiosk-clear-stickers');
  if (btnKioskClearStickers) btnKioskClearStickers.addEventListener('click', clearAllKioskStickers);

  const btnKioskRotateLeft = document.getElementById('btn-kiosk-rotate-left');
  if (btnKioskRotateLeft) {
    btnKioskRotateLeft.addEventListener('click', () => {
      if (!kioskSelectedSticker) return;
      kioskSelectedSticker.rotation -= (15 * Math.PI / 180);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  const btnKioskRotateRight = document.getElementById('btn-kiosk-rotate-right');
  if (btnKioskRotateRight) {
    btnKioskRotateRight.addEventListener('click', () => {
      if (!kioskSelectedSticker) return;
      kioskSelectedSticker.rotation += (15 * Math.PI / 180);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  const btnKioskScaleDown = document.getElementById('btn-kiosk-scale-down');
  if (btnKioskScaleDown) {
    btnKioskScaleDown.addEventListener('click', () => {
      if (!kioskSelectedSticker) return;
      const newW = Math.max(60, kioskSelectedSticker.width * 0.85);
      kioskSelectedSticker.width = Math.round(newW);
      kioskSelectedSticker.height = Math.round(newW / kioskSelectedSticker.aspectRatio);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  const btnKioskScaleUp = document.getElementById('btn-kiosk-scale-up');
  if (btnKioskScaleUp) {
    btnKioskScaleUp.addEventListener('click', () => {
      if (!kioskSelectedSticker) return;
      const newW = Math.min(COLLAGE_WIDTH * 0.95, kioskSelectedSticker.width * 1.15);
      kioskSelectedSticker.width = Math.round(newW);
      kioskSelectedSticker.height = Math.round(newW / kioskSelectedSticker.aspectRatio);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  const btnKioskFlipSticker = document.getElementById('btn-kiosk-flip-sticker');
  if (btnKioskFlipSticker) {
    btnKioskFlipSticker.addEventListener('click', () => {
      if (!kioskSelectedSticker) return;
      kioskSelectedSticker.flipX = !kioskSelectedSticker.flipX;
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  // =========================================================================
  // Text Overlay Form Controls & MS Word Color Picker
  // =========================================================================
  const kioskOverlayTextInput = document.getElementById('kiosk-overlay-text');
  const kioskFontFamilySelect = document.getElementById('kiosk-font-family');
  const kioskSliderFontSize = document.getElementById('kiosk-slider-font-size');
  const kioskValFontSize = document.getElementById('kiosk-val-font-size');
  const btnKioskTextBold = document.getElementById('btn-kiosk-text-bold');
  const btnKioskTextItalic = document.getElementById('btn-kiosk-text-italic');
  const btnKioskTextUnderline = document.getElementById('btn-kiosk-text-underline');
  const btnKioskApplyText = document.getElementById('btn-kiosk-apply-text');
  const btnKioskClearText = document.getElementById('btn-kiosk-clear-text');

  // MS Word color elements
  const btnKioskMSWordColorToggle = document.getElementById('btn-kiosk-msword-color-toggle');
  const kioskMSWordPaletteDropdown = document.getElementById('kiosk-msword-palette-dropdown');
  const kioskMSWordActiveColorBar = document.getElementById('kiosk-msword-active-color-bar');
  const kioskMSWordColorName = document.getElementById('kiosk-msword-color-name');
  const kioskMSWordThemeTopRow = document.getElementById('kiosk-msword-theme-top-row');
  const kioskMSWordThemeShadesGrid = document.getElementById('kiosk-msword-theme-shades-grid');
  const kioskMSWordStandardGrid = document.getElementById('kiosk-msword-standard-grid');
  const kioskMSWordCustomColorInput = document.getElementById('kiosk-msword-custom-color-input');

  if (kioskOverlayTextInput) {
    kioskOverlayTextInput.addEventListener('input', () => {
      kioskTextOverlay = kioskOverlayTextInput.value;
      kioskIsTextSelected = !!kioskTextOverlay;
      if (kioskIsTextSelected) kioskSelectedSticker = null;
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  if (btnKioskApplyText) {
    btnKioskApplyText.addEventListener('click', () => {
      kioskTextOverlay = kioskOverlayTextInput ? kioskOverlayTextInput.value.trim() : '';
      if (kioskTextOverlay) kioskIsTextSelected = true;
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  if (btnKioskClearText) {
    btnKioskClearText.addEventListener('click', () => {
      if (kioskOverlayTextInput) kioskOverlayTextInput.value = '';
      kioskTextOverlay = '';
      kioskIsTextSelected = false;
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  if (kioskFontFamilySelect) {
    kioskFontFamilySelect.style.fontFamily = `"${kioskFontFamilySelect.value}", sans-serif`;
    kioskFontFamilySelect.addEventListener('change', async () => {
      kioskFontFamily = kioskFontFamilySelect.value;
      kioskFontFamilySelect.style.fontFamily = `"${kioskFontFamily}", sans-serif`;
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      try {
        await document.fonts.load(`90px "${kioskFontFamily}"`);
      } catch (e) { }
      drawKioskCanvas();
    });
  }

  if (kioskSliderFontSize) {
    kioskSliderFontSize.addEventListener('input', (e) => {
      kioskFontSize = parseInt(e.target.value, 10);
      if (kioskValFontSize) kioskValFontSize.textContent = kioskFontSize + 'px';
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  if (btnKioskTextBold) {
    btnKioskTextBold.addEventListener('click', () => {
      kioskIsBold = !kioskIsBold;
      btnKioskTextBold.classList.toggle('active', kioskIsBold);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  if (btnKioskTextItalic) {
    btnKioskTextItalic.addEventListener('click', () => {
      kioskIsItalic = !kioskIsItalic;
      btnKioskTextItalic.classList.toggle('active', kioskIsItalic);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  if (btnKioskTextUnderline) {
    btnKioskTextUnderline.addEventListener('click', () => {
      kioskIsUnderline = !kioskIsUnderline;
      btnKioskTextUnderline.classList.toggle('active', kioskIsUnderline);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    });
  }

  function applyKioskFontColor(hex, name) {
    kioskFontColor = hex;
    if (kioskMSWordActiveColorBar) kioskMSWordActiveColorBar.style.backgroundColor = hex;
    if (kioskMSWordColorName) kioskMSWordColorName.textContent = name || hex;
    if (kioskMSWordPaletteDropdown) kioskMSWordPaletteDropdown.style.display = 'none';

    document.querySelectorAll('#kiosk-msword-palette-dropdown .msword-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color.toLowerCase() === hex.toLowerCase());
    });

    hasUnsavedCustomization = true;
    updateSaveCustomizationState();
    drawKioskCanvas();
  }

  function initKioskMSWordColorPicker() {
    // ---- FONT COLOR PICKER ----
    if (kioskMSWordThemeTopRow && kioskMSWordThemeShadesGrid && kioskMSWordStandardGrid) {
      kioskMSWordThemeTopRow.innerHTML = '';
      MSWORD_THEME_BASE.forEach(item => {
        const swatch = document.createElement('div');
        swatch.className = 'msword-swatch' + (item.hex === kioskFontColor ? ' active' : '');
        swatch.style.backgroundColor = item.hex;
        swatch.title = item.name;
        swatch.dataset.color = item.hex;
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          applyKioskFontColor(item.hex, item.name);
        });
        kioskMSWordThemeTopRow.appendChild(swatch);
      });

      kioskMSWordThemeShadesGrid.innerHTML = '';
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 10; c++) {
          const hex = MSWORD_THEME_SHADES[c][r];
          const baseName = MSWORD_THEME_BASE[c].name;
          const swatch = document.createElement('div');
          swatch.className = 'msword-swatch' + (hex.toLowerCase() === kioskFontColor.toLowerCase() ? ' active' : '');
          swatch.style.backgroundColor = hex;
          swatch.title = `${baseName} (shade ${r + 1})`;
          swatch.dataset.color = hex;
          swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            applyKioskFontColor(hex, baseName);
          });
          kioskMSWordThemeShadesGrid.appendChild(swatch);
        }
      }

      kioskMSWordStandardGrid.innerHTML = '';
      MSWORD_STANDARD_COLORS.forEach(item => {
        const swatch = document.createElement('div');
        swatch.className = 'msword-swatch' + (item.hex.toLowerCase() === kioskFontColor.toLowerCase() ? ' active' : '');
        swatch.style.backgroundColor = item.hex;
        swatch.title = item.name;
        swatch.dataset.color = item.hex;
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          applyKioskFontColor(item.hex, item.name);
        });
        kioskMSWordStandardGrid.appendChild(swatch);
      });

      if (btnKioskMSWordColorToggle && kioskMSWordPaletteDropdown) {
        btnKioskMSWordColorToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = kioskMSWordPaletteDropdown.style.display === 'none';
          kioskMSWordPaletteDropdown.style.display = isHidden ? 'block' : 'none';
        });
      }

      if (kioskMSWordCustomColorInput) {
        kioskMSWordCustomColorInput.addEventListener('input', (e) => {
          applyKioskFontColor(e.target.value, e.target.value.toUpperCase());
        });
      }
    }

    // ---- FRAME CUSTOM COLOR PICKER ----
    const frameThemeTop = document.getElementById('kiosk-frame-msword-theme-top-row');
    const frameThemeShades = document.getElementById('kiosk-frame-msword-theme-shades-grid');
    const frameStandard = document.getElementById('kiosk-frame-msword-standard-grid');
    const btnFrameToggle = document.getElementById('btn-kiosk-frame-custom-toggle');
    const frameDropdown = document.getElementById('kiosk-frame-msword-palette-dropdown');
    const frameCustomInput = document.getElementById('kiosk-frame-msword-custom-color');

    function applyFrameCustomColor(hex, name) {
      if (typeof colorDots !== 'undefined') {
        colorDots.forEach(d => d.classList.remove('active'));
      }
      selectedFrameColor = hex;
      updateFrameColorBadge(hex, name);
      hasUnsavedCustomization = true;
      updateSaveCustomizationState();
      drawKioskCanvas();
    }

    if (frameThemeTop && frameThemeShades && frameStandard) {
      frameThemeTop.innerHTML = '';
      MSWORD_THEME_BASE.forEach(item => {
        const swatch = document.createElement('div');
        swatch.className = 'msword-swatch' + (item.hex === selectedFrameColor ? ' active' : '');
        swatch.style.backgroundColor = item.hex;
        swatch.title = item.name;
        swatch.dataset.color = item.hex;
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          applyFrameCustomColor(item.hex, item.name);
          frameDropdown.style.display = 'none';
        });
        frameThemeTop.appendChild(swatch);
      });

      frameThemeShades.innerHTML = '';
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 10; c++) {
          const hex = MSWORD_THEME_SHADES[c][r];
          const baseName = MSWORD_THEME_BASE[c].name;
          const swatch = document.createElement('div');
          swatch.className = 'msword-swatch' + (hex.toLowerCase() === selectedFrameColor.toLowerCase() ? ' active' : '');
          swatch.style.backgroundColor = hex;
          swatch.title = `${baseName} (shade ${r + 1})`;
          swatch.dataset.color = hex;
          swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            applyFrameCustomColor(hex, baseName);
            frameDropdown.style.display = 'none';
          });
          frameThemeShades.appendChild(swatch);
        }
      }

      frameStandard.innerHTML = '';
      MSWORD_STANDARD_COLORS.forEach(item => {
        const swatch = document.createElement('div');
        swatch.className = 'msword-swatch' + (item.hex.toLowerCase() === selectedFrameColor.toLowerCase() ? ' active' : '');
        swatch.style.backgroundColor = item.hex;
        swatch.title = item.name;
        swatch.dataset.color = item.hex;
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          applyFrameCustomColor(item.hex, item.name);
          frameDropdown.style.display = 'none';
        });
        frameStandard.appendChild(swatch);
      });

      if (btnFrameToggle && frameDropdown) {
        btnFrameToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = frameDropdown.style.display === 'none';
          frameDropdown.style.display = isHidden ? 'block' : 'none';
        });
      }

      if (frameCustomInput) {
        frameCustomInput.addEventListener('input', (e) => {
          applyFrameCustomColor(e.target.value, e.target.value.toUpperCase());
        });
      }
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      const containerFont = document.getElementById('kiosk-msword-color-picker-container');
      if (containerFont && !containerFont.contains(e.target) && kioskMSWordPaletteDropdown) {
        kioskMSWordPaletteDropdown.style.display = 'none';
      }
      const containerFrame = document.getElementById('kiosk-frame-custom-picker-container');
      if (containerFrame && !containerFrame.contains(e.target) && frameDropdown) {
        frameDropdown.style.display = 'none';
      }
    });
  }

  // =========================================================================
  // Canvas Hit Testing & Direct Handle Pointer Handlers
  // =========================================================================
  function getKioskCanvasPos(e) {
    if (!kioskCollageCanvas) return { x: 0, y: 0 };
    const rect = kioskCollageCanvas.getBoundingClientRect();
    const scaleX = kioskCollageCanvas.width / rect.width;
    const scaleY = kioskCollageCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function getKioskStickerHandleAt(s, px, py) {
    const dx = px - s.x;
    const dy = py - s.y;
    const cos = Math.cos(-s.rotation);
    const sin = Math.sin(-s.rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    const hw = s.width / 2;
    const hh = s.height / 2;
    const handleHitRadius = 55;

    // 1. Top Rotation Handle
    if (Math.hypot(lx - 0, ly - (-hh - 80)) <= handleHitRadius) return 'rotate';
    // 2. Top-Right Delete Handle
    if (Math.hypot(lx - (hw + 40), ly - (-hh - 40)) <= handleHitRadius) return 'delete';
    // 3. Top-Left Flip Handle
    if (Math.hypot(lx - (-hw - 40), ly - (-hh - 40)) <= handleHitRadius) return 'flip';
    // 4. Corner Resize Handles
    if (Math.hypot(lx - (-hw - 8), ly - (-hh - 8)) <= handleHitRadius) return 'resize-tl';
    if (Math.hypot(lx - (hw + 8), ly - (-hh - 8)) <= handleHitRadius) return 'resize-tr';
    if (Math.hypot(lx - (hw + 8), ly - (hh + 8)) <= handleHitRadius) return 'resize-br';
    if (Math.hypot(lx - (-hw - 8), ly - (hh + 8)) <= handleHitRadius) return 'resize-bl';
    // 5. Sticker Body
    if (Math.abs(lx) <= hw + 8 && Math.abs(ly) <= hh + 8) return 'body';

    return null;
  }

  function isPointInsideKioskSticker(s, px, py) {
    const dx = px - s.x;
    const dy = py - s.y;
    const cos = Math.cos(-s.rotation);
    const sin = Math.sin(-s.rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= s.width / 2 && Math.abs(ly) <= s.height / 2;
  }

  function getKioskTextHandleAt(px, py) {
    if (!kioskTextOverlay || !kioskIsTextSelected || !kioskCtx) return null;

    const dx = px - kioskTextX;
    const dy = py - kioskTextY;
    const cos = Math.cos(-kioskTextRotation);
    const sin = Math.sin(-kioskTextRotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    kioskCtx.save();
    kioskCtx.font = `${kioskIsItalic ? 'italic ' : ''}${kioskIsBold ? 'bold ' : ''}${kioskFontSize}px "${kioskFontFamily}", sans-serif`;
    const tw = kioskCtx.measureText(kioskTextOverlay).width;
    const th = kioskFontSize;
    kioskCtx.restore();

    const hw = tw / 2 + 20;
    const hh = th * 0.6 + 15;
    const handleHitRadius = 38;

    if (Math.hypot(lx - 0, ly - (-hh - 48)) <= handleHitRadius) return 'rotate';
    if (Math.hypot(lx - (hw + 24), ly - (-hh - 24)) <= handleHitRadius) return 'delete';
    if (Math.hypot(lx - (-hw), ly - (-hh)) <= handleHitRadius) return 'resize-tl';
    if (Math.hypot(lx - hw, ly - (-hh)) <= handleHitRadius) return 'resize-tr';
    if (Math.hypot(lx - hw, ly - hh) <= handleHitRadius) return 'resize-br';
    if (Math.hypot(lx - (-hw), ly - hh) <= handleHitRadius) return 'resize-bl';
    if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return 'body';

    return null;
  }

  function isPointInsideKioskText(px, py) {
    if (!kioskTextOverlay || !kioskCtx) return false;
    const dx = px - kioskTextX;
    const dy = py - kioskTextY;
    const cos = Math.cos(-kioskTextRotation);
    const sin = Math.sin(-kioskTextRotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    kioskCtx.save();
    kioskCtx.font = `${kioskIsItalic ? 'italic ' : ''}${kioskIsBold ? 'bold ' : ''}${kioskFontSize}px "${kioskFontFamily}", sans-serif`;
    const tw = kioskCtx.measureText(kioskTextOverlay).width;
    const th = kioskFontSize;
    kioskCtx.restore();

    const hw = tw / 2 + 25;
    const hh = th * 0.6 + 20;
    return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
  }

  function updateKioskCanvasCursor(pos) {
    if (!kioskCollageCanvas) return;
    if (kioskActiveDrag) {
      if (kioskActiveDrag.mode === 'sticker-move' || kioskActiveDrag.mode === 'text-move') {
        kioskCollageCanvas.style.cursor = 'grabbing';
      } else if (kioskActiveDrag.mode === 'sticker-rotate' || kioskActiveDrag.mode === 'text-rotate') {
        kioskCollageCanvas.style.cursor = 'default';
      } else if (kioskActiveDrag.mode === 'sticker-resize' || kioskActiveDrag.mode === 'text-resize') {
        kioskCollageCanvas.style.cursor = 'nwse-resize';
      }
      return;
    }

    if (kioskIsTextSelected && kioskTextOverlay) {
      const handle = getKioskTextHandleAt(pos.x, pos.y);
      if (handle === 'rotate') { kioskCollageCanvas.style.cursor = 'grab'; return; }
      if (handle === 'delete') { kioskCollageCanvas.style.cursor = 'pointer'; return; }
      if (handle === 'resize-tl' || handle === 'resize-br') { kioskCollageCanvas.style.cursor = 'nwse-resize'; return; }
      if (handle === 'resize-tr' || handle === 'resize-bl') { kioskCollageCanvas.style.cursor = 'nesw-resize'; return; }
      if (handle === 'body') { kioskCollageCanvas.style.cursor = 'grab'; return; }
    }

    if (kioskSelectedSticker) {
      const handle = getKioskStickerHandleAt(kioskSelectedSticker, pos.x, pos.y);
      if (handle === 'rotate') { kioskCollageCanvas.style.cursor = 'grab'; return; }
      if (handle === 'delete' || handle === 'flip') { kioskCollageCanvas.style.cursor = 'pointer'; return; }
      if (handle === 'resize-tl' || handle === 'resize-br') { kioskCollageCanvas.style.cursor = 'nwse-resize'; return; }
      if (handle === 'resize-tr' || handle === 'resize-bl') { kioskCollageCanvas.style.cursor = 'nesw-resize'; return; }
      if (handle === 'body') { kioskCollageCanvas.style.cursor = 'grab'; return; }
    }

    for (let i = kioskCustomStickers.length - 1; i >= 0; i--) {
      if (isPointInsideKioskSticker(kioskCustomStickers[i], pos.x, pos.y)) {
        kioskCollageCanvas.style.cursor = 'pointer';
        return;
      }
    }

    if (isPointInsideKioskText(pos.x, pos.y)) {
      kioskCollageCanvas.style.cursor = 'move';
      return;
    }

    kioskCollageCanvas.style.cursor = 'default';
  }

  // Pointer Down on Canvas
  if (kioskCollageCanvas) {
    kioskCollageCanvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const pos = getKioskCanvasPos(e);

      // A. Check selected text handles
      if (kioskIsTextSelected && kioskTextOverlay) {
        const textHandle = getKioskTextHandleAt(pos.x, pos.y);
        if (textHandle === 'delete') {
          kioskTextOverlay = '';
          if (kioskOverlayTextInput) kioskOverlayTextInput.value = '';
          kioskIsTextSelected = false;
          hasUnsavedCustomization = true;
          updateSaveCustomizationState();
          drawKioskCanvas();
          return;
        }
        if (textHandle === 'rotate') {
          kioskSelectedSticker = null;
          updateKioskStickerControlsUI();
          kioskActiveDrag = {
            mode: 'text-rotate',
            startPos: pos,
            startRotation: kioskTextRotation
          };
          try { kioskCollageCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          updateKioskCanvasCursor(pos);
          return;
        }
        if (textHandle && textHandle.startsWith('resize-')) {
          kioskSelectedSticker = null;
          updateKioskStickerControlsUI();
          const initialDist = Math.hypot(pos.x - kioskTextX, pos.y - kioskTextY);
          kioskActiveDrag = {
            mode: 'text-resize',
            corner: textHandle.replace('resize-', ''),
            startPos: pos,
            startFontSize: kioskFontSize,
            startDist: Math.max(10, initialDist)
          };
          try { kioskCollageCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          updateKioskCanvasCursor(pos);
          return;
        }
        if (textHandle === 'body') {
          kioskSelectedSticker = null;
          updateKioskStickerControlsUI();
          kioskActiveDrag = {
            mode: 'text-move',
            startPos: pos,
            startTextX: kioskTextX,
            startTextY: kioskTextY
          };
          try { kioskCollageCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          updateKioskCanvasCursor(pos);
          return;
        }
      }

      // B. Check selected sticker handles
      if (kioskSelectedSticker) {
        kioskIsTextSelected = false;
        const handle = getKioskStickerHandleAt(kioskSelectedSticker, pos.x, pos.y);
        if (handle === 'delete') {
          deleteSelectedKioskSticker();
          return;
        }
        if (handle === 'flip') {
          kioskSelectedSticker.flipX = !kioskSelectedSticker.flipX;
          hasUnsavedCustomization = true;
          updateSaveCustomizationState();
          drawKioskCanvas();
          return;
        }
        if (handle === 'rotate') {
          kioskActiveDrag = {
            mode: 'sticker-rotate',
            sticker: kioskSelectedSticker,
            startPos: pos,
            startRotation: kioskSelectedSticker.rotation
          };
          try { kioskCollageCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          updateKioskCanvasCursor(pos);
          return;
        }
        if (handle && handle.startsWith('resize-')) {
          const initialDist = Math.hypot(pos.x - kioskSelectedSticker.x, pos.y - kioskSelectedSticker.y);
          kioskActiveDrag = {
            mode: 'sticker-resize',
            sticker: kioskSelectedSticker,
            corner: handle.replace('resize-', ''),
            startPos: pos,
            startWidth: kioskSelectedSticker.width,
            startHeight: kioskSelectedSticker.height,
            startDist: Math.max(10, initialDist)
          };
          try { kioskCollageCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          updateKioskCanvasCursor(pos);
          return;
        }
        if (handle === 'body') {
          kioskActiveDrag = {
            mode: 'sticker-move',
            sticker: kioskSelectedSticker,
            startPos: pos,
            startStickerX: kioskSelectedSticker.x,
            startStickerY: kioskSelectedSticker.y
          };
          try { kioskCollageCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          updateKioskCanvasCursor(pos);
          return;
        }
      }

      // C. Click on another sticker
      for (let i = kioskCustomStickers.length - 1; i >= 0; i--) {
        const s = kioskCustomStickers[i];
        if (isPointInsideKioskSticker(s, pos.x, pos.y)) {
          kioskIsTextSelected = false;
          kioskSelectedSticker = s;
          updateKioskStickerControlsUI();
          drawKioskCanvas();
          kioskActiveDrag = {
            mode: 'sticker-move',
            sticker: s,
            startPos: pos,
            startStickerX: s.x,
            startStickerY: s.y
          };
          try { kioskCollageCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          updateKioskCanvasCursor(pos);
          return;
        }
      }

      // D. Click on text body
      if (isPointInsideKioskText(pos.x, pos.y)) {
        kioskSelectedSticker = null;
        updateKioskStickerControlsUI();
        kioskIsTextSelected = true;
        drawKioskCanvas();
        kioskActiveDrag = {
          mode: 'text-move',
          startPos: pos,
          startTextX: kioskTextX,
          startTextY: kioskTextY
        };
        try { kioskCollageCanvas.setPointerCapture(e.pointerId); } catch (_) { }
        updateKioskCanvasCursor(pos);
        return;
      }

      // E. Click on background: deselect
      if (kioskSelectedSticker || kioskIsTextSelected) {
        kioskSelectedSticker = null;
        kioskIsTextSelected = false;
        updateKioskStickerControlsUI();
        drawKioskCanvas();
      }
    });

    kioskCollageCanvas.addEventListener('pointermove', (e) => {
      const pos = getKioskCanvasPos(e);
      if (!kioskActiveDrag) {
        updateKioskCanvasCursor(pos);
        return;
      }

      // 1. Drag sticker
      if (kioskActiveDrag.mode === 'sticker-move') {
        const dx = pos.x - kioskActiveDrag.startPos.x;
        const dy = pos.y - kioskActiveDrag.startPos.y;
        kioskActiveDrag.sticker.x = Math.round(kioskActiveDrag.startStickerX + dx);
        kioskActiveDrag.sticker.y = Math.round(kioskActiveDrag.startStickerY + dy);
        hasUnsavedCustomization = true;
        updateSaveCustomizationState();
        drawKioskCanvas();
        return;
      }

      // 2. Rotate sticker
      if (kioskActiveDrag.mode === 'sticker-rotate') {
        const s = kioskActiveDrag.sticker;
        const startAngle = Math.atan2(kioskActiveDrag.startPos.y - s.y, kioskActiveDrag.startPos.x - s.x);
        const currentAngle = Math.atan2(pos.y - s.y, pos.x - s.x);
        s.rotation = kioskActiveDrag.startRotation + (currentAngle - startAngle);
        hasUnsavedCustomization = true;
        updateSaveCustomizationState();
        drawKioskCanvas();
        return;
      }

      // 3. Resize sticker
      if (kioskActiveDrag.mode === 'sticker-resize') {
        const s = kioskActiveDrag.sticker;
        const currentDist = Math.hypot(pos.x - s.x, pos.y - s.y);
        const scale = currentDist / kioskActiveDrag.startDist;
        const newW = Math.max(60, Math.min(COLLAGE_WIDTH * 0.95, Math.round(kioskActiveDrag.startWidth * scale)));
        s.width = newW;
        s.height = Math.round(newW / s.aspectRatio);
        hasUnsavedCustomization = true;
        updateSaveCustomizationState();
        drawKioskCanvas();
        return;
      }

      // 4. Drag text
      if (kioskActiveDrag.mode === 'text-move') {
        const dx = pos.x - kioskActiveDrag.startPos.x;
        const dy = pos.y - kioskActiveDrag.startPos.y;
        kioskTextX = Math.round(kioskActiveDrag.startTextX + dx);
        kioskTextY = Math.round(kioskActiveDrag.startTextY + dy);
        hasUnsavedCustomization = true;
        updateSaveCustomizationState();
        drawKioskCanvas();
        return;
      }

      // 5. Rotate text
      if (kioskActiveDrag.mode === 'text-rotate') {
        const startAngle = Math.atan2(kioskActiveDrag.startPos.y - kioskTextY, kioskActiveDrag.startPos.x - kioskTextX);
        const currentAngle = Math.atan2(pos.y - kioskTextY, pos.x - kioskTextX);
        kioskTextRotation = kioskActiveDrag.startRotation + (currentAngle - startAngle);
        hasUnsavedCustomization = true;
        updateSaveCustomizationState();
        drawKioskCanvas();
        return;
      }

      // 6. Resize text
      if (kioskActiveDrag.mode === 'text-resize') {
        const currentDist = Math.hypot(pos.x - kioskTextX, pos.y - kioskTextY);
        const scale = currentDist / kioskActiveDrag.startDist;
        const newSize = Math.max(24, Math.min(220, Math.round(kioskActiveDrag.startFontSize * scale)));
        kioskFontSize = newSize;
        if (kioskSliderFontSize) kioskSliderFontSize.value = newSize;
        if (kioskValFontSize) kioskValFontSize.textContent = newSize + 'px';
        hasUnsavedCustomization = true;
        updateSaveCustomizationState();
        drawKioskCanvas();
        return;
      }
    });

    const endPointerAction = (e) => {
      if (kioskActiveDrag) {
        try { kioskCollageCanvas.releasePointerCapture(e.pointerId); } catch (_) { }
        kioskActiveDrag = null;
        updateKioskCanvasCursor(getKioskCanvasPos(e));
        drawKioskCanvas();
      }
    };

    kioskCollageCanvas.addEventListener('pointerup', endPointerAction);
    kioskCollageCanvas.addEventListener('pointercancel', endPointerAction);
  }

  // =========================================================================
  // Save Customization Button Listener
  // =========================================================================
  async function autoSaveKioskCustomization({ keepDirty = false, force = false } = {}) {
    if (typeof window.isKioskEdited === 'function' && !keepDirty) {
      if (!window.isKioskEdited()) return;
    }
    if (!hasUnsavedCustomization || !btnSaveCustomization || (!force && btnSaveCustomization.disabled)) return;
    btnSaveCustomization.disabled = true;
    const oldText = btnSaveCustomization.textContent;
    btnSaveCustomization.textContent = 'Saving...';
    try {
      // 1. Export clean photostrip JPEG without interactive selection handles
      drawKioskCanvas(true);
      const editedImage = await new Promise(resolve =>
        kioskCollageCanvas.toBlob(resolve, 'image/jpeg', 0.95)
      );
      drawKioskCanvas(false);
      if (!editedImage) throw new Error('Unable to prepare the photostrip for saving');

      // 2. Persist the JPEG as binary multipart data (no Base64 overhead).
      const saveData = new FormData();
      saveData.append('session_dir', currentSessionDir);
      saveData.append('timestamp', currentGallerySessionTimestamp || '');
      if (keepDirty) {
        saveData.append('is_original', 'true');
      }
      saveData.append('image', editedImage, 'photostrip.jpg');
      const response = await fetch('/api/customer/save_edit', {
        method: 'POST',
        body: saveData
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      if (keepDirty) {
        // This is the automatic safety copy made on entering the preview. Do
        // not mark the editor clean: a subsequent manual Save can still store
        // any changes the customer makes while this background save completes.
        hasUnsavedCustomization = true;
        btnSaveCustomization.textContent = 'Auto-saved ✓';
      } else {
        savedFrameColor = selectedFrameColor;
        hasUnsavedCustomization = false;
        if (typeof window.setKioskSaved === 'function') window.setKioskSaved();
        btnSaveCustomization.textContent = 'Saved ✓';
      }
      if (imgCollagePreview && result.collage_edited_url) {
        imgCollagePreview.src = result.collage_edited_url + '?t=' + Date.now();
      }
    } catch (err) {
      console.error('Failed to auto-save customization: ' + err.message);
      btnSaveCustomization.textContent = oldText;
      btnSaveCustomization.disabled = false;
    } finally {
      setTimeout(() => {
        updateSaveCustomizationState(false, true);
      }, 1200);
    }
  }

  if (btnSaveCustomization) {
    btnSaveCustomization.addEventListener('click', async () => {
      await autoSaveKioskCustomization();
    });
  }

  // Initialize Kawaii Stickers Tray & MS Word Color Picker on startup
  initKioskStickersTray();
  initKioskMSWordColorPicker();

  // =========================================================================
  // Finish Capture → Upload → Review Studio
  // =========================================================================
  async function finishCapture() {
    captureStatus.textContent = 'Processing...';
    captureInstruction.textContent = 'Saving your photos, please wait!';

    try {
      // All transfers started during the countdowns. Only wait for any final
      // in-flight upload instead of starting a new four-photo transfer now.
      await Promise.all(captureUploadTasks);
      const result = {
        files: uploadedCaptureFiles.filter(Boolean),
        session_timestamp: currentCaptureTimestamp
      };

      // Reset studio customizations for fresh review
      selectedFrameColor = '#ffffff';
      savedFrameColor = '#ffffff';
      selectedPhotoBorderStyle = 'none';
      selectedPhotoRadius = 8;
      updateFrameColorBadge('#ffffff', 'Pure White');
      document.querySelectorAll('#kiosk-photo-border-options .frame-accent-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.border === 'none');
      });
      document.querySelectorAll('#kiosk-photo-corner-options .frame-corner-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.radius === '8');
      });
      // There is intentionally no expensive final collage yet. The canvas is
      // the instant local preview; clicking Save produces the 600-DPI strip.
      hasUnsavedCustomization = true;
      kioskCustomStickers = [];
      kioskSelectedSticker = null;
      kioskTextOverlay = '';
      kioskIsTextSelected = false;
      if (kioskOverlayTextInput) kioskOverlayTextInput.value = '';
      if (typeof window.resetKioskHistory === 'function') window.resetKioskHistory();
      updateKioskStickerControlsUI();

      colorDots.forEach(d => {
        d.classList.toggle('active', d.dataset.color === '#ffffff');
      });

      currentGallerySessionTimestamp = result.session_timestamp;
      isEditingGallerySession = true;

      // Load high-res photos directly into interactive canvas
      const photoUrls = (result.files && result.files.length > 0)
        ? result.files
        : capturedImages.map(image => image.previewUrl || image);
      await loadKioskPhotosFromUrls(photoUrls);

      capturedImages.forEach(image => {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
      capturedImages = [];
      updateSaveCustomizationState(false, true);

      showScreen(screenReview);
      // Persist the default, full-resolution strip immediately. The user can
      // begin editing right away; this background save protects the session
      // even if they leave the preview without pressing Save.
      drawKioskCanvas();
      void autoSaveKioskCustomization({ keepDirty: true });

    } catch (err) {
      console.error(err);
      alert('Error saving photos: ' + err.message);
      showScreen(screenDashboard);
    }
  }

  // =========================================================================
  // Review Actions
  // =========================================================================
  btnTakeMore.addEventListener('click', async () => {
    await autoSaveKioskCustomization({ force: true });
    capturedImages = [];
    await startCaptureSession();
  });

  // =========================================================================
  // Customer Gallery
  // =========================================================================
  async function loadGallery() {
    showScreen(screenGallery);
    gallerySessionsContainer.innerHTML = '<p style="text-align:center;opacity:0.6;padding:2rem;">Loading your photos...</p>';
    galleryEmpty.classList.add('hidden');

    try {
      let response = await fetch('/api/customer/gallery');
      if (response.status === 401) {
        // Server session expired – silently re-auth then retry
        const authResp = await fetch('/api/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_number: customerToken })
        });
        if (!authResp.ok) throw new Error('Re-authentication failed');
        response = await fetch('/api/customer/gallery');
      }
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      renderGallery(await response.json());
    } catch (err) {
      console.error(err);
      gallerySessionsContainer.innerHTML = '<p style="color:#f87171;text-align:center;padding:2rem;">Error loading gallery.</p>';
    }
  }

  function updateGalleryLayout() {
    // No arrow buttons needed for vertical scroll.
  }

  // Recompute layout after rendering and on resize
  window.addEventListener('resize', () => updateGalleryLayout());

  function renderGallery(data) {
    gallerySessionsContainer.innerHTML = '';
    const sessions = data.sessions || [];
    if (sessions.length === 0) {
      galleryEmpty.classList.remove('hidden');
      return;
    }

    // Sort oldest-first
    const sortedSessions = [...sessions].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    sortedSessions.forEach((sess, index) => {
      const sessionNum = index + 1;
      const baseLabel = `Session ${sessionNum}`;
      if (sess.collage_url) {
        addGalleryCard(sess.collage_url, sess, false, baseLabel);
      }

      const editedUrls = sess.collage_edited_urls || [];
      editedUrls.forEach((editUrl) => {
        addGalleryCard(editUrl, sess, true, `${baseLabel} (Edited)`);
      });
    });
  }

  function addGalleryCard(imgUrl, session, isEdited, label) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Open photostrip preview');

    // Session label at the top (e.g. "SESSION 1", "SESSION 1 (EDITED)")
    const sessionLabel = document.createElement('div');
    sessionLabel.className = 'gallery-session-label';
    sessionLabel.textContent = label || '';

    const img = document.createElement('img');
    img.src = imgUrl + '?t=' + Date.now();
    img.alt = 'Collage';
    img.className = 'gallery-collage-preview';
    const openPreview = () => openLightbox(img.src, session);
    card.addEventListener('click', openPreview);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPreview();
      }
    });

    // Date/time at the bottom
    const time = document.createElement('div');
    time.className = 'gallery-item-time';
    time.textContent = session.time || '';

    card.append(sessionLabel, img, time);

    gallerySessionsContainer.appendChild(card);
  }

  // =========================================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // =========================================================================
  document.addEventListener('keydown', (e) => {
    // Don't intercept while entering text (except Escape), but a colour input
    // on the review screen should not trap the Save shortcut.
    const isTextEntry = e.target.tagName === 'TEXTAREA'
      || (e.target.tagName === 'INPUT' && e.target.type !== 'color');
    if (isTextEntry
      && e.key !== 'Escape'
      && !(e.ctrlKey && (e.key === 'F2' || e.key === 'F3'))
    ) return;

    // Hidden admin shortcut: Ctrl+F2 logs out from any screen
    if (e.ctrlKey && e.key === 'F2') {
      e.preventDefault();
      performLogout();
      return;
    }

    // Hidden admin shortcut: Ctrl+F3 opens the Admin page from any kiosk screen
    if (e.ctrlKey && e.key === 'F3') {
      e.preventDefault();
      window.location.assign('/admin');
      return;
    }

    // Secret shortcut: Ctrl+G opens gallery from Dashboard or Capture
    if ((currentScreen === screenDashboard || currentScreen === screenCapture) && e.ctrlKey && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      loadGallery();
      return;
    }

    // ---- THANK YOU SCREEN ----
    if (currentScreen === screenThankYou) {
      if (e.key === 'Enter') {
        e.preventDefault();
        returnToWelcome();
      }
    }

    // ---- LOGIN SCREEN ----
    else if (currentScreen === screenLogin) {
      // Enter is handled on the input itself
    }

    // ---- DASHBOARD SCREEN ----
    else if (currentScreen === screenDashboard) {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnNewSession.click();
      } else if (e.ctrlKey && e.key === 'F2') {
        e.preventDefault();
        performLogout();
      }
    }

    // ---- SETUP SCREEN (removed — no-op) ----
    // else if (currentScreen === screenSetup) { ... }

    // ---- CAPTURE SCREEN ----
    else if (currentScreen === screenCapture) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!btnCapture.disabled && !isCapturing) {
          startBurstCapture();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (btnCaptureExit) btnCaptureExit.click();
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        const btnCaptureGallery = document.getElementById('btn-capture-gallery');
        if (btnCaptureGallery) btnCaptureGallery.click();
      }
    }

    // ---- REVIEW SCREEN ----
    else if (currentScreen === screenReview) {
      // Keep shortcuts screen-wide even after a frame color control
      // retains keyboard focus.
      if (e.key === 'Enter') {
        e.preventDefault();
        if (document.activeElement === btnTakeMore) {
          btnTakeMore.click();
        } else if (document.activeElement === btnGotoGallery) {
          btnGotoGallery.click();
        } else if (!btnSaveCustomization.disabled) {
          btnSaveCustomization.click();
        }
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        btnGotoGallery.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        btnTakeMore.click();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateReviewButtons(-1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        navigateReviewButtons(1);
      }
    }

    // ---- GALLERY SCREEN ----
    else if (currentScreen === screenGallery) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (btnGalleryBack) btnGalleryBack.click();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (galleryContent) {
          const amount = galleryContent.clientHeight * 0.6 || 300;
          galleryContent.scrollBy({ top: e.key === 'ArrowDown' ? amount : -amount, behavior: 'smooth' });
        }
      }
    }
  });

  // Arrow-navigate through review action buttons
  const reviewButtons = [btnSaveCustomization, btnTakeMore, btnGotoGallery].filter(Boolean);
  function navigateReviewButtons(direction) {
    const currentIdx = reviewButtons.findIndex(b => b === document.activeElement);
    let newIdx = currentIdx + direction;
    if (newIdx < 0) newIdx = reviewButtons.length - 1;
    if (newIdx >= reviewButtons.length) newIdx = 0;
    reviewButtons[newIdx].focus();
  }

  // =========================================================================
  // Helper Functions
  // =========================================================================
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function delayAbortable(ms) {
    return new Promise(resolve => {
      const start = Date.now();
      const check = setInterval(() => {
        if (burstAborted || Date.now() - start >= ms) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  }

  function runCountdown(seconds) {
    return new Promise((resolve) => {
      countdownOverlay.classList.remove('hidden');
      let currentVal = seconds;
      countdownNum.textContent = currentVal;
      playBeep();

      const interval = setInterval(() => {
        // Abort check — immediately resolve if burst was cancelled
        if (burstAborted) {
          clearInterval(interval);
          countdownOverlay.classList.add('hidden');
          resolve();
          return;
        }
        currentVal--;
        if (currentVal > 0) {
          countdownNum.textContent = currentVal;
          playBeep();
        } else {
          clearInterval(interval);
          countdownOverlay.classList.add('hidden');
          resolve();
        }
      }, 1000);
    });
  }

  function triggerFlash() {
    playShutter();
    flashOverlay.classList.add('flash-animation');
    setTimeout(() => {
      flashOverlay.classList.remove('flash-animation');
    }, 400);
  }

  async function captureSnapshot() {
    const canvas = document.createElement('canvas');
    const sourceWidth = videoWebcam.videoWidth || 1280;
    const sourceHeight = videoWebcam.videoHeight || 960;
    // Keep every saved capture at the same landscape ratio as a single
    // collage slot (1022 x 752). This also matches the cropped live preview.
    const collageImageRatio = 1022 / 752;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    if (sourceWidth / sourceHeight > collageImageRatio) {
      cropWidth = Math.round(sourceHeight * collageImageRatio);
    } else {
      cropHeight = Math.round(sourceWidth / collageImageRatio);
    }
    const cropX = Math.round((sourceWidth - cropWidth) / 2);
    const cropY = Math.round((sourceHeight - cropHeight) / 2);
    // The finished strip uses 1022px-wide photo slots. 1920px gives ample
    // headroom for the 600-DPI output without pushing full 4K frames through
    // a mobile connection or an ngrok tunnel.
    const maxUploadWidth = 1920;
    const outputWidth = Math.min(cropWidth, maxUploadWidth);
    const outputHeight = Math.round(outputWidth / collageImageRatio);
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.filter = 'brightness(1.05) contrast(1.05) saturate(1.05)';
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      videoWebcam,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, canvas.width, canvas.height
    );
    // Reset filter so it doesn't affect subsequent draws if canvas is reused
    ctx.filter = 'none';
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1.0));
  }

  // =========================================================================
  // Initialise
  // =========================================================================
  loadSessionDuration();
  checkExistingLogin();

  // =========================================================================
  // Lightbox & Audio Helpers
  // =========================================================================
  function openLightbox(url, gallerySession = null) {
    currentLightboxImgUrl = url;
    currentLightboxSession = gallerySession;
    if (lightboxImg) lightboxImg.src = url;
    if (lightboxModal) lightboxModal.classList.remove('hidden');
  }

  function getDownloadUrl(photoUrl) {
    const photoPath = new URL(photoUrl, window.location.origin).pathname;
    const photoPrefix = '/static/photos/';
    if (!photoPath.startsWith(photoPrefix)) return photoUrl;
    const encodedPath = photoPath.slice(photoPrefix.length).split('/').map(encodeURIComponent).join('/');
    return `/api/photo/download/${encodedPath}`;
  }

  function closeLightbox() {
    if (lightboxModal) lightboxModal.classList.add('hidden');
    if (lightboxImg) lightboxImg.src = '';
    currentLightboxImgUrl = null;
    currentLightboxSession = null;
  }

  if (btnLightboxClose) btnLightboxClose.addEventListener('click', closeLightbox);
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
  }

  if (btnLightboxEdit) {
    btnLightboxEdit.addEventListener('click', async () => {
      if (!currentLightboxImgUrl) return;
      const parts = currentLightboxImgUrl.split('/');
      const filename = parts[parts.length - 1].split('?')[0];
      if (filename.startsWith('collage_')) {
        let ts = filename.split('_')[1];
        if (filename.startsWith('collage_edited_')) {
          ts = filename.split('_')[2];
        }
        ts = ts.split('.')[0];

        currentGallerySessionTimestamp = currentLightboxSession?.timestamp || ts;
        currentSessionDir = currentLightboxSession?.folder || customerName;
        const targetImgUrl = currentLightboxImgUrl;
        const targetFiles = (currentLightboxSession && currentLightboxSession.files && currentLightboxSession.files.length > 0)
          ? currentLightboxSession.files
          : [targetImgUrl];

        closeLightbox();

        // Reset UI
        selectedFrameColor = '#ffffff';
        savedFrameColor = '#ffffff';
        selectedPhotoBorderStyle = 'none';
        selectedPhotoRadius = 8;
        updateFrameColorBadge('#ffffff', 'Pure White');
        document.querySelectorAll('#kiosk-photo-border-options .frame-accent-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.border === 'none');
        });
        document.querySelectorAll('#kiosk-photo-corner-options .frame-corner-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.radius === '8');
        });
        hasUnsavedCustomization = false;
        kioskCustomStickers = [];
        kioskSelectedSticker = null;
        kioskTextOverlay = '';
        kioskIsTextSelected = false;
        if (kioskOverlayTextInput) kioskOverlayTextInput.value = '';
        updateKioskStickerControlsUI();
        colorDots.forEach(d => d.classList.toggle('active', d.dataset.color === '#ffffff'));

        showScreen(screenReview);

        // Load photos into canvas
        await loadKioskPhotosFromUrls(targetFiles);
        updateSaveCustomizationState(false, true);
      } else {
        alert('You can only edit collages, not individual photos or animations.');
      }
    });
  }

  if (btnLightboxDownload) {
    btnLightboxDownload.addEventListener('click', () => {
      if (!currentLightboxImgUrl) return;
      const a = document.createElement('a');
      a.href = getDownloadUrl(currentLightboxImgUrl);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  if (btnLightboxDelete) {
    btnLightboxDelete.addEventListener('click', async () => {
      if (!currentLightboxImgUrl) return;
      if (!confirm("Are you sure you want to permanently delete this photo?")) return;

      const fileUrl = currentLightboxImgUrl.split('?')[0];
      try {
        btnLightboxDelete.disabled = true;
        btnLightboxDelete.textContent = 'Deleting...';

        const response = await fetch('/api/customer/photo', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: fileUrl })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to delete');

        closeLightbox();
        loadGallery();
      } catch (err) {
        alert(err.message);
      } finally {
        btnLightboxDelete.disabled = false;
        btnLightboxDelete.textContent = '🗑 Delete';
      }
    });
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioContext ? new AudioContext() : null;

  function playBeep() {
    if (!audioCtx) return;
    try {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { }
  }

  function playShutter() {
    if (!audioCtx) return;
    try {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) { }
  }

  // =========================================================================
  // UNDO / REDO LOGIC
  // =========================================================================
  let editHistory = [];
  let editHistoryIndex = -1;
  let isRestoringHistory = false;
  let historyDebounceTimer = null;
  let lastSavedHistoryIndex = 0;

  window.resetKioskHistory = function() {
    editHistory = [];
    editHistoryIndex = -1;
    lastSavedHistoryIndex = 0;
  };

  window.isKioskEdited = function() {
    if (editHistory.length > 0) {
      return editHistoryIndex !== lastSavedHistoryIndex;
    }
    return false;
  };

  window.setKioskSaved = function() {
    lastSavedHistoryIndex = editHistoryIndex;
  };

  function cloneCurrentKioskState() {
    return {
      frameColor: selectedFrameColor,
      photoBorder: selectedPhotoBorderStyle,
      photoRadius: selectedPhotoRadius,
      stickers: kioskCustomStickers.map(s => ({...s})),
      textOverlay: kioskTextOverlay,
      textX: kioskTextX,
      textY: kioskTextY,
      textRotation: kioskTextRotation,
      fontSize: kioskFontSize,
      isBold: kioskIsBold,
      isItalic: kioskIsItalic,
      isUnderline: kioskIsUnderline,
      fontFamily: kioskFontFamily,
      fontColor: kioskFontColor
    };
  }

  function pushKioskHistory() {
    if (isRestoringHistory) return;
    const state = cloneCurrentKioskState();
    if (editHistoryIndex < editHistory.length - 1) {
      editHistory = editHistory.slice(0, editHistoryIndex + 1);
    }
    editHistory.push(state);
    if (editHistory.length > 50) editHistory.shift();
    else editHistoryIndex++;
    updateUndoRedoUI();
  }

  // Globally accessible so updateSaveCustomizationState can call it
  window.debouncedPushHistory = function() {
    clearTimeout(historyDebounceTimer);
    historyDebounceTimer = setTimeout(pushKioskHistory, 300);
  };

  function restoreKioskHistory(index) {
    if (index < 0 || index >= editHistory.length) return;
    isRestoringHistory = true;
    editHistoryIndex = index;
    const state = editHistory[index];
    
    selectedFrameColor = state.frameColor;
    selectedPhotoBorderStyle = state.photoBorder;
    selectedPhotoRadius = state.photoRadius;
    kioskCustomStickers = state.stickers.map(s => ({...s}));
    kioskSelectedSticker = null;
    kioskIsTextSelected = false;

    kioskTextOverlay = state.textOverlay;
    kioskTextX = state.textX;
    kioskTextY = state.textY;
    kioskTextRotation = state.textRotation;
    kioskFontSize = state.fontSize;
    kioskIsBold = state.isBold;
    kioskIsItalic = state.isItalic;
    kioskIsUnderline = state.isUnderline;
    kioskFontFamily = state.fontFamily;
    kioskFontColor = state.fontColor;

    // sync UI
    updateFrameColorBadge(selectedFrameColor);
    document.querySelectorAll('#kiosk-photo-border-options .frame-accent-btn').forEach(b => {
      if(b.dataset.border === selectedPhotoBorderStyle) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    
    const txtInput = document.getElementById('kiosk-overlay-text');
    if (txtInput) txtInput.value = kioskTextOverlay;
    
    const fontSelect = document.getElementById('kiosk-font-family');
    if (fontSelect) fontSelect.value = kioskFontFamily;
    
    const btnBold = document.getElementById('btn-kiosk-text-bold');
    if (btnBold) btnBold.classList.toggle('active', kioskIsBold);
    
    const btnItalic = document.getElementById('btn-kiosk-text-italic');
    if (btnItalic) btnItalic.classList.toggle('active', kioskIsItalic);
    
    const btnUnderline = document.getElementById('btn-kiosk-text-underline');
    if (btnUnderline) btnUnderline.classList.toggle('active', kioskIsUnderline);
    
    const slider = document.getElementById('kiosk-slider-font-size');
    if (slider) slider.value = kioskFontSize;
    const valFontSize = document.getElementById('kiosk-val-font-size');
    if (valFontSize) valFontSize.textContent = kioskFontSize + 'px';
    
    updateKioskStickerControlsUI();
    updateSaveCustomizationState(true);
    scheduleKioskPreviewDraw();
    updateUndoRedoUI();
    isRestoringHistory = false;
  }

  function updateUndoRedoUI() {
    const btnUndo = document.getElementById('btn-kiosk-undo');
    const btnRedo = document.getElementById('btn-kiosk-redo');
    if (btnUndo) btnUndo.disabled = editHistoryIndex <= 0;
    if (btnRedo) btnRedo.disabled = editHistoryIndex >= editHistory.length - 1;
  }

  const btnUndo = document.getElementById('btn-kiosk-undo');
  if (btnUndo) btnUndo.addEventListener('click', () => restoreKioskHistory(editHistoryIndex - 1));
  
  const btnRedo = document.getElementById('btn-kiosk-redo');
  if (btnRedo) btnRedo.addEventListener('click', () => restoreKioskHistory(editHistoryIndex + 1));
  
  document.addEventListener('keydown', (e) => {
    const reviewScreen = document.getElementById('screen-review');
    if (!reviewScreen || reviewScreen.classList.contains('hidden')) return;
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      restoreKioskHistory(editHistoryIndex - 1);
    } else if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      restoreKioskHistory(editHistoryIndex + 1);
    }
  });
  
  // Capture initial state on open
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const reviewScreen = document.getElementById('screen-review');
        if (reviewScreen && !reviewScreen.classList.contains('hidden') && editHistory.length === 0) {
           pushKioskHistory();
        }
      }
    });
  });
  const screenRev = document.getElementById('screen-review');
  if (screenRev) observer.observe(screenRev, { attributes: true });

});
document.addEventListener('contextmenu', event => event.preventDefault());
