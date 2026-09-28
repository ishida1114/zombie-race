const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let raceState = 'INIT'; // INIT, COUNTDOWN, RACING, FINISHED
let startCountdown = 3.0; // スタート前の3秒カウントダウン
let shakeTime = 0;
let scrollY = 0;
let globalTime = 0;

let remainingDistance = 1000;
const totalDistance = 1000;
let startTime = 0;
let lastGoalCountdownValue = null;

// 🧬 1. カラーとサイズの適正化（真っ黒にならないよう調整）
const ZOMBIE_COLORS = [
  { name: '標準', filter: 'none' },
  { name: '猛毒', filter: 'hue-rotate(90deg) saturate(120%)' }, // 青紫
  { name: '深淵', filter: 'hue-rotate(210deg) saturate(100%) brightness(0.9)' }, // 青系
  { name: '狂暴', filter: 'hue-rotate(-50deg) saturate(150%) brightness(1.1)' }, // 赤系
  { name: '蒼白', filter: 'grayscale(70%) brightness(1.2) hue-rotate(180deg)' }, // 白系
  { name: '黒曜', filter: 'grayscale(60%) brightness(0.6) contrast(1.3)' }, // 暗めだが潰れない
];

const ZOMBIE_SIZES = [
  { name: '標準', scaleX: 1.0, scaleY: 1.0 },
  { name: '巨漢', scaleX: 1.25, scaleY: 1.3 },
  { name: '肥満', scaleX: 1.3, scaleY: 0.95 },
  { name: '小柄', scaleX: 0.75, scaleY: 0.75 },
];

// 🎥 2. 動画の読み込みを「1つ」に統合し、四角バグを解消
const zombieVideo = document.createElement('video');
zombieVideo.src = '/zombie1.mp4';
zombieVideo.loop = true;
zombieVideo.muted = true;
zombieVideo.playsInline = true;
zombieVideo.autoplay = true;
zombieVideo.addEventListener('canplay', () => zombieVideo.play().catch(() => {}));

// 🎨 3. 共通のクロマキー処理用Canvas
const offCanvas = document.createElement('canvas');
const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

function updateChromaKeyFrame(targetW, targetH) {
  if (zombieVideo.readyState < 2 || zombieVideo.paused) return null;

  if (offCanvas.width !== targetW) offCanvas.width = targetW;
  if (offCanvas.height !== targetH) offCanvas.height = targetH;

  offCtx.clearRect(0, 0, targetW, targetH);
  offCtx.drawImage(zombieVideo, 0, 0, targetW, targetH);

  const imgData = offCtx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // グリーンバック判定
    if (g > 80 && g > r * 1.2 && g > b * 1.2) {
      data[i + 3] = 0; // 緑を透明に
    }
  }
  offCtx.putImageData(imgData, 0, 0);
  return offCanvas;
}

let currentZombie = {
  name: '検体 No.101',
  colorInfo: ZOMBIE_COLORS[0],
  sizeInfo: ZOMBIE_SIZES[0],
  speed: 50, power: 50, stamina: 50
};

let remainingTurns = 5;

// 🏃 4人の走者
const runners = [
  { id: 0, name: 'YOU', x: 20, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, colorInfo: ZOMBIE_COLORS[0], sizeInfo: ZOMBIE_SIZES[0], boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 9999 },
  { id: 1, name: 'No.088', x: 100, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, colorInfo: ZOMBIE_COLORS[1], sizeInfo: ZOMBIE_SIZES[1], boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 300 },
  { id: 2, name: 'No.204', x: 180, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, colorInfo: ZOMBIE_COLORS[2], sizeInfo: ZOMBIE_SIZES[2], boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 450 },
  { id: 3, name: 'No.305', x: 260, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, colorInfo: ZOMBIE_COLORS[3], sizeInfo: ZOMBIE_SIZES[3], boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 600 }
];

const particles = [];
const effects = [];

// 🧪 スキルのチャージ速度を大幅に低下（1レースで1〜2回しか100%にならない）
const ALL_SKILLS = [
  { id: 'meteor', name: '細胞活性', icon: '🧪', desc: '前方妨害', speed: 0.045 },
  { id: 'mach', name: '神経加速', icon: '⚡', desc: '一時加速', speed: 0.055 },
  { id: 'barrier', name: '硬化膜', icon: '🛡️', desc: '妨害無効', speed: 0.050 },
  { id: 'volcano', name: '暴走反応', icon: '🔥', desc: '大妨害', speed: 0.040 },
  { id: 'meat', name: '組織投与', icon: '🥩', desc: '全体妨害', speed: 0.045 },
  { id: 'heal', name: '強心刺激', icon: '💉', desc: 'スタミナ回復', speed: 0.050 }
];

