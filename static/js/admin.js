document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const sessionsListContainer = document.getElementById('sessions-list-container');
  const searchInput = document.getElementById('session-search');
  
  const workspaceControlsPanel = document.getElementById('workspace-controls-panel');
  const canvasContainer = document.getElementById('canvas-container');
  const noSessionSelected = document.getElementById('no-session-selected');
  
  const activeSessionName = document.getElementById('active-session-name');
  const activeSessionTime = document.getElementById('active-session-time');
  
  const canvas = document.getElementById('collageCanvas');
  const ctx = canvas.getContext('2d');
  
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

  // Application State
  let sessions = [];
  let selectedSession = null;
  let originalImage = new Image();
  let currentFilter = 'normal';
  let textOverlay = '';
  let selectedFrameColor = '#ffffff';
  let selectedStickerPack = 'none';

  // 1. Fetch Sessions List on Load
  async function fetchSessions() {
    try {
      const response = await fetch('/api/admin/sessions');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      sessions = data.sessions;
      renderSessions(sessions);
    } catch (err) {
      console.error(err);
      sessionsListContainer.innerHTML = `<div class="empty-state"><p style="color: #ef4444;">Error: ${err.message}</p></div>`;
    }
  }

  // 2. Render Sessions List
  function renderSessions(list) {
    if (list.length === 0) {
      sessionsListContainer.innerHTML = `
        <div class="empty-state">
          <p>No customer folders found.</p>
        </div>`;
      return;
    }
    
    sessionsListContainer.innerHTML = '';
    list.forEach(sess => {
      const item = document.createElement('div');
      item.className = 'session-item';
      if (selectedSession && selectedSession.folder === sess.folder) {
        item.classList.add('selected');
      }
      
      item.innerHTML = `
        <div class="session-name">${sess.customer_name}</div>
        <div class="session-date">${sess.time}</div>
      `;
      
      item.addEventListener('click', () => selectSession(sess));
      sessionsListContainer.appendChild(item);
    });
  }

  // 3. Search Filter
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    const filtered = sessions.filter(sess => 
      sess.customer_name.toLowerCase().includes(query) || 
      sess.folder.toLowerCase().includes(query)
    );
    renderSessions(filtered);
  });

  // 4. Select Session
  function selectSession(session) {
    selectedSession = session;
    
    // Highlight active sidebar item
    const items = document.querySelectorAll('.session-item');
    items.forEach(el => el.classList.remove('selected'));
    fetchSessions(); // refresh background but keep visual highlight
    
    // Set UI labels
    activeSessionName.textContent = session.customer_name;
    activeSessionTime.textContent = session.time;
    
    // Show panels
    noSessionSelected.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
    workspaceControlsPanel.classList.remove('hidden');
    
    // Reset control fields
    currentFilter = 'normal';
    filterBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === 'normal') btn.classList.add('active');
    });
    overlayTextInput.value = '';
    textOverlay = '';
    
    // Reset UI
    selectedFrameColor = '#ffffff';
    selectedStickerPack = 'none';
    colorDots.forEach(d => d.classList.toggle('active', d.dataset.color === '#ffffff'));
    packBtns.forEach(b => b.classList.toggle('active', b.dataset.pack === 'none'));
    
    // Load Image
    const imgUrl = session.collage_edited_url || session.collage_url;
    
    if (!imgUrl) {
      // Fallback: If no collage, show standard captures or text
      alert("No collage image found for this session!");
      return;
    }

    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    originalImage = new Image();
    originalImage.crossOrigin = 'anonymous'; // prevent tainted canvas
    originalImage.onload = () => {
      // Set canvas dimensions
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      
      // Draw image
      drawCanvas();
    };
    originalImage.src = imgUrl + '?t=' + new Date().getTime();
  }

  // 5. Draw Canvas with current filter and text overlay
  function drawCanvas() {
    if (!originalImage.src) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply filter
    let filterString = 'none';
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
    
    ctx.filter = filterString;
    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none'; // reset filter so text overlay doesn't get filtered
    
    // Draw text overlay if applicable
    if (textOverlay) {
      const fontFamily = fontFamilySelect.value;
      const fontColor = fontColorSelect.value;
      
      // Set font settings
      ctx.font = `600 32px "${fontFamily}"`;
      ctx.fillStyle = fontColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Compute Y position (centered in the bottom footer region, which is 80px tall)
      const footerY = canvas.height - 40;
      
      // Draw a subtle border outline for high contrast readability
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeText(textOverlay, canvas.width / 2, footerY);
      
      ctx.fillText(textOverlay, canvas.width / 2, footerY);
    }
  }

  // 6. Filter button clicks
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      drawCanvas();
    });
  });

  // 7. Apply Text Overlay
  btnApplyText.addEventListener('click', () => {
    textOverlay = overlayTextInput.value.trim();
    drawCanvas();
  });

  // Trigger draw canvas on font/color change immediately
  fontFamilySelect.addEventListener('change', drawCanvas);
  fontColorSelect.addEventListener('change', drawCanvas);

  // Frame Background & Stickers
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
          sticker_pack: selectedStickerPack
        })
      });
      const result = await response.json();
      if (result.preview_data) {
        originalImage.src = result.preview_data;
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

  // 8. Save Edited Collage to Server
  btnSaveEdit.addEventListener('click', async () => {
    if (!selectedSession) return;
    
    btnSaveEdit.disabled = true;
    btnSaveEdit.textContent = 'Saving...';
    
    try {
      // Step 1: Update the base collage via edit_existing if there's frame/sticker changes
      if (selectedFrameColor !== '#ffffff' || selectedStickerPack !== 'none') {
          await fetch('/api/session/edit_existing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  session_dir: selectedSession.folder,
                  session_timestamp: selectedSession.timestamp,
                  frame_color: selectedFrameColor,
                  sticker_pack: selectedStickerPack
              })
          });
      }

      // Step 2: Save the canvas layer (with text & filters) as the edited collage
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
      
      // Update session references
      selectedSession.collage_edited_url = result.collage_edited_url;
      
      btnSaveEdit.textContent = 'Saved! ✨';
      fetchSessions();
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

  // 9. Print Photostrip
  btnPrint.addEventListener('click', () => {
    window.print();
  });

  // 10. Download Collage
  btnDownload.addEventListener('click', () => {
    if (!selectedSession) return;
    
    const link = document.createElement('a');
    link.download = `photostrip_${selectedSession.folder}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  });

  // Initial Fetch
  fetchSessions();
});
