const CHANNEL =
  document.body?.dataset?.channel ||
  (window.location.pathname.includes("2") ? "2" : "1");
const socket = io({ query: { channel: CHANNEL } });
const overlayStage = document.querySelector("#overlayStage");
const el = document.querySelector("#lowerThird");
const cornerLogo = document.querySelector("#cornerLogo");
const cornerLogoImage = document.querySelector("#cornerLogoImage");
const orgLogo = document.querySelector("#orgLogo");
const timerOverlay = document.querySelector("#timerOverlay");
const timerRingProgress = document.querySelector("#timerRingProgress");
const timerDigits = document.querySelector("#timerDigits");
const timerSublabel = document.querySelector("#timerSublabel");
const timerStatusBadge = document.querySelector("#timerStatusBadge");
const RING_CIRC = 779.115;

let initialized = false;
let currentState = {};

function isBroadcastEnvironment() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("guide") === "1") return false;
  if (
    params.get("guide") === "0" ||
    params.get("vmix") === "1" ||
    params.get("live") === "1"
  ) {
    return true;
  }
  if (window.obsstudio || window.vmix) return true;
  const ua = navigator.userAgent || "";
  if (/obs|vmix|cefsharp/i.test(ua)) return true;
  // Broadcast sources (vMix / OBS CEF) have no browser toolbar/address bar
  const chromeUiHeight = (window.outerHeight || 0) - (window.innerHeight || 0);
  const w = window.innerWidth || 1920;
  const h = window.innerHeight || 1080;
  const isExact16by9 = Math.abs(w / h - 16 / 9) < 0.015;
  if (chromeUiHeight <= 5 && isExact16by9) return true;
  return false;
}

function applyStageScale() {
  if (overlayStage) {
    overlayStage.classList.toggle("preview-guide", !isBroadcastEnvironment());
  }
  const rect = overlayStage
    ? overlayStage.getBoundingClientRect()
    : { width: window.innerWidth || 1920, height: window.innerHeight || 1080 };
  const w = rect.width || window.innerWidth || 1920;
  const h = rect.height || window.innerHeight || 1080;
  const scale = Math.min(w / 1920, h / 1080) || 1;
  document.documentElement.style.setProperty("--stage-scale", scale.toFixed(4));
}

const VALID_TIMER_POSITIONS = [
  "top-left",
  "bottom-left",
  "center",
  "top-right",
  "bottom-right",
];

