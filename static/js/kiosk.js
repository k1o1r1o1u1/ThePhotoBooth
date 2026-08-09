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
        finishSession('Your session ended after a period of inactivity. Thank you for visiting Chini Champra Creations.');
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
    } else if (screen === screenThankYou) {
      setTimeout(() => btnReturnWelcome.focus(), 100);
    } else if (screen === screenGallery) {
      setTimeout(() => btnGalleryBack.focus(), 100);
    }

    updateSessionUserBadge(screen);
    document.body.classList.toggle('on-dashboard', screen === screenDashboard);
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
    if (!sessionUser) return;
    const show = screen === screenCapture || screen === screenReview;
    sessionUser.classList.toggle('hidden', !show);
    sessionUser.textContent = show && customerName ? customerName : '';
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

  function handleSessionTimerExpired() {
    finishSession(`Your ${sessionDurationMinutes}-minute photo session has ended. Thank you for visiting Chini Champra Creations.`);
  }

  function tickSessionTimer() {
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

  function finishSession(message) {
    if (currentScreen === screenThankYou) return;
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
    fetch('/api/customer/logout', { method: 'POST' }).catch(() => {});
  }

  async function performLogout() {
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
    fetch('/api/customer/logout', { method: 'POST' }).catch(() => {});
  }

  btnLogout.addEventListener('click', performLogout);
  if (btnEndSession) {
    btnEndSession.addEventListener('click', () => {
      finishSession('Thank you for creating great memories with Chini Champra Creations. We hope to see you again soon!');
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
  btnGotoGallery.addEventListener('click', () => loadGallery());

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
    if (captureInstruction) captureInstruction.textContent = 'Press the button or Space to start!';

    // Clear thumbnails
    if (thumbsBar) thumbsBar.innerHTML = '';
    for (let i = 0; i < TARGET_PHOTO_COUNT; i++) {
      const slot = document.createElement('div');
      slot.className = 'thumbnail-slot';
      slot.id = `thumb-slot-${i}`;
      thumbsBar.appendChild(slot);
    }

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
      const requestId = ++webcamStreamRequestId;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
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
        videoWebcam.play().catch(() => {});
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
      const base64Img = captureSnapshot();
      capturedImages.push(base64Img);
      fillSlot(i, base64Img);

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

  function fillSlot(idx, base64Img) {
    const slot = document.getElementById(`thumb-slot-${idx}`);
    if (slot) slot.style.backgroundImage = `url(${base64Img})`;
  }

  // =========================================================================
  // Live Filters & Studio Controls Implementation
  // =========================================================================
  let selectedFrameColor = '#ffffff';

  const colorDots = document.querySelectorAll('#frame-color-palette .color-dot');
  const btnSaveCustomization = document.getElementById('btn-save-customization');

  const customColorPicker = document.getElementById('custom-color-picker');

  function updateSaveCustomizationState() {
    if (!btnSaveCustomization) return;
    const hasUnsavedFrameChange = selectedFrameColor !== savedFrameColor;
    btnSaveCustomization.disabled = !hasUnsavedFrameChange;
    btnSaveCustomization.innerHTML = hasUnsavedFrameChange
      ? 'Save This Frame Color &#10024; <kbd class="key-badge">Enter &#8629;</kbd>'
      : 'Saved &#10003;';
  }

  // Color dots click events (Review Screen)
  colorDots.forEach(dot => {
    dot.addEventListener('click', async () => {
      colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      await updateFramePreview(dot.dataset.color);
    });
  });

  // Custom Color Picker input event
  if (customColorPicker) {
    customColorPicker.addEventListener('input', async (e) => {
      colorDots.forEach(d => d.classList.remove('active'));
      await updateFramePreview(e.target.value);
    });
  }

  async function updateFramePreviewFull() {
    try {
      const response = await fetch('/api/session/render_preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_dir: currentSessionDir,
          images: capturedImages,
          session_timestamp: currentGallerySessionTimestamp,
          frame_color: selectedFrameColor
        })
      });
      const result = await response.json();
      if (result.preview_data) {
        imgCollagePreview.src = result.preview_data;
      }
    } catch (err) {
      console.error('Failed to update preview:', err);
    }
  }

  // Refresh the photostrip preview after a frame color change.
  async function updateFramePreview(hexColor) {
    selectedFrameColor = hexColor;
    await updateFramePreviewFull();
    updateSaveCustomizationState();
  }

  // Save customization button
  if (btnSaveCustomization) {
    btnSaveCustomization.addEventListener('click', async () => {
      btnSaveCustomization.disabled = true;
      btnSaveCustomization.textContent = 'Saving...';
      try {
        const endpoint = isEditingGallerySession ? '/api/session/edit_existing' : '/api/session/upload';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_dir: currentSessionDir,
            images: capturedImages,
            session_timestamp: currentGallerySessionTimestamp,
            frame_color: selectedFrameColor
          })
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        imgCollagePreview.src = result.collage_url + '?t=' + Date.now();
        btnSaveCustomization.textContent = 'Saved! ✨';
        
        // Keep the original session selected. A customer may save more than
        // one frame colour during the same review without re-uploading photos.
        savedFrameColor = selectedFrameColor;
      } catch (err) {
        alert('Failed to save customization: ' + err.message);
      } finally {
        setTimeout(() => {
          updateSaveCustomizationState();
        }, 1500);
      }
    });
  }

  // =========================================================================
  // Finish Capture → Upload → Review
  // =========================================================================
  async function finishCapture() {
    captureStatus.textContent = 'Processing...';
    captureInstruction.textContent = 'Building your photostrip, please wait!';

    try {
      const response = await fetch('/api/session/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_dir: currentSessionDir,
          images: capturedImages,
          frame_color: selectedFrameColor
        })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      // Populate Review Screen — reset customizations to defaults
      selectedFrameColor = '#ffffff';
      savedFrameColor = '#ffffff';
      colorDots.forEach(d => {
        d.classList.toggle('active', d.dataset.color === '#ffffff');
      });
      imgCollagePreview.src = result.collage_url + '?t=' + Date.now();
      
      // Mark as editing an existing session so the 'Save Custom Photostrip' button 
      // calls edit_existing rather than upload, preventing duplicate captures.
      currentGallerySessionTimestamp = result.session_timestamp;
      isEditingGallerySession = true;
      capturedImages = []; // Clear base64 arrays since they are saved on server now
      updateSaveCustomizationState();

      // Populate Individual Photos
      const galleryContainer = document.getElementById('individual-photos-gallery');
      if (galleryContainer) {
        galleryContainer.innerHTML = '';
        if (result.files && result.files.length > 0) {
          result.files.forEach(fileUrl => {
            const imgEl = document.createElement('img');
            imgEl.src = fileUrl + '?t=' + Date.now();
            imgEl.alt = 'Individual Photo';
            galleryContainer.appendChild(imgEl);
          });
        }
      }

      showScreen(screenReview);

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
    
    sortedSessions.forEach((sess) => {
      if (sess.collage_url) {
        addGalleryCard(sess.collage_url, sess, false);
      }
      
      const editedUrls = sess.collage_edited_urls || [];
      editedUrls.forEach((editUrl) => {
        addGalleryCard(editUrl, sess, true);
      });
    });
  }
  
  function addGalleryCard(imgUrl, session, isEdited) {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Open photostrip preview');

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

      const time = document.createElement('div');
      time.className = 'gallery-item-time';
      time.textContent = `${session.time || ''}${isEdited ? ' · Edited' : ''}`;

      card.append(img, time);

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

  function captureSnapshot() {
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
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      videoWebcam,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, canvas.width, canvas.height
    );
    return canvas.toDataURL('image/jpeg', 1.0);
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
    btnLightboxEdit.addEventListener('click', () => {
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
          isEditingGallerySession = true;
          
          closeLightbox();
          
          // Reset UI
          selectedFrameColor = '#ffffff';
          savedFrameColor = '#ffffff';
          colorDots.forEach(d => d.classList.toggle('active', d.dataset.color === '#ffffff'));
          
          showScreen(screenReview);
          
          // Clear old preview until new one loads
          imgCollagePreview.src = '';
          updateFramePreviewFull();
          updateSaveCustomizationState();
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
});