let currentFlasks = [];

// 🎨 ゾンビ描画
function drawZombieCharacter(targetCtx, x, y, width, height, zData, processedCanvas, isExhausted) {
  targetCtx.save();
  const isKnockback = zData.knockback > 0;

  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  targetCtx.beginPath();
  targetCtx.ellipse(x + width / 2, y + height - 2, (width / 2 - 4) * zData.sizeInfo.scaleX, 5, 0, 0, Math.PI * 2);
  targetCtx.fill();

  if (processedCanvas) {
    targetCtx.translate(x + width / 2, y + height);
    targetCtx.scale(zData.sizeInfo.scaleX, zData.sizeInfo.scaleY);

    if (isKnockback) targetCtx.rotate(-0.35);

    let filterStr = zData.colorInfo.filter;
    if (isKnockback) filterStr = 'brightness(200%) sepia(100%) hue-rotate(-50deg)';
    else if (isExhausted) filterStr += ' grayscale(80%) brightness(0.6)';
    
    targetCtx.filter = filterStr;
    targetCtx.drawImage(processedCanvas, -width / 2, -height, width, height);
    targetCtx.filter = 'none';
  } else {
    // 動画読み込み待ちの時は透明（灰色の四角を廃止）
  }

  if (isExhausted && !isKnockback) {
    targetCtx.translate(x + width / 2, y + height);
    targetCtx.fillStyle = '#38bdf8';
    targetCtx.fillRect((width / 2 - 4) * zData.sizeInfo.scaleX, -height + 4, 3, 5);
  }

  targetCtx.restore();
}

function drawJapaneseStreetBackground() {
  ctx.fillStyle = '#1e232e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#131720';
  ctx.fillRect(0, 0, 12, canvas.height);
  ctx.fillRect(canvas.width - 12, 0, 12, canvas.height);

  ctx.fillStyle = '#374151';
  ctx.fillRect(12, 0, 2, canvas.height);
  ctx.fillRect(canvas.width - 14, 0, 2, canvas.height);

  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 1;
  ctx.setLineDash([12, 18]);
  for (let x of [90, 170, 250]) {
    ctx.beginPath();
    ctx.moveTo(x, -60 + scrollY);
    ctx.lineTo(x, canvas.height + 60 + scrollY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 20]);
  ctx.beginPath();
  ctx.moveTo(170, -60 + scrollY);
  ctx.lineTo(170, canvas.height + 60 + scrollY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function generateRandomZombie() {
  const num = Math.floor(Math.random() * 900) + 100;
  currentZombie = {
    name: `検体 No.${num}`,
    colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)],
    sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)],
    speed: Math.floor(Math.random() * 20) + 40,
    power: Math.floor(Math.random() * 20) + 40,
    stamina: Math.floor(Math.random() * 20) + 40
  };
  remainingTurns = 5;
  updateNurtureUI();
}

function updateNurtureUI() {
  document.getElementById('nurture-turn-txt').textContent = `残 ${remainingTurns} 調整`;
  document.getElementById('nurture-zombie-name').textContent = `[${currentZombie.sizeInfo.name} / ${currentZombie.colorInfo.name}] ${currentZombie.name}`;
  document.getElementById('stat-spd').textContent = currentZombie.speed;
  document.getElementById('stat-pow').textContent = currentZombie.power;
  document.getElementById('stat-stm').textContent = currentZombie.stamina;

  const previewCanvas = document.getElementById('zombieCanvas');
  const pCtx = previewCanvas.getContext('2d');
  
  pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const processedCanvas = updateChromaKeyFrame(60, 80);
  drawZombieCharacter(pCtx, 30, 20, 60, 80, { ...currentZombie, knockback: 0 }, processedCanvas, false);

  const cmdBox = document.querySelector('.command-container');
  const raceBtn = document.getElementById('to-race-btn');

  if (remainingTurns <= 0) {
    if (cmdBox) cmdBox.classList.add('hidden');
    if (raceBtn) raceBtn.classList.remove('hidden');
  } else {
    if (cmdBox) cmdBox.classList.remove('hidden');
    if (raceBtn) raceBtn.classList.add('hidden');
  }
}

function executeCommand(type) {
  if (remainingTurns <= 0) return;
  if (type === 'spd') currentZombie.speed += Math.floor(Math.random() * 10) + 8;
  if (type === 'pow') currentZombie.power += Math.floor(Math.random() * 10) + 8;
  if (type === 'stm') currentZombie.stamina += Math.floor(Math.random() * 10) + 8;
  remainingTurns--;
  updateNurtureUI();
}