function renderTimerTick() {
  if (!timerOverlay) return;
  const liveOn = currentState.liveEnabled !== false;
  const t = currentState.timer || {
    visible: false,
    mode: "countdown",
    position: "center",
    showBg: true,
    durationSec: 600,
    baseSec: 600,
    running: false,
    startedAt: null,
  };
  const pos = VALID_TIMER_POSITIONS.includes(t.position) ? t.position : "center";
  if (timerOverlay.dataset.pos !== pos) {
    timerOverlay.dataset.pos = pos;
  }
  const showBg = t.showBg !== undefined ? Boolean(t.showBg) : true;
  timerOverlay.classList.toggle("has-bg", showBg);
  timerOverlay.classList.toggle("hidden", !liveOn || !t.visible);

  const deltaSec =
    t.running && t.startedAt ? Math.max(0, (Date.now() - t.startedAt) / 1000) : 0;

  let currentSec = 0;
  if (t.mode === "stopwatch") {
    currentSec = Math.max(0, (Number(t.baseSec) || 0) + deltaSec);
  } else {
    const base =
      t.baseSec !== undefined && t.baseSec !== null
        ? Math.max(0, Number(t.baseSec))
        : Math.max(1, Number(t.durationSec) || 600);
    currentSec = Math.max(0, base - deltaSec);
  }
  let displaySec = 0;
  let progress = 1;
  let finished = false;

  if (t.mode === "clock") {
    const d = new Date();
    displaySec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    progress = d.getSeconds() / 60;
    if (timerSublabel) timerSublabel.textContent = "LOCAL TIME";
  } else if (t.mode === "stopwatch") {
    displaySec = Math.floor(currentSec);
    progress = currentSec === 0 ? 0 : (currentSec % 60) / 60;
    if (timerSublabel) timerSublabel.textContent = "ELAPSED";
  } else {
    const duration = Math.max(1, t.durationSec || 600);
    displaySec = t.running ? Math.ceil(currentSec) : Math.round(currentSec);
    progress = Math.max(0, Math.min(1, currentSec / duration));
    finished = currentSec <= 0;
    if (timerSublabel) timerSublabel.textContent = "REMAINING";
  }
  const mins = Math.floor(displaySec / 60);
  const secs = displaySec % 60;
  if (timerDigits) {
    if (t.mode === "clock" && t.clockType === "digital") {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const timeKey = `${hh}:${mm}`;
      if (timerDigits.dataset.currentTime !== timeKey) {
        timerDigits.dataset.currentTime = timeKey;
        timerDigits.innerHTML = `<div class="flip-block">${hh}</div><div class="flip-block">${mm}</div>`;
      }
    } else {
      delete timerDigits.dataset.currentTime;
      if (t.mode === "clock") {
        const d = new Date();
        timerDigits.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      } else {
        const mins = Math.floor(displaySec / 60);
        const secs = displaySec % 60;
        timerDigits.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
    }
  }
  if (timerRingProgress) {
    timerRingProgress.style.strokeDashoffset = (RING_CIRC * (1 - progress)).toFixed(2);
  }
  timerOverlay.classList.toggle("finished", Boolean(finished && t.mode === "countdown"));

  const effectivelyRunning = Boolean(t.running && !finished);
  if (timerStatusBadge) {
    const wantMode = effectivelyRunning ? "running" : "paused";
    if (timerStatusBadge.dataset.mode !== wantMode) {
      timerStatusBadge.dataset.mode = wantMode;
      timerStatusBadge.innerHTML = effectivelyRunning
        ? `<span class="timer-pause-bars"><span></span><span></span></span>`
        : `<span class="timer-play-triangle"></span>`;
    }
    
    const analogClock = document.querySelector("#analogClock");
    if (analogClock) {
      const isAnalog = t.mode === "clock" && t.clockType !== "digital";
      analogClock.classList.toggle("hidden", !isAnalog);
      if (timerDigits) timerDigits.style.display = isAnalog ? "none" : "";
      if (timerSublabel) timerSublabel.style.display = isAnalog ? "none" : "";
      
      if (isAnalog) {
        const d = new Date();
        const hr = d.getHours() % 12;
        const min = d.getMinutes();
        const sec = d.getSeconds();
        const ms = d.getMilliseconds();
        const hrDeg = (hr + min / 60) * 30;
        const minDeg = (min + sec / 60) * 6;
        const secDeg = (sec + ms / 1000) * 6;
        
        const hHand = document.querySelector("#hourHand");
        const mHand = document.querySelector("#minHand");
        const sHand = document.querySelector("#secondHand");
        if (hHand) hHand.style.transform = `translateX(-50%) rotate(${hrDeg}deg)`;
        if (mHand) mHand.style.transform = `translateX(-50%) rotate(${minDeg}deg)`;
        if (sHand) sHand.style.transform = `translateX(-50%) rotate(${secDeg}deg)`;
      }
    }
  }
}

function paint(s) {
  currentState = s || {};
  const liveOn = s.liveEnabled !== false;
  document.querySelector("#name").textContent = s.name;
  document.querySelector("#role").textContent = s.role;
  if (s.organizationLogo) {
    orgLogo.src = s.organizationLogo;
    orgLogo.style.display = "block";
  } else {
    orgLogo.removeAttribute("src");
    orgLogo.style.display = "none";
  }
  const qaOverlay = document.querySelector("#qaOverlay");
  const qaText = document.querySelector("#qaText");
  if (qaOverlay && qaText) {
    const isQaVisible = liveOn && s.qaVisible;
    qaOverlay.classList.toggle("hidden", !isQaVisible);
    
    if (s.qaList && s.activeQa) {
      const q = s.qaList.find(item => item.id === s.activeQa);
      if (q) {
        qaText.textContent = q.question;
      }
    }
    
    if (initialized) {
      qaOverlay.classList.remove("no-transition");
    }
  }

  el.classList.toggle("hidden", !liveOn || !s.visible);
  const defaultAccent =
    s.theme === "pink" ? "#ff4ca0" : s.theme === "lime" ? "#b9ff70" : "#42e8e0";
  document.documentElement.style.setProperty("--org-bg", s.orgBlockColor || "#dce5fc");
  document.documentElement.style.setProperty("--cyan", s.accentColor || defaultAccent);
  document.documentElement.style.setProperty("--content-bg", s.contentColor || "#1b2238");
  const orgBlock = document.querySelector(".organization-block");
  if (orgBlock) {
    orgBlock.style.borderRadius = "0px";
  }
  if (s.customLogo) {
    cornerLogoImage.src = s.customLogo;
    cornerLogoImage.style.display = "block";
  }
  cornerLogo.classList.toggle("hidden", !liveOn || s.cornerLogo === "none" || !s.customLogo);
  const pos = s.cornerLogoPosition === "left" ? "left" : "right";
  cornerLogo.classList.toggle("pos-left", pos === "left");
  cornerLogo.classList.toggle("pos-right", pos === "right");
  renderTimerTick();
  applyStageScale();
  if (!initialized) {
    initialized = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.classList.remove("no-transition");
        if (timerOverlay) timerOverlay.classList.remove("no-transition");
        cornerLogo.style.transition = "";
      })
    );
  } else if (liveOn && s.visible) {
    const currentIdentifier = `${s.activeMode || ""}-${s.activeProfile || ""}-${s.activeProject || ""}-${s.name || ""}`;
    if (lastOverlayIdentifier !== null && lastOverlayIdentifier !== currentIdentifier) {
      replay();
    }
    lastOverlayIdentifier = currentIdentifier;
  } else {
    lastOverlayIdentifier = `${s.activeMode || ""}-${s.activeProfile || ""}-${s.activeProject || ""}-${s.name || ""}`;
  }
}

