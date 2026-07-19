document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // DOM Elements
  // =========================================================================
  const screenLogin = document.getElementById('screen-login');
  const screenDashboard = document.getElementById('screen-dashboard');
  const screenCapture = document.getElementById('screen-capture');
  const screenReview = document.getElementById('screen-review');
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
  const btnReviewHome = document.getElementById('btn-review-home');
  const btnCaptureExit = document.getElementById('btn-capture-exit');

  const gallerySessionsContainer = document.getElementById('gallery-sessions-container');
  const galleryEmpty = document.getElementById('gallery-empty');
  const btnGalleryBack = document.getElementById('btn-gallery-back');

  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const btnLightboxClose = document.getElementById('btn-lightbox-close');
  const btnLightboxDownload = document.getElementById('btn-lightbox-download');
  const btnLightboxDelete = document.getElementById('btn-lightbox-delete');
  let currentLightboxImgUrl = null;

  // =========================================================================
  // Application State
  // =========================================================================
  let customerName = '';
  const TARGET_PHOTO_COUNT = 4; // always 4 photos
  let currentSessionDir = '';
  let webcamStream = null;
  let capturedImages = [];
  let idleTimer = null;
  let currentScreen = null;
  let isCapturing = false;
  let burstAborted = false;
  const IDLE_TIMEOUT_MS = 120000; // 2 minutes
  const SESSION_DURATION_MS = 240000; // 4 minutes
  let sessionTimer = null;
  let sessionTimerEnd = 0;

  // =========================================================================
  // Idle Timeout Management
  // =========================================================================
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (customerName) {
      idleTimer = setTimeout(() => {
        alert('Session timed out due to inactivity.');
        performLogout();
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
  function showScreen(screen) {
    [screenLogin, screenDashboard, screenCapture, screenReview, screenGallery]
      .forEach(s => { if (s) s.classList.add('hidden'); });
    screen.classList.remove('hidden');
    currentScreen = screen;

    // Re-trigger the fade-in animation
    screen.style.animation = 'none';
    screen.offsetHeight; // force reflow
    screen.style.animation = '';

    // Auto-focus for keyboard friendliness
    if (screen === screenLogin) {
      setTimeout(() => inputName.focus(), 100);
    } else if (screen === screenDashboard) {
      setTimeout(() => btnNewSession.focus(), 100);
    } else if (screen === screenCapture) {
      setTimeout(() => btnCapture.focus(), 100);
    } else if (screen === screenReview) {
      setTimeout(() => btnTakeMore.focus(), 100);
    } else if (screen === screenGallery) {
      setTimeout(() => btnGalleryBack.focus(), 100);
    }
  }

  // =========================================================================
  // Session Timer (5 minutes)
  // =========================================================================
  const timerContainer = document.getElementById('session-timer');
  const timerDisplay = document.getElementById('timer-display');

  function startSessionTimer() {
    stopSessionTimer();
    sessionTimerEnd = Date.now() + SESSION_DURATION_MS;
    timerContainer.classList.remove('hidden');
    updateTimerDisplay();
    sessionTimer = setInterval(() => {
      const remaining = sessionTimerEnd - Date.now();
      if (remaining <= 0) {
        // Abort any running burst first
        burstAborted = true;
        isCapturing = false;
        stopSessionTimer();
        // Time's up – force finish
        if (webcamStream) {
          webcamStream.getTracks().forEach(t => t.stop());
          webcamStream = null;
        }
        capturedImages = [];
        countdownOverlay.classList.add('hidden');
        alert('Time is up! Your 4-minute session has ended.');
        performLogout();
        return;
      }
      updateTimerDisplay();
    }, 500);
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
    if (timerContainer) timerContainer.classList.add('hidden');
    if (timerContainer) timerContainer.classList.remove('timer-warning', 'timer-critical');
  }

  // =========================================================================
  // Login Persistence (localStorage)
  // =========================================================================
  async function checkExistingLogin() {
    const saved = localStorage.getItem('photobooth_customer');
    if (saved) {
      customerName = saved;
      dashboardName.textContent = customerName;
      // Re-establish server-side session so gallery and other APIs work
      try {
        await fetch('/api/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_name: customerName })
        });
      } catch (_) { /* proceed even if server is temporarily unreachable */ }
      showScreen(screenDashboard);
      startIdleWatcher();
    } else {
      showScreen(screenLogin);
    }
  }

  // =========================================================================
  // Login
  // =========================================================================
  btnLogin.addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) {
      inputName.focus();
      inputName.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.5)';
      inputName.style.borderColor = '#ef4444';
      setTimeout(() => {
        inputName.style.boxShadow = '';
        inputName.style.borderColor = '';
      }, 1500);
      return;
    }
    customerName = name;
    localStorage.setItem('photobooth_customer', customerName);
    dashboardName.textContent = customerName;
    showScreen(screenDashboard);
    startIdleWatcher();
  });

  inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnLogin.click();
  });

  // =========================================================================
  // Logout
  // =========================================================================
  async function performLogout() {
    stopIdleWatcher();
    stopSessionTimer();
    localStorage.removeItem('photobooth_customer');
    customerName = '';
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
      webcamStream = null;
    }
    try { await fetch('/api/customer/logout', { method: 'POST' }); } catch (_) { }
    inputName.value = '';
    showScreen(screenLogin);
  }

  btnLogout.addEventListener('click', performLogout);

  // =========================================================================
  // Dashboard Navigation
  // =========================================================================
  btnNewSession.addEventListener('click', () => startCaptureSession());
  btnGalleryBack.addEventListener('click', () => showScreen(screenDashboard));
  btnGotoGallery.addEventListener('click', () => loadGallery());

  // Review → Start Over
  if (btnReviewHome) {
    btnReviewHome.addEventListener('click', () => showScreen(screenDashboard));
  }

  // Capture → Cancel/Exit
  if (btnCaptureExit) {
    btnCaptureExit.addEventListener('click', () => {
      // Signal the burst loop to stop
      burstAborted = true;
      isCapturing = false;
      // Hide countdown if visible
      countdownOverlay.classList.add('hidden');
      if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
        webcamStream = null;
      }
      capturedImages = [];
      showScreen(screenDashboard);
    });
  }

  // Allow Enter/Space on all focusable action buttons
  [btnNewSession, btnTakeMore, btnGotoGallery, btnReviewHome].forEach(el => {
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
        body: JSON.stringify({ customer_name: customerName })
      });

      const sessionData = await response.json();
      if (sessionData.error) throw new Error(sessionData.error);

      currentSessionDir = sessionData.session_dir;

      // Start Webcam
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 960, facingMode: 'user' },
        audio: false
      });
      videoWebcam.srcObject = webcamStream;

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
    if (!sessionTimer) {
      startSessionTimer();
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
  // Finish Capture → Upload → Review
  // =========================================================================
  async function finishCapture() {
    captureStatus.textContent = 'Processing...';
    captureInstruction.textContent = 'Building your photostrip, please wait!';

    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }

    try {
      const response = await fetch('/api/session/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_dir: currentSessionDir,
          images: capturedImages
        })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      // Populate Review Screen
      imgCollagePreview.src = result.collage_url + '?t=' + Date.now();

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
  btnTakeMore.addEventListener('click', () => {
    capturedImages = [];
    startCaptureSession(); // go directly to burst, no setup screen
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
          body: JSON.stringify({ customer_name: customerName })
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

  function renderGallery(data) {
    gallerySessionsContainer.innerHTML = '';
    const sessions = data.sessions || [];
    if (sessions.length === 0) {
      galleryEmpty.classList.remove('hidden');
      return;
    }
    sessions.forEach(sess => {
      const card = document.createElement('div');
      card.className = 'gallery-card';

      const title = document.createElement('h3');
      title.textContent = `Session: ${sess.folder}`;
      card.appendChild(title);

      const imgRow = document.createElement('div');
      imgRow.className = 'gallery-images-row';

      // Collage
      if (sess.collage_url) {
        const col = document.createElement('img');
        col.src = sess.collage_url + '?t=' + Date.now();
        col.alt = 'Collage';
        col.style.height = '200px';
        col.style.width = 'auto';
        col.addEventListener('click', () => openLightbox(col.src));
        imgRow.appendChild(col);
      }

      // Individual files
      if (sess.files && sess.files.length > 0) {
        sess.files.forEach(f => {
          const thumb = document.createElement('img');
          thumb.src = f + '?t=' + Date.now();
          thumb.alt = 'Photo';
          thumb.style.height = '120px';
          thumb.style.width = 'auto';
          thumb.style.border = '1px solid var(--glass-border)';
          thumb.addEventListener('click', () => openLightbox(thumb.src));
          imgRow.appendChild(thumb);
        });
      }

      card.appendChild(imgRow);
      gallerySessionsContainer.appendChild(card);
    });
  }

  // =========================================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // =========================================================================
  document.addEventListener('keydown', (e) => {
    // Don't intercept when typing in an input (except Escape)
    if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.key !== 'Escape') return;

    // ---- LOGIN SCREEN ----
    if (currentScreen === screenLogin) {
      // Enter is handled on the input itself
    }

    // ---- DASHBOARD SCREEN ----
    else if (currentScreen === screenDashboard) {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnNewSession.click();
      } else if (e.key === 'Escape') {
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
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        btnTakeMore.click();
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        btnGotoGallery.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (btnReviewHome) btnReviewHome.click();
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
        btnGalleryBack.click();
      }
    }
  });

  // Arrow-navigate through review action buttons
  const reviewButtons = [btnTakeMore, btnGotoGallery, btnReviewHome].filter(Boolean);
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
    canvas.width = videoWebcam.videoWidth || 640;
    canvas.height = videoWebcam.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoWebcam, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.95);
  }

  // =========================================================================
  // Initialise
  // =========================================================================
  checkExistingLogin();

  // =========================================================================
  // Lightbox & Audio Helpers
  // =========================================================================
  function openLightbox(url) {
    currentLightboxImgUrl = url;
    if (lightboxImg) lightboxImg.src = url;
    if (lightboxModal) lightboxModal.classList.remove('hidden');
  }

  function closeLightbox() {
    if (lightboxModal) lightboxModal.classList.add('hidden');
    if (lightboxImg) lightboxImg.src = '';
    currentLightboxImgUrl = null;
  }

  if (btnLightboxClose) btnLightboxClose.addEventListener('click', closeLightbox);
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
  }

  if (btnLightboxDownload) {
    btnLightboxDownload.addEventListener('click', () => {
      if (!currentLightboxImgUrl) return;
      const a = document.createElement('a');
      a.href = currentLightboxImgUrl;
      const parts = currentLightboxImgUrl.split('/');
      a.download = parts[parts.length - 1].split('?')[0];
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
