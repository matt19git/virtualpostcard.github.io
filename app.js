// app.js - Streamlined & Unified Postcard Logic for Ashlyn & Matt

(function() {
  
  // --- App State ---
  const state = {
    brushColor: '#800f2f',       // default Crimson
    isDrawing: false,
    strokes: [],                 // [{ color, points: [[x, y], ...] }] (relative 0-1000 coordinates)
    
    stamps: [],                  // [{ id, x, y, scale, rotation, el }] (relative 0-100% of card)
    selectedStamp: null,
    selectedEnvStamp: 'stamp-heart', // default postage stamp for envelope top right
    
    isRecipientView: false,      // true if loading a postcard from URL
    isOpening: false             // lock flag during open animation
  };

  const STAMP_SVGS = {};         // SVG elements lookup table for canvas exports

  // Core Stamps Tray configuration
  const STAMPS_LIST = [
    { id: 'stamp-heart', label: 'Heart' },
    { id: 'stamp-pigeon', label: 'Pigeon' },
    { id: 'stamp-flower', label: 'Flower' },
    { id: 'stamp-postmark', label: 'Postmark' }
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
  let envelopeContainer, envelopeEl, waxSealEl, envelopeStampSpot;
  let viewEditor, viewReviewDesk, viewRecipient, recipientHelpText;
  let shareModal, toastNotification;
  
  // Spots for previews
  let cardReviewSpot, envelopeReviewSpot;

  // --- Initializer ---
  document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    setupEventListeners();
    setupCanvas();
    populateToolbar();
    populateEnvStampPicker();
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

  function setupEventListeners() {
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
    postcardCard.addEventListener('mousedown', (e) => {
      if (e.target === canvas || e.target === postcardCard || e.target === stampsOverlay) {
        deselectAllStamps();
      }
    });
    postcardCard.addEventListener('touchstart', (e) => {
      if (e.target === canvas || e.target === postcardCard || e.target === stampsOverlay) {
        deselectAllStamps();
      }
    });

    // Sync input address values with envelope front preview
    const inputTo = document.getElementById('input-to');
    const inputFrom = document.getElementById('input-from');
    
    inputTo.addEventListener('input', () => {
      document.getElementById('display-to').textContent = `To: ${inputTo.value.trim() || 'Ashlyn'}`;
    });
    inputFrom.addEventListener('input', () => {
      document.getElementById('display-from').textContent = `From: ${inputFrom.value.trim() || 'Matt'}`;
    });

    // Window resize to fit canvas
    window.addEventListener('resize', resizeCanvas);
  }

  // --- Populate Colors and Stamps UI ---
  function populateToolbar() {
    // Colors
    const paletteContainer = document.getElementById('colors-palette');
    paletteContainer.innerHTML = '';
    BRUSH_COLORS.forEach((color, idx) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (idx === 0 ? ' active' : '');
      dot.style.backgroundColor = color;
      dot.dataset.color = color;
      
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        state.brushColor = color;
      });
      
      paletteContainer.appendChild(dot);
    });

    // Stamps for Doodle Card
    stampsTray.innerHTML = '';
    STAMPS_LIST.forEach(stamp => {
      const stampThumb = document.createElement('div');
      stampThumb.className = 'stamp-thumb';
      stampThumb.dataset.id = stamp.id;
      stampThumb.title = stamp.label;
      
      const svgTemplate = document.getElementById(stamp.id);
      if (svgTemplate) {
        stampThumb.innerHTML = svgTemplate.outerHTML;
        STAMP_SVGS[stamp.id] = svgTemplate.outerHTML;
      }
      
      stampThumb.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.isRecipientView) {
          placeStampOnCard(stamp.id);
        }
      });
      stampsTray.appendChild(stampThumb);
    });
  }

  // Populate Envelope Postage Stamp Selector on Address Desk
  function populateEnvStampPicker() {
    if (!envStampPicker) return;
    envStampPicker.innerHTML = '';
    
    STAMPS_LIST.forEach(stamp => {
      const opt = document.createElement('div');
      opt.className = 'env-stamp-opt' + (stamp.id === state.selectedEnvStamp ? ' active' : '');
      opt.dataset.id = stamp.id;
      opt.title = `Envelope Stamp: ${stamp.label}`;
      
      const svgTemplate = document.getElementById(stamp.id);
      if (svgTemplate) {
        opt.innerHTML = svgTemplate.outerHTML;
      }

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
    const template = document.getElementById(stampId);
    if (template && envelopeStampSpot) {
      envelopeStampSpot.innerHTML = template.outerHTML;
    }
  }

  // --- Drawing Canvas Handler ---
  function setupCanvas() {
    canvas.addEventListener('mousedown', startPaint);
    canvas.addEventListener('mousemove', paint);
    canvas.addEventListener('mouseup', stopPaint);
    canvas.addEventListener('mouseleave', stopPaint);

    // Touch events mapping
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      const m = new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY });
      canvas.dispatchEvent(m);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      const m = new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY });
      canvas.dispatchEvent(m);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
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
    if (state.isRecipientView) return;
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
    if (!state.isDrawing || state.isRecipientView) return;
    
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

  // --- SVG Stamp Manager (Draggable on Card) ---
  function placeStampOnCard(stampId) {
    const template = document.getElementById(stampId);
    if (!template) return;
    
    const stampEl = document.createElement('div');
    stampEl.className = 'placed-stamp';
    stampEl.dataset.id = stampId;
    stampEl.innerHTML = `
      ${template.outerHTML}
      <div class="stamp-btn stamp-del-btn"><i class="fas fa-times"></i></div>
      <div class="stamp-btn stamp-rot-btn"><i class="fas fa-sync-alt"></i></div>
    `;

    const x = 40 + Math.random() * 10;
    const y = 30 + Math.random() * 10;

    const stampObj = {
      id: stampId,
      x: x,
      y: y,
      scale: 1.0,
      rotation: 0,
      el: stampEl
    };

    state.stamps.push(stampObj);
    stampsOverlay.appendChild(stampEl);
    
    selectStamp(stampObj);
    updateStampCSS(stampObj);
    bindStampHandlers(stampObj);
  }

  function bindStampHandlers(stampObj) {
    const el = stampObj.el;
    
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag, { passive: false });

    el.querySelector('.stamp-del-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      el.remove();
      state.stamps = state.stamps.filter(s => s !== stampObj);
      if (state.selectedStamp === stampObj) state.selectedStamp = null;
    });

    el.querySelector('.stamp-rot-btn').addEventListener('mousedown', startRotateScale);
    el.querySelector('.stamp-rot-btn').addEventListener('touchstart', startRotateScale, { passive: false });

    function startDrag(e) {
      e.stopPropagation();
      selectStamp(stampObj);
      
      const clientX = e.clientX || e.touches[0].clientX;
      const clientY = e.clientY || e.touches[0].clientY;
      const cardRect = postcardCard.getBoundingClientRect();
      
      const startXPct = stampObj.x;
      const startYPct = stampObj.y;
      const originX = clientX;
      const originY = clientY;

      el.classList.add('dragging');

      function onDrag(mEv) {
        const cx = mEv.clientX || (mEv.touches && mEv.touches[0].clientX);
        const cy = mEv.clientY || (mEv.touches && mEv.touches[0].clientY);
        
        const dx = cx - originX;
        const dy = cy - originY;

        stampObj.x = startXPct + (dx / cardRect.width) * 100;
        stampObj.y = startYPct + (dy / cardRect.height) * 100;

        stampObj.x = Math.max(0, Math.min(100, stampObj.x));
        stampObj.y = Math.max(0, Math.min(100, stampObj.y));

        updateStampCSS(stampObj);
      }

      function endDrag() {
        el.classList.remove('dragging');
        window.removeEventListener('mousemove', onDrag);
        window.removeEventListener('mouseup', onDrag);
        window.removeEventListener('touchmove', onDrag);
        window.removeEventListener('touchend', endDrag);
      }

      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchmove', onDrag, { passive: false });
      window.addEventListener('touchend', endDrag);
    }

    function startRotateScale(e) {
      e.stopPropagation();
      e.preventDefault();
      
      const elRect = el.getBoundingClientRect();
      const center = {
        x: elRect.left + elRect.width / 2,
        y: elRect.top + elRect.height / 2
      };

      const startRot = stampObj.rotation;
      const startScale = stampObj.scale;
      
      const clientX = e.clientX || e.touches[0].clientX;
      const clientY = e.clientY || e.touches[0].clientY;
      
      const startDist = Math.hypot(clientX - center.x, clientY - center.y);
      const startAngle = Math.atan2(clientY - center.y, clientX - center.x);

      function onRotateScale(mEv) {
        const cx = mEv.clientX || (mEv.touches && mEv.touches[0].clientX);
        const cy = mEv.clientY || (mEv.touches && mEv.touches[0].clientY);
        
        const curDist = Math.hypot(cx - center.x, cy - center.y);
        const curAngle = Math.atan2(cy - center.y, cx - center.x);

        stampObj.scale = startScale * (curDist / startDist);
        stampObj.scale = Math.max(0.5, Math.min(2.5, stampObj.scale));

        const angleDiff = (curAngle - startAngle) * (180 / Math.PI);
        stampObj.rotation = (startRot + angleDiff) % 360;

        updateStampCSS(stampObj);
      }

      function endRotateScale() {
        window.removeEventListener('mousemove', onRotateScale);
        window.removeEventListener('mouseup', endRotateScale);
        window.removeEventListener('touchmove', onRotateScale);
        window.removeEventListener('touchend', endRotateScale);
      }

      window.addEventListener('mousemove', onRotateScale);
      window.addEventListener('mouseup', endRotateScale);
      window.addEventListener('touchmove', onRotateScale, { passive: false });
      window.addEventListener('touchend', endRotateScale);
    }
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
    postcardCard.classList.add('in-review');

    envelopeReviewSpot.appendChild(envelopeContainer);
    envelopeContainer.className = 'envelope-container in-review';
    envelopeContainer.style.display = 'block';
    
    // Front address defaults: Ashlyn & Matt
    const toName = document.getElementById('input-to').value.trim() || 'Ashlyn';
    const fromName = document.getElementById('input-from').value.trim() || 'Matt';
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
    postcardCard.classList.remove('in-review');
    
    envelopeContainer.className = 'envelope-container';
    envelopeContainer.style.display = 'none';
    document.body.appendChild(envelopeContainer);

    viewReviewDesk.classList.remove('active');
    viewEditor.classList.add('active');
    
    resizeCanvas();
  }

  // --- MAILING ANIMATION FLOW (NO FLIPPING) ---
  function triggerMailingAnimation() {
    document.querySelector('.review-form').style.display = 'none';
    
    document.getElementById('view-review-desk').appendChild(postcardCard);
    document.getElementById('view-review-desk').appendChild(envelopeContainer);
    
    postcardCard.classList.remove('in-review');
    envelopeContainer.classList.remove('in-review');
    
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
            waxSealEl.style.transform = 'scale(1)';

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
      to: document.getElementById('input-to').value.trim() || 'Ashlyn',
      fr: document.getElementById('input-from').value.trim() || 'Matt',
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

    const to = data.to || 'Ashlyn';
    const from = data.fr || 'Matt';
    document.getElementById('input-to').value = to;
    document.getElementById('input-from').value = from;

    // Load card stamps
    stampsOverlay.innerHTML = '';
    state.stamps = [];
    if (data.st) {
      data.st.forEach(sData => {
        const template = document.getElementById(sData.id);
        if (template) {
          const stampEl = document.createElement('div');
          stampEl.className = 'placed-stamp';
          stampEl.innerHTML = template.outerHTML;
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

    recipientHelpText.textContent = "You received a letter! Click the envelope to open. 💌";

    document.getElementById('view-home').classList.remove('active');
    document.getElementById('view-editor').classList.remove('active');
    viewRecipient.classList.add('active');
    
    resizeCanvas();
  }

  // --- Crack Seal and slide out letter (NO FLIP) ---
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
      .then(() => showToast("Copied link! 💌"))
      .catch(() => showToast("Failed to copy link."));
  }

  function emailShareLink() {
    const link = document.getElementById('share-link-input').value;
    const to = document.getElementById('input-to').value.trim() || 'Ashlyn';
    const subject = encodeURIComponent("A virtual letter for you! 💌");
    const body = encodeURIComponent(`Hi ${to},\n\nI wrote and drew a virtual letter for you. Open it here:\n\n${link}\n\nWith love.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  // --- Download Card Image PNG ---
  function downloadPostcardImage() {
    const exportCanvas = document.createElement('canvas');
    const width = 1200;
    const height = 1500;
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

    // Dotted card line separator (split top/bottom)
    eCtx.strokeStyle = 'rgba(226, 149, 120, 0.4)';
    eCtx.lineWidth = 4;
    eCtx.setLineDash([12, 12]);
    eCtx.beginPath();
    eCtx.moveTo(0, height * 0.42);
    eCtx.lineTo(width, height * 0.42);
    eCtx.stroke();
    eCtx.setLineDash([]);

    // Faint canvas hint on top
    eCtx.fillStyle = '#a09080';
    eCtx.font = "bold 22px 'Outfit', sans-serif";
    eCtx.fillText("DOODLE BOARD", 40, 50);

    // 2. Draw Text message in bottom half
    const text = letterTextarea.value;
    eCtx.fillStyle = '#2b2d42';
    eCtx.font = "italic 44px 'Caveat', cursive";
    
    const lines = text.split('\n');
    let yPos = (height * 0.42) + 70;
    const lineHeight = 65;
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

    // 3. Draw Canvas Doodles
    state.strokes.forEach(stroke => {
      if (stroke.points.length === 0) return;
      eCtx.beginPath();
      eCtx.strokeStyle = stroke.color;
      eCtx.lineWidth = 6;
      eCtx.lineCap = 'round';
      eCtx.lineJoin = 'round';

      const p0 = stroke.points[0];
      const getX = (px) => (px / 1000) * width;
      const getY = (py) => (py / 1000) * (height * 0.42);

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

    // 4. Render Draggable Stamps
    const stampPromises = state.stamps.map(stamp => {
      return new Promise((resolve) => {
        const svgContent = STAMP_SVGS[stamp.id];
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
        showToast("Downloaded postcard! 💾");
      } catch (err) {
        console.error("Export error:", err);
        showToast("Failed to download postcard.");
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
