/**
 * FocusAI v1.1 — script.js
 * AI Study Monitor using MediaPipe Face Landmarker + Hand Landmarker
 *
 * Features:
 *  - Head pose estimation (yaw + pitch via landmark geometry)
 *  - Eye Aspect Ratio — drowsiness detection
 *  - Face absence detection
 *  - Hand detection — phone usage detection
 *  - Configurable thresholds via sliders
 *  - Web Audio API beep alert
 *  - Session stats (focused time, distracted time, alert count)
 *  - Focus score ring
 *  - Distraction streak timer
 */

import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

// ─── DOM refs ────────────────────────────────────────────────────────
const video        = document.getElementById("webcam");
const canvas       = document.getElementById("overlay");
const ctx          = canvas.getContext("2d");

const btnStart     = document.getElementById("btnStart");
const btnStop      = document.getElementById("btnStop");
const btnMute      = document.getElementById("btnMute");
const btnPhoneDetect = document.getElementById("btnPhoneDetect");
const clearLogBtn  = document.getElementById("clearLog");

const cameraIdle      = document.getElementById("cameraIdle");
const alertOverlay    = document.getElementById("alertOverlay");
const alertMessage    = document.getElementById("alertMessage");
const cameraFrame     = document.getElementById("cameraFrame");
const loadingOverlay  = document.getElementById("loadingOverlay");
const loadingText     = document.getElementById("loadingText");
const statusBadge     = document.getElementById("statusBadge");
const pulseDot        = document.getElementById("pulseDot");
const headerStatusText= document.getElementById("headerStatusText");
const sessionClock    = document.getElementById("sessionClock");

const fpsVal    = document.getElementById("fpsVal");
const faceVal   = document.getElementById("faceVal");
const earVal    = document.getElementById("earVal");
const yawVal    = document.getElementById("yawVal");
const pitchVal  = document.getElementById("pitchVal");

const ringFill          = document.getElementById("ringFill");
const ringScore         = document.getElementById("ringScore");
const focusedTimeEl     = document.getElementById("focusedTime");
const distractedTimeEl  = document.getElementById("distractedTime");
const alertCountEl      = document.getElementById("alertCount");
const logList           = document.getElementById("logList");
const currentStateLabel = document.getElementById("currentStateLabel");
const distrStreakEl     = document.getElementById("distrStreak");

// Sliders
const yawThreshInput   = document.getElementById("yawThresh");
const pitchThreshInput = document.getElementById("pitchThresh");
const earThreshInput   = document.getElementById("earThresh");
const alertDelayInput  = document.getElementById("alertDelay");
const yawThreshVal     = document.getElementById("yawThreshVal");
const pitchThreshVal   = document.getElementById("pitchThreshVal");
const earThreshVal     = document.getElementById("earThreshVal");
const alertDelayVal    = document.getElementById("alertDelayVal");

// ─── State ───────────────────────────────────────────────────────────
let faceLandmarker = null;
let handLandmarker = null;
let running        = false;
let muted          = false;
let animFrameId    = null;
let audioCtx       = null;
let drawUtils      = null;

// Timing
let sessionStart   = 0;
let focusedMs      = 0;
let distractedMs   = 0;
let lastTickMs     = 0;

// Distraction
let isDistracted       = false;
let distractionStartMs = 0;
let alertCount         = 0;
let lastAlertMs        = 0;
const ALERT_COOLDOWN   = 5000; // ms between repeated audible alerts

// Hand detection
let isHoldingPhone      = false;
let phoneAlertMs       = 0;
let phoneDetectionEnabled = true;  // Toggle phone detection on/off
const PHONE_COOLDOWN   = 3000; // ms between phone alert beeps

// FPS
let fpsFrames  = 0;
let fpsLastTs  = 0;

// Thresholds (kept in sync with sliders)
const thresh = { yaw: 20, pitch: 15, ear: 0.22, alertDelay: 3000 };

// Eye landmark indices (MediaPipe 478-point model)
const LEFT_EYE  = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33,  160, 158, 133, 153, 144];

// ─── Slider wiring ────────────────────────────────────────────────────
function wireSliders() {
  yawThreshInput.addEventListener("input", () => {
    thresh.yaw = parseInt(yawThreshInput.value);
    yawThreshVal.textContent = thresh.yaw + " deg";
  });
  pitchThreshInput.addEventListener("input", () => {
    thresh.pitch = parseInt(pitchThreshInput.value);
    pitchThreshVal.textContent = thresh.pitch + " deg";
  });
  earThreshInput.addEventListener("input", () => {
    thresh.ear = parseInt(earThreshInput.value) / 100;
    earThreshVal.textContent = thresh.ear.toFixed(2);
  });
  alertDelayInput.addEventListener("input", () => {
    thresh.alertDelay = parseInt(alertDelayInput.value) * 1000;
    alertDelayVal.textContent = alertDelayInput.value + "s";
  });
}