let lastOverlayIdentifier = null;
let replayTimer = null;
let lastReplayTime = 0;

function replay() {
  const now = Date.now();
  if (now - lastReplayTime < 250) return;
  lastReplayTime = now;
  el.classList.remove("replay");
  void el.offsetWidth;
  el.classList.add("replay");
  clearTimeout(replayTimer);
  replayTimer = setTimeout(() => el.classList.remove("replay"), 1620);
}

window.addEventListener("resize", applyStageScale);
applyStageScale();
setInterval(renderTimerTick, 100);
setInterval(() => {
  fetch("/ping").catch(() => {});
}, 240000);
socket.on("overlay:state", paint);
socket.on("overlay:trigger", ({ type }) => {
  if (type === "reload") {
    window.location.reload();
    return;
  }
  if (type === "replay" && currentState.liveEnabled !== false) {
    replay();
  }
});






document.querySelectorAll('.clock-face').forEach(function(face) { 
  if(face.querySelector('.clock-number')) return; 
  for(var i=1; i<=12; i++) { 
    var n = document.createElement('div'); 
    n.className = 'clock-number num-' + i; 
    n.innerHTML = '<span>' + i + '</span>'; 
    face.appendChild(n); 
  } 
});
function updateClockModes() {
  document.querySelectorAll('.timer-overlay, #previewTimerOverlay').forEach(function(el) {
    var t = typeof currentState !== 'undefined' ? currentState.timer : (typeof getTimerState === 'function' ? getTimerState() : null);
    if(t) {
      var isClock = t.mode === 'clock';
      var isDigitalClock = isClock && t.clockType === 'digital';
      var isAnalogClock = isClock && t.clockType !== 'digital';
      el.classList.toggle('digital-clock-mode', isDigitalClock);
      el.classList.toggle('analog-clock-mode', isAnalogClock);
    }
  });
}
setInterval(updateClockModes, 200);