function startRace() {
  if (isGameRunning) return;
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('nurture-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('race-screen').classList.remove('hidden');

  remainingDistance = totalDistance;
  globalTime = 0;
  lastGoalCountdownValue = null;
  
  // 🏁 3秒間のスタートカウントダウン開始
  raceState = 'COUNTDOWN';
  startCountdown = 3.0;
  document.getElementById('countdown-overlay').classList.remove('hidden');

  runners[0] = { 
    ...runners[0], 
    spdAttr: currentZombie.speed, powAttr: currentZombie.power,
    colorInfo: currentZombie.colorInfo, sizeInfo: currentZombie.sizeInfo,
    maxStm: currentZombie.stamina * 2.2, stm: currentZombie.stamina * 2.2, dist: 0, boostTimer: 0, knockback: 0 
  };

  for (let i = 1; i < 4; i++) {
    runners[i].dist = 0;
    runners[i].colorInfo = ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)];
    runners[i].sizeInfo = ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)];
    runners[i].spdAttr = currentZombie.speed + (Math.floor(Math.random() * 30) - 15);
    runners[i].powAttr = currentZombie.power + (Math.floor(Math.random() * 30) - 15);
    runners[i].maxStm = (currentZombie.stamina + (Math.floor(Math.random() * 30) - 15)) * 2.2;
    runners[i].stm = runners[i].maxStm;
    runners[i].boostTimer = 0;
    runners[i].knockback = 0;
    runners[i].skillCd = Math.floor(Math.random() * 300) + 300;
  }

  selectRandomFlasks();
  isGameRunning = true;
  requestAnimationFrame(update);
}

function selectRandomFlasks() {
  const shuffled = [...ALL_SKILLS].sort(() => 0.5 - Math.random());
  currentFlasks = shuffled.slice(0, 3).map(s => ({ ...s, charge: 0, max: 100 }));
  currentFlasks.forEach((flask, idx) => {
    const iconEl = document.getElementById(`flask-icon-${idx}`);
    const nameEl = document.getElementById(`flask-name-${idx}`);
    const descEl = document.getElementById(`flask-desc-${idx}`);
    if (iconEl) iconEl.textContent = flask.icon;
    if (nameEl) nameEl.textContent = flask.name;
    if (descEl) descEl.textContent = flask.desc;
  });
}

function triggerSkill(index, power) {
  if (!currentFlasks[index] || raceState !== 'RACING') return;
  const flask = currentFlasks[index];
  const isMax = power >= 100;
  const playerRunner = runners[0];

  // ★100%溜まりきる前に使うと、効果が最大60%以下に大きく減衰するペナルティ
  const effectivePower = isMax ? 100 : power * 0.6;

  if (flask.id === 'meteor' || flask.id === 'volcano') {
    particles.push({ type: 'meteor', x: canvas.width / 2, y: -50, targetY: 200, radius: isMax ? 35 : 18, power: effectivePower });
    if (isMax) shakeTime = 12;
  } else if (flask.id === 'mach') {
    playerRunner.boostTimer = Math.floor((effectivePower / 100) * 140);
    effects.push({ text: `神経加速`, x: playerRunner.x + 24, y: playerRunner.y - 12, color: '#38bdf8' });
  } else if (flask.id === 'barrier') {
    playerRunner.isBarrier = true;
    setTimeout(() => { playerRunner.isBarrier = false; }, (effectivePower / 100) * 3500);
    effects.push({ text: `組織硬化`, x: playerRunner.x + 24, y: playerRunner.y - 12, color: '#a855f7' });
  } else if (flask.id === 'meat') {
    effects.push({ text: `組織妨害`, x: canvas.width / 2, y: 150, color: '#ef4444' });
    for (let i = 1; i < 4; i++) {
      const powResistance = Math.floor(runners[i].powAttr * 0.4);
      // 効果減衰を反映
      runners[i].knockback = Math.max(10, Math.floor(60 * (effectivePower / 100)) - powResistance);
    }
  } else if (flask.id === 'heal') {
    playerRunner.stm = Math.min(playerRunner.maxStm, playerRunner.stm + Math.floor(50 * (effectivePower / 100)));
    playerRunner.boostTimer = Math.floor(70 * (effectivePower / 100));
    effects.push({ text: `強心刺激`, x: playerRunner.x + 24, y: playerRunner.y - 12, color: '#22c55e' });
  }
  flask.charge = 0; // 使ったら0に戻る
}