// ─── Audio ────────────────────────────────────────────────────────────
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playAlert() {
  if (muted || !audioCtx) return;
  const now = audioCtx.currentTime;
  [880, 660].forEach((freq, i) => {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "square";
    osc.frequency.value = freq;
    const t = now + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + 0.16);
    osc.start(t);
    osc.stop(t + 0.18);
  });
}

// ─── Logging ─────────────────────────────────────────────────────────
function addLog(message, type = "warn") {
  const empty = logList.querySelector(".log-empty");
  if (empty) empty.remove();
  const time = new Date().toTimeString().slice(0, 8);
  const li = document.createElement("li");
  li.className = "log-item";
  const labels = { warn: "CANH BAO", danger: "ALERT", info: "INFO" };
  li.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-msg">${message}</span>
    <span class="log-type ${type}">${labels[type] || type}</span>
  `;
  logList.prepend(li);
  // Keep under 60 items
  const items = logList.querySelectorAll(".log-item");
  if (items.length > 60) items[items.length - 1].remove();
}

clearLogBtn.addEventListener("click", () => {
  logList.innerHTML = '<li class="log-empty">Chua co canh bao nao.</li>';
});

// ─── Time formatting ──────────────────────────────────────────────────
function formatHMS(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

function formatMM(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2,"0")}`;
}

// ─── Focus score ──────────────────────────────────────────────────────
function updateFocusScore() {
  const total = focusedMs + distractedMs;
  if (total < 500) { ringScore.textContent = "--"; return; }
  const score = Math.round((focusedMs / total) * 100);
  ringScore.textContent = score;
  const offset = 314 - (score / 100) * 314;
  ringFill.style.strokeDashoffset = offset;
  ringFill.style.stroke = score >= 70 ? "var(--accent)" : score >= 45 ? "var(--warn)" : "var(--danger)";
}

// ─── EAR ─────────────────────────────────────────────────────────────
function dist2d(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function eyeAspectRatio(lm, indices) {
  const [p1, p2, p3, p4, p5, p6] = indices.map(i => lm[i]);
  return (dist2d(p2, p6) + dist2d(p3, p5)) / (2 * dist2d(p1, p4));
}

// ─── Head pose (simplified geometric approach) ────────────────────────
function estimateHeadPose(lm) {
  const noseTip     = lm[1];
  const leftEar     = lm[234];
  const rightEar    = lm[454];
  const chin        = lm[152];
  const forehead    = lm[10];

  const earMidX  = (leftEar.x + rightEar.x) / 2;
  const faceW    = Math.abs(leftEar.x - rightEar.x) || 0.001;
  const yaw      = ((noseTip.x - earMidX) / (faceW / 2)) * 50;

  const faceH    = Math.abs(forehead.y - chin.y) || 0.001;
  const noseMidY = (forehead.y + chin.y) / 2;
  const pitch    = ((noseTip.y - noseMidY) / (faceH / 2)) * 45;

  return { yaw, pitch };
}

// ─── Alert UI ─────────────────────────────────────────────────────────
function showAlertUI(reason) {
  alertMessage.textContent = reason;
  alertOverlay.classList.add("visible");
  cameraFrame.classList.add("alert-active");
  pulseDot.className = "pulse-dot alert";
  headerStatusText.textContent = reason;
  statusBadge.textContent = "⚠ " + reason;
  statusBadge.className = "status-badge alert";
  currentStateLabel.textContent = "⚠ Xao nhãng";
  currentStateLabel.style.color = "var(--danger)";
}

function hideAlertUI() {
  alertOverlay.classList.remove("visible");
  cameraFrame.classList.remove("alert-active");
  if (running) {
    pulseDot.className = "pulse-dot active";
    headerStatusText.textContent = "Đang theo dõi";
    statusBadge.textContent = "Đang chạy";
    statusBadge.className = "status-badge running";
    currentStateLabel.textContent = "✓ Tập trung";
    currentStateLabel.style.color = "var(--accent)";
  }
}

// ─── Distraction state machine ────────────────────────────────────────
function handleDistraction(nowMs, reason) {
  if (!isDistracted) {
    isDistracted = true;
    distractionStartMs = nowMs;
  }
  const duration = nowMs - distractionStartMs;

  // Update streak display
  distrStreakEl.textContent = (duration / 1000).toFixed(1) + "s";

  if (duration >= thresh.alertDelay) {
    if (nowMs - lastAlertMs > ALERT_COOLDOWN) {
      lastAlertMs = nowMs;
      alertCount++;
      alertCountEl.textContent = alertCount;
      playAlert();
      addLog(reason, "danger");
    }
    showAlertUI(reason);
  }
}

function clearDistraction() {
  if (isDistracted) {
    isDistracted = false;
    distractionStartMs = 0;
    distrStreakEl.textContent = "--";
  }
  hideAlertUI();
}

// ─── Load MediaPipe ───────────────────────────────────────────────────
async function loadMediaPipe() {
  loadingOverlay.classList.add("visible");
  loadingText.textContent = "Dang tai FilesetResolver...";

  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  loadingText.textContent = "Dang tai mo hinh Face Landmarker...";

  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    outputFaceBlendshapes: false,
    runningMode: "VIDEO",
    numFaces: 1,
  });

  loadingText.textContent = "Dang tai mo hinh Hand Landmarker...";

  handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  });

  loadingOverlay.classList.remove("visible");
  addLog("Mo hinh AI da san sang [OK] (Face + Hand)", "info");
}