// --- Floating Emoji Reactions (Livestream style) ---
const EMOJI_SVGS = {
  like: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#1877F2"/><path d="M10 17C10 16.2 10.7 15.5 11.5 15.5H13.5C14.3 15.5 15 16.2 15 17V26C15 26.8 14.3 27.5 13.5 27.5H11.5C10.7 27.5 10 26.8 10 26V17ZM16.5 27C17.5 27 19.5 27.5 21.5 27.5C24.5 27.5 25.8 26 25.8 23.5C25.8 22.8 25.5 22.1 25.1 21.5C25.8 20.8 26.2 19.8 26.2 18.8C26.2 18 25.9 17.2 25.4 16.6C25.7 15.9 25.7 15 25.1 14.3C24.3 13.5 23.2 13.5 21.7 13.5H19.5C19.8 12.5 20.5 10 20.5 8.5C20.5 7 19.5 6 18.2 6C17.2 6 16.8 6.8 16.6 7.6L16.2 11.2C15.9 13.8 14.2 15.8 13.5 16.5L16.5 17.5V27Z" fill="#FFFFFF"/></svg>`,
  heart: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#FA3E3E"/><path d="M18 27.5L16.2 25.8C9.8 20 5.5 16.1 5.5 11.3C5.5 7.4 8.5 4.5 12.4 4.5C14.6 4.5 16.7 5.5 18 7.1C19.3 5.5 21.4 4.5 23.6 4.5C27.5 4.5 30.5 7.4 30.5 11.3C30.5 16.1 26.2 20 19.8 25.8L18 27.5Z" fill="#FFFFFF"/></svg>`,
  love: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#F7B125"/><path d="M7 11C7 8.8 8.8 7 11 7C12.3 7 13.6 7.6 14.7 8.7C15.8 7.6 17.1 7 18.4 7C20.6 7 22.4 8.8 22.4 11C22.4 13.9 19.8 16.3 15.8 19.9L14.7 20.9L13.6 19.9C9.6 16.3 7 13.9 7 11Z" fill="#E0245E" transform="scale(0.58) translate(-1, 5)"/><path d="M7 11C7 8.8 8.8 7 11 7C12.3 7 13.6 7.6 14.7 8.7C15.8 7.6 17.1 7 18.4 7C20.6 7 22.4 8.8 22.4 11C22.4 13.9 19.8 16.3 15.8 19.9L14.7 20.9L13.6 19.9C9.6 16.3 7 13.9 7 11Z" fill="#E0245E" transform="scale(0.58) translate(22, 5)"/><path d="M9.5 21C9.5 26 13.3 29.5 18 29.5C22.7 29.5 26.5 26 26.5 21H9.5Z" fill="#583100"/><path d="M12.5 21C12.8 24.5 15.2 27 18 27C20.8 27 23.2 24.5 23.5 21H12.5Z" fill="#E0245E"/></svg>`,
  laugh: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#F7B125"/><path d="M8 14.5C9.5 12 12.5 12 14 14.5" stroke="#583100" stroke-width="2.2" stroke-linecap="round"/><path d="M22 14.5C23.5 12 26.5 12 28 14.5" stroke="#583100" stroke-width="2.2" stroke-linecap="round"/><path d="M9 19.5C9 26 13 29.5 18 29.5C23 29.5 27 26 27 19.5H9Z" fill="#583100"/><path d="M12 19.5C12.5 23.5 15 26 18 26C21 26 23.5 23.5 24 19.5H12Z" fill="#E0245E"/><path d="M9 19.5H27C27 21 25 22 18 22C11 22 9 21 9 19.5Z" fill="#FFFFFF"/><path d="M4.5 17C4.5 17 7 19.5 7 21.5C7 22.9 5.9 24 4.5 24C3.1 24 2 22.9 2 21.5C2 19.5 4.5 17 4.5 17Z" fill="#29B6F6"/><path d="M31.5 17C31.5 17 29 19.5 29 21.5C29 22.9 30.1 24 31.5 24C32.9 24 34 22.9 34 21.5C34 19.5 31.5 17 31.5 17Z" fill="#29B6F6"/></svg>`,
  party: `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="18" fill="#FFFFFF"/><path d="M7 29L13 13L25 25L7 29Z" fill="#F7B125"/><path d="M13 13L16 16L10 22L7 29L13 13Z" fill="#FA3E3E"/><path d="M13 13L25 25" stroke="#D97706" stroke-width="1.5"/><circle cx="26" cy="9" r="2.2" fill="#FA3E3E"/><circle cx="21" cy="7" r="1.8" fill="#29B6F6"/><circle cx="30" cy="15" r="2" fill="#10B981"/><circle cx="27" cy="21" r="1.8" fill="#8B5CF6"/><circle cx="15" cy="6" r="1.5" fill="#F59E0B"/><path d="M19 12C22 10 25 13 28 11" stroke="#FA3E3E" stroke-width="1.8" stroke-linecap="round"/><path d="M22 17C25 16 27 19 30 18" stroke="#29B6F6" stroke-width="1.8" stroke-linecap="round"/></svg>`
};