function aiTriggerSkill(runner) {
  const skills = ['mach', 'barrier', 'meat', 'heal'];
  const skill = skills[Math.floor(Math.random() * skills.length)];
  
  if (skill === 'mach') {
    runner.boostTimer = 100;
    effects.push({ text: `加速`, x: runner.x + 24, y: runner.y - 12, color: '#ef4444' });
  } else if (skill === 'barrier') {
    runner.isBarrier = true;
    setTimeout(() => { runner.isBarrier = false; }, 2500);
    effects.push({ text: `硬化`, x: runner.x + 24, y: runner.y - 12, color: '#a855f7' });
  } else if (skill === 'meat') {
    effects.push({ text: `妨害！`, x: runner.x + 24, y: runner.y - 12, color: '#ef4444' });
    runners.forEach(r => {
      if (r.id !== runner.id && !r.isBarrier) {
        r.knockback = Math.max(15, 50 - Math.floor(r.powAttr * 0.3));
      }
    });
  } else if (skill === 'heal') {
    runner.stm = Math.min(runner.maxStm, runner.stm + 40);
    effects.push({ text: `回復`, x: runner.x + 24, y: runner.y - 12, color: '#22c55e' });
  }
  runner.skillCd = Math.floor(Math.random() * 400) + 600; // CPUの頻度も下げる
}

function finishRace() {
  raceState = 'FINISHED';
  document.getElementById('countdown-overlay').classList.add('hidden');
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const sorted = [...runners].sort((a, b) => b.dist - a.dist);
  const playerRank = sorted.findIndex(r => r.id === 0) + 1;
  const badgeEl = document.getElementById('result-rank-badge');
  const detailEl = document.getElementById('result-detail');
  const resultScreen = document.getElementById('result-screen');
  if (badgeEl) badgeEl.textContent = `${playerRank}位`;
  if (detailEl) detailEl.textContent = `走破タイム: ${elapsedSec}秒`;
  if (resultScreen) resultScreen.classList.remove('hidden');
}

