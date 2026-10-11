/**
 * ============================================================================
 * Career Paths & Future Jobs - Main Application Logic (Phase 3 Enhanced)
 * Ms Trâm English Hub
 * ============================================================================
 */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     1. LocalStorage & State Management
     -------------------------------------------------------------------------- */
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    }
  };

  // Quản lý âm thanh & cài đặt
  let isMuted = store.get("cpv-muted", false);

  // Quản lý chủ đề hiện tại
  let currentTopic = window.TopicManager ? window.TopicManager.getActive() : null;
  let W = currentTopic ? currentTopic.words : [];
  let PASS = currentTopic ? currentTopic.passages : {};
  let CLUSTERS = currentTopic ? (currentTopic.clusters || []) : [];

  function getKnownSet(topicId) {
    return new Set(store.get("cpv-known-" + topicId, []));
  }
  function saveKnownSet(topicId, set) {
    store.set("cpv-known-" + topicId, [...set]);
  }

  function getWeakWordsSet(topicId) {
    return new Set(store.get("cpv-weak-" + topicId, []));
  }
  function saveWeakWordsSet(topicId, set) {
    store.set("cpv-weak-" + topicId, [...set]);
  }

  function getStarredSet(topicId) {
    return new Set(store.get("cpv-star-" + topicId, []));
  }
  function saveStarredSet(topicId, set) {
    store.set("cpv-star-" + topicId, [...set]);
  }

  let known = currentTopic ? getKnownSet(currentTopic.id) : new Set();
  let weakWords = currentTopic ? getWeakWordsSet(currentTopic.id) : new Set();
  let starred = currentTopic ? getStarredSet(currentTopic.id) : new Set();

  let speechRate = store.get("cpv-speech-rate", 0.9);
  let isAutoplay = false;
  let autoplayTimer = null;
  let matchSession = null;
  let matchTimer = null;

  let filter = "all";
  let tab = store.get("cpv-tab", "cards");
  let cardOrder = null;
  let cardIdx = 0;
  let flipped = false;
  let session = null; // Quiz, Gap hoặc Spell session
  let student = store.get("cpv-student", null);
  let q = ""; // Từ khóa tìm kiếm trong danh sách

  const MODE = {
    quiz: "Trắc nghiệm",
    gap: "Điền từ",
    spell: "Luyện gõ từ",
    match: "Ghép từ phản xạ"
  };

  /* --------------------------------------------------------------------------
     2. Native Web Audio API Sound Synthesizer (Zero Dependencies)
     -------------------------------------------------------------------------- */
  const soundFX = {
    ctx: null,
    getCtx() {
      if (!this.ctx && typeof AudioContext !== 'undefined') {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return this.ctx;
    },
    playTone(freq, type, duration, gainVal = 0.12) {
      if (isMuted) return;
      try {
        const ctx = this.getCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    },
    ding() {
      if (isMuted) return;
      try {
        const ctx = this.getCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.12);
        osc2.start(ctx.currentTime + 0.08);
        osc2.stop(ctx.currentTime + 0.35);
      } catch (e) {}
    },
    buzz() {
      this.playTone(180, 'triangle', 0.22, 0.15);
    },
    flip() {
      this.playTone(420, 'sine', 0.05, 0.06);
    }
  };

  /* --------------------------------------------------------------------------
     3. Helper Utilities
     -------------------------------------------------------------------------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));

  const shuffle = a => {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const pool = () => {
    if (filter === "weak") {
      const list = W.filter(x => weakWords.has(x.w));
      return list.length ? list : W;
    }
    if (filter === "starred") {
      const list = W.filter(x => starred.has(x.w));
      return list.length ? list : W;
    }
    return filter === "all" ? W : W.filter(x => x.p === +filter);
  };

  const filled = x => esc(x.ex).replace("___", `<mark>${esc(x.form)}</mark>`);
  const posGroup = p => (p === "v" || p === "phr v") ? "v" : p;
  const scopeName = f => f === "weak" ? "Các từ cần ôn gấp" : f === "starred" ? "Các từ đã gắn sao ⭐" : f === "all" ? "Tất cả các bài" : "Bài " + f + " – " + (PASS[f] || "");
  const fmtTime = ts => new Date(ts).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const fmtDur = d => `${Math.floor(d / 60)} phút ${d % 60} giây`;

  // Tùy chỉnh tốc độ phát âm (0.8x Chậm / 1.0x Chuẩn)
  function toggleSpeechRate() {
    speechRate = speechRate === 0.8 ? 1.0 : 0.8;
    store.set("cpv-speech-rate", speechRate);
    document.querySelectorAll(".speed-toggle-btn").forEach(b => {
      b.textContent = speechRate === 0.8 ? "0.8x Chậm" : "1.0x Chuẩn";
    });
  }

  // Phát âm từ vựng bằng Web Speech API
  function speak(t) {
    try {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "en-GB";
      u.rate = speechRate;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // Đánh dấu hoặc bỏ đánh dấu từ đã thuộc (lưu theo từng chủ đề)
  function toggleKnown(w) {
    if (!currentTopic) return;
    known.has(w) ? known.delete(w) : known.add(w);
    saveKnownSet(currentTopic.id, known);
    drawLadder();
  }

  function markAsWeak(w) {
    if (!currentTopic) return;
    weakWords.add(w);
    saveWeakWordsSet(currentTopic.id, weakWords);
    drawChips();
  }

  function removeFromWeak(w) {
    if (!currentTopic) return;
    weakWords.delete(w);
    saveWeakWordsSet(currentTopic.id, weakWords);
    drawChips();
  }

  // Gắn sao từ vựng yêu thích / cần lưu ý
  function toggleStarred(w) {
    if (!currentTopic) return;
    if (starred.has(w)) {
      starred.delete(w);
    } else {
      starred.add(w);
      soundFX.ding();
    }
    saveStarredSet(currentTopic.id, starred);
    drawChips();
  }

  /* --------------------------------------------------------------------------
     4. Topic Management & Switcher
     -------------------------------------------------------------------------- */
  function updateTopicHeader() {
    if (!currentTopic) return;
    const btnNameEl = $("#topicBtnName");
    const eyebrowEl = $("#topicEyebrow");
    const titleEl = $("#topicTitle");
    const descEl = $("#topicDesc");

    if (btnNameEl) btnNameEl.textContent = currentTopic.title;
    if (eyebrowEl) eyebrowEl.textContent = currentTopic.eyebrow || "Education & Careers · B2 – C1";
    if (titleEl) titleEl.innerHTML = esc(currentTopic.title).replace("&amp;", "<span>&amp;</span>");
    if (descEl) descEl.textContent = currentTopic.desc || "";
    document.title = `${currentTopic.title} · Ms Trâm English Hub`;
  }

  function switchTopic(topicId) {
    if (!window.TopicManager) return;
    window.TopicManager.setActiveId(topicId);
    currentTopic = window.TopicManager.getActive();
    if (!currentTopic) return;

    W = currentTopic.words;
    PASS = currentTopic.passages;
    CLUSTERS = currentTopic.clusters || [];
    known = getKnownSet(currentTopic.id);
    weakWords = getWeakWordsSet(currentTopic.id);
    starred = getStarredSet(currentTopic.id);
    matchSession = null;
    stopAutoplay();

    filter = "all";
    cardOrder = null;
    cardIdx = 0;
    flipped = false;
    session = null;
    q = "";

    updateTopicHeader();
    drawLadder();
    drawChips();
    render();

    const modal = $("#topicModal");
    if (modal && typeof modal.close === 'function') modal.close();
  }

  function renderTopicModalList() {
    const listEl = $("#topicList");
    if (!listEl || !window.TopicManager) return;
    const allTopics = window.TopicManager.getAll();

    listEl.innerHTML = Object.values(allTopics).map(t => {
      const tKnown = getKnownSet(t.id);
      const isActive = currentTopic && currentTopic.id === t.id;
      const count = t.words.length;
      const pct = count ? Math.round((tKnown.size / count) * 100) : 0;

      return `
        <article class="topic-card${isActive ? " is-active" : ""}" data-topic-id="${esc(t.id)}">
          <div class="topic-card-top">
            <span class="eyebrow">${esc(t.eyebrow || "")}</span>
            ${isActive ? `<span class="topic-card-badge">Đang học</span>` : ""}
          </div>
          <h3 class="topic-card-title">${esc(t.title)}</h3>
          <p class="topic-card-desc">${esc(t.desc)}</p>
          <div class="topic-card-footer">
            <span>📚 ${count} từ vựng (${Object.keys(t.passages || {}).length} bài đọc)</span>
            <span>Tiến độ: <b>${tKnown.size}/${count}</b> (${pct}%)</span>
          </div>
        </article>
      `;
    }).join("");

    listEl.querySelectorAll(".topic-card").forEach(card => {
      card.onclick = () => {
        const id = card.dataset.topicId;
        if (id) switchTopic(id);
      };
    });
  }

  function initTopicModal() {
    const modal = $("#topicModal");
    const openBtn = $("#openTopicModal");
    const closeBtn = $("#closeTopicModal");

    if (openBtn && modal) {
      openBtn.onclick = () => {
        renderTopicModalList();
        if (typeof modal.showModal === 'function') modal.showModal();
      };
    }

    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.close();
    }

    if (modal) {
      modal.onclick = e => {
        if (e.target === modal) modal.close();
      };
    }
  }

  /* --------------------------------------------------------------------------
     Theme Management (Dark Default with Light Toggle)
     -------------------------------------------------------------------------- */
  let currentTheme = store.get("cpv-theme", "dark");

  function applyTheme(theme) {
    currentTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    store.set("cpv-theme", currentTheme);

    const btn = $("#themeToggle");
    if (btn) {
      if (currentTheme === "dark") {
        btn.textContent = "🌙";
        btn.setAttribute("aria-label", "Chuyển sang giao diện sáng");
        btn.title = "Giao diện tối (Bấm để chuyển sang sáng)";
      } else {
        btn.textContent = "☀️";
        btn.setAttribute("aria-label", "Chuyển sang giao diện tối");
        btn.title = "Giao diện sáng (Bấm để chuyển sang tối)";
      }
    }
  }

  function initTheme() {
    applyTheme(currentTheme);
    const btn = $("#themeToggle");
    if (btn) {
      btn.onclick = () => {
        applyTheme(currentTheme === "dark" ? "light" : "dark");
        soundFX.ding();
      };
    }
  }

  /* --------------------------------------------------------------------------
     Branch Map Modal Switcher (2 Cơ sở: 12 Lê Đình Chinh & 32 Chu Văn An)
     -------------------------------------------------------------------------- */
  const BRANCHES = {
    "1": {
      name: "Cơ sở 1: 12 Lê Đình Chinh",
      address: "12 Lê Đình Chinh, Quy Nhơn Nam, Gia Lai, Việt Nam",
      link: "https://maps.google.com/?q=12+Lê+Đình+Chinh,+Quy+Nhơn+Nam,+Gia+Lai"
    },
    "2": {
      name: "Cơ sở 2: 32 Chu Văn An",
      address: "32 Chu Văn An, Quy Nhơn, Gia Lai, Việt Nam",
      link: "https://maps.google.com/?q=32+Chu+Văn+An,+Quy+Nhơn,+Gia+Lai"
    }
  };

  function selectBranch(branchId) {
    const b = BRANCHES[branchId] || BRANCHES["1"];
    const subEl = $("#mapModalSub");
    const linkEl = $("#externalMapLink");
    const box1 = $("#mapFrameBox1");
    const box2 = $("#mapFrameBox2");
    const tab1 = $("#branchTab1");
    const tab2 = $("#branchTab2");

    if (subEl) subEl.textContent = b.address;
    if (linkEl) linkEl.href = b.link;

    if (branchId === "2") {
      if (box1) box1.style.display = "none";
      if (box2) box2.style.display = "block";
      if (tab1) { tab1.classList.remove("is-active"); tab1.setAttribute("aria-selected", "false"); }
      if (tab2) { tab2.classList.add("is-active"); tab2.setAttribute("aria-selected", "true"); }
    } else {
      if (box1) box1.style.display = "block";
      if (box2) box2.style.display = "none";
      if (tab1) { tab1.classList.add("is-active"); tab1.setAttribute("aria-selected", "true"); }
      if (tab2) { tab2.classList.remove("is-active"); tab2.setAttribute("aria-selected", "false"); }
    }
  }

  function initMapModal() {
    const modal = $("#mapModal");
    const closeBtn = $("#closeMapModal");

    document.querySelectorAll("[data-branch]").forEach(btn => {
      if (btn.id === "branchTab1" || btn.id === "branchTab2") return;
      btn.onclick = () => {
        const branchId = btn.dataset.branch || "1";
        selectBranch(branchId);
        if (modal && typeof modal.showModal === 'function') modal.showModal();
      };
    });

    const tab1 = $("#branchTab1");
    const tab2 = $("#branchTab2");
    if (tab1) tab1.onclick = () => selectBranch("1");
    if (tab2) tab2.onclick = () => selectBranch("2");

    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.close();
    }

    if (modal) {
      modal.onclick = e => {
        if (e.target === modal) modal.close();
      };
    }
  }

  /* --------------------------------------------------------------------------
     Toast Notification & Clipboard Copy (Hotline, Zalo, Thông tin lớp học)
     -------------------------------------------------------------------------- */
  function showToast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._tid);
    el._tid = setTimeout(() => {
      el.classList.remove("is-visible");
    }, 2400);
  }

  function copyToClipboard(text, label) {
    const clean = String(text).replace(/\s+/g, "");
    const doShow = () => {
      showToast(`✓ Đã sao chép ${label || "số"}: ${text}!`);
      soundFX.ding();
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(clean).then(doShow).catch(() => {
        fallbackCopy(clean, doShow);
      });
    } else {
      fallbackCopy(clean, doShow);
    }
  }

  function fallbackCopy(str, cb) {
    const ta = document.createElement("textarea");
    ta.value = str;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      if (cb) cb();
    } catch (e) {
      alert(`Số: ${str}`);
    }
    document.body.removeChild(ta);
  }

  /* --------------------------------------------------------------------------
     Study Statistics & Reset Progress Modal
     -------------------------------------------------------------------------- */
  function renderStats() {
    if (!currentTopic) return;
    const sub = $("#statsModalSub");
    if (sub) sub.textContent = `Chuyên đề: ${currentTopic.title}`;

    const total = W.length;
    const knownCount = known.size;
    const pct = total ? Math.round((knownCount / total) * 100) : 0;
    const weakCount = weakWords.size;
    const starCount = starred.size;

    const attKey = `cpv-att-${currentTopic.id}`;
    const att = store.get(attKey, {});
    const quizAtt = att.quiz || 0;
    const gapAtt = att.gap || 0;
    const spellAtt = att.spell || 0;

    const grid = $("#statsGrid");
    if (grid) {
      grid.innerHTML = `
        <div class="stat-box">
          <span class="stat-box-val">${knownCount} / ${total}</span>
          <span class="stat-box-lbl">Đã thuộc (${pct}%)</span>
        </div>
        <div class="stat-box">
          <span class="stat-box-val" style="color:var(--bad)">${weakCount} từ</span>
          <span class="stat-box-lbl">Cần ôn gấp (hay sai)</span>
        </div>
        <div class="stat-box">
          <span class="stat-box-val" style="color:var(--hi)">${starCount} từ</span>
          <span class="stat-box-lbl">Đã gắn sao yêu thích ⭐</span>
        </div>
        <div class="stat-box">
          <span class="stat-box-val" style="color:var(--good)">${quizAtt + gapAtt + spellAtt}</span>
          <span class="stat-box-lbl">Số lượt làm bài trắc nghiệm / gõ từ</span>
        </div>
      `;
    }
  }

  function initStatsModal() {
    const modal = $("#statsModal");
    const openBtn = $("#openStatsBtn");
    const closeBtn = $("#closeStatsModal");
    const closeBtn2 = $("#closeStatsModalBtn");
    const resetBtn = $("#resetProgressBtn");

    if (openBtn && modal) {
      openBtn.onclick = () => {
        renderStats();
        if (typeof modal.showModal === 'function') modal.showModal();
      };
      openBtn.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openBtn.click();
        }
      };
    }

    if (closeBtn && modal) closeBtn.onclick = () => modal.close();
    if (closeBtn2 && modal) closeBtn2.onclick = () => modal.close();

    if (modal) {
      modal.onclick = e => {
        if (e.target === modal) modal.close();
      };
    }

    if (resetBtn && modal) {
      resetBtn.onclick = () => {
        if (!currentTopic) return;
        const ok = confirm(`Em có chắc chắn muốn đặt lại toàn bộ tiến độ (xóa từ đã thuộc & từ hay sai) của chuyên đề "${currentTopic.title}" để học lại từ đầu không?`);
        if (ok) {
          known.clear();
          weakWords.clear();
          saveKnownSet(currentTopic.id, known);
          saveWeakWordsSet(currentTopic.id, weakWords);
          soundFX.ding();
          drawLadder();
          drawChips();
          renderStats();
          render();
          modal.close();
        }
      };
    }
  }

  function updateSoundButton() {
    const btn = $("#soundToggle");
    if (!btn) return;
    btn.textContent = isMuted ? "🔇" : "🔊";
    btn.classList.toggle("is-muted", isMuted);
    btn.title = isMuted ? "Âm thanh: Đang tắt (Bấm để bật)" : "Âm thanh: Đang bật (Bấm để tắt)";
  }

  /* --------------------------------------------------------------------------
     5. Header Components: Ladder & Chips
     -------------------------------------------------------------------------- */
  function drawLadder() {
    const rungsEl = $("#rungs");
    const knownNEl = $("#knownN");
    const totalNEl = $("#totalN");
    if (rungsEl) {
      rungsEl.innerHTML = W.map(x => `<div class="rung${known.has(x.w) ? " on" : ""}" title="${esc(x.w)}"></div>`).join("");
    }
    if (knownNEl) knownNEl.textContent = known.size;
    if (totalNEl) totalNEl.textContent = W.length;
  }

  function drawChips() {
    const chipsEl = $("#chips");
    if (!chipsEl) return;
    const pKeys = Object.keys(PASS);
    const opts = [["all", "Tất cả"], ...pKeys.map(k => [k, `Bài ${k}`])];

    if (weakWords.size > 0) {
      opts.push(["weak", `🔥 Cần ôn gấp (${weakWords.size})`]);
    }
    if (starred.size > 0) {
      opts.push(["starred", `⭐ Đã gắn sao (${starred.size})`]);
    }

    chipsEl.innerHTML = opts.map(([v, l]) =>
      `<button class="chip${v === 'weak' ? ' chip-weak' : v === 'starred' ? ' chip-starred' : ''}" data-f="${v}" aria-pressed="${filter === v}" title="${v === "all" ? "" : v === 'weak' ? 'Danh sách các từ hay làm sai' : v === 'starred' ? 'Danh sách các từ em đã đánh dấu sao' : esc(PASS[v] || "")}">${l}</button>`
    ).join("");
  }

  function render() {
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.tab === tab));
    const renderers = {
      cards: renderCards,
      quiz: renderQuiz,
      gap: renderGap,
      spell: renderSpell,
      match: renderMatch,
      list: renderList
    };
    if (renderers[tab]) {
      renderers[tab]();
    }
  }

  /* --------------------------------------------------------------------------
     6. Tab 1: Flashcards (Thẻ ghi nhớ & Tự động phát)
     -------------------------------------------------------------------------- */
  function stopAutoplay() {
    if (autoplayTimer) {
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
    isAutoplay = false;
    const btn = $("#autoplayBtn");
    if (btn) {
      btn.classList.remove("is-playing");
      btn.innerHTML = "▶ Tự động";
    }
  }

  function startAutoplay() {
    isAutoplay = true;
    const btn = $("#autoplayBtn");
    if (btn) {
      btn.classList.add("is-playing");
      btn.innerHTML = "⏸️ Tạm dừng";
    }
    runAutoplayStep();
  }

  function runAutoplayStep() {
    if (!isAutoplay || tab !== "cards") {
      stopAutoplay();
      return;
    }
    const P = pool();
    if (!P.length || !cardOrder) return;
    const currentWord = cardOrder[cardIdx];
    speak(currentWord);

    autoplayTimer = setTimeout(() => {
      if (!isAutoplay || tab !== "cards") return;
      flipped = true;
      soundFX.flip();
      const cardEl = $("#card");
      if (cardEl) cardEl.classList.add("flip");

      autoplayTimer = setTimeout(() => {
        if (!isAutoplay || tab !== "cards") return;
        cardIdx = (cardIdx + 1) % cardOrder.length;
        flipped = false;
        soundFX.flip();
        renderCards();
        runAutoplayStep();
      }, 2500);
    }, 2200);
  }

  function renderCards() {
    const P = pool();
    if (P.length === 0) {
      $("#view").innerHTML = `<div class="empty">Không có từ vựng nào trong bộ lọc này.</div>`;
      return;
    }
    if (!cardOrder || cardOrder.length === 0) cardOrder = P.map(x => x.w);
    if (cardIdx >= cardOrder.length) cardIdx = 0;

    const x = W.find(y => y.w === cardOrder[cardIdx]);
    if (!x) return;

    const rel = [
      x.syn && `<span><b>Đồng nghĩa</b>${esc(x.syn)}</span>`,
      x.ant && `<span><b>Trái nghĩa</b>${esc(x.ant)}</span>`
    ].filter(Boolean).join("");

    $("#view").innerHTML = `
      <div class="row" style="justify-content:space-between">
        <span class="counter">Thẻ ${cardIdx + 1} / ${cardOrder.length}</span>
        <div class="row">
          <button class="speed-toggle-btn" id="speedToggleBtn" title="Tốc độ phát âm">${speechRate === 0.8 ? "0.8x Chậm" : "1.0x Chuẩn"}</button>
          <button class="btn autoplay-btn${isAutoplay ? " is-playing" : ""}" id="autoplayBtn" title="Tự động lật và đọc thẻ">${isAutoplay ? "⏸️ Tạm dừng" : "▶ Tự động"}</button>
          <button class="btn" id="shuf">Trộn thẻ</button>
          <button class="btn" id="say">🔊 Nghe</button>
        </div>
      </div>
      <div class="stage">
        <div class="card${flipped ? " flip" : ""}" id="card" tabindex="0" role="button" aria-label="Lật thẻ">
          <div class="face front">
            <div class="row center">
              <span class="tag">${esc(x.pos)}</span>
              <span class="tag">Bài ${x.p} · ${esc(PASS[x.p] || "")}</span>
              ${weakWords.has(x.w) ? `<span class="tag" style="background:var(--bad-soft);color:var(--bad)">🔥 Hay sai</span>` : ""}
              <button class="star-btn ${starred.has(x.w) ? "is-starred" : ""}" id="cardStarBtn" title="${starred.has(x.w) ? "Bỏ gắn sao" : "Gắn sao từ này"}">${starred.has(x.w) ? "⭐" : "☆"}</button>
            </div>
            <div class="word">${esc(x.w)}</div>
            <div class="ipa">${esc(x.ipa)}</div>
            <div class="hint">Chạm hoặc nhấn Space để lật</div>
          </div>
          <div class="face back">
            <div class="row" style="justify-content:space-between;align-items:center">
              <div class="row">
                <span class="tag">${esc(x.w)}</span>
                <span class="ipa">${esc(x.ipa)}</span>
              </div>
              <button class="star-btn ${starred.has(x.w) ? "is-starred" : ""}" id="cardStarBtnBack" title="${starred.has(x.w) ? "Bỏ gắn sao" : "Gắn sao từ này"}">${starred.has(x.w) ? "⭐" : "☆"}</button>
            </div>
            <div class="vi">${esc(x.vi)}</div>
            ${rel ? `<div class="rel">${rel}</div>` : ""}
            <p class="ex">${filled(x)}</p>
          </div>
        </div>
      </div>
      <div class="row center">
        <button class="btn" id="prev">← Trước</button>
        <button class="btn ${known.has(x.w) ? "known" : ""}" id="know">${known.has(x.w) ? "✓ Đã thuộc" : "Đánh dấu đã thuộc"}</button>
        <button class="btn primary" id="next">Tiếp →</button>
      </div>
      <div class="card-kb-hints" aria-hidden="true">
        <span class="kb-chip">Space: Lật</span>
        <span class="kb-chip">← →: Chuyển thẻ</span>
        <span class="kb-chip">M: Thuộc</span>
        <span class="kb-chip">S: Nghe</span>
      </div>`;

    const go = d => {
      stopAutoplay();
      cardIdx = (cardIdx + d + cardOrder.length) % cardOrder.length;
      flipped = false;
      soundFX.flip();
      renderCards();
    };

    $("#card").onclick = (e) => {
      if (e.target.closest(".star-btn")) return;
      flipped = !flipped;
      soundFX.flip();
      $("#card").classList.toggle("flip", flipped);
    };

    const handleStar = (e) => {
      e.stopPropagation();
      toggleStarred(x.w);
      renderCards();
    };

    const starFront = $("#cardStarBtn");
    const starBack = $("#cardStarBtnBack");
    if (starFront) starFront.onclick = handleStar;
    if (starBack) starBack.onclick = handleStar;

    $("#speedToggleBtn").onclick = () => {
      toggleSpeechRate();
    };

    $("#autoplayBtn").onclick = () => {
      if (isAutoplay) stopAutoplay();
      else startAutoplay();
    };

    $("#prev").onclick = () => go(-1);
    $("#next").onclick = () => go(1);
    $("#know").onclick = () => {
      toggleKnown(x.w);
      if (known.has(x.w)) {
        soundFX.ding();
        removeFromWeak(x.w);
      }
      renderCards();
    };
    $("#say").onclick = () => speak(x.w);
    $("#shuf").onclick = () => {
      stopAutoplay();
      cardOrder = shuffle(cardOrder);
      cardIdx = 0;
      flipped = false;
      renderCards();
    };
  }

  /* --------------------------------------------------------------------------
     7. Question Generators (Quiz & Gap-Fill)
     -------------------------------------------------------------------------- */
  function pick(arr, n, exclude) {
    return shuffle([...new Set(arr)].filter(v => v && !exclude.includes(v))).slice(0, n);
  }

  const kin = w => CLUSTERS.filter(c => c.includes(w)).flat();

  function quizQ(x) {
    const others = W.filter(y => y.w !== x.w && !kin(x.w).includes(y.w));
    const types = ["meaning", "reverse"];
    if (x.syn) types.push("syn", "syn");
    if (x.ant) types.push("ant", "ant");
    const t = types[Math.floor(Math.random() * types.length)];

    if (t === "meaning") {
      return {
        x,
        label: "Nghĩa của từ",
        prompt: `“${x.w}” nghĩa là gì?`,
        ans: x.vi,
        opts: [x.vi, ...pick(others.map(y => y.vi), 3, [x.vi])]
      };
    }
    if (t === "reverse") {
      return {
        x,
        label: "Chọn từ",
        prompt: `Từ nào có nghĩa “${x.vi}”?`,
        ans: x.w,
        opts: [x.w, ...pick(others.map(y => y.w), 3, [x.w])]
      };
    }
    const relPool = others.flatMap(y => [y.syn, y.ant]).filter(Boolean);
    if (t === "syn") {
      return {
        x,
        label: "Đồng nghĩa",
        prompt: `Từ ĐỒNG NGHĨA với “${x.w}”`,
        ans: x.syn,
        opts: [x.syn, ...pick(relPool, 3, [x.w, x.syn, x.ant, ...kin(x.w), ...kin(x.syn)])]
      };
    }
    const ex2 = [x.w, x.ant, x.syn, ...kin(x.ant)];
    const d = x.syn ? [x.syn, ...pick(relPool, 2, ex2)] : pick(relPool, 3, ex2);
    return {
      x,
      label: "Trái nghĩa",
      prompt: `Từ TRÁI NGHĨA với “${x.w}”`,
      ans: x.ant,
      opts: [x.ant, ...d]
    };
  }

  function gapQ(x) {
    const ok = y => y.w !== x.w && !kin(x.w).includes(y.w);
    const same = W.filter(y => ok(y) && posGroup(y.pos) === posGroup(x.pos)).map(y => y.form);
    const any = W.filter(ok).map(y => y.form);
    let d = x.dist ? [...x.dist] : pick(same, 3, [x.form]);
    if (d.length < 3) d = d.concat(pick(any, 3 - d.length, [x.form, ...d]));
    return {
      x,
      label: "Điền từ vào chỗ trống",
      gap: true,
      prompt: esc(x.ex).replace("___", '<span class="blank">______</span>'),
      ans: x.form,
      opts: [x.form, ...d]
    };
  }

  function newSession(kind) {
    const P = shuffle(pool()).slice(0, 10);
    return {
      kind,
      qs: P.map(x => {
        const q = kind === "quiz" ? quizQ(x) : gapQ(x);
        q.opts = shuffle(q.opts);
        return q;
      }),
      i: 0,
      score: 0,
      picked: null,
      miss: [],
      t0: Date.now()
    };
  }

  /* --------------------------------------------------------------------------
     8. Student Information & Session Runner
     -------------------------------------------------------------------------- */
  function whoBar() {
    return `<div class="who">Học sinh: <b>${esc(student.n)}</b> · Lớp <b>${esc(student.c)}</b><button class="linkbtn" id="chg">Đổi tên</button></div>`;
  }

  function studentForm(kind) {
    $("#view").innerHTML = `<div class="q form" id="sf">
      <div><span class="eyebrow">${MODE[kind]} · Bước 1</span><h2 style="font-size:22px;margin-top:4px">Nhập thông tin trước khi làm bài</h2></div>
      <p style="margin:0;color:var(--muted);font-size:14.5px">Làm xong 10 câu, em chụp màn hình phiếu kết quả hoặc bấm sao chép rồi gửi cô qua Zalo.</p>
      <div class="field"><label for="sn">Họ và tên</label><input id="sn" autocomplete="name" placeholder="VD: Nguyễn Thị Lan" maxlength="40"></div>
      <div class="field"><label for="sc">Lớp</label><input id="sc" placeholder="VD: 12A1" maxlength="15"></div>
      <p class="err" id="se" hidden>Em nhập đầy đủ họ tên và lớp nhé.</p>
      <div><button class="btn primary" type="button" id="startBtn">Bắt đầu làm bài</button></div>
    </div>`;

    try {
      $("#sn").focus({ preventScroll: true });
    } catch (e) {}

    const start = () => {
      const n = $("#sn").value.trim().replace(/\s+/g, " ");
      const c = $("#sc").value.trim().toUpperCase();
      if (n.length < 2 || !c) {
        $("#se").hidden = false;
        (n.length < 2 ? $("#sn") : $("#sc")).focus();
        return;
      }
      student = { n, c };
      store.set("cpv-student", student);
      session = null;
      renderSession(kind);
    };

    $("#startBtn").addEventListener("click", start);
    ["#sn", "#sc"].forEach(id => $(id).addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        start();
      }
    }));
  }

  function renderSession(kind) {
    if (!student) return studentForm(kind);
    if (!session || session.kind !== kind) session = newSession(kind);
    const s = session;
    if (s.i >= s.qs.length) return renderScore(kind);
    const q = s.qs[s.i], done = s.picked !== null;
    const letters = "ABCD";

    $("#view").innerHTML = whoBar() + `
      <div class="q">
        <div class="q-top">
          <span class="eyebrow">${q.label} · Bài ${q.x.p}</span>
          <span class="counter">Câu ${s.i + 1}/${s.qs.length} · Đúng ${s.score}</span>
        </div>
        <div class="bar"><i style="width:${(s.i / s.qs.length) * 100}%"></i></div>
        <div class="prompt${q.gap ? " sent" : ""}">${q.gap ? q.prompt : esc(q.prompt)}</div>
        <div class="opts">${q.opts.map((o, i) => {
          let c = "";
          if (done) {
            if (o === q.ans) c = "right";
            else if (o === s.picked) c = "wrong";
          }
          return `<button class="opt ${c}" data-o="${esc(o)}" data-idx="${i}" ${done ? "disabled" : ""} title="Bấm phím số ${i + 1} hoặc phím ${letters[i]} để chọn">
            <span class="k">${letters[i]}</span>
            <span>${esc(o)}</span>
            <span class="k-num">${i + 1}</span>
          </button>`;
        }).join("")}</div>
        ${done ? `<div class="fb"><strong class="${s.picked === q.ans ? "ok" : "no"}">${s.picked === q.ans ? "Chính xác!" : "Chưa đúng."}</strong>
          <b>${esc(q.x.w)}</b> <span class="ipa">${esc(q.x.ipa)}</span> (${esc(q.x.pos)}): ${esc(q.x.vi)}${q.x.syn ? ` · ĐN: ${esc(q.x.syn)}` : ""}${q.x.ant ? ` · TN: ${esc(q.x.ant)}` : ""}
          <p class="ex">${filled(q.x)}</p></div>
          <div class="row" style="justify-content:flex-end"><button class="btn primary" id="nextQ">${s.i + 1 < s.qs.length ? "Câu tiếp (Enter ↵)" : "Xem kết quả (Enter ↵)"}</button></div>` : ""}
        <div class="kb-hints" aria-hidden="true">
          <span class="kb-chip">⌨️ Phím 1-4 / A-D: Chọn</span>
          ${done ? `<span class="kb-chip">Enter ↵: Tiếp tục</span>` : ""}
        </div>
      </div>`;

    document.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      s.picked = b.dataset.o;
      if (s.picked === q.ans) {
        s.score++;
        soundFX.ding();
      } else {
        s.miss.push(q.x);
        markAsWeak(q.x.w);
        soundFX.buzz();
      }
      renderSession(kind);
    });

    if (done) {
      $("#nextQ").onclick = () => {
        s.i++;
        s.picked = null;
        renderSession(kind);
      };
    }
  }

  /* --------------------------------------------------------------------------
     9. Tab 4: Luyện gõ từ vựng (Spelling & Dictation Mode)
     -------------------------------------------------------------------------- */
  function renderSpell() {
    if (!student) return studentForm("spell");

    const P = pool();
    if (P.length === 0) {
      $("#view").innerHTML = `<div class="empty">Không có từ vựng nào trong bộ lọc này.</div>`;
      return;
    }

    if (!session || session.kind !== "spell") {
      const spellPool = shuffle(P).slice(0, 10);
      session = {
        kind: "spell",
        qs: spellPool,
        i: 0,
        score: 0,
        done: false,
        inputVal: "",
        miss: [],
        t0: Date.now()
      };
    }

    const s = session;
    if (s.i >= s.qs.length) return renderScore("spell");

    const x = s.qs[s.i];
    const isDone = s.done;
    const isRight = s.inputVal.trim().toLowerCase() === x.form.trim().toLowerCase() || s.inputVal.trim().toLowerCase() === x.w.trim().toLowerCase();

    $("#view").innerHTML = whoBar() + `
      <div class="spell-box">
        <div class="q-top">
          <span class="eyebrow">Luyện gõ chính tả · Bài ${x.p}</span>
          <span class="counter">Từ ${s.i + 1}/${s.qs.length} · Đúng ${s.score}</span>
        </div>
        <div class="bar"><i style="width:${(s.i / s.qs.length) * 100}%"></i></div>

        <div class="spell-hint-card">
          <div class="row" style="justify-content:space-between">
            <span class="tag">${esc(x.pos)}</span>
            <button class="btn" id="spellVoiceBtn" type="button" style="padding:4px 10px;font-size:13px">🔊 Nghe phát âm</button>
          </div>
          <div style="font-family:var(--display);font-size:22px;font-weight:700">${esc(x.vi)}</div>
          <p class="ex" style="margin:4px 0 0;font-size:14.5px">${filled(x).replace(`<mark>${esc(x.form)}</mark>`, '<span class="blank">______</span>')}</p>
        </div>

        <div class="spell-input-wrap">
          <input class="spell-input ${isDone ? (isRight ? "correct" : "wrong") : ""}"
                 id="spellInput"
                 autocomplete="off"
                 autocapitalize="off"
                 spellcheck="false"
                 placeholder="Gõ từ tiếng Anh vào đây..."
                 value="${esc(s.inputVal)}"
                 ${isDone ? "disabled" : ""}>
          <button class="btn primary" id="spellSubmitBtn" type="button" style="min-width:130px">
            ${isDone ? (s.i + 1 < s.qs.length ? "Tiếp theo →" : "Xem kết quả") : "Kiểm tra ↵"}
          </button>
        </div>

        ${isDone ? `
          <div class="spell-fb">
            <div style="font-weight:700;color:${isRight ? "var(--good)" : "var(--bad)"}">
              ${isRight ? "✓ Hoàn toàn chính xác!" : `✗ Chưa chính xác. Đáp án đúng: “${esc(x.form)}”`}
            </div>
            <div>
              <b>${esc(x.w)}</b> <span class="ipa">${esc(x.ipa)}</span> (${esc(x.pos)}): ${esc(x.vi)}
              ${x.syn ? ` · ĐN: ${esc(x.syn)}` : ""}
            </div>
          </div>
        ` : ""}
      </div>
    `;

    const inputEl = $("#spellInput");
    if (!isDone && inputEl) {
      inputEl.focus();
      // Tự động phát âm khi vừa mở từ
      speak(x.w);
    }

    $("#spellVoiceBtn").onclick = () => speak(x.w);

    const handleCheckOrNext = () => {
      if (!s.done) {
        const val = inputEl.value.trim();
        if (!val) {
          inputEl.focus();
          return;
        }
        s.inputVal = val;
        s.done = true;
        const right = val.toLowerCase() === x.form.toLowerCase() || val.toLowerCase() === x.w.toLowerCase();
        if (right) {
          s.score++;
          soundFX.ding();
          removeFromWeak(x.w);
        } else {
          s.miss.push(x);
          markAsWeak(x.w);
          soundFX.buzz();
        }
        renderSpell();
      } else {
        s.i++;
        s.done = false;
        s.inputVal = "";
        renderSpell();
      }
    };

    $("#spellSubmitBtn").onclick = handleCheckOrNext;

    if (inputEl) {
      inputEl.onkeydown = e => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleCheckOrNext();
        }
      };
    }
  }

  /* --------------------------------------------------------------------------
     10. Phiếu kết quả (Score Ticket) & Báo cáo Zalo
     -------------------------------------------------------------------------- */
  function renderScore(kind) {
    const s = session;
    const pct = Math.round((s.score / s.qs.length) * 100);

    if (!s.o) {
      const attKey = `cpv-att-${currentTopic ? currentTopic.id : "def"}`;
      const att = store.get(attKey, {});
      att[kind] = (att[kind] || 0) + 1;
      store.set(attKey, att);
      s.o = {
        a: att[kind],
        ts: Date.now(),
        d: Math.round((Date.now() - s.t0) / 1000)
      };
    }

    const o = s.o;
    const logoEl = $(".brand-id svg");
    const logo = logoEl ? logoEl.outerHTML : "";
    const msg = pct >= 90 ? "Xuất sắc!" : pct >= 70 ? "Tốt lắm!" : pct >= 50 ? "Khá, cần ôn thêm." : "Cần ôn lại thẻ ghi nhớ.";
    const topicTitle = currentTopic ? currentTopic.title : "Career Paths";

    $("#view").innerHTML = `
      <div class="shot-tip" id="tip"><span aria-hidden="true">📸</span><span>Em chụp màn hình hoặc bấm nút sao chép kết quả gửi Zalo cho cô nhé!</span></div>
      <div class="ticket" id="ticket">
        <div class="ticket-h">${logo}<div><div class="tn">Ms Trâm English Hub</div><div class="tt">Phiếu kết quả · ${esc(topicTitle)}</div></div></div>
        <div class="ticket-b">
          <div><div class="t-name">${esc(student.n)}</div><div class="t-class">Lớp ${esc(student.c)}</div></div>
          <div class="t-score"><span class="big">${s.score}/${s.qs.length}</span><span class="pct">${pct}% · ${msg}</span></div>
          <dl class="t-meta">
            <dt>Chủ đề</dt><dd>${esc(topicTitle)}</dd>
            <dt>Phần</dt><dd>${MODE[kind]} · ${esc(scopeName(filter))}</dd>
            <dt>Lần làm</dt><dd>Lần thứ ${o.a}</dd>
            <dt>Nộp lúc</dt><dd>${fmtTime(o.ts)}</dd>
            <dt>Làm trong</dt><dd>${fmtDur(o.d)}</dd>
          </dl>
          ${s.miss.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Từ làm sai (${s.miss.length})</div><div class="t-miss">${s.miss.map(x => `<span>${esc(x.w)}</span>`).join("")}</div></div>` : `<div class="t-ok">Không sai từ nào 🎉</div>`}
        </div>
      </div>
      ${s.miss.length ? `<ul class="miss" style="max-width:440px;margin:0 auto">${s.miss.map(x => `<li><b>${esc(x.w)}</b>: ${esc(x.vi)}</li>`).join("")}</ul>` : ""}
      <div class="row center">
        <button class="btn primary" id="again">Làm bộ câu mới</button>
        <button class="btn secondary" id="copyZaloBtn">📋 Sao chép kết quả gửi Zalo</button>
        ${s.miss.length ? `<button class="btn" id="markReview">Ôn các từ sai bằng thẻ</button>` : ""}
      </div>`;

    try {
      $("#tip").scrollIntoView({ block: "start" });
    } catch (e) {}

    // Xử lý sao chép Zalo
    $("#copyZaloBtn").onclick = () => {
      const missText = s.miss.length ? s.miss.map(m => m.w).join(", ") : "Không có (Đúng 100%)";
      const zaloMessage = `📝 BÁO CÁO KẾT QUẢ ÔN TẬP
