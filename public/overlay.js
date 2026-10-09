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
    if (t.mode === "clock") {
      const d = new Date();
      timerDigits.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } else {
      const mins = Math.floor(displaySec / 60);
      const secs = displaySec % 60;
      timerDigits.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
  }
  if (timerRingProgress) {
    timerRingProgress.style.strokeDashoffset = (RING_CIRC * (1 - progress)).toFixed(2);
  }
  timerOverlay.classList.toggle("finished", finished && t.mode !== "stopwatch");

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
  }
}

function replay() {
  el.classList.remove("replay");
  void el.offsetWidth;
  el.classList.add("replay");
  setTimeout(() => el.classList.remove("replay"), 1620);
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