// ─── Camera ───────────────────────────────────────────────────────────
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise(res => { video.onloadeddata = res; });
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  drawUtils = new DrawingUtils(ctx);
  cameraIdle.classList.add("hidden");
}

function stopCamera() {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;
  cameraIdle.classList.remove("hidden");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ─── Main detection loop ──────────────────────────────────────────────
function detectionLoop(nowMs) {
  if (!running) return;
  animFrameId = requestAnimationFrame(detectionLoop);

  // FPS
  fpsFrames++;
  if (nowMs - fpsLastTs > 1000) {
    fpsVal.textContent = Math.round(fpsFrames * 1000 / (nowMs - fpsLastTs));
    fpsFrames = 0;
    fpsLastTs = nowMs;
  }

  // Throttle AI inference to ~15 FPS
  if (nowMs - lastTickMs < 66) return;
  const dt = Math.min(nowMs - lastTickMs, 500);
  lastTickMs = nowMs;

  // Update session clock
  sessionClock.textContent = formatHMS(nowMs - sessionStart);

  // Run MediaPipe
  let result, handResult;
  try {
    result = faceLandmarker.detectForVideo(video, nowMs);
    handResult = handLandmarker.detectForVideo(video, nowMs);
  } catch (e) {
    console.warn("Detection error:", e);
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Hand detection (Phone usage) ──
  if (phoneDetectionEnabled && handResult.landmarks && handResult.landmarks.length > 1) {
    isHoldingPhone = true;
    if (nowMs - phoneAlertMs > PHONE_COOLDOWN) {
      phoneAlertMs = nowMs;
      alertCount++;
      alertCountEl.textContent = alertCount;
      playAlert();
      addLog(`Phat hien ${handResult.landmarks.length} tay - Dang cam dien thoai?`, "danger");
    }
    distractedMs += dt;
    showAlertUI(`Cam dien thoai! [PHONE] (Phat hien ${handResult.landmarks.length} tay)`);
    updateStats();
    return;
  } else {
    isHoldingPhone = false;
  }

  // ── No face ──
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    faceVal.textContent  = "0";
    earVal.textContent   = "--";
    yawVal.textContent   = "--";
    pitchVal.textContent = "--";
    distractedMs += dt;
    updateStats();
    handleDistraction(nowMs, "Khong tim thay khuon mat!");
    return;
  }

  const lm = result.faceLandmarks[0];
  faceVal.textContent = "1";

  // Draw landmarks
  drawUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
    color: "rgba(74,247,192,0.07)", lineWidth: 0.5,
  });
  drawUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
    color: "rgba(74,247,192,0.7)", lineWidth: 1,
  });
  drawUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
    color: "rgba(74,247,192,0.7)", lineWidth: 1,
  });
  drawUtils.drawConnectors(lm, FaceLandmarker.FACE_LANDMARKS_LIPS, {
    color: "rgba(91,143,255,0.3)", lineWidth: 0.5,
  });

  // EAR
  const ear = ((eyeAspectRatio(lm, LEFT_EYE) + eyeAspectRatio(lm, RIGHT_EYE)) / 2);
  earVal.textContent = ear.toFixed(3);

  // Head pose
  const { yaw, pitch } = estimateHeadPose(lm);
  yawVal.textContent   = Math.round(yaw) + "deg";
  pitchVal.textContent = Math.round(pitch) + "deg";

  // Highlight EAR in red if low
  earVal.style.color   = ear < thresh.ear ? "var(--danger)" : "var(--accent)";
  yawVal.style.color   = Math.abs(yaw) > thresh.yaw ? "var(--danger)" : "var(--accent)";
  pitchVal.style.color = pitch > thresh.pitch ? "var(--warn)" : "var(--accent)";

  // Distraction check
  let reason = null;
  if (ear < thresh.ear) {
    reason = `Mat nham / Buon ngu [Z_Z] (EAR: ${ear.toFixed(3)})`;
  } else if (Math.abs(yaw) > thresh.yaw) {
    reason = `Quay dau sang ${yaw > 0 ? "phai" : "trai"} (${Math.round(Math.abs(yaw))} deg)`;
  } else if (pitch > thresh.pitch) {
    reason = `Cui dau xuong (${Math.round(pitch)} deg)`;
  }

  if (reason) {
    distractedMs += dt;
    handleDistraction(nowMs, reason);
  } else {
    focusedMs += dt;
    clearDistraction();
  }

  updateStats();
}

