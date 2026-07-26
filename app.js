// app.js - Streamlined & Ultra-Smooth Postcard Logic with 100% Transparent Stickers

(function() {
  
  // --- App State ---
  const state = {
    activeMode: 'type',          // 'type' (edit text like normal) or 'draw' (pen doodle)
    brushColor: '#800f2f',       // default Crimson
    isDrawing: false,
    strokes: [],                 // [{ color, points: [[x, y], ...] }] (relative 0-1000 coordinates)
    
    stamps: [],                  // [{ id, x, y, scale, rotation, el }] (relative 0-100% of card)
    selectedStamp: null,
    selectedEnvStamp: 'stamp-heart', // default postage stamp for envelope top right
    
    isRecipientView: false,      // true if loading a postcard from URL
    isOpening: false             // lock flag during open animation
  };

  const SVG_CACHE = {};          // SVG markup lookup table

  // Transparent Cute Vector Stickers for the Letter Card
  const STICKERS_LIST = [
    { id: 'sticker-heart', label: 'Glossy Heart Sticker' },
    { id: 'sticker-sparkles', label: 'Gold Sparkles Sticker' },
    { id: 'sticker-flower', label: 'Pink Blossom Sticker' },
    { id: 'sticker-coffee', label: 'Cute Coffee Mug Sticker' }
  ];

  // Real Vintage Postage Stamps for Envelope
  const ENV_STAMPS_LIST = [
    { id: 'stamp-heart', label: 'Victorian Heart Stamp', src: 'assets/stamps/stamp_heart.png' },
    { id: 'stamp-bird', label: 'Air Mail Pigeon Stamp', src: 'assets/stamps/stamp_bird.png' },
    { id: 'stamp-rose', label: 'Botanical Rose Stamp', src: 'assets/stamps/stamp_rose.png' }
  ];

  // Colors available for pen
  const BRUSH_COLORS = [
    '#800f2f', // Crimson
    '#e27396', // Rose Pink
    '#2d6a4f', // Sage Dark Green
    '#a8dadc', // Sky Blue
    '#2b2d42'  // Charcoal Ink
  ];

  // --- DOM Elements ---
  let canvas, ctx;
  let postcardCard, letterTextarea;
  let stampsOverlay, stampsTray, envStampPicker;
  let btnModeType, btnModeDraw;
  let envelopeContainer, envelopeEl, waxSealEl, envelopeStampSpot;
  let viewEditor, viewReviewDesk, viewRecipient, recipientHelpText;
  let shareModal, toastNotification;
  
  // Spots for previews
  let cardReviewSpot, envelopeReviewSpot;

  // --- Initializer ---
  document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    cacheSVGs();
    setupEventListeners();
    setupCanvas();
    populateToolbar();
    populateEnvStampPicker();
    setMode('type'); // Default to typing mode so cursor works like normal text
    checkUrlHash();
  });

  function initDOMElements() {
    canvas = document.getElementById('drawing-canvas');
    ctx = canvas.getContext('2d');
    postcardCard = document.getElementById('postcard-card');
    letterTextarea = document.getElementById('letter-textarea');
    stampsOverlay = document.getElementById('stamps-overlay');
    stampsTray = document.getElementById('stamps-picker');
    envStampPicker = document.getElementById('env-stamp-picker');

    btnModeType = document.getElementById('btn-mode-text');
    btnModeDraw = document.getElementById('btn-mode-draw');
    
    envelopeContainer = document.getElementById('envelope-container');
    envelopeEl = document.getElementById('envelope');
    waxSealEl = document.getElementById('wax-seal-element');
    envelopeStampSpot = document.getElementById('envelope-stamp-spot');
    
    viewEditor = document.getElementById('view-editor');
    viewReviewDesk = document.getElementById('view-review-desk');
    viewRecipient = document.getElementById('view-recipient');
    recipientHelpText = document.getElementById('recipient-help-text');
    
    cardReviewSpot = document.getElementById('card-review-spot');
    envelopeReviewSpot = document.getElementById('envelope-review-spot');
    
    shareModal = document.getElementById('share-modal');
    toastNotification = document.getElementById('toast-notification');
  }

  function cacheSVGs() {
    STICKERS_LIST.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) SVG_CACHE[s.id] = el.outerHTML;
    });
  }

  function setupEventListeners() {
    // Mode Buttons
    btnModeType.addEventListener('click', () => setMode('type'));
    btnModeDraw.addEventListener('click', () => setMode('draw'));

    // Start Writing / Create Postcard Button
    const btnWrite = document.getElementById('btn-write-letter');
    if (btnWrite) {
      btnWrite.addEventListener('click', () => {
        document.getElementById('view-home').classList.remove('active');
        viewEditor.classList.add('active');
        resizeCanvas();
      });
    }

    // Toolbar Buttons
    document.getElementById('btn-clear-canvas').addEventListener('click', clearCanvas);
    
    // Transition to Review Desk
    document.getElementById('btn-seal-send').addEventListener('click', transitionToReview);
    
    // Back to Editor from Review
    document.getElementById('btn-back-to-editor').addEventListener('click', backToEditor);
    
    // Final Confirm send
    document.getElementById('btn-confirm-send').addEventListener('click', triggerMailingAnimation);

    // Share modal close and redirect to fresh creation
    document.getElementById('btn-close-share').addEventListener('click', () => {
      shareModal.close();
      window.location.hash = '';
      location.reload();
    });

    document.getElementById('btn-copy-link').addEventListener('click', copyShareLink);
    document.getElementById('btn-email-link').addEventListener('click', emailShareLink);
    document.getElementById('btn-download-postcard').addEventListener('click', downloadPostcardImage);

    // Recipient View: Click ANYWHERE on envelope container to open letter!
    envelopeContainer.addEventListener('click', () => {
      if (state.isRecipientView) {
        crackSealAndReveal();
      }
    });

    // De-select stamps when clicking blank card areas
    postcardCard.addEventListener('pointerdown', (e) => {
      if (e.target === canvas || e.target === postcardCard || e.target === stampsOverlay) {
        deselectAllStamps();
      }
    });

    // Sync input address values with envelope front preview
    const inputTo = document.getElementById('input-to');
    const inputFrom = document.getElementById('input-from');
    
    inputTo.addEventListener('input', () => {
      document.getElementById('display-to').textContent = `To: ${inputTo.value.trim() || 'Name Here'}`;
    });
    inputFrom.addEventListener('input', () => {
      document.getElementById('display-from').textContent = `From: ${inputFrom.value.trim() || 'Name Here'}`;
    });

    // Window resize to fit canvas
    window.addEventListener('resize', resizeCanvas);
  }

  // --- Mode Manager (Type vs Draw) ---
  function setMode(mode) {
    state.activeMode = mode;

    if (mode === 'type') {
      btnModeType.classList.add('active');
      btnModeDraw.classList.remove('active');
      canvas.classList.remove('drawing-active');
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    } else {
      btnModeDraw.classList.add('active');
      btnModeType.classList.remove('active');
      canvas.classList.add('drawing-active');
      
      // Highlight active color dot
      document.querySelectorAll('.color-dot').forEach(d => {
        if (d.dataset.color === state.brushColor) {
          d.classList.add('active');
        } else {
          d.classList.remove('active');
        }
      });
    }
  }

  // --- Populate Colors and Transparent Stickers UI ---
  function populateToolbar() {
    // Colors
    const paletteContainer = document.getElementById('colors-palette');
    paletteContainer.innerHTML = '';
    BRUSH_COLORS.forEach((color) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot';
      dot.style.backgroundColor = color;
      dot.dataset.color = color;
      
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.activeMode === 'draw' && state.brushColor === color) {
          setMode('type');
        } else {
          state.brushColor = color;
          setMode('draw');
        }
      });
      
      paletteContainer.appendChild(dot);
    });

    // Transparent Stickers Tray for Card
    stampsTray.innerHTML = '';
    STICKERS_LIST.forEach(sticker => {
      const stampThumb = document.createElement('div');
      stampThumb.className = 'stamp-thumb';
      stampThumb.dataset.id = sticker.id;
      stampThumb.title = sticker.label;
      
      if (SVG_CACHE[sticker.id]) {
        stampThumb.innerHTML = SVG_CACHE[sticker.id];
      }
      
      stampThumb.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.isRecipientView) {
          placeStampOnCard(sticker.id);
        }
      });
      stampsTray.appendChild(stampThumb);
    });
  }

  // Populate Envelope Postage Stamp Selector on Address Desk
  function populateEnvStampPicker() {
    if (!envStampPicker) return;
    envStampPicker.innerHTML = '';
    
    ENV_STAMPS_LIST.forEach(stamp => {
      const opt = document.createElement('div');
      opt.className = 'env-stamp-opt' + (stamp.id === state.selectedEnvStamp ? ' active' : '');
      opt.dataset.id = stamp.id;
      opt.title = `Envelope Stamp: ${stamp.label}`;
      opt.innerHTML = `<img src="${stamp.src}" alt="${stamp.label}">`;

      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.env-stamp-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        state.selectedEnvStamp = stamp.id;
        updateEnvelopeStampDisplay(stamp.id);
      });

      envStampPicker.appendChild(opt);
    });

    updateEnvelopeStampDisplay(state.selectedEnvStamp);
  }

  function updateEnvelopeStampDisplay(stampId) {
    const stampData = ENV_STAMPS_LIST.find(s => s.id === stampId) || ENV_STAMPS_LIST[0];
    if (envelopeStampSpot) {
      envelopeStampSpot.innerHTML = `<img src="${stampData.src}" alt="${stampData.label}">`;
    }
  }

  // --- Full Sheet Drawing & Typing Handler ---
  function setupCanvas() {
    canvas.addEventListener('mousedown', startPaint);
    canvas.addEventListener('mousemove', paint);
    canvas.addEventListener('mouseup', stopPaint);
    canvas.addEventListener('mouseleave', stopPaint);

    // Touch events mapping
    canvas.addEventListener('touchstart', (e) => {
      if (state.activeMode !== 'draw') return;
      const t = e.touches[0];
      const m = new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY });
      canvas.dispatchEvent(m);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (state.activeMode !== 'draw') return;
      const t = e.touches[0];
      const m = new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY });
      canvas.dispatchEvent(m);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      if (state.activeMode !== 'draw') return;
      canvas.dispatchEvent(new MouseEvent('mouseup', {}));
    });
  }

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redrawStrokes();
  }

  function startPaint(e) {
    if (state.isRecipientView || state.activeMode !== 'draw') return;
    state.isDrawing = true;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * 1000);
    const y = Math.round((e.clientY - rect.top) / rect.height * 1000);
    
    state.strokes.push({
      color: state.brushColor,
      points: [[x, y]]
    });

    ctx.beginPath();
    ctx.strokeStyle = state.brushColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const cx = (x / 1000) * canvas.width;
    const cy = (y / 1000) * canvas.height;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }

  function paint(e) {
    if (!state.isDrawing || state.isRecipientView || state.activeMode !== 'draw') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * 1000);
    const y = Math.round((e.clientY - rect.top) / rect.height * 1000);
    
    const current = state.strokes[state.strokes.length - 1];
    const last = current.points[current.points.length - 1];
    
    if (Math.hypot(x - last[0], y - last[1]) < 3) return;
    
    current.points.push([x, y]);
    redrawStrokes();
  }

  function stopPaint() {
    if (state.isDrawing) {
      state.isDrawing = false;
      simplifyLastStroke();
      redrawStrokes();
    }
  }

  function simplifyLastStroke() {
    if (state.strokes.length === 0) return;
    const stroke = state.strokes[state.strokes.length - 1];
    if (stroke.points.length <= 2) return;
    
    const simplified = [stroke.points[0]];
    let last = stroke.points[0];
    
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const pt = stroke.points[i];
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) > 10) {
        simplified.push(pt);
        last = pt;
      }
    }
    simplified.push(stroke.points[stroke.points.length - 1]);
    stroke.points = simplified;
  }

  function redrawStrokes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.strokes.forEach(stroke => {
      if (stroke.points.length === 0) return;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const first = stroke.points[0];
      ctx.moveTo((first[0] / 1000) * canvas.width, (first[1] / 1000) * canvas.height);
      
      if (stroke.points.length === 1) {
        ctx.lineTo((first[0] / 1000) * canvas.width, (first[1] / 1000) * canvas.height);
      } else {
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const pt = stroke.points[i];
          const next = stroke.points[i + 1];
          const xc = ((pt[0] + next[0]) / 2 / 1000) * canvas.width;
          const yc = ((pt[1] + next[1]) / 2 / 1000) * canvas.height;
          ctx.quadraticCurveTo((pt[0] / 1000) * canvas.width, (pt[1] / 1000) * canvas.height, xc, yc);
        }
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo((last[0] / 1000) * canvas.width, (last[1] / 1000) * canvas.height);
      }
      ctx.stroke();
    });
  }

  function clearCanvas() {
    if (confirm("Clear your doodle?")) {
      state.strokes = [];
      redrawStrokes();
    }
  }

  // --- Ultra-Smooth Sticker Manager with Pointer Events ---
  function placeStampOnCard(stickerId) {
    const svgContent = SVG_CACHE[stickerId];
    if (!svgContent) return;
    
    const stampEl = document.createElement('div');
    stampEl.className = 'placed-stamp';
    stampEl.dataset.id = stickerId;
    stampEl.innerHTML = `
      ${svgContent}
      <div class="stamp-btn stamp-del-btn"><i class="fas fa-times"></i></div>
      <div class="stamp-btn stamp-rot-btn"><i class="fas fa-sync-alt"></i></div>
    `;

    // Center place with slight random tilt
    const x = 42 + Math.random() * 8;
    const y = 32 + Math.random() * 8;
    const initialRot = Math.round((Math.random() - 0.5) * 12);

    const stampObj = {
      id: stickerId,
      x: x,
      y: y,
      scale: 1.0,
      rotation: initialRot,
      el: stampEl
    };

    state.stamps.push(stampObj);
    stampsOverlay.appendChild(stampEl);
    
    selectStamp(stampObj);
    updateStampCSS(stampObj);
    bindStampPointerHandlers(stampObj);
  }

  function bindStampPointerHandlers(stampObj) {
    const el = stampObj.el;
    
    // Smooth Pointer events dragging (Handles Mouse, Touch, Stylus seamlessly)
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.stamp-btn')) return;
      e.stopPropagation();
      selectStamp(stampObj);

      const cardRect = postcardCard.getBoundingClientRect();
      const startXPct = stampObj.x;
      const startYPct = stampObj.y;
      const originX = e.clientX;
      const originY = e.clientY;

      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);

      function onPointerMove(pEv) {
        const dx = pEv.clientX - originX;
        const dy = pEv.clientY - originY;

        stampObj.x = startXPct + (dx / cardRect.width) * 100;
        stampObj.y = startYPct + (dy / cardRect.height) * 100;

        stampObj.x = Math.max(2, Math.min(98, stampObj.x));
        stampObj.y = Math.max(2, Math.min(98, stampObj.y));

        updateStampCSS(stampObj);
      }

      function onPointerUp(pEv) {
        el.classList.remove('dragging');
        try { el.releasePointerCapture(pEv.pointerId); } catch(err){}
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerUp);
      }

      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
    });

    // Delete Button
    el.querySelector('.stamp-del-btn').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      el.remove();
      state.stamps = state.stamps.filter(s => s !== stampObj);
      if (state.selectedStamp === stampObj) state.selectedStamp = null;
    });

    // Rotate and Scale Handle
    el.querySelector('.stamp-rot-btn').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const handleEl = e.target.closest('.stamp-rot-btn');
      handleEl.setPointerCapture(e.pointerId);

      const elRect = el.getBoundingClientRect();
      const center = {
        x: elRect.left + elRect.width / 2,
        y: elRect.top + elRect.height / 2
      };

      const startRot = stampObj.rotation;
      const startScale = stampObj.scale;
      const startDist = Math.hypot(e.clientX - center.x, e.clientY - center.y);
      const startAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x);

      function onRotateMove(pEv) {
        const curDist = Math.hypot(pEv.clientX - center.x, pEv.clientY - center.y);
        const curAngle = Math.atan2(pEv.clientY - center.y, pEv.clientX - center.x);

        stampObj.scale = startScale * (curDist / startDist);
        stampObj.scale = Math.max(0.4, Math.min(2.8, stampObj.scale));

        const angleDiff = (curAngle - startAngle) * (180 / Math.PI);
        stampObj.rotation = (startRot + angleDiff) % 360;

        updateStampCSS(stampObj);
      }

      function onRotateUp(pEv) {
        try { handleEl.releasePointerCapture(pEv.pointerId); } catch(err){}
        handleEl.removeEventListener('pointermove', onRotateMove);
        handleEl.removeEventListener('pointerup', onRotateUp);
        handleEl.removeEventListener('pointercancel', onRotateUp);
      }

      handleEl.addEventListener('pointermove', onRotateMove);
      handleEl.addEventListener('pointerup', onRotateUp);
      handleEl.addEventListener('pointercancel', onRotateUp);
    });
  }

  function selectStamp(stampObj) {
    if (state.isRecipientView) return;
    deselectAllStamps();
    state.selectedStamp = stampObj;
    stampObj.el.classList.add('selected');
  }

  function deselectAllStamps() {
    state.stamps.forEach(s => s.el.classList.remove('selected'));
    state.selectedStamp = null;
  }

  function updateStampCSS(stampObj) {
    stampObj.el.style.left = `${stampObj.x}%`;
    stampObj.el.style.top = `${stampObj.y}%`;
    stampObj.el.style.transform = `translate(-50%, -50%) rotate(${stampObj.rotation}deg) scale(${stampObj.scale})`;
  }

  // --- TRANSITION TO REVIEW DESK ---
  function transitionToReview() {
    deselectAllStamps();

    cardReviewSpot.appendChild(postcardCard);
    postcardCard.className = 'postcard-card in-review';

    envelopeReviewSpot.appendChild(envelopeContainer);
    envelopeContainer.className = 'envelope-container in-review';
    envelopeContainer.style.display = 'block';
    
    const toName = document.getElementById('input-to').value.trim() || 'Name Here';
    const fromName = document.getElementById('input-from').value.trim() || 'Name Here';
    document.getElementById('display-to').textContent = `To: ${toName}`;
    document.getElementById('display-from').textContent = `From: ${fromName}`;
    
    updateEnvelopeStampDisplay(state.selectedEnvStamp);
    
    waxSealEl.classList.remove('broken');
    waxSealEl.style.display = 'flex';

    viewEditor.classList.remove('active');
    viewReviewDesk.classList.add('active');
  }

  function backToEditor() {
    document.getElementById('view-editor').insertBefore(postcardCard, document.querySelector('.postcard-toolbar'));
    postcardCard.className = 'postcard-card';
    
    envelopeContainer.className = 'envelope-container';
    envelopeContainer.style.display = 'none';
    document.body.appendChild(envelopeContainer);

    viewReviewDesk.classList.remove('active');
    viewEditor.classList.add('active');
    
    resizeCanvas();
  }

  // --- MAILING ANIMATION FLOW ---
  function triggerMailingAnimation() {
    document.querySelector('.review-form').style.display = 'none';
    
    document.getElementById('view-review-desk').appendChild(postcardCard);
    document.getElementById('view-review-desk').appendChild(envelopeContainer);
    
    postcardCard.className = 'postcard-card';
    envelopeContainer.className = 'envelope-container';
    
    postcardCard.style.position = 'absolute';
    postcardCard.style.transform = 'scale(1) translateY(0)';
    
    envelopeContainer.style.position = 'absolute';
    envelopeContainer.style.transform = 'scale(1) translateY(0)';

    setTimeout(() => {
      // 1. Card slides down behind envelope
      postcardCard.style.transition = 'all 0.9s ease-in-out';
      postcardCard.style.transform = 'translateY(200px) scale(0.48)';
      postcardCard.style.opacity = '0';

      setTimeout(() => {
        postcardCard.style.display = 'none';

        // 2. Top flap folds down
        const topFlap = envelopeEl.querySelector('.flap.top');
        topFlap.style.transform = 'rotateX(0deg)';
        topFlap.style.zIndex = '3';

        setTimeout(() => {
          // 3. Wax seal stamps down in center
          waxSealEl.style.opacity = '0';
          waxSealEl.style.transform = 'scale(2.2) translate(-50%, -50%)';
          waxSealEl.style.display = 'flex';
          
          setTimeout(() => {
            waxSealEl.style.transition = 'all 0.3s var(--bounce-easing)';
            waxSealEl.style.opacity = '1';
            waxSealEl.style.transform = 'scale(1) translateX(-50%)';

            // 4. Envelope flies off screen
            setTimeout(() => {
              envelopeContainer.style.transition = 'all 1.1s var(--spring-easing)';
              envelopeContainer.style.transform = 'translateY(-1000px) scale(0.4)';
              envelopeContainer.style.opacity = '0';
              
              setTimeout(openShareDialog, 1000);
            }, 1200);

          }, 100);
        }, 600);
      }, 700);
    }, 200);
  }

  function openShareDialog() {
    const magicLink = generateMagicLink();
    document.getElementById('share-link-input').value = magicLink;
    shareModal.showModal();
  }

  // --- Link Serialization ---
  function generateMagicLink() {
    const letterObj = {
      t: letterTextarea.value,
      to: document.getElementById('input-to').value.trim() || 'Name Here',
      fr: document.getElementById('input-from').value.trim() || 'Name Here',
      es: state.selectedEnvStamp, // envelope postage stamp ID
      st: state.stamps.map(s => ({
        id: s.id,
        x: Math.round(s.x),
        y: Math.round(s.y),
        s: parseFloat(s.scale.toFixed(2)),
        r: Math.round(s.rotation)
      })),
      dr: state.strokes.map(s => ({
        c: s.color,
        p: compressPoints(s.points)
      }))
    };

    const json = JSON.stringify(letterObj);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return `${window.location.origin}${window.location.pathname}#letter=${compressed}`;
  }

  function compressPoints(points) {
    if (points.length === 0) return [];
    const first = points[0];
    const deltas = [first[0], first[1]];
    for (let i = 1; i < points.length; i++) {
      deltas.push(points[i][0] - points[i-1][0]);
      deltas.push(points[i][1] - points[i-1][1]);
    }
    return deltas;
  }

  function decompressPoints(deltas) {
    if (deltas.length < 2) return [];
    const points = [[deltas[0], deltas[1]]];
    let x = deltas[0];
    let y = deltas[1];
    for (let i = 2; i < deltas.length; i += 2) {
      x += deltas[i];
      y += deltas[i+1];
      points.push([x, y]);
    }
    return points;
  }

  // --- De-serialize Recipient Letter ---
  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#letter=')) {
      state.isRecipientView = true;
      const dataStr = hash.substring(8);
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(dataStr);
        if (!decompressed) throw new Error("Decompression failed");
        
        const letterData = JSON.parse(decompressed);
        loadReceivedLetter(letterData);
      } catch (err) {
        console.error("Url read error:", err);
        showToast("Postcard link is broken 💔");
      }
    }
  }

  function loadReceivedLetter(data) {
    letterTextarea.value = data.t || '';
    letterTextarea.readOnly = true;

    const to = data.to || 'Name Here';
    const from = data.fr || 'Name Here';
    document.getElementById('input-to').value = to;
    document.getElementById('input-from').value = from;

    // Load card stickers
    stampsOverlay.innerHTML = '';
    state.stamps = [];
    if (data.st) {
      data.st.forEach(sData => {
        const svgContent = SVG_CACHE[sData.id];
        if (svgContent) {
          const stampEl = document.createElement('div');
          stampEl.className = 'placed-stamp';
          stampEl.innerHTML = svgContent;
          stampEl.style.left = `${sData.x}%`;
          stampEl.style.top = `${sData.y}%`;
          stampEl.style.transform = `translate(-50%, -50%) rotate(${sData.r}deg) scale(${sData.s})`;
          stampsOverlay.appendChild(stampEl);
        }
      });
    }

    // Load drawings
    state.strokes = [];
    if (data.dr) {
      state.strokes = data.dr.map(s => ({
        color: s.c,
        points: decompressPoints(s.p)
      }));
    }

    document.querySelector('.postcard-toolbar').style.display = 'none';
    
    postcardCard.style.display = 'none';
    postcardCard.style.transform = 'translateY(150px) scale(0.6)';
    postcardCard.style.opacity = '0';

    // Populate recipient envelope details
    document.getElementById('display-to').textContent = `To: ${to}`;
    document.getElementById('display-from').textContent = `From: ${from}`;
    
    // Load chosen envelope postage stamp
    const envStampId = data.es || 'stamp-heart';
    updateEnvelopeStampDisplay(envStampId);

    viewRecipient.insertBefore(envelopeContainer, document.getElementById('recipient-action-panel'));

    waxSealEl.className = 'wax-seal';
    waxSealEl.classList.remove('broken');
    waxSealEl.removeAttribute('style');
    waxSealEl.style.display = 'flex';
    
    const topFlap = envelopeEl.querySelector('.flap.top');
    topFlap.removeAttribute('style');
    envelopeEl.classList.remove('open');

    envelopeContainer.removeAttribute('style');
    envelopeContainer.style.display = 'block';

    recipientHelpText.textContent = "You received a letter! Click the envelope to open. 📬";

    document.getElementById('view-home').classList.remove('active');
    document.getElementById('view-editor').classList.remove('active');
    viewRecipient.classList.add('active');
    
    resizeCanvas();
  }

  // --- Crack Seal and slide out letter ---
  function crackSealAndReveal() {
    if (!state.isRecipientView || state.isOpening) return;
    state.isOpening = true;
    
    waxSealEl.classList.add('broken');
    recipientHelpText.style.display = 'none';

    setTimeout(() => {
      waxSealEl.style.display = 'none';
      
      envelopeEl.classList.add('open');
      const topFlap = envelopeEl.querySelector('.flap.top');
      topFlap.style.transform = 'rotateX(180deg)';
      topFlap.style.zIndex = '0';

      setTimeout(() => {
        viewRecipient.insertBefore(postcardCard, document.getElementById('recipient-action-panel'));
        postcardCard.style.display = 'flex';
        postcardCard.style.position = 'relative';
        postcardCard.style.transform = 'translateY(120px) scale(0.7)';
        postcardCard.style.opacity = '0';
        resizeCanvas();

        setTimeout(() => {
          postcardCard.style.transition = 'all 1.0s var(--spring-easing)';
          postcardCard.style.transform = 'translateY(0) scale(1)';
          postcardCard.style.opacity = '1';
          postcardCard.style.zIndex = '20';

          envelopeContainer.style.transition = 'all 0.8s ease';
          envelopeContainer.style.transform = 'scale(0.8) translateY(100px)';
          envelopeContainer.style.opacity = '0';
          
          setTimeout(() => {
            envelopeContainer.style.display = 'none';
            document.getElementById('recipient-action-panel').style.display = 'flex';
          }, 800);

        }, 50);
      }, 500);
    }, 400);
  }

  // --- Action Dialog Comms ---
  function copyShareLink() {
    const input = document.getElementById('share-link-input');
    input.select();
    input.setSelectionRange(0, 9999);
    navigator.clipboard.writeText(input.value)
      .then(() => showToast("Copied link! 📬"))
      .catch(() => showToast("Failed to copy link."));
  }

  function emailShareLink() {
    const link = document.getElementById('share-link-input').value;
    const to = document.getElementById('input-to').value.trim() || 'Name Here';
    const subject = encodeURIComponent("A virtual letter for you! 📬");
    const body = encodeURIComponent(`Hi ${to},\n\nI wrote and drew a virtual letter for you. Open it here:\n\n${link}\n\nBest regards.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  // --- Download Card Image PNG ---
  function downloadPostcardImage() {
    const exportCanvas = document.createElement('canvas');
    const width = 1200;
    const height = 1400;
    exportCanvas.width = width;
    exportCanvas.height = height;
    const eCtx = exportCanvas.getContext('2d');

    // 1. Draw Paper cream background
    eCtx.fillStyle = '#faf6ee';
    eCtx.fillRect(0, 0, width, height);

    // Border line
    eCtx.strokeStyle = 'rgba(0,0,0,0.1)';
    eCtx.lineWidth = 4;
    eCtx.strokeRect(0, 0, width, height);

    // 2. Draw Text message across paper
    const text = letterTextarea.value;
    eCtx.fillStyle = '#2b2d42';
    eCtx.font = "italic 44px 'Caveat', cursive";
    
    const lines = text.split('\n');
    let yPos = 80;
    const lineHeight = 60;
    const maxWidth = width - 120;

    lines.forEach(line => {
      const words = line.split(' ');
      let curLine = '';
      words.forEach(word => {
        const test = curLine + word + ' ';
        if (eCtx.measureText(test).width > maxWidth) {
          eCtx.fillText(curLine, 60, yPos);
          curLine = word + ' ';
          yPos += lineHeight;
        } else {
          curLine = test;
        }
      });
      eCtx.fillText(curLine, 60, yPos);
      yPos += lineHeight;
    });

    // 3. Draw Canvas Doodles across full sheet
    state.strokes.forEach(stroke => {
      if (stroke.points.length === 0) return;
      eCtx.beginPath();
      eCtx.strokeStyle = stroke.color;
      eCtx.lineWidth = 6;
      eCtx.lineCap = 'round';
      eCtx.lineJoin = 'round';

      const p0 = stroke.points[0];
      const getX = (px) => (px / 1000) * width;
      const getY = (py) => (py / 1000) * height;

      eCtx.moveTo(getX(p0[0]), getY(p0[1]));
      
      if (stroke.points.length === 1) {
        eCtx.lineTo(getX(p0[0]), getY(p0[1]));
      } else {
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const pt = stroke.points[i];
          const next = stroke.points[i + 1];
          const xc = (getX(pt[0]) + getX(next[0])) / 2;
          const yc = (getY(pt[1]) + getY(next[1])) / 2;
          eCtx.quadraticCurveTo(getX(pt[0]), getY(pt[1]), xc, yc);
        }
        const last = stroke.points[stroke.points.length - 1];
        eCtx.lineTo(getX(last[0]), getY(last[1]));
      }
      eCtx.stroke();
    });

    // 4. Render Draggable Transparent Vector Stickers
    const stampPromises = state.stamps.map(stamp => {
      return new Promise((resolve) => {
        const svgContent = SVG_CACHE[stamp.id];
        if (!svgContent) return resolve();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        svgEl.setAttribute('width', '100');
        svgEl.setAttribute('height', '100');
        
        const serialized = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        img.onload = () => {
          eCtx.save();
          const stampX = (stamp.x / 100) * width;
          const stampY = (stamp.y / 100) * height;
          eCtx.translate(stampX, stampY);
          eCtx.rotate((stamp.rotation * Math.PI) / 180);
          
          const drawSize = 140 * stamp.scale;
          eCtx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          eCtx.restore();
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
    });

    Promise.all(stampPromises).then(() => {
      try {
        const dataUrl = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'postcard.png';
        link.href = dataUrl;
        link.click();
        showToast("Downloaded letter! 💾");
      } catch (err) {
        console.error("Export error:", err);
        showToast("Failed to download letter.");
      }
    });
  }

  // --- Helpers ---
  function showToast(msg) {
    toastNotification.textContent = msg;
    toastNotification.classList.add('active');
    setTimeout(() => {
      toastNotification.classList.remove('active');
    }, 2800);
  }

})();