function update() {
  if (!isGameRunning) {
    if (document.getElementById('nurture-screen').classList.contains('hidden') === false) {
      globalTime++;
      updateNurtureUI();
    }
    requestAnimationFrame(update);
    return;
  }
  globalTime++;

  const cdEl = document.getElementById('countdown-overlay');

  // 🏁 スタート前のカウントダウン処理
  if (raceState === 'COUNTDOWN') {
    startCountdown -= 1 / 60;
    if (startCountdown > 0) {
      cdEl.textContent = Math.ceil(startCountdown);
    } else {
      cdEl.textContent = "START!";
      setTimeout(() => { if (raceState === 'RACING') cdEl.classList.add('hidden'); }, 1000);
      raceState = 'RACING';
      startTime = Date.now();
    }
  }

  // 🏃 レース中の進行処理
  if (raceState === 'RACING') {
    currentFlasks.forEach((flask, index) => {
      if (flask.charge < flask.max) flask.charge = Math.min(flask.max, flask.charge + flask.speed);
      const fillEl = document.getElementById(`flask-fill-${index}`);
      const percentEl = document.getElementById(`flask-percent-${index}`);
      if (fillEl && percentEl) {
        fillEl.style.height = `${flask.charge}%`;
        percentEl.textContent = `${Math.floor(flask.charge)}%`;
        const cardEl = fillEl.closest('.flask-card');
        if (flask.charge >= 100) cardEl.classList.add('ready');
        else cardEl.classList.remove('ready');
      }
    });

    for (let i = 0; i < 4; i++) {
      const r = runners[i];
      let baseSpeed = 0.22 + (r.spdAttr - 50) * 0.003;
      if (r.stm > 0) r.stm -= 0.06;
      else baseSpeed *= 0.3;

      if (r.boostTimer > 0) { r.boostTimer--; baseSpeed *= 1.7; }
      if (r.knockback > 0) { r.knockback--; baseSpeed *= 0; }

      r.dist += baseSpeed;

      if (i !== 0 && remainingDistance < 900) {
        r.skillCd--;
        if (r.skillCd <= 0) aiTriggerSkill(r);
      }
    }

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const r1 = runners[i];
        const r2 = runners[j];
        if (Math.abs(r1.dist - r2.dist) < 8) {
          if (r1.powAttr > r2.powAttr) { r1.dist += 0.08; r2.dist -= 0.08; }
          else if (r2.powAttr > r1.powAttr) { r2.dist += 0.08; r1.dist -= 0.08; }
        }
      }
    }

    const leadingDist = Math.max(...runners.map(r => r.dist));
    remainingDistance = Math.max(0, totalDistance - leadingDist);

    // ゴール手前のカウントダウン
    if (remainingDistance <= 200 && remainingDistance > 0 && startCountdown <= 0) {
      const countVal = Math.min(5, Math.max(1, Math.ceil(remainingDistance / 40)));
      cdEl.textContent = countVal;
      cdEl.classList.remove('hidden');
    }

    if (remainingDistance <= 0) { finishRace(); return; }
  }

  // カメラ計算
  const avgDist = runners.reduce((acc, r) => acc + r.dist, 0) / 4;
  for (let i = 0; i < 4; i++) {
    const r = runners[i];
    const diffFromAvg = r.dist - avgDist;
    r.y = 220 - diffFromAvg * 4.5;
    if (r.y < 80) r.y = 80;
    if (r.y > 340) r.y = 340;
  }

  document.getElementById('hud-dist').textContent = `${Math.floor(remainingDistance)}m`;
  const sortedRunners = [...runners].sort((a, b) => b.dist - a.dist);
  const myRank = sortedRunners.findIndex(r => r.id === 0) + 1;
  document.getElementById('hud-rank').textContent = `${myRank}位 / 4人`;

  for (let i = 0; i < 4; i++) {
    const r = runners[i];
    const ratio = Math.min(1, Math.max(0, r.dist / totalDistance));
    const markerEl = document.getElementById(`runner-marker-${i}`);
    if (markerEl) markerEl.style.left = `${ratio * 100}%`;
  }

  // 描画開始
  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6); shakeTime--; }

  // カウントダウン中以外は背景をスクロール
  if (raceState === 'RACING') {
    scrollY = (scrollY + 0.25) % 60;
  }
  drawJapaneseStreetBackground();

  // ★ 毎フレーム1回だけクロマキー処理を実行（激重バグと四角バグを解消）
  const processedCanvas = updateChromaKeyFrame(54, 64);

  const drawOrder = [...runners].sort((a, b) => a.y - b.y);
  drawOrder.forEach(r => {
    drawZombieCharacter(ctx, r.x - 6, r.y - 16, 54, 64, r, processedCanvas, r.stm <= 0);
    
    if (r.isBarrier) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x + 20, r.y + 16, 28 * r.sizeInfo.scaleX, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // パーティクル（カウントダウン中は止める）
  if (raceState === 'RACING') {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.type === 'meteor') {
        p.y += 8; ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        if (p.y >= p.targetY) {
          shakeTime = 8;
          for (let j = 1; j < 4; j++) {
            const powResist = Math.floor(runners[j].powAttr * 0.3);
            runners[j].knockback = Math.max(15, Math.floor(60 * (p.power / 100)) - powResist);
          }
          effects.push({ text: `衝撃波`, x: p.x, y: p.y, color: '#ef4444' });
          particles.splice(i, 1);
        }
      }
    }

    for (let i = effects.length - 1; i >= 0; i--) {
      const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(eff.text, eff.x, eff.y); eff.y -= 0.8; if (eff.y < 120) effects.splice(i, 1);
    }
  } else {
    // 停止中も表示は残す
    for (let i = effects.length - 1; i >= 0; i--) {
      const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(eff.text, eff.x, eff.y);
    }
  }

  ctx.restore();
  requestAnimationFrame(update);
}

function init() {
  const startBtn = document.getElementById('start-btn');
  const toRaceBtn = document.getElementById('to-race-btn');
  const retryBtn = document.getElementById('retry-btn');

  if (startBtn) {
    startBtn.onclick = (e) => {
      e.preventDefault();
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('nurture-screen').classList.remove('hidden');
      generateRandomZombie();
    };
  }

  if (toRaceBtn) {
    toRaceBtn.onclick = (e) => {
      e.preventDefault();
      startRace();
    };
  }

  document.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      executeCommand(btn.dataset.cmd);
    };
  });

  if (retryBtn) {
    retryBtn.onclick = (e) => {
      e.preventDefault();
      isGameRunning = false;
      document.getElementById('result-screen').classList.add('hidden');
      document.getElementById('race-screen').classList.add('hidden');
      document.getElementById('nurture-screen').classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
    };
  }

  document.querySelectorAll('.flask-card').forEach((card) => {
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (raceState !== 'RACING' || currentFlasks.length === 0) return;
      const index = parseInt(card.dataset.index);
      const flask = currentFlasks[index];
      if (flask && flask.charge >= 10) {
        triggerSkill(index, Math.floor(flask.charge));
      }
    });
  });
  
  requestAnimationFrame(update);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}