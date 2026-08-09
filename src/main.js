import Lenis from '@studio-freight/lenis';

/* ==========================================================================
   AUREN LUXURY COLD BREW — MAIN JAVASCRIPT ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const TOTAL_FRAMES = 240;
  const frameImages = [];
  let loadedFramesCount = 0;

  // DOM Elements
  const preloader = document.getElementById('preloader');
  const loaderPercent = document.getElementById('loader-percent');
  const loaderBarFill = document.getElementById('loader-bar-fill');
  const navbar = document.getElementById('navbar');

  const heroContainer = document.getElementById('hero-scroll-container');
  const heroSticky = document.getElementById('hero-sticky');
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');

  const phase1 = document.getElementById('phase-1');
  const phase2 = document.getElementById('phase-2');
  const phase3 = document.getElementById('phase-3');

  const frameScrubber = document.getElementById('frame-scrubber');
  const frameCounter = document.getElementById('frame-counter');
  const autoplayBtn = document.getElementById('autoplay-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const playStateLabel = document.getElementById('play-state-label');

  // Motion State Variables
  let targetFrame = 1;
  let currentFrame = 1;
  let isAutoplay = false;
  let autoplayInterval = null;

  // Sound State Variables
  let soundEnabled = false;
  let audioCtx = null;
  let ambientGainNode = null;
  const soundToggleBtn = document.getElementById('sound-toggle');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');

  /* ==========================================================================
     1. LENIS SMOOTH SCROLLING SETUP
     ========================================================================== */
  const lenis = new Lenis({
    duration: 0.8,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1.25,
    touchMultiplier: 1.8,
    smoothTouch: false
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Scroll Handler for Navbar & Story Reveal
  lenis.on('scroll', (e) => {
    if (e.scroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    updateFrameFromScroll();
    checkStoryScrollReveal();
    checkMetricsAnimation();
  });

  /* ==========================================================================
     2. FRAME PRELOADER ENGINE
     ========================================================================== */
  function preloadFrames() {
    let hasFinished = false;

    const finishPreload = () => {
      if (hasFinished) return;
      hasFinished = true;
      onAllFramesLoaded();
    };

    // Safety unblock timer (4s max wait)
    setTimeout(finishPreload, 3500);

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const frameNum = String(i).padStart(3, '0');

      const onFrameLoaded = () => {
        if (img._handled) return;
        img._handled = true;
        loadedFramesCount++;
        const percent = Math.floor((loadedFramesCount / TOTAL_FRAMES) * 100);
        if (loaderPercent) loaderPercent.textContent = percent;
        if (loaderBarFill) loaderBarFill.style.width = `${percent}%`;

        if (loadedFramesCount >= TOTAL_FRAMES) {
          finishPreload();
        }
      };

      img.onload = onFrameLoaded;
      img.onerror = () => {
        if (!img._retried) {
          img._retried = true;
          img.src = `/image/ezgif-frame-${frameNum}.jpg`;
        } else {
          onFrameLoaded();
        }
      };

      img.src = `./image/ezgif-frame-${frameNum}.jpg`;

      if (img.complete && img.naturalWidth !== 0) {
        onFrameLoaded();
      }

      frameImages.push(img);
    }
  }

  function onAllFramesLoaded() {
    if (preloader) preloader.classList.add('fade-out');
    resizeCanvas();
    renderCanvasFrame(currentFrame);
    startRenderLoop();
  }

  /* ==========================================================================
     3. HIGH-DPI CANVAS RENDER ENGINE
     ========================================================================== */
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    renderCanvasFrame(currentFrame);
  });

  function renderCanvasFrame(frameIndex) {
    const imgIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(frameIndex) - 1));
    let img = frameImages[imgIndex];
    if (!img || !img.complete) {
      img = frameImages.find(f => f && (f.complete || f.naturalWidth > 0)) || img;
    }
    if (!img) return;

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;

    // Aspect Ratio "Cover" calculation
    const imgWidth = img.naturalWidth || 1920;
    const imgHeight = img.naturalHeight || 1080;
    const imgAspect = imgWidth / imgHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (canvasAspect > imgAspect) {
      renderWidth = canvasWidth;
      renderHeight = canvasWidth / imgAspect;
      offsetX = 0;
      offsetY = (canvasHeight - renderHeight) / 2;
    } else {
      renderWidth = canvasHeight * imgAspect;
      renderHeight = canvasHeight;
      offsetX = (canvasWidth - renderWidth) / 2;
      offsetY = 0;
    }

    // Dynamic Zoom / Parallax Depth during Splash Impact (Frames 60 - 120)
    let zoomScale = 1.0;
    if (frameIndex >= 50 && frameIndex <= 140) {
      const zoomProgress = (frameIndex - 50) / 90;
      zoomScale = 1.0 + Math.sin(zoomProgress * Math.PI) * 0.05; // 5% subtle cinematic zoom
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    
    // Zoom centered
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(zoomScale, zoomScale);
    ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

    ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
    ctx.restore();
  }

  // Smooth Lerp Animation Loop (60 FPS)
  function startRenderLoop() {
    function animate() {
      // Lerp frame towards target frame for fluid physics movement
      const delta = targetFrame - currentFrame;
      if (Math.abs(delta) > 0.002) {
        currentFrame += delta * 0.35; // increased responsiveness factor for zero frame lag
        renderCanvasFrame(currentFrame);
        updateUIForFrame(currentFrame);
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  /* ==========================================================================
     4. SCROLL & UI SYNCHRONIZATION
     ========================================================================== */
  function updateFrameFromScroll() {
    if (isAutoplay) return;

    const scrollTop = lenis.scroll || window.scrollY || document.documentElement.scrollTop;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, scrollTop / maxScroll));

    targetFrame = 1 + progress * (TOTAL_FRAMES - 1);
  }

  function updateUIForFrame(frameVal) {
    const frameInt = Math.round(frameVal);
    
    // Scrubber update if present
    if (frameScrubber) frameScrubber.value = frameInt;
    if (frameCounter) frameCounter.textContent = `${String(frameInt).padStart(3, '0')} / ${TOTAL_FRAMES}`;

    // Text Phase Overlays sync
    if (frameInt <= 70) {
      setActivePhase(phase1);
    } else if (frameInt > 70 && frameInt <= 150) {
      setActivePhase(phase2);
      playIceImpactSoundIfEnabled(frameInt);
    } else {
      setActivePhase(phase3);
    }
  }

  function setActivePhase(activePhaseEl) {
    if (!activePhaseEl) return;
    [phase1, phase2, phase3].forEach(p => {
      if (p) {
        if (p === activePhaseEl) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      }
    });
  }

  // Manual Scrubber Interaction
  if (frameScrubber) {
    frameScrubber.addEventListener('input', (e) => {
      if (isAutoplay) stopAutoplay();
      targetFrame = parseFloat(e.target.value);
    });
  }

  // Autoplay Motion Toggle
  if (autoplayBtn) {
    autoplayBtn.addEventListener('click', () => {
      if (isAutoplay) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });
  }

  function startAutoplay() {
    isAutoplay = true;
    if (playIcon) playIcon.classList.add('hidden');
    if (pauseIcon) pauseIcon.classList.remove('hidden');
    if (playStateLabel) playStateLabel.textContent = 'Pause Motion';

    autoplayInterval = setInterval(() => {
      targetFrame += 1;
      if (targetFrame > TOTAL_FRAMES) {
        targetFrame = 1;
      }
    }, 45); // ~22 fps smooth speed
  }

  function stopAutoplay() {
    isAutoplay = false;
    if (autoplayInterval) clearInterval(autoplayInterval);
    if (playIcon) playIcon.classList.remove('hidden');
    if (pauseIcon) pauseIcon.classList.add('hidden');
    if (playStateLabel) playStateLabel.textContent = 'Play Motion';
  }

  /* ==========================================================================
     5. WEB AUDIO API AMBIENT SOUNDSCAPE
     ========================================================================== */
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundEnabled) {
        if (soundIconOn) soundIconOn.classList.remove('hidden');
        if (soundIconOff) soundIconOff.classList.add('hidden');
        initAndStartAudio();
      } else {
        if (soundIconOn) soundIconOn.classList.add('hidden');
        if (soundIconOff) soundIconOff.classList.remove('hidden');
        stopAudio();
      }
    });
  }

  function initAndStartAudio() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Synthesize low ambient warmth rumble (lowpass filtered noise)
    if (!ambientGainNode) {
      ambientGainNode = audioCtx.createGain();
      ambientGainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, audioCtx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(ambientGainNode);
      ambientGainNode.connect(audioCtx.destination);
      whiteNoise.start();
    }
  }

  function stopAudio() {
    if (ambientGainNode && audioCtx) {
      ambientGainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    }
  }

  // Trigger crystal ice clink sound on splash impact frame
  let lastClinkFrame = 0;
  function playIceImpactSoundIfEnabled(frameInt) {
    if (!soundEnabled || !audioCtx) return;
    if (Math.abs(frameInt - 85) < 3 && Math.abs(frameInt - lastClinkFrame) > 30) {
      lastClinkFrame = frameInt;

      // High metallic chime
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1250, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.26);
    }
  }

  /* ==========================================================================
     6. SENSORY INTERACTIVE WHEEL & PROFILES
     ========================================================================== */
  const sensoryProfiles = {
    cacao: {
      title: '70% Valrhona Dark Cacao',
      desc: 'Rich, full-bodied dark chocolate notes derived naturally from slow Ethiopian bean fermentation, leaving a lingering bittersweet finish.',
      sweetness: '75%',
      aroma: '95%',
      smoothness: '98%'
    },
    jasmine: {
      title: 'Wild Ethiopian Jasmine',
      desc: 'High-elevation floral aromatics extracted at sub-zero temperatures, giving a crisp tea-like elegance and fragrant headiness.',
      sweetness: '60%',
      aroma: '99%',
      smoothness: '90%'
    },
    hazelnut: {
      title: 'Toasted Piedmont Hazelnut',
      desc: 'Subtle nutty warmth with hints of oak wood smoke, offering a rich dessert finish without added refined sugars.',
      sweetness: '85%',
      aroma: '88%',
      smoothness: '94%'
    },
    vanilla: {
      title: 'Madagascar Bourbon Vanilla',
      desc: 'Whole vanilla bean pod infusion yielding a velvety orchid floral sweetness and silky mouthfeel.',
      sweetness: '90%',
      aroma: '92%',
      smoothness: '100%'
    }
  };

  const sensoryTabs = document.querySelectorAll('.sensory-tab');
  const sensoryTitle = document.getElementById('sensory-display-title');
  const sensoryDesc = document.getElementById('sensory-display-desc');
  const barSweetness = document.getElementById('bar-sweetness');
  const barAroma = document.getElementById('bar-aroma');
  const barSmoothness = document.getElementById('bar-smoothness');

  sensoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sensoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const key = tab.getAttribute('data-sensory');
      const data = sensoryProfiles[key];
      if (data) {
        sensoryTitle.textContent = data.title;
        sensoryDesc.textContent = data.desc;
        barSweetness.style.width = data.sweetness;
        barAroma.style.width = data.aroma;
        barSmoothness.style.width = data.smoothness;
      }
    });
  });

  /* ==========================================================================
     7. STORY SCROLL REVEAL
     ========================================================================== */
  const storyLines = document.querySelectorAll('.story-line');
  function checkStoryScrollReveal() {
    storyLines.forEach(line => {
      const rect = line.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.8 && rect.bottom > 0) {
        line.classList.add('visible');
      }
    });
  }

  /* ==========================================================================
     8. METRICS STRIP COUNTER ANIMATION
     ========================================================================== */
  let metricsAnimated = false;
  const stripNumbers = document.querySelectorAll('.strip-number');
  function checkMetricsAnimation() {
    if (metricsAnimated) return;
    const strip = document.querySelector('.metrics-strip');
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.85) {
      metricsAnimated = true;
      stripNumbers.forEach(numEl => {
        const target = parseInt(numEl.getAttribute('data-target'), 10);
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 40));
        const timer = setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          numEl.textContent = current;
        }, 30);
      });
    }
  }

  /* ==========================================================================
     9. MODAL & RESERVATION SYSTEM
     ========================================================================== */
  const orderModal = document.getElementById('order-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalTriggers = document.querySelectorAll('.modal-trigger, .btn-primary-nav');
  const variantSelectButtons = document.querySelectorAll('.btn-variant-select');
  const variantSelectDropdown = document.getElementById('variant-select');
  const orderForm = document.getElementById('order-form');
  const modalSuccess = document.getElementById('modal-success');
  const successCloseBtn = document.getElementById('success-close-btn');
  const successItem = document.getElementById('success-item');

  function openModal(selectedVariant = null) {
    orderModal.classList.add('active');
    if (selectedVariant && variantSelectDropdown) {
      for (let option of variantSelectDropdown.options) {
        if (option.value.toLowerCase().includes(selectedVariant.toLowerCase())) {
          option.selected = true;
          break;
        }
      }
    }
  }

  function closeModal() {
    orderModal.classList.remove('active');
    setTimeout(() => {
      orderForm.classList.remove('hidden');
      modalSuccess.classList.add('hidden');
    }, 400);
  }

  modalTriggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  variantSelectButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const product = btn.getAttribute('data-product');
      openModal(product);
    });
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (successCloseBtn) successCloseBtn.addEventListener('click', closeModal);

  orderModal.addEventListener('click', (e) => {
    if (e.target === orderModal) closeModal();
  });

  if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const chosenItem = variantSelectDropdown.options[variantSelectDropdown.selectedIndex].text;
      successItem.textContent = chosenItem;
      orderForm.classList.add('hidden');
      modalSuccess.classList.remove('hidden');
    });
  }

  /* ==========================================================================
     10. NEWSLETTER FORM
     ========================================================================== */
  const newsletterForm = document.getElementById('newsletter-form');
  const newsletterMsg = document.getElementById('newsletter-status') || document.getElementById('newsletter-msg');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      newsletterMsg.textContent = '✨ Thank you. You have been added to the AUREN private allocation list.';
      newsletterForm.reset();
    });
  }

  // Initialize Preloading
  preloadFrames();
});