const MAX_ACTIVE_EMOJIS = 45;

function spawnFloatingEmoji(type, container, side, size) {
  if (!container) return;
  const svgHtml = EMOJI_SVGS[type];
  if (!svgHtml) return;

  while (container.children.length >= MAX_ACTIVE_EMOJIS) {
    if (container.firstElementChild) {
      container.firstElementChild.remove();
    } else break;
  }

  const el = document.createElement("div");
  el.className = "floating-emoji";
  el.innerHTML = svgHtml;

  // Set randomized emoji size (46px - 80px)
  const chosenSize = size || Math.floor(46 + Math.random() * 34);
  el.style.setProperty("--emoji-size", chosenSize + "px");

  // Assign side: randomly 'left' or 'right' if not specified
  const chosenSide = (side === "left" || side === "right") ? side : (Math.random() < 0.5 ? "left" : "right");
  el.classList.add(chosenSide === "left" ? "side-left" : "side-right");

  // Smooth gentle trajectory variables for natural medium speed
  const startXNum = Math.random() * 60 - 30;
  const startX = startXNum.toFixed(1) + "px";
  const d1 = (startXNum + (Math.random() * 16 - 8)).toFixed(1) + "px";
  const d2 = (startXNum + (Math.random() * 20 - 10)).toFixed(1) + "px";
  const d3 = (startXNum + (Math.random() * 24 - 12)).toFixed(1) + "px";
  const d4 = (startXNum + (Math.random() * 28 - 14)).toFixed(1) + "px";
  const rotStart = (Math.random() * 10 - 5).toFixed(1) + "deg";
  const rotMid = (Math.random() * 12 - 6).toFixed(1) + "deg";
  const rotEnd = (Math.random() * 14 - 7).toFixed(1) + "deg";

  el.style.setProperty("--start-x", startX);
  el.style.setProperty("--drift-1", d1);
  el.style.setProperty("--drift-2", d2);
  el.style.setProperty("--drift-3", d3);
  el.style.setProperty("--drift-4", d4);
  el.style.setProperty("--rot-start", rotStart);
  el.style.setProperty("--rot-mid", rotMid);
  el.style.setProperty("--rot-end", rotEnd);

  const duration = (2.4 + Math.random() * 0.2).toFixed(2) + "s";
  el.style.animationDuration = duration;

  let cleaned = false;
  const cleanUp = () => {
    if (cleaned) return;
    cleaned = true;
    el.remove();
  };

  el.addEventListener("animationend", cleanUp, { once: true });
  setTimeout(cleanUp, 3200);

  container.appendChild(el);
}

socket.on("overlay:emoji", (payload) => {
  if (!payload) return;
  let list = [];
  if (Array.isArray(payload.items)) {
    list = payload.items;
  } else if (Array.isArray(payload.emojis)) {
    list = payload.emojis.map((t) => typeof t === "object" ? t : { type: t, side: payload.side, size: payload.size });
  } else if (payload.type || payload.emoji) {
    list = [{ type: payload.type || payload.emoji, side: payload.side, size: payload.size }];
  }
  if (!list.length) return;

  const container = document.querySelector("#emojiStream");
  if (!container) return;

  list.forEach((item, idx) => {
    const emojiType = typeof item === "string" ? item : item.type;
    const emojiSide = typeof item === "object" ? item.side : payload.side;
    const emojiSize = typeof item === "object" ? item.size : payload.size;
    if (idx === 0) {
      spawnFloatingEmoji(emojiType, container, emojiSide, emojiSize);
    } else {
      setTimeout(() => {
        spawnFloatingEmoji(emojiType, container, emojiSide, emojiSize);
      }, Math.min(idx * 40, 450));
    }
  });
});


