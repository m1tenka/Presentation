(() => {
  const deck = document.querySelector('.deck');
  const slides = [...document.querySelectorAll('.slide')];
  const counter = document.querySelector('.counter');
  const progress = document.querySelector('.progress');
  const hint = document.querySelector('.hint');
  const prevBtn = document.querySelector('[data-dir="-1"]');
  const nextBtn = document.querySelector('[data-dir="1"]');
  const flowQuery = window.matchMedia('(max-width: 760px), (orientation: portrait) and (max-width: 1100px)');
  const TRANSITION_MS = 1050;
  const pad = (n) => String(n).padStart(2, '0');

  /* ---- shared meta row ---- */
  const metaHTML =
    '<span>©Дмитрий Золотарёв</span>' +
    '<span>Предложение\nоктябрь 2026</span>' +
    '<span>Unicar · PhuketDrive\nDandy · logistics.kaz</span>' +
    '<span>2026</span>';
  document.querySelectorAll('.meta').forEach((m) => { m.innerHTML = metaHTML; });

  /* ---- split headlines into masked lines ---- */
  document.querySelectorAll('.split').forEach((el) => {
    const parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts
      .map((p, i) => `<span class="ln"><span style="--l:${i}">${p.trim()}</span></span>`)
      .join('');
  });

  /* ---- stagger index per slide ---- */
  slides.forEach((s, si) => {
    s.setAttribute('role', 'group');
    s.setAttribute('aria-roledescription', 'slide');
    s.setAttribute('aria-label', `${si + 1} из ${slides.length}: ${s.dataset.title || ''}`);
    s.querySelectorAll('[data-a], .shot').forEach((el, i) => el.style.setProperty('--i', i));
  });

  /* ---- count-up numbers ---- */
  const countUp = (slide) => {
    slide.querySelectorAll('[data-count]').forEach((el) => {
      const target = +el.dataset.count;
      const start = performance.now() + 450;
      const dur = 1400;
      const tick = (t) => {
        const p = Math.min(1, Math.max(0, (t - start) / dur));
        const e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(target * e);
        if (p < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    });
  };

  /* ---------------- deck mode ---------------- */
  let current = 0;
  let locked = false;

  const setChrome = () => {
    const s = slides[current];
    document.body.dataset.theme = s.dataset.theme || 'light';
    counter.textContent = `${pad(current + 1)} / ${pad(slides.length)}`;
    progress.style.transform = `scaleX(${(current + 1) / slides.length})`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
    if (current > 0) hint.classList.add('is-hidden');
  };

  const show = (index, opts = {}) => {
    if (index < 0 || index >= slides.length || index === current && !opts.force) return;
    if (locked && !opts.force) return;
    const prev = slides[current];
    const back = index < current;
    deck.classList.toggle('go-back', back);
    slides.forEach((s) => s.classList.remove('is-leaving'));
    if (prev !== slides[index] && !opts.force) prev.classList.add('is-leaving');
    prev.classList.remove('is-active');
    // restart animations
    const next = slides[index];
    next.classList.remove('is-active');
    void next.offsetWidth;
    next.classList.add('is-active');
    current = index;
    setChrome();
    countUp(next);
    if (history.replaceState) history.replaceState(null, '', `#${index + 1}`);
    locked = true;
    setTimeout(() => {
      locked = false;
      prev.classList.remove('is-leaving');
    }, TRANSITION_MS);
  };
  const go = (dir) => show(current + dir);

  /* wheel: one gesture = one slide (ignores trackpad inertia) */
  let gesture = false;
  let gestureTimer;
  const onWheel = (e) => {
    if (flowQuery.matches) return;
    e.preventDefault();
    const dy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    clearTimeout(gestureTimer);
    gestureTimer = setTimeout(() => { gesture = false; }, 220);
    if (gesture || Math.abs(dy) < 6) return;
    gesture = true;
    go(dy > 0 ? 1 : -1);
  };

  const onKey = (e) => {
    if (flowQuery.matches) return;
    if (e.target.closest && e.target.closest('button') && e.key === ' ') return;
    const k = e.key;
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); go(1); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); go(-1); }
    else if (k === 'Home') { e.preventDefault(); show(0); }
    else if (k === 'End') { e.preventDefault(); show(slides.length - 1); }
  };

  let touchY = null;
  const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
  const onTouchEnd = (e) => {
    if (flowQuery.matches || touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 40) go(dy > 0 ? 1 : -1);
    touchY = null;
  };

  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (!flowQuery.matches && Number.isFinite(n) && n - 1 !== current) show(Math.min(Math.max(n - 1, 0), slides.length - 1));
  });
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });

  /* ---------------- flow mode (phones) ---------------- */
  let observer = null;
  const enterFlow = () => {
    slides.forEach((s) => s.classList.remove('is-active', 'is-leaving'));
    observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && !en.target.classList.contains('is-active')) {
          en.target.classList.add('is-active');
          countUp(en.target);
        }
      });
    }, { threshold: 0.15 });
    slides.forEach((s) => observer.observe(s));
  };
  const enterDeck = () => {
    if (observer) { observer.disconnect(); observer = null; }
    slides.forEach((s) => s.classList.remove('is-active', 'is-leaving'));
    const fromHash = parseInt(location.hash.slice(1), 10);
    current = Number.isFinite(fromHash) ? Math.min(Math.max(fromHash - 1, 0), slides.length - 1) : 0;
    slides[current].classList.add('is-active');
    setChrome();
    countUp(slides[current]);
    requestAnimationFrame(() => deck.classList.add('is-ready'));
  };
  const applyMode = () => (flowQuery.matches ? enterFlow() : enterDeck());
  flowQuery.addEventListener('change', applyMode);

  /* wait for the font so masked lines measure correctly */
  const start = () => applyMode();
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(start);
  } else {
    start();
  }
})();
