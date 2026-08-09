document.addEventListener('DOMContentLoaded', () => {
  const COLLAGE_WIDTH = 1182;
  const COLLAGE_HEIGHT = 3700;
  // --- View Containers ---
  const viewCustomers = document.getElementById('view-customers');
  const viewTokens = document.getElementById('view-tokens');
  const viewGallery = document.getElementById('view-gallery');
  const viewEditor = document.getElementById('view-editor');

  // --- Customer View Elements ---
  const customerGrid = document.getElementById('customer-grid');
  const searchInput = document.getElementById('session-search');
  const btnAdminSettings = document.getElementById('btn-admin-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsForm = document.getElementById('settings-form');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  const settingSessionDuration = document.getElementById('setting-session-duration');
  const settingsStatus = document.getElementById('settings-status');
  const btnOpenTokens = document.getElementById('btn-open-tokens');
  const btnRefreshCustomers = document.getElementById('btn-refresh-customers');
  const btnBackFromTokens = document.getElementById('btn-back-from-tokens');
  const btnRefreshTokens = document.getElementById('btn-refresh-tokens');
  const btnExportTokens = document.getElementById('btn-export-tokens');
  const tokenImportFile = document.getElementById('token-import-file');
  const tokenForm = document.getElementById('token-form');
  const tokenDashboard = document.getElementById('token-dashboard');
  const tokenTableBody = document.getElementById('token-table-body');
  const tokenSearch = document.getElementById('token-search');
  let tokenRows = [];

  // --- Gallery View Elements ---
  const galleryGrid = document.getElementById('gallery-grid');
  const btnBackToCustomers = document.getElementById('btn-back-to-customers');
  const galleryCustomerName = document.getElementById('gallery-customer-name');

  // --- Editor View Elements ---
  const btnBackToGallery = document.getElementById('btn-back-to-gallery');
  const editorCustomerName = document.getElementById('editor-customer-name');
  const activeSessionTime = document.getElementById('active-session-time');
  const canvasContainer = document.getElementById('canvas-container');
  const canvas = document.getElementById('collageCanvas');
  const ctx = canvas.getContext('2d');
  
  // Editor Controls
  const filterBtns = document.querySelectorAll('.filter-btn');
  const overlayTextInput = document.getElementById('overlay-text');
  const fontFamilySelect = document.getElementById('font-family');
  const fontColorSelect = document.getElementById('font-color');
  const btnApplyText = document.getElementById('btn-apply-text');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  const btnPrint = document.getElementById('btn-print');
  const btnDownload = document.getElementById('btn-download');
  const colorDots = document.querySelectorAll('#frame-color-palette .color-dot');
  const customColorPicker = document.getElementById('custom-color-picker');
  const packBtns = document.querySelectorAll('#sticker-packs-grid .pack-btn');

  // Sliders & Lightbox
  const sliderBrightness = document.getElementById('slider-brightness');
  const sliderContrast = document.getElementById('slider-contrast');
  const sliderSaturation = document.getElementById('slider-saturation');
  const valBrightness = document.getElementById('val-brightness');
  const valContrast = document.getElementById('val-contrast');
  const valSaturation = document.getElementById('val-saturation');
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');

  // --- Application State ---
  let rawSessions = [];
  let groupedCustomers = []; // Array of { folder, name, sessions: [] }
  let activeCustomer = null;
  let selectedSession = null;
  let previewItems = [];
  let currentPreviewIndex = -1;
  
  let originalImage = new Image();
  let currentFilter = 'normal';
  let textOverlay = '';
  let selectedFrameColor = '#ffffff';
  let selectedStickerPack = 'none';
  let brightness = 100;
  let contrast = 100;
  let saturation = 100;
  
  // New Layered Rendering State
  let photoImages = [];
  let stickersImage = new Image();
  stickersImage.crossOrigin = 'anonymous';
  stickersImage.onload = drawCanvas;
  
  // Draggable Text State
  let textX = COLLAGE_WIDTH / 2;
  let textY = COLLAGE_HEIGHT - 100;
  let isDraggingText = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let fontSize = 60;
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  
  // Canvas Zoom and Pan State
  let zoomLevel = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;

  function updateCanvasTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  }

  // --- View Navigation ---
  function switchView(viewElement) {
    document.querySelectorAll('.view-container').forEach(el => {
      el.classList.remove('active-view');
    });
    viewElement.classList.add('active-view');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function renderTokenDashboard(analytics) {
    if (!tokenDashboard) return;
    const cards = [
      ['Customers', analytics.total_customers],
      ['People', analytics.total_people],
      ['Revenue', `₹${Number(analytics.total_revenue || 0).toFixed(2)}`],
      ['Pending booth', analytics.pending_booth],
      ['Photos taken', analytics.booth_used],
      ['Prints pending', analytics.pending_prints],
      ['Printing done', analytics.printing_done],
      ['Prints given', analytics.photos_given],
    ];
    tokenDashboard.innerHTML = cards.map(([label, value]) =>
      `<div class="token-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  function renderTokens() {
    if (!tokenTableBody) return;
    const query = (tokenSearch?.value || '').trim().toLowerCase();
    const rows = tokenRows.filter(token => [token.token_number, token.customer_name, token.contact_number, token.email]
      .some(value => String(value || '').toLowerCase().includes(query)));
    tokenTableBody.innerHTML = rows.map(token => `<tr>
      <td>${escapeHtml(token.token_number)}${token.is_test ? ' <small>(test)</small>' : ''}</td>
      <td>${escapeHtml(token.customer_name)}</td><td>${escapeHtml(token.contact_number)}</td><td>${escapeHtml(token.email)}</td><td>${Number(token.people_count || 1)}</td>
      <td>₹${Number(token.amount || 0).toFixed(2)}</td><td>${escapeHtml(token.payment_mode)}</td>
      <td><label class="token-check"><input type="checkbox" data-token="${escapeHtml(token.token_number)}" data-field="booth_used" ${token.booth_used ? 'checked' : ''}> ${token.booth_used ? 'Used' : 'Pending'}</label></td>
      <td><label class="token-check"><input type="checkbox" data-token="${escapeHtml(token.token_number)}" data-field="printing_done" ${token.printing_done ? 'checked' : ''}> ${token.printing_done ? 'Done' : 'Pending'}</label></td>
      <td><label class="token-check"><input type="checkbox" data-token="${escapeHtml(token.token_number)}" data-field="photo_given" ${token.photo_given ? 'checked' : ''}> ${token.photo_given ? 'Given' : 'Pending'}</label></td>
      <td><div class="token-actions">
        <button class="token-edit-btn" data-edit-token="${escapeHtml(token.token_number)}">Edit</button>
        ${token.contact_number ? `<button class="token-whatsapp-btn" data-whatsapp-token="${escapeHtml(token.token_number)}">WhatsApp</button>` : ''}
        ${token.email ? `<button class="token-email-btn" data-email-token="${escapeHtml(token.token_number)}">Email</button>` : ''}
        ${token.is_test ? '<small>Permanent test token</small>' : `<button class="token-delete-btn" data-delete-token="${escapeHtml(token.token_number)}">Delete</button>`}
      </div></td>
    </tr>`).join('') || '<tr><td colspan="11">No tokens found.</td></tr>';
  }

  async function fetchTokens() {
    const response = await fetch('/api/admin/tokens');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load tokens');
    tokenRows = data.tokens;
    renderTokenDashboard(data.analytics);
    renderTokens();
  }

  async function prepareNextTokenNumber() {
    const input = document.getElementById('token-number');
    if (!input) return;
    const response = await fetch('/api/admin/tokens/next');
    const data = await response.json();
    if (response.ok) input.value = data.token_number;
  }

  if (btnOpenTokens) btnOpenTokens.addEventListener('click', async () => {
    switchView(viewTokens);
    try { await fetchTokens(); await prepareNextTokenNumber(); } catch (error) { alert(error.message); }
  });
  if (btnRefreshCustomers) btnRefreshCustomers.addEventListener('click', fetchSessions);
  if (btnRefreshTokens) btnRefreshTokens.addEventListener('click', async () => {
    try { await fetchTokens(); } catch (error) { alert(error.message); }
  });
  if (btnBackFromTokens) btnBackFromTokens.addEventListener('click', () => switchView(viewCustomers));
  if (tokenSearch) tokenSearch.addEventListener('input', renderTokens);
  if (btnExportTokens) btnExportTokens.addEventListener('click', () => { window.location.assign('/api/admin/tokens/export'); });
  if (tokenForm) tokenForm.addEventListener('submit', async event => {
    event.preventDefault();
    const body = {
      token_number: document.getElementById('token-number').value,
      customer_name: document.getElementById('token-customer-name').value,
      contact_number: document.getElementById('token-contact').value,
      email: document.getElementById('token-email').value,
      people_count: document.getElementById('token-people-count').value,
      amount: document.getElementById('token-amount').value,
      payment_mode: document.getElementById('token-payment-mode').value,
    };
    const response = await fetch('/api/admin/tokens', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) return alert(data.error || 'Could not save token');
    tokenForm.reset();
    tokenForm.querySelector('button[type="submit"]').textContent = 'Save Token';
    await fetchTokens();
    await prepareNextTokenNumber();
  });
  if (tokenImportFile) tokenImportFile.addEventListener('change', async () => {
    const file = tokenImportFile.files[0];
    if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    const response = await fetch('/api/admin/tokens/import', { method: 'POST', body: formData });
    const data = await response.json();
    tokenImportFile.value = '';
    if (!response.ok) return alert(data.error || 'Import failed');
    alert(`${data.imported} token(s) imported.`);
    await fetchTokens();
  });
  if (tokenTableBody) tokenTableBody.addEventListener('change', async event => {
    const checkbox = event.target;
    if (!checkbox.matches('input[data-token][data-field]')) return;
    const response = await fetch(`/api/admin/tokens/${encodeURIComponent(checkbox.dataset.token)}/status`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({field: checkbox.dataset.field, value: checkbox.checked})
    });
    if (!response.ok) { alert('Could not update status'); checkbox.checked = !checkbox.checked; return; }
    await fetchTokens();
  });
  if (tokenTableBody) tokenTableBody.addEventListener('click', async event => {
    const editButton = event.target.closest('[data-edit-token]');
    if (editButton) {
      const token = tokenRows.find(row => row.token_number === editButton.dataset.editToken);
      if (!token) return;
      document.getElementById('token-number').value = token.token_number;
      document.getElementById('token-customer-name').value = token.customer_name || '';
      document.getElementById('token-contact').value = token.contact_number || '';
      document.getElementById('token-email').value = token.email || '';
      document.getElementById('token-people-count').value = token.people_count || 1;
      document.getElementById('token-amount').value = token.amount || '';
      document.getElementById('token-payment-mode').value = token.payment_mode || '';
      tokenForm.querySelector('button[type="submit"]').textContent = 'Update Token';
      tokenForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('token-customer-name').focus();
      return;
    }
    const whatsappButton = event.target.closest('[data-whatsapp-token]');
    if (whatsappButton) {
      const token = tokenRows.find(row => row.token_number === whatsappButton.dataset.whatsappToken);
      if (!token) return;
      let number = String(token.contact_number || '').replace(/\D/g, '');
      if (number.length === 10) number = `91${number}`;
      if (!number) return alert('Add a contact number before opening WhatsApp.');
      const message = `Hi ${token.customer_name}, your Chini Champra Creations photobooth photos are ready.`;
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
      return;
    }
    const emailButton = event.target.closest('[data-email-token]');
    if (emailButton) {
      const token = tokenRows.find(row => row.token_number === emailButton.dataset.emailToken);
      if (!token?.email) return alert('Add an email address before opening email.');
      const subject = 'Your Chini Champra Creations photos are ready';
      const body = `Hi ${token.customer_name},\n\nYour Chini Champra Creations photobooth photos are ready.\n\nThank you!`;
      window.location.href = `mailto:${encodeURIComponent(token.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return;
    }
    const button = event.target.closest('[data-delete-token]');
    if (!button) return;
    const tokenNumber = button.dataset.deleteToken;
    if (!confirm(`Delete customer token ${tokenNumber}? Their saved photo files will be kept.`)) return;
    const response = await fetch(`/api/admin/tokens/${encodeURIComponent(tokenNumber)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) return alert(data.error || 'Could not delete customer');
    await fetchTokens();
    await prepareNextTokenNumber();
  });

  btnBackToCustomers.addEventListener('click', () => {
    switchView(viewCustomers);
    activeCustomer = null;
  });

  btnBackToGallery.addEventListener('click', async () => {
    switchView(viewGallery);
    // Re-fetch and re-render gallery so newly saved edits appear
    if (activeCustomer) {
      await fetchSessions();
      // Find the updated customer data after refresh
      const updated = groupedCustomers.find(c => c.folder === activeCustomer.folder);
      if (updated) {
        activeCustomer = updated;
        renderGallery(updated);
      }
    }
  });

  // --- 1. Fetch Data and Group ---
  async function fetchSessions() {
    try {
      const response = await fetch('/api/admin/sessions');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      rawSessions = data.sessions;
      groupSessionsByCustomer(rawSessions);
      renderCustomers(groupedCustomers);
    } catch (err) {
      console.error(err);
      if (customerGrid) {
        customerGrid.innerHTML = `<div class="empty-state"><p style="color: #ef4444;">Error: ${err.message}</p></div>`;
      }
    }
  }

  function groupSessionsByCustomer(sessionsList) {
    const map = new Map();
    sessionsList.forEach(sess => {
      if (!map.has(sess.folder)) {
        map.set(sess.folder, {
          folder: sess.folder,
          customer_name: sess.customer_name,
          sessions: []
        });
      }
      map.get(sess.folder).sessions.push(sess);
    });
    groupedCustomers = Array.from(map.values());
    // Sort by latest session time
    groupedCustomers.sort((a, b) => {
      const aTime = a.sessions.length > 0 ? a.sessions[0].timestamp : '0';
      const bTime = b.sessions.length > 0 ? b.sessions[0].timestamp : '0';
      return bTime.localeCompare(aTime);
    });
  }

  // --- 2. Render Customers Grid ---
  function renderCustomers(list) {
    if (!customerGrid) return;
    if (list.length === 0) {
      customerGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem;">
          <p>No customer folders found.</p>
        </div>`;
      return;
    }
    
    customerGrid.innerHTML = '';
    list.forEach(cust => {
      const latestSession = cust.sessions[0];
      const timeStr = latestSession ? latestSession.time : '';
      const photoCount = cust.sessions.length;
      
      const card = document.createElement('div');
      card.className = 'customer-card';
      card.innerHTML = `
        <div class="customer-card-title">${cust.customer_name}</div>
        <div class="customer-card-meta">
          📸 ${photoCount} Session${photoCount !== 1 ? 's' : ''}<br>
          🕒 Last: ${timeStr}
        </div>
      `;
      card.addEventListener('click', () => {
        activeCustomer = cust;
        galleryCustomerName.textContent = cust.customer_name;
        renderGallery(cust);
        switchView(viewGallery);
      });
      customerGrid.appendChild(card);
    });
  }

  // Search Filter
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      const filtered = groupedCustomers.filter(cust => 
        cust.customer_name.toLowerCase().includes(query) || 
        cust.folder.toLowerCase().includes(query)
      );
      renderCustomers(filtered);
    });
  }

  // --- 3. Render Gallery for Active Customer ---
  function renderGallery(customerData) {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';
    previewItems = [];
    currentPreviewIndex = -1;
    
    if (customerData.sessions.length === 0) {
      galleryGrid.innerHTML = '<p>No collages found for this customer.</p>';
      return;
    }

    // Sort sessions oldest-first
    const sortedSessions = [...customerData.sessions].sort((a, b) => {
      return a.timestamp.localeCompare(b.timestamp);
    });

    sortedSessions.forEach((sess, index) => {
      const sessionLabel = `Session ${index + 1}`;
      // Original collage
      if (sess.collage_url) {
        addGalleryItem(sess.collage_url, sess, customerData, false, sessionLabel);
      }
      
      // All edited versions
      const editedUrls = sess.collage_edited_urls || [];
      editedUrls.forEach((editUrl) => {
        addGalleryItem(editUrl, sess, customerData, true, `${sessionLabel} (Edited)`);
      });

    });
  }
  
  function addGalleryItem(imgUrl, sess, customerData, isEdited, sessionLabel) {
    previewItems.push({ imgUrl, sess, customerData, isEdited });
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.style.position = 'relative';
    item.innerHTML = `
      <div class="gallery-session-label">${sessionLabel}</div>
      <img src="${imgUrl}?t=${new Date().getTime()}" alt="Collage">
      <div class="gallery-item-time">${sess.time}</div>
    `;
    item.addEventListener('click', () => {
      openPreviewModal(imgUrl, sess, customerData, isEdited);
    });
    galleryGrid.appendChild(item);
  }

  async function copyOriginalPhoto(imgUrl) {
    try {
      const response = await fetch(imgUrl);
      if (!response.ok) throw new Error('Photo could not be read');
      const blob = await response.blob();
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image support is unavailable');
      }
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      alert('Original photo copied. Open Photoshop and press Ctrl+V.');
    } catch (error) {
      alert('Could not copy this photo automatically. Use Download Original and drag that JPG into Photoshop.');
    }
  }

  function addOriginalGalleryItem(imgUrl, sess, customerData, photoNumber) {
    const item = document.createElement('div');
    item.className = 'gallery-item gallery-original-item';
    item.style.position = 'relative';
    const image = document.createElement('img');
    image.src = `${imgUrl}?t=${Date.now()}`;
    image.alt = `Original photo ${photoNumber}`;
    image.draggable = true;
    image.title = 'Drag into Photoshop, or use Copy Original';
    image.addEventListener('click', () => openPreviewModal(imgUrl, sess, customerData, false));

    const label = document.createElement('div');
    label.className = 'gallery-item-time';
    label.textContent = `Original photo ${photoNumber} · full resolution`;

    const actions = document.createElement('div');
    actions.className = 'original-photo-actions';
    const copyButton = document.createElement('button');
    copyButton.className = 'original-photo-btn';
    copyButton.textContent = 'Copy Original';
    copyButton.addEventListener('click', event => {
      event.stopPropagation();
      copyOriginalPhoto(imgUrl);
    });
    const downloadLink = document.createElement('a');
    downloadLink.className = 'original-photo-btn';
    downloadLink.href = getDownloadUrl(imgUrl);
    downloadLink.textContent = 'Download JPG';
    downloadLink.addEventListener('click', event => event.stopPropagation());
    actions.append(copyButton, downloadLink);
    item.append(image, label, actions);
    galleryGrid.appendChild(item);
  }

  // --- Preview Modal ---
  const previewModal = document.getElementById('preview-modal');
  const previewModalImg = document.getElementById('preview-modal-img');
  const previewImageWrap = document.getElementById('preview-image-wrap');
  const btnPreviewClose = document.getElementById('btn-preview-close');
  const btnPreviewPrev = document.getElementById('btn-preview-prev');
  const btnPreviewNext = document.getElementById('btn-preview-next');
  const btnPreviewDownload = document.getElementById('btn-preview-download');
  const btnPreviewEdit = document.getElementById('btn-preview-edit');
  
  let currentPreviewSession = null;
  let currentPreviewCustomer = null;
  let currentPreviewImgUrl = null;
  let currentPreviewIsEdited = false;

  function getDownloadUrl(photoUrl) {
    const photoPath = new URL(photoUrl, window.location.origin).pathname;
    const photoPrefix = '/static/photos/';
    if (!photoPath.startsWith(photoPrefix)) return photoUrl;
    const encodedPath = photoPath.slice(photoPrefix.length).split('/').map(encodeURIComponent).join('/');
    return `/api/photo/download/${encodedPath}`;
  }

  function openPreviewModal(imgUrl, session, customerData, isEdited) {
    currentPreviewSession = session;
    currentPreviewCustomer = customerData;
    currentPreviewImgUrl = imgUrl;
    currentPreviewIsEdited = isEdited;
    currentPreviewIndex = previewItems.findIndex(item => item.imgUrl === imgUrl);
    previewModal.classList.remove('is-zoomed');
    if (previewImageWrap) previewImageWrap.scrollTo({ top: 0, left: 0 });
    previewModalImg.src = imgUrl + '?t=' + new Date().getTime();
    previewModal.style.display = 'flex';
    setTimeout(() => {
      previewModal.style.opacity = '1';
    }, 10);
  }

  if (btnPreviewClose) {
    btnPreviewClose.addEventListener('click', () => {
      closePreviewModal();
    });
  }

  function closePreviewModal() {
    previewModal.classList.remove('is-zoomed');
    previewModal.style.opacity = '0';
    setTimeout(() => { previewModal.style.display = 'none'; }, 200);
  }

  function navigatePreview(direction) {
    if (!previewItems.length || currentPreviewIndex < 0) return;
    const nextIndex = (currentPreviewIndex + direction + previewItems.length) % previewItems.length;
    const item = previewItems[nextIndex];
    openPreviewModal(item.imgUrl, item.sess, item.customerData, item.isEdited);
  }

  if (btnPreviewPrev) btnPreviewPrev.addEventListener('click', () => navigatePreview(-1));
  if (btnPreviewNext) btnPreviewNext.addEventListener('click', () => navigatePreview(1));
  if (previewModalImg) previewModalImg.addEventListener('click', event => {
    event.stopPropagation();
    previewModal.classList.toggle('is-zoomed');
  });
  if (previewModal) previewModal.addEventListener('click', event => {
    if (event.target === previewModal) closePreviewModal();
  });
  document.addEventListener('keydown', event => {
    if (previewModal?.style.display !== 'flex') return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigatePreview(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); navigatePreview(1); }
    else if (event.key === 'Escape') { event.preventDefault(); closePreviewModal(); }
  });

  function closeSettings() {
    settingsModal.style.display = 'none';
    settingsForm.reset();
    settingsStatus.textContent = '';
  }

  if (btnAdminSettings) {
    btnAdminSettings.addEventListener('click', async () => {
      settingsStatus.textContent = '';
      try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load settings');
        settingSessionDuration.value = data.session_duration_minutes;
        settingsModal.style.display = 'flex';
        settingSessionDuration.focus();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (btnSettingsClose) btnSettingsClose.addEventListener('click', closeSettings);
  if (settingsModal) {
    settingsModal.addEventListener('click', event => {
      if (event.target === settingsModal) closeSettings();
    });
  }
  if (settingsForm) {
    settingsForm.addEventListener('submit', async event => {
      event.preventDefault();
      settingsStatus.textContent = 'Saving…';
      try {
        const response = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_duration_minutes: settingSessionDuration.value,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to save settings');
        settingsStatus.textContent = `Saved: ${data.session_duration_minutes}-minute sessions.`;
      } catch (err) {
        settingsStatus.textContent = err.message;
      }
    });
  }

  if (btnPreviewDownload) {
    btnPreviewDownload.addEventListener('click', () => {
      if (!currentPreviewImgUrl) return;

      const downloadLink = document.createElement('a');
      downloadLink.href = getDownloadUrl(currentPreviewImgUrl);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    });
  }

  if (btnPreviewEdit) {
    btnPreviewEdit.addEventListener('click', () => {
      previewModal.style.opacity = '0';
      setTimeout(() => {
        previewModal.style.display = 'none';
        openEditor(currentPreviewSession, currentPreviewCustomer, currentPreviewImgUrl, currentPreviewIsEdited);
      }, 200);
    });
  }

  // --- 4. Open Editor ---
  // editImgUrl: the specific image to load for editing
  // isEdited: if true, we're editing an already-edited image (no layered rebuild)
  function openEditor(session, customerData, editImgUrl, isEdited) {
    selectedSession = session;
    editorCustomerName.textContent = customerData.customer_name;
    activeSessionTime.textContent = session.time;
    
    // Switch View
    switchView(viewEditor);
    
    // Reset control fields
    currentFilter = 'normal';
    filterBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === 'normal') btn.classList.add('active');
    });
    overlayTextInput.value = '';
    textOverlay = '';
    
    // Reset Sliders
    brightness = 100;
    contrast = 100;
    saturation = 100;
    if (sliderBrightness) sliderBrightness.value = 100;
    if (sliderContrast) sliderContrast.value = 100;
    if (sliderSaturation) sliderSaturation.value = 100;
    if (valBrightness) valBrightness.textContent = '100%';
    if (valContrast) valContrast.textContent = '100%';
    if (valSaturation) valSaturation.textContent = '100%';
    
    // Reset Text Styles and Position
    fontSize = 60;
    isBold = false;
    isItalic = false;
    isUnderline = false;
    if (sliderFontSize) sliderFontSize.value = 60;
    if (valFontSize) valFontSize.textContent = '60px';
    if (btnTextBold) btnTextBold.classList.remove('active');
    if (btnTextItalic) btnTextItalic.classList.remove('active');
    if (btnTextUnderline) btnTextUnderline.classList.remove('active');
    
    textX = COLLAGE_WIDTH / 2;
    textY = COLLAGE_HEIGHT - 100;
    
    // Reset Zoom and Pan
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    updateCanvasTransform();
    
    // Reset UI selections
    selectedFrameColor = '#ffffff';
    selectedStickerPack = 'none';
    colorDots.forEach(d => d.classList.toggle('active', d.dataset.color === '#ffffff'));
    packBtns.forEach(b => b.classList.toggle('active', b.dataset.pack === 'none'));
    
    // Determine the image URL to load
    const imgUrl = editImgUrl || session.collage_url;
    if (!imgUrl) {
      alert("No collage image found for this session!");
      return;
    }
    
    // Every gallery version uses the original captures as editable layers.
    // This lets staff change the frame again without finding the original item.
    photoImages = [];
    stickersImage.src = '';
    
    if (session.files && session.files.length > 0) {
      // Load individual capture photos for layered editing.
      Promise.all(session.files.map(url => {
        return new Promise(resolve => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });
      })).then(imgs => {
        photoImages = imgs.filter(img => img !== null);
        drawCanvas();
      });
    }

    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    originalImage = new Image();
    originalImage.crossOrigin = 'anonymous';
    originalImage.onload = () => {
      canvas.width = COLLAGE_WIDTH;
      canvas.height = COLLAGE_HEIGHT;
      drawCanvas();
    };
    originalImage.src = imgUrl + '?t=' + new Date().getTime();
  }

  // --- 5. Draw Canvas (Editor Logic) ---
  function drawCanvas() {
    if (!originalImage.src || !originalImage.width) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply filter
    let filterString = '';
    switch (currentFilter) {
      case 'grayscale':
        filterString = 'grayscale(100%)';
        break;
      case 'sepia':
        filterString = 'sepia(100%) contrast(90%) brightness(95%)';
        break;
      case 'cyan':
        filterString = 'hue-rotate(180deg) saturate(110%)';
        break;
      case 'neon':
        filterString = 'hue-rotate(290deg) saturate(140%)';
        break;
      case 'contrast':
        filterString = 'contrast(140%) brightness(105%)';
        break;
    }
    
    let manualAdjustments = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    if (!filterString || filterString === 'none') {
      filterString = manualAdjustments;
    } else {
      filterString += ` ${manualAdjustments}`;
    }
    
    // LAYER 1: Background Frame Color (only when editing layered captures)
    if (photoImages.length > 0) {
      ctx.filter = 'none';
      ctx.fillStyle = selectedFrameColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // LAYER 2: Photos (Filtered)
    ctx.filter = filterString;
    if (photoImages.length > 0) {
      const photoW = 1022, photoH = 752, leftMargin = 80, topMargin = 80, gutter = 80;
      photoImages.forEach((img, i) => {
        const y = topMargin + i * (photoH + gutter);
        
        // Calculate crop to cover (equivalent to object-fit: cover)
        const imgRatio = img.width / img.height;
        const targetRatio = photoW / photoH;
        let sWidth, sHeight, sx, sy;

        if (imgRatio > targetRatio) {
          sHeight = img.height;
          sWidth = img.height * targetRatio;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = img.width / targetRatio;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }
        
        ctx.drawImage(img, sx, sy, sWidth, sHeight, leftMargin, y, photoW, photoH);
      });
    } else {
      // Fallback: editing a flat edited image — draw it with filter applied
      ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    }
    
    // Reset filter
    ctx.filter = 'none'; 
    
    // LAYER 3: Stickers
    if (stickersImage && stickersImage.width > 0 && selectedStickerPack !== 'none') {
      ctx.drawImage(stickersImage, 0, 0, canvas.width, canvas.height);
    }
    
    // LAYER 4: Text overlay
    if (textOverlay) {
      const fontFamily = fontFamilySelect ? fontFamilySelect.value : 'Outfit';
      const fontColor = fontColorSelect ? fontColorSelect.value : '#000000';
      
      const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px "${fontFamily}", sans-serif`;
      ctx.font = fontStyle;
      ctx.textAlign = 'center';
      ctx.fillStyle = fontColor;
      
      // Outline to ensure visibility
      ctx.strokeStyle = (fontColor === '#ffffff' || fontColor === '#00f0ff') ? '#000000' : '#ffffff';
      ctx.lineWidth = Math.max(2, fontSize * 0.05);
      ctx.strokeText(textOverlay, textX, textY);
      ctx.fillText(textOverlay, textX, textY);
      
      // Draw Underline
      if (isUnderline) {
         const metrics = ctx.measureText(textOverlay);
         const textWidth = metrics.width;
         ctx.beginPath();
         // textY is alphabetic baseline
         const lineY = textY + fontSize * 0.15; 
         ctx.moveTo(textX - textWidth / 2, lineY);
         ctx.lineTo(textX + textWidth / 2, lineY);
         ctx.lineWidth = Math.max(3, fontSize * 0.08);
         ctx.strokeStyle = fontColor;
         ctx.stroke();
      }
    }
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      drawCanvas();
    });
  });

  if (btnApplyText) {
    btnApplyText.addEventListener('click', () => {
      textOverlay = overlayTextInput.value.trim();
      drawCanvas();
    });
  }

  const btnClearText = document.getElementById('btn-clear-text');
  if (btnClearText) {
    btnClearText.addEventListener('click', () => {
      overlayTextInput.value = '';
      textOverlay = '';
      drawCanvas();
    });
  }

  if (fontFamilySelect) fontFamilySelect.addEventListener('change', drawCanvas);
  if (fontColorSelect) fontColorSelect.addEventListener('change', drawCanvas);

  // Text Styling Listeners
  const sliderFontSize = document.getElementById('slider-font-size');
  const valFontSize = document.getElementById('val-font-size');
  const btnTextBold = document.getElementById('btn-text-bold');
  const btnTextItalic = document.getElementById('btn-text-italic');
  const btnTextUnderline = document.getElementById('btn-text-underline');

  if (sliderFontSize) {
    sliderFontSize.addEventListener('input', (e) => {
      fontSize = parseInt(e.target.value);
      if (valFontSize) valFontSize.textContent = fontSize + 'px';
      drawCanvas();
    });
  }

  if (btnTextBold) {
    btnTextBold.addEventListener('click', () => {
      isBold = !isBold;
      btnTextBold.classList.toggle('active', isBold);
      drawCanvas();
    });
  }

  if (btnTextItalic) {
    btnTextItalic.addEventListener('click', () => {
      isItalic = !isItalic;
      btnTextItalic.classList.toggle('active', isItalic);
      drawCanvas();
    });
  }

  if (btnTextUnderline) {
    btnTextUnderline.addEventListener('click', () => {
      isUnderline = !isUnderline;
      btnTextUnderline.classList.toggle('active', isUnderline);
      drawCanvas();
    });
  }

  // Text Dragging Logic
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  canvasContainer.addEventListener('mousedown', (e) => {
    // Check if clicking text
    if (textOverlay) {
      const pos = getCanvasPos(e);
      ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px "${fontFamilySelect.value}", sans-serif`;
      const metrics = ctx.measureText(textOverlay);
      const textWidth = metrics.width;
      const textHeight = fontSize;
  
      if (pos.x >= textX - textWidth / 2 && pos.x <= textX + textWidth / 2 &&
          pos.y >= textY - textHeight && pos.y <= textY + 20) {
        isDraggingText = true;
        dragOffsetX = pos.x - textX;
        dragOffsetY = pos.y - textY;
        canvasContainer.style.cursor = 'grabbing';
        return; // Don't start panning if dragging text
      }
    }
    
    // Otherwise start panning
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    canvasContainer.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingText) {
      const pos = getCanvasPos(e);
      textX = pos.x - dragOffsetX;
      textY = pos.y - dragOffsetY;
      drawCanvas();
    } else if (isPanning) {
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      updateCanvasTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    isDraggingText = false;
    isPanning = false;
    canvasContainer.style.cursor = 'grab';
  });
  
  canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    if (e.deltaY < 0) {
      zoomLevel += zoomFactor;
    } else {
      zoomLevel -= zoomFactor;
    }
    zoomLevel = Math.max(0.2, Math.min(zoomLevel, 5));
    updateCanvasTransform();
  }, { passive: false });
  
  // Slider Event Listeners
  if (sliderBrightness) {
    sliderBrightness.addEventListener('input', (e) => {
      brightness = e.target.value;
      valBrightness.textContent = brightness + '%';
      drawCanvas();
    });
  }
  if (sliderContrast) {
    sliderContrast.addEventListener('input', (e) => {
      contrast = e.target.value;
      valContrast.textContent = contrast + '%';
      drawCanvas();
    });
  }
  if (sliderSaturation) {
    sliderSaturation.addEventListener('input', (e) => {
      saturation = e.target.value;
      valSaturation.textContent = saturation + '%';
      drawCanvas();
    });
  }

  // Lightbox logic
  if (canvasContainer && lightboxModal) {
    canvasContainer.addEventListener('click', () => {
      if (!originalImage.src || !originalImage.width) return;
      lightboxImg.src = canvas.toDataURL('image/jpeg', 0.95);
      lightboxModal.classList.add('active');
    });
    
    lightboxModal.addEventListener('click', () => {
      lightboxModal.classList.remove('active');
    });
  }

  async function updateAdminPreview() {
    if (!selectedSession) return;
    try {
      const response = await fetch('/api/session/render_preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_dir: selectedSession.folder,
          session_timestamp: selectedSession.timestamp,
          frame_color: selectedFrameColor,
          sticker_pack: selectedStickerPack,
          layer_type: 'stickers_only'
        })
      });
      const result = await response.json();
      if (result.preview_data) {
        stickersImage.src = result.preview_data;
      } else {
        drawCanvas();
      }
    } catch (err) {
      console.error('Failed to update preview:', err);
    }
  }

  colorDots.forEach(dot => {
    dot.addEventListener('click', async () => {
      colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      selectedFrameColor = dot.dataset.color;
      await updateAdminPreview();
    });
  });

  if (customColorPicker) {
    customColorPicker.addEventListener('input', async (e) => {
      colorDots.forEach(d => d.classList.remove('active'));
      selectedFrameColor = e.target.value;
      await updateAdminPreview();
    });
  }

  packBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      packBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStickerPack = btn.dataset.pack;
      await updateAdminPreview();
    });
  });

  // --- 6. Editor Actions ---
  if (btnSaveEdit) {
    btnSaveEdit.addEventListener('click', async () => {
      if (!selectedSession) return;
      
      btnSaveEdit.disabled = true;
      btnSaveEdit.textContent = 'Saving...';
      
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const response = await fetch('/api/admin/save_edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_dir: selectedSession.folder,
            timestamp: selectedSession.timestamp,
            image: dataUrl
          })
        });
        
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        
        selectedSession.collage_edited_urls = selectedSession.collage_edited_urls || [];
        selectedSession.collage_edited_urls.push(result.collage_edited_url);
        btnSaveEdit.textContent = 'Saved! ✨';
        
        // Refresh session data in background so if we go back to gallery it has the new image
        await fetchSessions();
      } catch (err) {
        console.error(err);
        alert('Failed to save edit: ' + err.message);
      } finally {
        setTimeout(() => {
          btnSaveEdit.disabled = false;
          btnSaveEdit.textContent = '💾 Save Edited Image';
        }, 1500);
      }
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      if (!selectedSession) return;
      
      const link = document.createElement('a');
      link.download = `photostrip_${selectedSession.folder}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    });
  }

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (settingsModal.style.display === 'flex') {
        closeSettings();
        return;
      }
      // 1. If Preview Modal is open, close it
      if (previewModal.style.display === 'flex') {
        if (btnPreviewClose) btnPreviewClose.click();
        return;
      }
      
      // 2. If in Editor View, go back to Gallery
      if (viewEditor.classList.contains('active-view')) {
        if (btnBackToGallery) btnBackToGallery.click();
        return;
      }
      
      // 3. If in Gallery View, go back to Customers
      if (viewGallery.classList.contains('active-view')) {
        if (btnBackToCustomers) btnBackToCustomers.click();
        return;
      }
    }
  });

  // Initial Data Fetch
  fetchSessions();
});