Học sinh: ${student.n} - Lớp: ${student.c}
Chuyên đề: ${topicTitle}
Phần: ${MODE[kind]} (${scopeName(filter)})
Kết quả: ${s.score}/${s.qs.length} (${pct}%) - ${msg}
Lần làm: Lần thứ ${o.a} | Thời gian: ${fmtDur(o.d)}
Từ làm sai: ${missText}
(Ms Trâm English Hub · Hotline: 0898 123 696 · Zalo: 0792 951 529 · Tiếng Anh cho mọi lứa tuổi)`;

      navigator.clipboard.writeText(zaloMessage).then(() => {
        const btn = $("#copyZaloBtn");
        btn.textContent = "✓ Đã sao chép! Em dán gửi cô nhé";
        btn.style.borderColor = "var(--good)";
        btn.style.color = "var(--good)";
        setTimeout(() => {
          btn.textContent = "📋 Sao chép kết quả gửi Zalo";
          btn.style.borderColor = "";
          btn.style.color = "";
        }, 3000);
      }).catch(() => {
        alert("Không thể sao chép tự động, em chụp màn hình phiếu kết quả gửi cô nhé!");
      });
    };

    $("#again").onclick = () => {
      session = null;
      if (kind === "spell") renderSpell();
      else renderSession(kind);
    };

    if (s.miss.length) {
      $("#markReview").onclick = () => {
        cardOrder = s.miss.map(x => x.w);
        cardIdx = 0;
        flipped = false;
        tab = "cards";
        session = null;
        render();
      };
    }
  }

  const renderQuiz = () => renderSession("quiz");
  const renderGap = () => renderSession("gap");

  /* --------------------------------------------------------------------------
     11. Tab 5: Mini-game Ghép từ phản xạ (Speed Match Pairs)
     -------------------------------------------------------------------------- */
  function newMatchGame() {
    const P = pool();
    const words = shuffle(P).slice(0, 5); // 5 từ 1 lượt chơi
    if (words.length < 2) return null;

    const tiles = shuffle([
      ...words.map(w => ({ id: w.w, type: 'en', text: w.w })),
      ...words.map(w => ({ id: w.w, type: 'vi', text: w.vi }))
    ]);

    return {
      words,
      tiles,
      firstPick: null,
      matched: new Set(),
      mistakes: 0,
      t0: Date.now(),
      elapsed: 0,
      isFinished: false
    };
  }

  function renderMatch() {
    stopAutoplay();
    if (!matchSession || matchSession.isFinished) {
      matchSession = newMatchGame();
    }
    const ms = matchSession;
    if (!ms) {
      $("#view").innerHTML = `<div class="empty">Không đủ từ vựng trong bộ lọc này để chơi ghép từ (Cần tối thiểu 2 từ).</div>`;
      return;
    }

    if (ms.isFinished) {
      const sec = (ms.elapsed / 1000).toFixed(1);
      $("#view").innerHTML = `
        <div class="match-win">
          <div style="font-size:48px;line-height:1">🎉</div>
          <h2 style="font-size:24px;margin:10px 0 6px">Xuất sắc! Đã ghép đúng tất cả các cặp</h2>
          <p style="color:var(--muted);margin:0;font-size:15px">Thời gian hoàn thành: <b>${sec} giây</b> · Lỗi bấm nhầm: <b>${ms.mistakes}</b></p>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:18px;flex-wrap:wrap">
            <button class="btn primary" id="matchNextBtn">Chơi lượt tiếp theo ⚡</button>
            <button class="btn" id="matchReplayBtn">Chơi lại bộ này</button>
          </div>
        </div>`;

      $("#matchNextBtn").onclick = () => {
        matchSession = newMatchGame();
        renderMatch();
      };
      $("#matchReplayBtn").onclick = () => {
        ms.matched.clear();
        ms.firstPick = null;
        ms.mistakes = 0;
        ms.t0 = Date.now();
        ms.isFinished = false;
        renderMatch();
      };
      return;
    }

    $("#view").innerHTML = `
      <div class="match-hud">
        <div class="match-stat">
          <span class="eyebrow">Tiến độ ghép</span>
          <b id="matchCountEl">${ms.matched.size} / ${ms.words.length} cặp</b>
        </div>
        <div class="match-stat">
          <span class="eyebrow">Thời gian</span>
          <b id="matchTimerEl">${((Date.now() - ms.t0) / 1000).toFixed(1)}s</b>
        </div>
        <button class="btn" id="matchShuffleBtn" style="padding:6px 14px;font-size:13px">Trộn thẻ</button>
      </div>

      <p class="match-hint" style="text-align:center;font-size:13.5px;color:var(--muted);margin:0">
        Chạm 1 thẻ tiếng Anh và 1 thẻ nghĩa tiếng Việt tương ứng để ghép đôi.
      </p>

      <div class="match-grid" id="matchGrid">
        ${ms.tiles.map((tile, idx) => {
          const isMatched = ms.matched.has(tile.id);
          const isSelected = ms.firstPick && ms.firstPick.idx === idx;
          return `
            <button class="match-card${isMatched ? ' is-matched' : ''}${isSelected ? ' is-selected' : ''}"
                    data-idx="${idx}"
                    data-id="${esc(tile.id)}"
                    data-type="${tile.type}"
                    ${isMatched ? 'disabled' : ''}>
              ${tile.type === 'en' ? `<span class="match-w">${esc(tile.text)}</span>` : `<span class="match-vi">${esc(tile.text)}</span>`}
            </button>
          `;
        }).join("")}
      </div>
    `;

    clearInterval(matchTimer);
    matchTimer = setInterval(() => {
      const el = $("#matchTimerEl");
      if (el && !ms.isFinished) {
        el.textContent = `${((Date.now() - ms.t0) / 1000).toFixed(1)}s`;
      } else {
        clearInterval(matchTimer);
      }
    }, 100);

    $("#matchShuffleBtn").onclick = () => {
      ms.tiles = shuffle(ms.tiles);
      renderMatch();
    };

    $("#matchGrid").onclick = e => {
      const btn = e.target.closest(".match-card");
      if (!btn || btn.disabled || btn.classList.contains("is-matched")) return;
      const idx = parseInt(btn.dataset.idx, 10);
      const tile = ms.tiles[idx];

      if (!ms.firstPick) {
        ms.firstPick = { idx, tile, el: btn };
        btn.classList.add("is-selected");
        if (tile.type === 'en') speak(tile.id);
        return;
      }

      if (ms.firstPick.idx === idx) {
        btn.classList.remove("is-selected");
        ms.firstPick = null;
        return;
      }

      if (ms.firstPick.tile.type === tile.type) {
        ms.firstPick.el.classList.remove("is-selected");
        ms.firstPick = { idx, tile, el: btn };
        btn.classList.add("is-selected");
        if (tile.type === 'en') speak(tile.id);
        return;
      }

      const pick1 = ms.firstPick;
      const pick2 = { idx, tile, el: btn };
      btn.classList.add("is-selected");

      if (pick1.tile.id === pick2.tile.id) {
        ms.matched.add(tile.id);
        ms.firstPick = null;
        soundFX.ding();
        pick1.el.classList.remove("is-selected");
        pick2.el.classList.remove("is-selected");
        pick1.el.classList.add("is-matched");
        pick2.el.classList.add("is-matched");
        pick1.el.disabled = true;
        pick2.el.disabled = true;

        if (tile.type === 'vi') speak(tile.id);

        if (ms.matched.size === ms.words.length) {
          ms.isFinished = true;
          ms.elapsed = Date.now() - ms.t0;
          clearInterval(matchTimer);
          setTimeout(() => renderMatch(), 400);
        } else {
          const countEl = $("#matchCountEl");
          if (countEl) countEl.textContent = `${ms.matched.size} / ${ms.words.length} cặp`;
        }
      } else {
        ms.mistakes++;
        soundFX.buzz();
        pick1.el.classList.add("is-wrong");
        pick2.el.classList.add("is-wrong");
        setTimeout(() => {
          pick1.el.classList.remove("is-selected", "is-wrong");
          pick2.el.classList.remove("is-selected", "is-wrong");
          ms.firstPick = null;
        }, 500);
      }
    };
  }

  /* --------------------------------------------------------------------------
     12. Tab 6: Danh sách từ vựng & Tìm kiếm & In ấn
     -------------------------------------------------------------------------- */
  function renderList() {
    stopAutoplay();
    $("#view").innerHTML = `
      <div class="print-header" style="display:none">
        <h1>Ms Trâm English Hub · Bảng Từ Vựng Ôn Thi THPTQG</h1>
        <p>Chuyên đề: ${esc(currentTopic ? currentTopic.title : "")} · Hotline: 0898 123 696 · Zalo: 0792 951 529 · Facebook: fb.com/mstramengclass</p>
      </div>
      <div class="row" style="justify-content:space-between;gap:10px">
        <input class="search" id="search" type="search" placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt…" value="${esc(q)}" style="flex:1">
        <div class="row">
          <button class="speed-toggle-btn" id="listSpeedBtn" title="Tốc độ phát âm">${speechRate === 0.8 ? "0.8x Chậm" : "1.0x Chuẩn"}</button>
          <button class="btn secondary" id="printListBtn" title="In hoặc lưu file PDF">🖨️ In / Lưu PDF</button>
        </div>
      </div>
      <div class="list" id="items"></div>`;

    const draw = () => {
      const t = q.trim().toLowerCase();
      const P = pool().filter(x => !t || x.w.includes(t) || x.vi.toLowerCase().includes(t));
      $("#items").innerHTML = P.length ? P.map(x => `
        <article class="item${known.has(x.w) ? " is-known" : ""}">
          <div class="item-h">
            <div class="row" style="gap:6px;align-items:center">
              <h3>${esc(x.w)}</h3>
              <button class="star-btn ${starred.has(x.w) ? "is-starred" : ""}" data-star="${esc(x.w)}" title="${starred.has(x.w) ? "Bỏ gắn sao" : "Gắn sao từ này"}">${starred.has(x.w) ? "⭐" : "☆"}</button>
            </div>
            <button class="tick" data-w="${esc(x.w)}" aria-pressed="${known.has(x.w)}">${known.has(x.w) ? "✓ Đã thuộc" : "Đã thuộc?"}</button>
          </div>
          <div class="row">
            <span class="tag">${esc(x.pos)}</span>
            <span class="ipa">${esc(x.ipa)}</span>
            <button class="icon-btn" data-say="${esc(x.w)}" aria-label="Nghe ${esc(x.w)}">🔊</button>
            <span class="tag">Bài ${x.p}</span>
            ${weakWords.has(x.w) ? `<span class="tag" style="background:var(--bad-soft);color:var(--bad)">🔥 Hay sai</span>` : ""}
          </div>
          <div class="vi">${esc(x.vi)}</div>
          ${x.syn || x.ant ? `<div class="rel">${x.syn ? `<span><b>ĐN</b>${esc(x.syn)}</span>` : ""}${x.ant ? `<span><b>TN</b>${esc(x.ant)}</span>` : ""}</div>` : ""}
          <p class="ex" style="font-size:14px">${filled(x)}</p>
        </article>`).join("") : `<div class="empty">Không tìm thấy từ nào khớp với “${esc(q)}”.</div>`;
    };

    draw();

    $("#search").oninput = e => {
      q = e.target.value;
      draw();
    };

    $("#listSpeedBtn").onclick = () => {
      toggleSpeechRate();
    };

    $("#printListBtn").onclick = () => {
      window.print();
    };

    $("#items").onclick = e => {
      const star = e.target.closest("[data-star]");
      if (star) {
        toggleStarred(star.dataset.star);
        draw();
        return;
      }
      const t = e.target.closest(".tick");
      if (t) {
        toggleKnown(t.dataset.w);
        if (known.has(t.dataset.w)) {
          soundFX.ding();
          removeFromWeak(t.dataset.w);
        }
        draw();
        return;
      }
      const s = e.target.closest("[data-say]");
      if (s) speak(s.dataset.say);
    };
  }

  /* --------------------------------------------------------------------------
     12. Global Event Listeners & Keyboard Shortcuts
     -------------------------------------------------------------------------- */
  document.addEventListener("keydown", e => {
    // Không bắt phím khi đang nhập liệu trong ô input
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
      return;
    }

    // Không can thiệp nếu modal đang mở
    const topicModal = $("#topicModal");
    const mapModal = $("#mapModal");
    if ((topicModal && topicModal.open) || (mapModal && mapModal.open)) {
      return;
    }

    const key = e.key;

    // 1. Chế độ Thẻ ghi nhớ (Flashcards)
    if (tab === "cards") {
      if (key === " ") {
        e.preventDefault();
        $("#card")?.click();
      } else if (key === "ArrowRight" || key === "Enter") {
        e.preventDefault();
        $("#next")?.click();
      } else if (key === "ArrowLeft") {
        e.preventDefault();
        $("#prev")?.click();
      } else if (key === "m" || key === "M") {
        e.preventDefault();
        $("#know")?.click();
      } else if (key === "s" || key === "S") {
        e.preventDefault();
        $("#say")?.click();
      } else if (key === "r" || key === "R") {
        e.preventDefault();
        $("#shuf")?.click();
      }
    }

    // 2. Chế độ Trắc nghiệm (Quiz) & Điền từ (Gap)
    else if ((tab === "quiz" || tab === "gap") && session) {
      const isDone = session.picked !== null;

      // Khi kết thúc phiên và hiển thị phiếu điểm
      if (session.i >= session.qs.length) {
        if (key === "Enter") {
          e.preventDefault();
          $("#again")?.click();
        }
        return;
      }

      // Khi đã chọn đáp án: Nhấn Enter hoặc Space để qua câu tiếp theo
      if (isDone) {
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          $("#nextQ")?.click();
        }
      } else {
        // Nhấn 1, 2, 3, 4 hoặc A, B, C, D để chọn phương án
        let optIdx = -1;
        if (key === "1" || key.toLowerCase() === "a") optIdx = 0;
        else if (key === "2" || key.toLowerCase() === "b") optIdx = 1;
        else if (key === "3" || key.toLowerCase() === "c") optIdx = 2;
        else if (key === "4" || key.toLowerCase() === "d") optIdx = 3;

        if (optIdx >= 0) {
          const opts = document.querySelectorAll(".opt");
          if (opts[optIdx] && !opts[optIdx].disabled) {
            e.preventDefault();
            opts[optIdx].click();
          }
        }
      }
    }
  });

  document.addEventListener("click", e => {
    const copyTarget = e.target.closest("[data-copy]");
    if (copyTarget) {
      e.preventDefault();
      const val = copyTarget.getAttribute("data-copy");
      const label = copyTarget.getAttribute("data-label") || "thông tin";
      copyToClipboard(val, label);
      return;
    }

    if (e.target.id === "chg") {
      student = null;
      store.set("cpv-student", null);
      session = null;
      render();
    }
  });

  $("#chips").addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    filter = b.dataset.f;
    cardOrder = null;
    cardIdx = 0;
    session = null;
    drawChips();
    render();
  });

  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest(".tab");
    if (!b) return;
    stopAutoplay();
    tab = b.dataset.tab;
    store.set("cpv-tab", tab);
    session = null;
    render();
  });

  const soundBtn = $("#soundToggle");
  if (soundBtn) {
    soundBtn.onclick = () => {
      isMuted = !isMuted;
      store.set("cpv-muted", isMuted);
      updateSoundButton();
      if (!isMuted) soundFX.ding();
    };
  }

  /* --------------------------------------------------------------------------
     14. Initialization
     -------------------------------------------------------------------------- */
  function init() {
    if (!["cards", "quiz", "gap", "spell", "match", "list"].includes(tab)) tab = "cards";
    initTheme();
    updateTopicHeader();
    updateSoundButton();
    initTopicModal();
    initMapModal();
    initStatsModal();
    drawLadder();
    drawChips();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
