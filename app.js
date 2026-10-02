/* Гілка — логіка каталогу.
   Дані: data.json (у майбутньому оновлюється синком з Google-таблиці).
   Медіа: media/<код>.jpg|mp4 — імена завжди збігаються з полем code. */
'use strict';

(() => {
  const IG = 'gilka.ceramics';
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    type: 'all',
    sort: 'new',
    showSold: false,
    dropActive: false,
    items: [],
  };

  const el = {
    introMeta: document.getElementById('intro-meta'),
    controls: document.getElementById('controls'),
    grid: document.getElementById('grid'),
    notice: document.getElementById('notice'),
    empty: document.getElementById('empty'),
    emptyText: document.getElementById('empty-text'),
    reset: document.getElementById('reset'),
    sort: document.getElementById('sort'),
    status: document.getElementById('status'),
    filters: Array.from(document.querySelectorAll('.filter')),
  };

  /* ---------- дрібні утиліти ---------- */

  const plural = (n, one, few, many) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  const money = (n) => `${n.toLocaleString('uk-UA')} грн`;

  const dur = (sec) => {
    if (!sec) return '';
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  const igDmUrl = (name) =>
    `https://ig.me/m/${IG}?text=${encodeURIComponent(`Добрий день! Цікавить «${name}».`)}`;

  const PLAY_SVG =
    '<svg viewBox="0 0 8 9" aria-hidden="true"><path d="M0 0l8 4.5L0 9z" fill="currentColor"/></svg>';

  /* стрілка CTA — чиста іконка ↗ (рівні кути, 45°) */
  const CTA_ARROW =
    '<svg class="card-cta-arrow" viewBox="0 0 9.5 9.5" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">' +
    '<path d="M0.75 8.75 L8.75 0.75"/><path d="M4.35 0.75 H8.75 V5.15"/></svg>';

  /* пауза відео, яке зникло з вьюпорта */
  const mediaObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.15) {
            const v = entry.target.querySelector('video');
            if (v && !v.paused) v.pause();
          }
        }
      }, { threshold: 0.15 })
    : null;

  /* ---------- картка ---------- */

  const makeCard = (item) => {
    const sold = item.status === 'sold';
    const card = document.createElement('article');
    card.className = sold ? 'card is-sold' : 'card';

    /* медіа: відео знизу, постер-картинка зверху, тапи приймає прозора кнопка-оверлей.
       (iOS Safari не програє відео, що лежить під шаром, і не віддає тапи по самому відео) */
    const media = document.createElement('div');
    media.className = sold ? 'card-media is-static' : 'card-media';

    let video = null;
    if (!sold) {
      video = document.createElement('video');
      video.src = `media/${item.code}.mp4`;
      video.muted = true;
      video.setAttribute('muted', '');
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = 'none';
      video.poster = `media/${item.code}.jpg`;
      if (!RM) video.loop = true;
      video.setAttribute('tabindex', '-1');
      video.setAttribute('aria-hidden', 'true');
      media.appendChild(video);
    }

    const img = document.createElement('img');
    img.className = 'poster';
    img.src = `media/${item.code}.jpg`;
    img.alt = sold
      ? item.volume
        ? `${item.name} — ${item.volume} мл, кераміка ручної роботи`
        : `${item.name} — кераміка ручної роботи`
      : '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 1000;
    img.height = 1250;
    media.appendChild(img);

    let toggleBtn = null;
    let seek = null;
    if (!sold) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'media-toggle';
      toggleBtn.setAttribute('aria-pressed', 'false');
      toggleBtn.setAttribute('aria-label', `Відтворити відео: ${item.name}`);
      media.appendChild(toggleBtn);

      seek = document.createElement('div');
      seek.className = 'media-seek';
      seek.setAttribute('role', 'slider');
      seek.setAttribute('tabindex', '0');
      seek.setAttribute('aria-label', `Перемотування відео: ${item.name}`);
      seek.setAttribute('aria-valuemin', '0');
      seek.setAttribute('aria-valuemax', String(item.duration || 0));
      seek.setAttribute('aria-valuenow', '0');
      seek.innerHTML = '<div class="media-line"><div class="media-fill"></div></div>';
      media.appendChild(seek);
    }

    if (sold) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'продано';
      media.appendChild(badge);
    } else {
      const hint = document.createElement('span');
      hint.className = 'media-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.innerHTML = PLAY_SVG + (item.duration ? `відео ${dur(item.duration)}` : '');
      media.appendChild(hint);
    }

    /* тексти */
    const info = document.createElement('div');
    info.className = 'card-info';

    const row = document.createElement('div');
    row.className = 'card-row';

    const name = document.createElement('h3');
    name.className = 'card-name';
    name.textContent = item.name;
    row.appendChild(name);

    if (item.volume) {
      const vol = document.createElement('span');
      vol.className = 'card-vol';
      vol.textContent = `${item.volume} мл`;
      row.appendChild(vol);
    } else {
      row.classList.add('no-vol');
    }

    const price = document.createElement('span');
    price.className = 'card-price';
    price.textContent = money(item.price);
    row.appendChild(price);

    info.appendChild(row);

    if (!sold) {
      const act = document.createElement('div');
      act.className = 'card-act';
      const cta = document.createElement('a');
      cta.className = 'card-cta';
      cta.href = igDmUrl(item.name);
      cta.target = '_blank';
      cta.rel = 'noopener';
      cta.innerHTML = 'написати в дірект' + CTA_ARROW;
      act.appendChild(cta);
      info.appendChild(act);
    }

    card.appendChild(media);
    card.appendChild(info);

    if (mediaObserver) mediaObserver.observe(media);

    /* відтворення відео */
    if (!sold && video && toggleBtn && seek) {
      const labelPlay = `Відтворити відео: ${item.name}`;
      const labelPause = `Пауза: ${item.name}`;
      const hint = media.querySelector('.media-hint');
      const fill = seek.querySelector('.media-fill');
      const pauseSvg =
        '<svg viewBox="0 0 8 9" aria-hidden="true"><rect x="0" y="0" width="3" height="9" fill="currentColor"/><rect x="5" y="0" width="3" height="9" fill="currentColor"/></svg>';

      /* перемотування: тап/драг по лінії + клавіші */
      const seekTo = (clientX) => {
        if (!video.duration) return;
        const r = seek.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        video.currentTime = ratio * video.duration;
      };
      seek.addEventListener('pointerdown', (e) => {
        try { seek.setPointerCapture(e.pointerId); } catch (err) {}
        seekTo(e.clientX);
      });
      seek.addEventListener('pointermove', (e) => {
        if (seek.hasPointerCapture && seek.hasPointerCapture(e.pointerId)) seekTo(e.clientX);
      });
      seek.addEventListener('keydown', (e) => {
        if (!video.duration) return;
        const step = e.shiftKey ? 10 : 5;
        if (e.key === 'ArrowRight') { video.currentTime = Math.min(video.duration, video.currentTime + step); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { video.currentTime = Math.max(0, video.currentTime - step); e.preventDefault(); }
        else if (e.key === 'Home') { video.currentTime = 0; e.preventDefault(); }
        else if (e.key === 'End') { video.currentTime = video.duration; e.preventDefault(); }
      });
      video.addEventListener('timeupdate', () => {
        if (video.duration) fill.style.width = `${(video.currentTime / video.duration) * 100}%`;
        seek.setAttribute('aria-valuenow', String(Math.round(video.currentTime)));
      });
      video.addEventListener('loadedmetadata', () => {
        if (video.duration) seek.setAttribute('aria-valuemax', String(Math.round(video.duration)));
      });

      /* одночасно грає лише одне відео */
      video.addEventListener('play', () => {
        for (const other of document.querySelectorAll('.card video')) {
          if (other !== video && !other.paused) other.pause();
        }
      });

      /* чип у куті: до запуску «▶ відео 0:21», під час — іконка паузи, на паузі — іконка ▶ */
      const paint = () => {
        const playing = !video.paused && !video.ended;
        toggleBtn.setAttribute('aria-pressed', String(playing));
        toggleBtn.setAttribute('aria-label', playing ? labelPause : labelPlay);
        if (hint) {
          if (playing) hint.innerHTML = pauseSvg;
          else if (card.classList.contains('is-video')) hint.innerHTML = PLAY_SVG;
          else hint.innerHTML = PLAY_SVG + (item.duration ? `відео ${dur(item.duration)}` : '');
        }
      };

      toggleBtn.addEventListener('click', () => {
        if (video.paused) {
          const p = video.play();
          if (p && p.catch) {
            p.catch(() => {
              /* запасний шлях: якщо платформа відмовила — показати нативні контроли */
              video.setAttribute('controls', 'controls');
              const p2 = video.play();
              if (p2 && p2.catch) p2.catch(() => {});
            });
          }
        } else if (video.readyState >= 3) {
          /* пауза — лише коли кадр уже йде (подвійний тап під час завантаження не скасовує старт) */
          video.pause();
        }
      });

      /* постер зникає тільки коли відео реально показує кадри — без світлого блимання */
      video.addEventListener('playing', () => {
        card.classList.add('is-video');
        paint();
      });
      video.addEventListener('play', paint);
      video.addEventListener('pause', paint);
      video.addEventListener('ended', paint);
      video.addEventListener('error', () => card.classList.add('media-error'));
    }

    return card;
  };

  /* ---------- фільтр / сортування / рендер ---------- */

  const baseItems = () =>
    state.items
      .filter((i) => i.status !== 'hidden')
      .filter((i) => state.showSold || i.status !== 'sold');

  const visibleItems = () => {
    const list = baseItems().filter((i) =>
      state.type === 'all'
        ? true
        : state.type === 'drop'
          ? i.drop === true
          : i.type === state.type
    );
    const sorters = {
      new: (a, b) => b.order - a.order,
      old: (a, b) => a.order - b.order,
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
    };
    const sorted = list.sort(sorters[state.sort] || sorters.new);
    /* продані — завжди в кінці; у межах групи — обране сортування */
    return sorted.sort(
      (a, b) => (a.status === 'sold' ? 1 : 0) - (b.status === 'sold' ? 1 : 0)
    );
  };

  const updateCounts = () => {
    const base = baseItems();
    const counts = { all: base.length, drop: 0, piala: 0, chakhe: 0, figurka: 0 };
    for (const i of base) {
      if (counts[i.type] !== undefined) counts[i.type] += 1;
      if (i.drop === true) counts.drop += 1;
    }
    for (const btn of el.filters) {
      const span = btn.querySelector('.count');
      if (span) span.textContent = counts[btn.dataset.type] ?? '';
    }
  };

  const updateFilterButtons = () => {
    for (const btn of el.filters) {
      const active = btn.dataset.type === state.type;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
  };

  const announce = (n) => {
    el.status.textContent =
      n === 0
        ? 'Нічого не знайдено'
        : `Показано ${n} ${plural(n, 'виріб', 'вироби', 'виробів')}`;
  };

  const render = () => {
    const list = visibleItems();
    if (mediaObserver) mediaObserver.disconnect();
    el.grid.replaceChildren(...list.map(makeCard));

    if (list.length === 0) {
      el.grid.hidden = true;
      el.empty.hidden = false;
      if (state.type === 'drop') {
        el.emptyText.textContent = 'У цьому дропі зараз нічого немає.';
      } else if (state.type !== 'all') {
        el.emptyText.textContent = 'У цій категорії поки нічого немає.';
      } else if (!state.showSold && state.items.some((i) => i.status === 'sold')) {
        el.emptyText.textContent =
          'Зараз усе продано. Новий дроп анонсую в інстаграмі — заглядайте.';
      } else {
        el.emptyText.textContent = 'За цих умов нічого немає.';
      }
      el.reset.hidden = state.type === 'all';
    } else {
      el.empty.hidden = true;
      el.grid.hidden = false;
    }

    updateCounts();
    announce(list.length);
  };

  /* ---------- події ---------- */

  for (const btn of el.filters) {
    btn.addEventListener('click', () => {
      state.type = btn.dataset.type;
      updateFilterButtons();
      render();
    });
  }

  el.sort.addEventListener('change', () => {
    state.sort = el.sort.value;
    render();
  });

  el.reset.addEventListener('click', () => {
    state.type = 'all';
    updateFilterButtons();
    render();
  });

  /* ---------- старт ---------- */

  const setIntro = (data) => {
    if (!el.introMeta) return;
    const n = data.items.length;
    const parts = [];
    if (data.dropLabel) parts.push(data.dropLabel);
    parts.push(`${n} ${plural(n, 'виріб', 'вироби', 'виробів')}`);
    el.introMeta.textContent = parts.join(' · ');
  };

  fetch('data.json', { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      state.showSold = data.showSold === true;
      state.items = (data.items || []).filter((i) => i && i.code && i.name);
      state.dropActive =
        data.dropActive === true && state.items.some((i) => i.drop === true);
      const dropBtn = el.filters.find((b) => b.dataset.type === 'drop');
      if (dropBtn) dropBtn.hidden = !state.dropActive;
      if (state.dropActive) state.type = 'drop';
      setIntro(data);
      el.notice.hidden = true;
      el.controls.hidden = false;
      el.grid.hidden = false;
      updateFilterButtons();
      render();
    })
    .catch(() => {
      el.notice.innerHTML =
        'Не вдалося завантажити каталог. Оновіть сторінку — або напишіть у дірект: ' +
        `<a href="https://instagram.com/${IG}" target="_blank" rel="noopener">@${IG}</a>`;
      el.notice.hidden = false;
    });
})();