function updateStats() {
  focusedTimeEl.textContent    = formatMM(focusedMs);
  distractedTimeEl.textContent = formatMM(distractedMs);
  updateFocusScore();
}

// ─── Start / Stop ─────────────────────────────────────────────────────
btnStart.addEventListener("click", async () => {
  initAudio();
  btnStart.disabled = true;
  statusBadge.textContent = "Đang khởi động…";

  try {
    if (!faceLandmarker) await loadMediaPipe();
    await startCamera();

    running        = true;
    sessionStart   = performance.now();
    lastTickMs     = sessionStart;
    fpsLastTs      = sessionStart;
    focusedMs      = 0;
    distractedMs   = 0;
    alertCount     = 0;
    alertCountEl.textContent        = "0";
    ringScore.textContent           = "--";
    ringFill.style.strokeDashoffset = "314";
    currentStateLabel.textContent   = "[OK] Tap trung";
    currentStateLabel.style.color   = "var(--accent)";
    distrStreakEl.textContent        = "--";

    btnStart.classList.add("hidden");
    btnStop.classList.remove("hidden");
    pulseDot.className = "pulse-dot active";
    headerStatusText.textContent = "Dang theo doi";
    statusBadge.textContent = "Dang chay";
    statusBadge.className = "status-badge running";
    addLog("Phien hoc bat dau [OK]", "info");

    animFrameId = requestAnimationFrame(detectionLoop);
  } catch (err) {
    console.error(err);
    addLog("Loi: " + err.message, "danger");
    loadingOverlay.classList.remove("visible");
    btnStart.disabled = false;
    statusBadge.textContent = "Loi khoi dong";
    statusBadge.className = "status-badge";
  }
});

btnStop.addEventListener("click", () => {
  running = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  stopCamera();
  clearDistraction();

  btnStop.classList.add("hidden");
  btnStart.classList.remove("hidden");
  btnStart.disabled = false;

  pulseDot.className = "pulse-dot";
  headerStatusText.textContent = "Da dung";
  statusBadge.textContent = "Da dung";
  statusBadge.className = "status-badge";
  currentStateLabel.textContent = "--";
  currentStateLabel.style.color = "";
  fpsVal.textContent = faceVal.textContent = earVal.textContent = yawVal.textContent = pitchVal.textContent = "—";

  addLog(
    `Phien hoc ket thuc - Tap trung: ${formatMM(focusedMs)} | Xao nhang: ${formatMM(distractedMs)} | Canh bao: ${alertCount}`,
    "info"
  );
});

// ─── Mute ────────────────────────────────────────────────────────────
btnMute.addEventListener("click", () => {
  muted = !muted;
  btnMute.classList.toggle("muted", muted);
  btnMute.title = muted ? "Bat am thanh" : "Tat am thanh";
  btnMute.querySelector("svg").innerHTML = muted
    ? `<path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0017 18.09L18.73 20 20 18.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`
    : `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM18.5 12c0-2.77-1.5-5.18-4-6.32v12.63c2.5-1.13 4-3.54 4-6.31z"/>`;
});

// ─── Init ────────────────────────────────────────────────────────────
wireSliders();