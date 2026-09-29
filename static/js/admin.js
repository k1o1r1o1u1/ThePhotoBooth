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
  const btnDeleteAllTokens = document.getElementById('btn-delete-all-tokens');
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
  const btnCombineMode = document.getElementById('btn-combine-mode');
  const btnCombineSelected = document.getElementById('btn-combine-selected');
  const combinePreviewModal = document.getElementById('combine-preview-modal');
  const combinePreviewModalImg = document.getElementById('combine-preview-modal-img');
  const btnCombinePreviewClose = document.getElementById('btn-combine-preview-close');
  const btnCombinePreviewDownload = document.getElementById('btn-combine-preview-download');

  let isCombineMode = false;
  let combineSelectedItems = []; // Will hold {imgUrl}

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
  const btnApplyText = document.getElementById('btn-apply-text');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  const btnPrint = document.getElementById('btn-print');
  const btnDownload = document.getElementById('btn-download');
  const colorDots = document.querySelectorAll('#frame-color-palette .color-dot');
  const customColorPicker = document.getElementById('custom-color-picker');
  const packBtns = document.querySelectorAll('#sticker-packs-grid .pack-btn');

  // MS Word Color Picker Elements
  const btnMSWordColorToggle = document.getElementById('btn-msword-color-toggle');
  const mswordPaletteDropdown = document.getElementById('msword-palette-dropdown');
  const mswordActiveColorBar = document.getElementById('msword-active-color-bar');
  const mswordColorName = document.getElementById('msword-color-name');
  const mswordThemeTopRow = document.getElementById('msword-theme-top-row');
  const mswordThemeShadesGrid = document.getElementById('msword-theme-shades-grid');
  const mswordStandardGrid = document.getElementById('msword-standard-grid');
  const mswordCustomColorInput = document.getElementById('msword-custom-color-input');

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
  
  // Draggable Text State (MS Word-style interactive overlay)
  let textX = COLLAGE_WIDTH / 2;
  let textY = COLLAGE_HEIGHT - 120;
  let textRotation = 0;
  let isTextSelected = false;
  let fontColor = '#000000';
  let fontSize = 90;
  let isBold = true;
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

  // --- Kawaii Custom Stickers State & Catalog ---
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

  let customStickers = []; // [{ id, name, file, img, x, y, width, height, aspectRatio, rotation, flipX }]
  let selectedSticker = null;
  let activeDrag = null; // null | { mode, sticker, ... }
  let hasInteractedWithCanvas = false;

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
      ['Strips', analytics.total_strips],
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
      <td data-label="Token">${escapeHtml(token.token_number)}${token.is_test ? ' <small>(test)</small>' : ''}</td>
      <td data-label="Name">${escapeHtml(token.customer_name)}</td><td data-label="Contact">${escapeHtml(token.contact_number)}</td><td data-label="Email">${escapeHtml(token.email)}</td><td data-label="People">${Number(token.people_count || 1)}</td>
      <td data-label="Strips">${Number(token.no_of_strips || 0)}</td>
      <td data-label="Amount">₹${Number(token.amount || 0).toFixed(2)}</td><td data-label="Payment">${escapeHtml(token.payment_mode)}</td>
      <td data-label="Booth used"><label class="token-check"><input type="checkbox" data-token="${escapeHtml(token.token_number)}" data-field="booth_used" ${token.booth_used ? 'checked' : ''}> ${token.booth_used ? 'Used' : 'Pending'}</label></td>
      <td data-label="Printing done"><label class="token-check"><input type="checkbox" data-token="${escapeHtml(token.token_number)}" data-field="printing_done" ${token.printing_done ? 'checked' : ''}> ${token.printing_done ? 'Done' : 'Pending'}</label></td>
      <td data-label="Print given"><label class="token-check"><input type="checkbox" data-token="${escapeHtml(token.token_number)}" data-field="photo_given" ${token.photo_given ? 'checked' : ''}> ${token.photo_given ? 'Given' : 'Pending'}</label></td>
      <td data-label="Action"><div class="token-actions">
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
      no_of_strips: document.getElementById('token-no-of-strips').value,
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
      document.getElementById('token-no-of-strips').value = token.no_of_strips || 0;
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
    if (!confirm(`Delete customer token ${tokenNumber}? Their folder will be archived.`)) return;
    const response = await fetch(`/api/admin/tokens/${encodeURIComponent(tokenNumber)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) return alert(data.error || 'Could not delete customer');
    await fetchTokens();
    await prepareNextTokenNumber();
  });

  if (btnDeleteAllTokens) {
    btnDeleteAllTokens.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete ALL customer tokens? Their folders will be archived.')) return;
      const response = await fetch('/api/admin/tokens', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) return alert(data.error || 'Could not delete all tokens');
      alert(`Deleted and archived ${data.deleted} tokens.`);
      await fetchTokens();
      await prepareNextTokenNumber();
    });
  }

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
        <div class="customer-card-title">Token ${cust.folder}</div>
        <div class="customer-card-meta">
          📸 ${photoCount} Session${photoCount !== 1 ? 's' : ''}<br>
          🕒 Last: ${timeStr}
        </div>
      `;
      card.addEventListener('click', () => {
        activeCustomer = cust;
        galleryCustomerName.textContent = `Token ${cust.folder}`;
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
      <div class="combine-check hidden" style="position: absolute; top: 10px; right: 10px; background: white; border: 2px solid #ccc; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: transparent;">✓</div>
    `;
    
    item.addEventListener('click', (e) => {
      if (isCombineMode) {
        const checkEl = item.querySelector('.combine-check');
        const isSelected = combineSelectedItems.includes(imgUrl);
        
        if (isSelected) {
          // Deselect
          combineSelectedItems = combineSelectedItems.filter(url => url !== imgUrl);
          checkEl.style.borderColor = '#ccc';
          checkEl.style.background = 'white';
          checkEl.style.color = 'transparent';
          item.style.boxShadow = 'none';
        } else {
          // Select (limit to 2)
          if (combineSelectedItems.length >= 2) {
            alert("You can only select exactly 2 strips to combine.");
            return;
          }
          combineSelectedItems.push(imgUrl);
          checkEl.style.borderColor = 'var(--accent-green)';
          checkEl.style.background = 'var(--accent-green)';
          checkEl.style.color = 'white';
          item.style.boxShadow = '0 0 0 3px var(--accent-green)';
        }
        
        // Update Combine button text
        btnCombineSelected.textContent = `Combine ${combineSelectedItems.length} Selected`;
        if (combineSelectedItems.length === 2) {
          btnCombineSelected.classList.remove('hidden');
        } else {
          btnCombineSelected.classList.add('hidden');
        }
      } else {
        openPreviewModal(imgUrl, sess, customerData, isEdited);
      }
    });
    galleryGrid.appendChild(item);
  }

  // --- Combine Mode Logic ---
  if (btnCombineMode) {
    btnCombineMode.addEventListener('click', () => {
      isCombineMode = !isCombineMode;
      btnCombineMode.classList.toggle('active', isCombineMode);
      combineSelectedItems = [];
      btnCombineSelected.classList.add('hidden');
      btnCombineSelected.textContent = 'Combine 0 Selected';
      
      // Toggle checkboxes visibility
      document.querySelectorAll('.combine-check').forEach(el => {
        if (isCombineMode) {
          el.classList.remove('hidden');
          el.style.borderColor = '#ccc';
          el.style.background = 'white';
          el.style.color = 'transparent';
        } else {
          el.classList.add('hidden');
        }
      });
      // Clear borders
      document.querySelectorAll('.gallery-item').forEach(el => el.style.boxShadow = 'none');
    });
  }

  if (btnCombineSelected) {
    btnCombineSelected.addEventListener('click', async () => {
      if (combineSelectedItems.length !== 2) return;
      
      const img1 = new Image();
      const img2 = new Image();
      img1.crossOrigin = 'anonymous';
      img2.crossOrigin = 'anonymous';
      
      await Promise.all([
        new Promise(r => { img1.onload = r; img1.src = combineSelectedItems[0]; }),
        new Promise(r => { img2.onload = r; img2.src = combineSelectedItems[1]; })
      ]);
      
      const gap = 40;
      const lineWidth = 4;
      
      const combineCanvas = document.createElement('canvas');
      combineCanvas.width = img1.width + gap + lineWidth + gap + img2.width;
      combineCanvas.height = Math.max(img1.height, img2.height);
      
      const combineCtx = combineCanvas.getContext('2d');
      // Fill white background
      combineCtx.fillStyle = '#ffffff';
      combineCtx.fillRect(0, 0, combineCanvas.width, combineCanvas.height);
      
      // Draw first image
      combineCtx.drawImage(img1, 0, 0);
      
      // Draw black line
      combineCtx.fillStyle = '#000000';
      combineCtx.fillRect(img1.width + gap, 0, lineWidth, combineCanvas.height);
      
      // Draw second image
      combineCtx.drawImage(img2, img1.width + gap + lineWidth + gap, 0);
      
      // Show modal
      const dataUrl = combineCanvas.toDataURL('image/jpeg', 0.95);
      combinePreviewModalImg.src = dataUrl;
      combinePreviewModal.style.display = 'flex';
      setTimeout(() => combinePreviewModal.style.opacity = '1', 10);
    });
  }

  if (btnCombinePreviewClose) {
    btnCombinePreviewClose.addEventListener('click', () => {
      combinePreviewModal.style.opacity = '0';
      setTimeout(() => combinePreviewModal.style.display = 'none', 200);
    });
  }

  if (btnCombinePreviewDownload) {
    btnCombinePreviewDownload.addEventListener('click', () => {
      const link = document.createElement('a');
      const tokenNo = activeCustomer ? activeCustomer.folder : 'Unknown';
      link.download = `combined_strip_Token${tokenNo}.jpg`;
      link.href = combinePreviewModalImg.src;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
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
    previewItems.push({ imgUrl, sess, customerData, isEdited: false });
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
    if (!previewItems.length) return;
    const currentIndex = currentPreviewIndex < 0 ? 0 : currentPreviewIndex;
    const nextIndex = (currentIndex + direction + previewItems.length) % previewItems.length;
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
    if (!previewModal || previewModal.style.display === 'none' || previewModal.style.display === '') return;
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
    editorCustomerName.textContent = `Token ${customerData.folder}`;
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
    
    // Reset Text Styles, Position & Rotation
    fontSize = 90;
    isBold = true;
    isItalic = false;
    isUnderline = false;
    textRotation = 0;
    isTextSelected = false;
    fontColor = '#000000';
    if (sliderFontSize) sliderFontSize.value = 90;
    if (valFontSize) valFontSize.textContent = '90px';
    if (btnTextBold) btnTextBold.classList.add('active');
    if (btnTextItalic) btnTextItalic.classList.remove('active');
    if (btnTextUnderline) btnTextUnderline.classList.remove('active');
    if (fontFamilySelect) fontFamilySelect.value = 'Courier Prime';
    if (mswordActiveColorBar) mswordActiveColorBar.style.backgroundColor = '#000000';
    if (mswordColorName) mswordColorName.textContent = 'Black';
    
    textX = COLLAGE_WIDTH / 2;
    textY = COLLAGE_HEIGHT - 120;
    
    // Reset Zoom and Pan
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    updateCanvasTransform();
    
    // Reset Custom Stickers
    customStickers = [];
    selectedSticker = null;
    updateStickerControlsUI();

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
  function drawCanvas(isExporting = false) {
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
    
    // LAYER 3: Preset Stickers
    if (stickersImage && stickersImage.width > 0 && selectedStickerPack !== 'none') {
      ctx.drawImage(stickersImage, 0, 0, canvas.width, canvas.height);
    }

    // LAYER 3.5: Custom Kawaii Placed Stickers
    customStickers.forEach(sticker => {
      if (!sticker.img || !sticker.img.complete) return;
      ctx.save();
      ctx.translate(sticker.x, sticker.y);
      ctx.rotate(sticker.rotation);
      if (sticker.flipX) {
        ctx.scale(-1, 1);
      }
      
      const hw = sticker.width / 2;
      const hh = sticker.height / 2;
      ctx.drawImage(sticker.img, -hw, -hh, sticker.width, sticker.height);
      ctx.restore();
    });

    // LAYER 3.6: Selection box & transformation handles (ONLY if !isExporting)
    if (!isExporting && selectedSticker && selectedSticker.img && selectedSticker.img.complete) {
      const s = selectedSticker;
      const hw = s.width / 2;
      const hh = s.height / 2;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);

      // Selection bounding box (cute vibrant pink dashed border)
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(-hw - 8, -hh - 8, s.width + 16, s.height + 16);
      ctx.setLineDash([]);

      // Top rotation handle stem
      ctx.beginPath();
      ctx.moveTo(0, -hh - 8);
      ctx.lineTo(0, -hh - 50);
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Top rotation grip button
      ctx.beginPath();
      ctx.arc(0, -hh - 50, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ff69b4';
      ctx.stroke();

      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff69b4';
      ctx.fillText('↻', 0, -hh - 50);

      // Top-right Delete handle (✕)
      ctx.beginPath();
      ctx.arc(hw + 24, -hh - 24, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('✕', hw + 24, -hh - 24);

      // Top-left Flip handle (⇄)
      ctx.beginPath();
      ctx.arc(-hw - 24, -hh - 24, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('⇄', -hw - 24, -hh - 24);

      // 4 Corner resize handles
      const corners = [
        [-hw - 8, -hh - 8], // TL
        [hw + 8, -hh - 8],  // TR
        [hw + 8, hh + 8],   // BR
        [-hw - 8, hh + 8]   // BL
      ];
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ff69b4';
        ctx.stroke();
      });

      ctx.restore();
    }
    
    // LAYER 4: Text overlay (MS Word-style interactive text)
    if (textOverlay) {
      const fontFamily = fontFamilySelect ? fontFamilySelect.value : 'Courier Prime';
      const activeColor = fontColor || '#000000';

      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(textRotation);

      const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px "${fontFamily}", sans-serif`;
      ctx.font = fontStyle;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(textOverlay);
      const tw = metrics.width;
      const th = fontSize;

      // Outline to ensure crisp readability on any photo/background
      ctx.strokeStyle = (activeColor.toLowerCase() === '#ffffff' || activeColor.toLowerCase() === '#fff') ? '#000000' : '#ffffff';
      ctx.lineWidth = Math.max(3, fontSize * 0.06);
      ctx.strokeText(textOverlay, 0, 0);

      ctx.fillStyle = activeColor;
      ctx.fillText(textOverlay, 0, 0);

      // Draw Underline
      if (isUnderline) {
        ctx.beginPath();
        const lineY = th * 0.48;
        ctx.moveTo(-tw / 2, lineY);
        ctx.lineTo(tw / 2, lineY);
        ctx.lineWidth = Math.max(3, fontSize * 0.08);
        ctx.strokeStyle = activeColor;
        ctx.stroke();
      }

      // LAYER 4.1: Direct MS Word-style selection box & handles (ONLY if !isExporting && isTextSelected)
      if (!isExporting && isTextSelected) {
        const hw = tw / 2 + 20;
        const hh = th * 0.6 + 15;

        // Bounding box (crisp modern blue dashed outline)
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 8]);
        ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
        ctx.setLineDash([]);

        // Top rotation handle stem
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(0, -hh - 48);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Top rotation grip button (↻)
        ctx.beginPath();
        ctx.arc(0, -hh - 48, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2563eb';
        ctx.stroke();

        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#2563eb';
        ctx.fillText('↻', 0, -hh - 48);

        // Top-right Delete handle (✕)
        ctx.beginPath();
        ctx.arc(hw + 24, -hh - 24, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('✕', hw + 24, -hh - 24);

        // 4 Corner resize handles
        const corners = [
          [-hw, -hh], // TL
          [hw, -hh],  // TR
          [hw, hh],   // BR
          [-hw, hh]   // BL
        ];
        corners.forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#2563eb';
          ctx.stroke();
        });
      }

      ctx.restore();
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
      if (textOverlay) isTextSelected = true;
      drawCanvas();
    });
  }

  if (overlayTextInput) {
    overlayTextInput.addEventListener('input', () => {
      textOverlay = overlayTextInput.value.trim();
      if (textOverlay) isTextSelected = true;
      drawCanvas();
    });
  }

  const btnClearText = document.getElementById('btn-clear-text');
  if (btnClearText) {
    btnClearText.addEventListener('click', () => {
      overlayTextInput.value = '';
      textOverlay = '';
      isTextSelected = false;
      drawCanvas();
    });
  }

  if (fontFamilySelect) {
    fontFamilySelect.addEventListener('change', async () => {
      try {
        const font = fontFamilySelect.value;
        await document.fonts.load(`90px "${font}"`);
      } catch (e) {}
      drawCanvas();
    });
  }

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

  // --- MS Word Font Color Picker Palette Generator ---
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
    // Col 0 (White)
    ['#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#7f7f7f'],
    // Col 1 (Black)
    ['#7f7f7f', '#595959', '#3f3f3f', '#262626', '#0d0d0d'],
    // Col 2 (Warm Gray)
    ['#ddd9c3', '#c4bd97', '#948a54', '#4a452a', '#1e1c11'],
    // Col 3 (Dark Blue)
    ['#c6d9f1', '#8eb4e3', '#558ed5', '#17375e', '#10243f'],
    // Col 4 (Blue)
    ['#dce6f2', '#b9cde5', '#95b3d7', '#376092', '#254061'],
    // Col 5 (Red)
    ['#f2dcdb', '#e6b9b8', '#d99694', '#963634', '#632523'],
    // Col 6 (Olive Green)
    ['#ebf1de', '#d7e4bd', '#c3d69b', '#77933c', '#4f6228'],
    // Col 7 (Purple)
    ['#e6e0ec', '#ccc1db', '#b3a2c7', '#604a7b', '#403152'],
    // Col 8 (Aqua)
    ['#dbeef4', '#b7dde8', '#93cddd', '#31859c', '#215968'],
    // Col 9 (Orange)
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

  function applyFontColor(hex, name) {
    fontColor = hex;
    if (mswordActiveColorBar) mswordActiveColorBar.style.backgroundColor = hex;
    if (mswordColorName) mswordColorName.textContent = name || hex;
    if (mswordPaletteDropdown) mswordPaletteDropdown.style.display = 'none';
    
    // Update active highlight on all swatches
    document.querySelectorAll('.msword-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color.toLowerCase() === hex.toLowerCase());
    });

    drawCanvas();
  }

  function initMSWordColorPicker() {
    if (!mswordThemeTopRow || !mswordThemeShadesGrid || !mswordStandardGrid) return;

    // 1. Top row of theme colors (10 swatches)
    mswordThemeTopRow.innerHTML = '';
    MSWORD_THEME_BASE.forEach(item => {
      const swatch = document.createElement('div');
      swatch.className = 'msword-swatch' + (item.hex === fontColor ? ' active' : '');
      swatch.style.backgroundColor = item.hex;
      swatch.title = item.name;
      swatch.dataset.color = item.hex;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        applyFontColor(item.hex, item.name);
      });
      mswordThemeTopRow.appendChild(swatch);
    });

    // 2. Shades grid: 5 rows of 10 columns
    mswordThemeShadesGrid.innerHTML = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 10; c++) {
        const hex = MSWORD_THEME_SHADES[c][r];
        const baseName = MSWORD_THEME_BASE[c].name;
        const swatch = document.createElement('div');
        swatch.className = 'msword-swatch' + (hex.toLowerCase() === fontColor.toLowerCase() ? ' active' : '');
        swatch.style.backgroundColor = hex;
        swatch.title = `${baseName} (shade ${r + 1})`;
        swatch.dataset.color = hex;
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          applyFontColor(hex, baseName);
        });
        mswordThemeShadesGrid.appendChild(swatch);
      }
    }

    // 3. Standard colors row (10 swatches)
    mswordStandardGrid.innerHTML = '';
    MSWORD_STANDARD_COLORS.forEach(item => {
      const swatch = document.createElement('div');
      swatch.className = 'msword-swatch' + (item.hex.toLowerCase() === fontColor.toLowerCase() ? ' active' : '');
      swatch.style.backgroundColor = item.hex;
      swatch.title = item.name;
      swatch.dataset.color = item.hex;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        applyFontColor(item.hex, item.name);
      });
      mswordStandardGrid.appendChild(swatch);
    });

    // 4. Toggle button click
    if (btnMSWordColorToggle && mswordPaletteDropdown) {
      btnMSWordColorToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = mswordPaletteDropdown.style.display === 'none';
        mswordPaletteDropdown.style.display = isHidden ? 'block' : 'none';
      });
    }

    // 5. Close dropdown if clicking outside
    document.addEventListener('click', (e) => {
      const container = document.getElementById('msword-color-picker-container');
      if (container && !container.contains(e.target) && mswordPaletteDropdown) {
        mswordPaletteDropdown.style.display = 'none';
      }
    });

    // 6. Custom color picker input
    if (mswordCustomColorInput) {
      mswordCustomColorInput.addEventListener('input', (e) => {
        applyFontColor(e.target.value, e.target.value.toUpperCase());
      });
    }
  }

  // --- Kawaii Stickers UI & Interaction Helpers ---
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function getStickerHandleAt(s, px, py) {
    const dx = px - s.x;
    const dy = py - s.y;
    const cos = Math.cos(-s.rotation);
    const sin = Math.sin(-s.rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    const hw = s.width / 2;
    const hh = s.height / 2;
    const handleHitRadius = 36; // Generous hit radius for smooth grabbing

    // 1. Top Rotation Handle (center is at 0, -hh - 50)
    if (Math.hypot(lx - 0, ly - (-hh - 50)) <= handleHitRadius) {
      return 'rotate';
    }

    // 2. Top-Right Delete Handle (center is at hw + 24, -hh - 24)
    if (Math.hypot(lx - (hw + 24), ly - (-hh - 24)) <= handleHitRadius) {
      return 'delete';
    }

    // 3. Top-Left Flip Handle (center is at -hw - 24, -hh - 24)
    if (Math.hypot(lx - (-hw - 24), ly - (-hh - 24)) <= handleHitRadius) {
      return 'flip';
    }

    // 4. Corner Resize Handles (TL, TR, BR, BL)
    if (Math.hypot(lx - (-hw - 8), ly - (-hh - 8)) <= handleHitRadius) {
      return 'resize-tl';
    }
    if (Math.hypot(lx - (hw + 8), ly - (-hh - 8)) <= handleHitRadius) {
      return 'resize-tr';
    }
    if (Math.hypot(lx - (hw + 8), ly - (hh + 8)) <= handleHitRadius) {
      return 'resize-br';
    }
    if (Math.hypot(lx - (-hw - 8), ly - (hh + 8)) <= handleHitRadius) {
      return 'resize-bl';
    }

    // 5. Sticker Body
    if (Math.abs(lx) <= hw + 8 && Math.abs(ly) <= hh + 8) {
      return 'body';
    }

    return null;
  }

  function isPointInsideSticker(s, px, py) {
    const dx = px - s.x;
    const dy = py - s.y;
    const cos = Math.cos(-s.rotation);
    const sin = Math.sin(-s.rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= s.width / 2 && Math.abs(ly) <= s.height / 2;
  }

  function getTextHandleAt(px, py) {
    if (!textOverlay || !isTextSelected) return null;

    const dx = px - textX;
    const dy = py - textY;
    const cos = Math.cos(-textRotation);
    const sin = Math.sin(-textRotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    ctx.save();
    const fontFamily = fontFamilySelect ? fontFamilySelect.value : 'Courier Prime';
    ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px "${fontFamily}", sans-serif`;
    const tw = ctx.measureText(textOverlay).width;
    const th = fontSize;
    ctx.restore();

    const hw = tw / 2 + 20;
    const hh = th * 0.6 + 15;
    const handleHitRadius = 36;

    // 1. Top Rotation handle (0, -hh - 48)
    if (Math.hypot(lx - 0, ly - (-hh - 48)) <= handleHitRadius) {
      return 'rotate';
    }

    // 2. Top-right Delete handle (hw + 24, -hh - 24)
    if (Math.hypot(lx - (hw + 24), ly - (-hh - 24)) <= handleHitRadius) {
      return 'delete';
    }

    // 3. 4 Corner Resize handles
    if (Math.hypot(lx - (-hw), ly - (-hh)) <= handleHitRadius) {
      return 'resize-tl';
    }
    if (Math.hypot(lx - hw, ly - (-hh)) <= handleHitRadius) {
      return 'resize-tr';
    }
    if (Math.hypot(lx - hw, ly - hh) <= handleHitRadius) {
      return 'resize-br';
    }
    if (Math.hypot(lx - (-hw), ly - hh) <= handleHitRadius) {
      return 'resize-bl';
    }

    // 4. Text Body
    if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
      return 'body';
    }

    return null;
  }

  function isPointInsideText(px, py) {
    if (!textOverlay) return false;
    const dx = px - textX;
    const dy = py - textY;
    const cos = Math.cos(-textRotation);
    const sin = Math.sin(-textRotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    ctx.save();
    const fontFamily = fontFamilySelect ? fontFamilySelect.value : 'Courier Prime';
    ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px "${fontFamily}", sans-serif`;
    const tw = ctx.measureText(textOverlay).width;
    const th = fontSize;
    ctx.restore();

    const hw = tw / 2 + 25;
    const hh = th * 0.6 + 20;
    return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
  }

  function updateCanvasCursor(pos) {
    if (activeDrag) {
      if (activeDrag.mode === 'sticker-move' || activeDrag.mode === 'text-move') {
        canvas.style.cursor = 'grabbing';
      } else if (activeDrag.mode === 'sticker-rotate' || activeDrag.mode === 'text-rotate') {
        canvas.style.cursor = 'crosshair';
      } else if (activeDrag.mode === 'sticker-resize' || activeDrag.mode === 'text-resize') {
        canvas.style.cursor = 'nwse-resize';
      }
      return;
    }

    // Text handle cursors if text is selected
    if (isTextSelected && textOverlay) {
      const handle = getTextHandleAt(pos.x, pos.y);
      if (handle === 'rotate') {
        canvas.style.cursor = 'grab';
        return;
      }
      if (handle === 'delete') {
        canvas.style.cursor = 'pointer';
        return;
      }
      if (handle === 'resize-tl' || handle === 'resize-br') {
        canvas.style.cursor = 'nwse-resize';
        return;
      }
      if (handle === 'resize-tr' || handle === 'resize-bl') {
        canvas.style.cursor = 'nesw-resize';
        return;
      }
      if (handle === 'body') {
        canvas.style.cursor = 'grab';
        return;
      }
    }

    if (selectedSticker) {
      const handle = getStickerHandleAt(selectedSticker, pos.x, pos.y);
      if (handle === 'rotate') {
        canvas.style.cursor = 'grab';
        return;
      }
      if (handle === 'delete' || handle === 'flip') {
        canvas.style.cursor = 'pointer';
        return;
      }
      if (handle === 'resize-tl' || handle === 'resize-br') {
        canvas.style.cursor = 'nwse-resize';
        return;
      }
      if (handle === 'resize-tr' || handle === 'resize-bl') {
        canvas.style.cursor = 'nesw-resize';
        return;
      }
      if (handle === 'body') {
        canvas.style.cursor = 'grab';
        return;
      }
    }

    for (let i = customStickers.length - 1; i >= 0; i--) {
      if (isPointInsideSticker(customStickers[i], pos.x, pos.y)) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    if (isPointInsideText(pos.x, pos.y)) {
      canvas.style.cursor = 'move';
      return;
    }

    canvas.style.cursor = 'default';
  }

  async function initKawaiiStickersTray() {
    const tray = document.getElementById('custom-stickers-tray');
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
      console.warn('Using default sticker catalog:', err);
    }

    tray.innerHTML = '';
    stickersList.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sticker-item-btn';
      btn.title = `Click or drag ${item.name} to add to photostrip`;
      btn.draggable = true;
      btn.innerHTML = `
        <img src="/static/stickers/kawaii/${item.file}" alt="${item.name}" draggable="false">
        <span>${item.name}</span>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        addCustomSticker(item);
      });

      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
      });

      tray.appendChild(btn);
    });
  }

  function addCustomSticker(item, targetX, targetY) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const baseW = 280;
      const baseH = Math.round(baseW / aspectRatio);
      
      let spawnX = targetX;
      let spawnY = targetY;
      if (spawnX === undefined || spawnY === undefined) {
        const offset = (customStickers.length % 5) * 50;
        spawnX = Math.round(COLLAGE_WIDTH / 2 + (customStickers.length % 2 === 0 ? offset : -offset));
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
      
      customStickers.push(newSticker);
      selectedSticker = newSticker;
      updateStickerControlsUI();
      drawCanvas();
    };
    img.src = item.url || `/static/stickers/kawaii/${item.file}`;
  }

  function updateStickerControlsUI() {
    const controls = document.getElementById('selected-sticker-controls');
    const countBadge = document.getElementById('active-stickers-count');
    const btnClearAll = document.getElementById('btn-clear-all-stickers');
    const nameLabel = document.getElementById('selected-sticker-name');
    
    if (countBadge) {
      if (customStickers.length > 0) {
        countBadge.textContent = customStickers.length;
        countBadge.style.display = 'inline-block';
        if (btnClearAll) btnClearAll.style.display = 'inline-block';
      } else {
        countBadge.style.display = 'none';
        if (btnClearAll) btnClearAll.style.display = 'none';
      }
    }
    
    if (controls) {
      if (selectedSticker) {
        controls.style.display = 'flex';
        if (nameLabel) nameLabel.textContent = selectedSticker.name || 'Sticker';
      } else {
        controls.style.display = 'none';
      }
    }
  }

  function deleteSelectedSticker() {
    if (!selectedSticker) return;
    customStickers = customStickers.filter(s => s.id !== selectedSticker.id);
    selectedSticker = null;
    updateStickerControlsUI();
    drawCanvas();
  }

  function clearAllStickers() {
    if (!customStickers.length) return;
    if (confirm('Remove all custom stickers from this collage?')) {
      customStickers = [];
      selectedSticker = null;
      updateStickerControlsUI();
      drawCanvas();
    }
  }

  const btnDeleteSelectedSticker = document.getElementById('btn-delete-selected-sticker');
  if (btnDeleteSelectedSticker) btnDeleteSelectedSticker.addEventListener('click', deleteSelectedSticker);

  const btnClearAllStickers = document.getElementById('btn-clear-all-stickers');
  if (btnClearAllStickers) btnClearAllStickers.addEventListener('click', clearAllStickers);

  const btnRotateLeft = document.getElementById('btn-rotate-left');
  if (btnRotateLeft) {
    btnRotateLeft.addEventListener('click', () => {
      if (!selectedSticker) return;
      selectedSticker.rotation -= (15 * Math.PI / 180);
      drawCanvas();
    });
  }

  const btnRotateRight = document.getElementById('btn-rotate-right');
  if (btnRotateRight) {
    btnRotateRight.addEventListener('click', () => {
      if (!selectedSticker) return;
      selectedSticker.rotation += (15 * Math.PI / 180);
      drawCanvas();
    });
  }

  const btnScaleDown = document.getElementById('btn-scale-down');
  if (btnScaleDown) {
    btnScaleDown.addEventListener('click', () => {
      if (!selectedSticker) return;
      const newW = Math.max(60, selectedSticker.width * 0.85);
      selectedSticker.width = Math.round(newW);
      selectedSticker.height = Math.round(newW / selectedSticker.aspectRatio);
      drawCanvas();
    });
  }

  const btnScaleUp = document.getElementById('btn-scale-up');
  if (btnScaleUp) {
    btnScaleUp.addEventListener('click', () => {
      if (!selectedSticker) return;
      const newW = Math.min(COLLAGE_WIDTH * 0.95, selectedSticker.width * 1.15);
      selectedSticker.width = Math.round(newW);
      selectedSticker.height = Math.round(newW / selectedSticker.aspectRatio);
      drawCanvas();
    });
  }

  const btnFlipSticker = document.getElementById('btn-flip-sticker');
  if (btnFlipSticker) {
    btnFlipSticker.addEventListener('click', () => {
      if (!selectedSticker) return;
      selectedSticker.flipX = !selectedSticker.flipX;
      drawCanvas();
    });
  }

  const btnFrontSticker = document.getElementById('btn-front-sticker');
  if (btnFrontSticker) {
    btnFrontSticker.addEventListener('click', () => {
      if (!selectedSticker) return;
      customStickers = customStickers.filter(s => s.id !== selectedSticker.id);
      customStickers.push(selectedSticker);
      drawCanvas();
    });
  }

  // --- MS Word-style Canvas Pointer / Mouse Handlers ---
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // Only primary mouse button
    const pos = getCanvasPos(e);
    hasInteractedWithCanvas = true;

    // 0. Check selected text handle / body
    if (isTextSelected && textOverlay) {
      const textHandle = getTextHandleAt(pos.x, pos.y);
      if (textHandle === 'delete') {
        textOverlay = '';
        overlayTextInput.value = '';
        isTextSelected = false;
        drawCanvas();
        return;
      }
      if (textHandle === 'rotate') {
        selectedSticker = null;
        updateStickerControlsUI();
        activeDrag = {
          mode: 'text-rotate',
          startPos: pos,
          startRotation: textRotation
        };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        updateCanvasCursor(pos);
        return;
      }
      if (textHandle && textHandle.startsWith('resize-')) {
        selectedSticker = null;
        updateStickerControlsUI();
        const initialDist = Math.hypot(pos.x - textX, pos.y - textY);
        activeDrag = {
          mode: 'text-resize',
          corner: textHandle.replace('resize-', ''),
          startPos: pos,
          startFontSize: fontSize,
          startDist: Math.max(10, initialDist)
        };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        updateCanvasCursor(pos);
        return;
      }
      if (textHandle === 'body') {
        selectedSticker = null;
        updateStickerControlsUI();
        activeDrag = {
          mode: 'text-move',
          startPos: pos,
          startTextX: textX,
          startTextY: textY
        };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        updateCanvasCursor(pos);
        return;
      }
    }

    // 1. Check selected sticker handle / body
    if (selectedSticker) {
      isTextSelected = false;
      const handle = getStickerHandleAt(selectedSticker, pos.x, pos.y);
      if (handle === 'delete') {
        deleteSelectedSticker();
        return;
      }
      if (handle === 'flip') {
        selectedSticker.flipX = !selectedSticker.flipX;
        drawCanvas();
        return;
      }
      if (handle === 'rotate') {
        activeDrag = {
          mode: 'sticker-rotate',
          sticker: selectedSticker,
          startPos: pos,
          startRotation: selectedSticker.rotation
        };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        updateCanvasCursor(pos);
        return;
      }
      if (handle && handle.startsWith('resize-')) {
        const initialDist = Math.hypot(pos.x - selectedSticker.x, pos.y - selectedSticker.y);
        activeDrag = {
          mode: 'sticker-resize',
          sticker: selectedSticker,
          corner: handle.replace('resize-', ''),
          startPos: pos,
          startWidth: selectedSticker.width,
          startHeight: selectedSticker.height,
          startDist: Math.max(10, initialDist)
        };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        updateCanvasCursor(pos);
        return;
      }
      if (handle === 'body') {
        activeDrag = {
          mode: 'sticker-move',
          sticker: selectedSticker,
          startPos: pos,
          startStickerX: selectedSticker.x,
          startStickerY: selectedSticker.y
        };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        updateCanvasCursor(pos);
        return;
      }
    }

    // 2. Check if clicking on another sticker (topmost first)
    for (let i = customStickers.length - 1; i >= 0; i--) {
      const s = customStickers[i];
      if (isPointInsideSticker(s, pos.x, pos.y)) {
        isTextSelected = false;
        selectedSticker = s;
        updateStickerControlsUI();
        drawCanvas();
        activeDrag = {
          mode: 'sticker-move',
          sticker: selectedSticker,
          startPos: pos,
          startStickerX: selectedSticker.x,
          startStickerY: selectedSticker.y
        };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        updateCanvasCursor(pos);
        return;
      }
    }

    // 3. Check text overlay
    if (isPointInsideText(pos.x, pos.y)) {
      selectedSticker = null;
      updateStickerControlsUI();
      isTextSelected = true;
      drawCanvas();
      activeDrag = {
        mode: 'text-move',
        startPos: pos,
        startTextX: textX,
        startTextY: textY
      };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      updateCanvasCursor(pos);
      return;
    }

    // 4. Clicked empty canvas space: deselect sticker & text
    let needsRedraw = false;
    if (selectedSticker) {
      selectedSticker = null;
      updateStickerControlsUI();
      needsRedraw = true;
    }
    if (isTextSelected) {
      isTextSelected = false;
      needsRedraw = true;
    }
    if (needsRedraw) {
      drawCanvas();
      updateCanvasCursor(pos);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const pos = getCanvasPos(e);

    if (activeDrag) {
      hasInteractedWithCanvas = true;

      if (activeDrag.mode === 'sticker-move') {
        const dx = pos.x - activeDrag.startPos.x;
        const dy = pos.y - activeDrag.startPos.y;
        activeDrag.sticker.x = Math.round(activeDrag.startStickerX + dx);
        activeDrag.sticker.y = Math.round(activeDrag.startStickerY + dy);
        canvas.style.cursor = 'grabbing';
        drawCanvas();
        return;
      }

      if (activeDrag.mode === 'sticker-rotate') {
        const s = activeDrag.sticker;
        const currentAngle = Math.atan2(pos.y - s.y, pos.x - s.x);
        let angle = currentAngle + Math.PI / 2;
        if (e.shiftKey) {
          const snap = 15 * (Math.PI / 180);
          angle = Math.round(angle / snap) * snap;
        }
        s.rotation = angle;
        canvas.style.cursor = 'crosshair';
        drawCanvas();
        return;
      }

      if (activeDrag.mode === 'sticker-resize') {
        const s = activeDrag.sticker;
        const currentDist = Math.hypot(pos.x - s.x, pos.y - s.y);
        const ratio = currentDist / activeDrag.startDist;
        const targetW = Math.max(60, Math.min(COLLAGE_WIDTH * 1.5, Math.round(activeDrag.startWidth * ratio)));
        s.width = targetW;
        s.height = Math.round(targetW / s.aspectRatio);
        canvas.style.cursor = 'nwse-resize';
        drawCanvas();
        return;
      }

      if (activeDrag.mode === 'text-move') {
        const dx = pos.x - activeDrag.startPos.x;
        const dy = pos.y - activeDrag.startPos.y;
        textX = Math.round(activeDrag.startTextX + dx);
        textY = Math.round(activeDrag.startTextY + dy);
        canvas.style.cursor = 'grabbing';
        drawCanvas();
        return;
      }

      if (activeDrag.mode === 'text-rotate') {
        const currentAngle = Math.atan2(pos.y - textY, pos.x - textX);
        let angle = currentAngle + Math.PI / 2;
        if (e.shiftKey) {
          const snap = 15 * (Math.PI / 180);
          angle = Math.round(angle / snap) * snap;
        }
        textRotation = angle;
        canvas.style.cursor = 'crosshair';
        drawCanvas();
        return;
      }

      if (activeDrag.mode === 'text-resize') {
        const currentDist = Math.hypot(pos.x - textX, pos.y - textY);
        const ratio = currentDist / activeDrag.startDist;
        const targetSize = Math.max(24, Math.min(220, Math.round(activeDrag.startFontSize * ratio)));
        fontSize = targetSize;
        if (sliderFontSize) sliderFontSize.value = targetSize;
        if (valFontSize) valFontSize.textContent = targetSize + 'px';
        canvas.style.cursor = 'nwse-resize';
        drawCanvas();
        return;
      }
    }

    updateCanvasCursor(pos);
  });

  function handlePointerEnd(e) {
    if (activeDrag) {
      activeDrag = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
      const pos = getCanvasPos(e);
      updateCanvasCursor(pos);
      drawCanvas();
    }
  }

  canvas.addEventListener('pointerup', handlePointerEnd);
  canvas.addEventListener('pointercancel', handlePointerEnd);

  // --- Drag and Drop from Tray directly to Canvas ---
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    hasInteractedWithCanvas = true;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const item = JSON.parse(raw);
      const pos = getCanvasPos(e);
      addCustomSticker(item, pos.x, pos.y);
    } catch (err) {
      console.error('Failed to drop sticker:', err);
    }
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
    canvasContainer.addEventListener('click', (e) => {
      if (hasInteractedWithCanvas) {
        hasInteractedWithCanvas = false;
        return;
      }
      if (e.target === canvas) return;
      if (!originalImage.src || !originalImage.width) return;
      drawCanvas(true);
      lightboxImg.src = canvas.toDataURL('image/jpeg', 0.95);
      drawCanvas(false);
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
        drawCanvas(true); // Draw clean without selection boxes or handles
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        drawCanvas(false); // Restore selection handles
        
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
      drawCanvas(true); // Draw clean without selection handles
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      drawCanvas(false); // Restore selection handles
      link.click();
    });
  }

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // If text is selected and user is not typing in a text field
    if (isTextSelected && textOverlay && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        textOverlay = '';
        overlayTextInput.value = '';
        isTextSelected = false;
        drawCanvas();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        textX -= (e.shiftKey ? 20 : 5);
        drawCanvas();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        textX += (e.shiftKey ? 20 : 5);
        drawCanvas();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        textY -= (e.shiftKey ? 20 : 5);
        drawCanvas();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        textY += (e.shiftKey ? 20 : 5);
        drawCanvas();
        return;
      }
    }

    // If a sticker is selected and user is not typing in a text field
    if (selectedSticker && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedSticker();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectedSticker.x -= (e.shiftKey ? 20 : 5);
        drawCanvas();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectedSticker.x += (e.shiftKey ? 20 : 5);
        drawCanvas();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSticker.y -= (e.shiftKey ? 20 : 5);
        drawCanvas();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSticker.y += (e.shiftKey ? 20 : 5);
        drawCanvas();
        return;
      }
    }

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
      
      // 2. If text is selected, deselect it
      if (isTextSelected) {
        isTextSelected = false;
        drawCanvas();
        return;
      }

      // 3. If a sticker is selected, deselect it
      if (selectedSticker) {
        selectedSticker = null;
        updateStickerControlsUI();
        drawCanvas();
        return;
      }

      // 4. If in Editor View, go back to Gallery
      if (viewEditor.classList.contains('active-view')) {
        if (btnBackToGallery) btnBackToGallery.click();
        return;
      }
      
      // 5. If in Gallery View, go back to Customers
      if (viewGallery.classList.contains('active-view')) {
        if (btnBackToCustomers) btnBackToCustomers.click();
        return;
      }
    }
  });

  // Initialize MS Word Color Picker, Kawaii Stickers Tray & Fetch Initial Data
  initMSWordColorPicker();
  initKawaiiStickersTray();
  fetchSessions();
});
document.addEventListener('contextmenu', event => event.preventDefault());
