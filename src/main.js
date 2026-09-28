const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let shakeTime = 0;
let scrollY = 0;
let globalTime = 0;

let currentScrollSpeed = 0.25;
const baseScrollSpeed = 0.25;
let remainingDistance = 1000;
const totalDistance = 1000;
let startTime = 0;

// 🧪 プレイヤー（YOU）
let currentZombie = {
  name: '検体 No.101',
  color: '#3fb950', // 肌の色
  clothes: 'none',  // 服の種類 (none, patient:患者服, suit:黒服)
  head: 'none',     // 頭の装飾 (none, electrode:電極, bandage:包帯)
  eye: 'hollow',    // 目 (hollow:空洞, glow:光る, stitched:縫合)
  speed: 50, power: 50, stamina: 50
};

let remainingTurns = 5;

// 🏃 4人の走者
const runners = [
  { id: 0, name: 'YOU', x: 25, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, color: '#3fb950', clothes: 'none', head: 'none', eye: 'hollow', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 9999 },
  { id: 1, name: 'No.088', x: 105, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, color: '#f85149', clothes: 'patient', head: 'none', eye: 'glow', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 300 },
  { id: 2, name: 'No.204', x: 185, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, color: '#a371f7', clothes: 'none', head: 'bandage', eye: 'stitched', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 450 },
  { id: 3, name: 'No.305', x: 265, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, color: '#d29922', clothes: 'suit', head: 'electrode', eye: 'hollow', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 600 }
];

const particles = [];
const effects = [];

// スキルリスト（効果説明文を追加）
const ALL_SKILLS = [
  { id: 'meteor', name: '細胞活性', icon: '🧪', desc: '前方妨害', speed: 0.15 },
  { id: 'mach', name: '神経加速', icon: '⚡', desc: '一時加速', speed: 0.22 },
  { id: 'barrier', name: '硬化膜', icon: '🛡️', desc: '妨害無効', speed: 0.18 },
  { id: 'volcano', name: '暴走反応', icon: '🔥', desc: '大妨害', speed: 0.12 },
  { id: 'meat', name: '組織投与', icon: '🥩', desc: '全体妨害', speed: 0.16 },
  { id: 'heal', name: '強心刺激', icon: '💉', desc: 'スタミナ回復', speed: 0.20 }
];

let currentFlasks = [];

// 🎨 ゾンビ描画（パーツ合成の導入）
function drawZombieCharacter(targetCtx, x, y, width, height, zData, isExhausted, distPhase) {
  targetCtx.save();
  const movePhase = isExhausted ? 0 : distPhase * 0.4;
  const legSway = Math.sin(movePhase) * 6;
  const armSway = Math.sin(movePhase + Math.PI) * 5;
  const bodyRoll = Math.sin(movePhase * 0.5) * 0.05;

  // 影
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  targetCtx.beginPath();
  targetCtx.ellipse(x + width / 2, y + height + 2, width / 2, 5, 0, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.translate(x + width / 2, y + height / 2);
  targetCtx.rotate(isExhausted ? 0.1 : bodyRoll);
  targetCtx.translate(-(x + width / 2), -(y + height / 2));

  // --- パーツ合成 ---
  const skinColor = isExhausted ? '#64748b' : zData.color;
  
  // 服の色決定
  let clothesColor = skinColor; // 裸の場合
  if (zData.clothes === 'patient') clothesColor = '#94a3b8'; // 患者服（水色グレー）
  else if (zData.clothes === 'suit') clothesColor = '#1e293b'; // スーツ（黒）

  const armColor = isExhausted ? '#475569' : clothesColor;

  // 足（肌色）
  targetCtx.fillStyle = skinColor;
  targetCtx.fillRect(x + 10, y + height - 8 + legSway, 6, 12);
  targetCtx.fillRect(x + width - 16, y + height - 8 - legSway, 6, 12);

  // 胴体（服）
  targetCtx.fillStyle = clothesColor;
  targetCtx.fillRect(x + 4, y + 10, width - 8, height - 14);
  
  // スーツの場合はネクタイ
  if (zData.clothes === 'suit') {
    targetCtx.fillStyle = '#64748b';
    targetCtx.fillRect(x + width / 2 - 2, y + 10, 4, 12);
  }

  // 頭（肌色）
  targetCtx.fillStyle = skinColor;
  targetCtx.fillRect(x + 2, y, width - 4, 16);

  // 頭の装飾
  if (zData.head === 'bandage') {
    targetCtx.fillStyle = '#cbd5e1'; // 包帯
    targetCtx.fillRect(x + 2, y + 2, width - 4, 5);
  } else if (zData.head === 'electrode') {
    targetCtx.fillStyle = '#ef4444'; // 赤いランプ
    targetCtx.fillRect(x + width / 2 - 3, y - 4, 6, 4);
    targetCtx.fillStyle = '#475569'; // 電極基部
    targetCtx.fillRect(x + width / 2 - 4, y, 8, 2);
  }

  // 腕
  const armOffset = isExhausted ? 8 : armSway;
  targetCtx.fillStyle = armColor;
  targetCtx.fillRect(x - 2, y + 12 + armOffset, 6, 16);
  targetCtx.fillRect(x + width - 4, y + 12 - (isExhausted ? -armOffset : armOffset), 6, 16);

  // 目
  if (zData.eye === 'glow') {
    // 光る機械の目
    targetCtx.fillStyle = '#ef4444';
    targetCtx.fillRect(x + 10, y + 5, 4, 4);
    targetCtx.fillRect(x + 25, y + 5, 4, 4);
  } else if (zData.eye === 'stitched') {
    // 縫合された目（×印）
    targetCtx.strokeStyle = '#1e293b';
    targetCtx.lineWidth = 1;
    targetCtx.beginPath();
    targetCtx.moveTo(x + 8, y + 4); targetCtx.lineTo(x + 14, y + 10);
    targetCtx.moveTo(x + 14, y + 4); targetCtx.lineTo(x + 8, y + 10);
    targetCtx.moveTo(x + 23, y + 4); targetCtx.lineTo(x + 29, y + 10);
    targetCtx.moveTo(x + 29, y + 4); targetCtx.lineTo(x + 23, y + 10);
    targetCtx.stroke();
  } else {
    // 空洞（デフォルト）
    targetCtx.fillStyle = '#090a0f';
    targetCtx.fillRect(x + 8, y + 4, 7, 7);
    targetCtx.fillRect(x + 23, y + 4, 7, 7);
    targetCtx.fillStyle = isExhausted ? '#ef4444' : '#cbd5e1';
    targetCtx.fillRect(x + 10, y + 6, 2, 2);
    targetCtx.fillRect(x + 25, y + 6, 2, 2);
  }

  // 口（縫い目）
  targetCtx.fillStyle = '#1e293b';
  targetCtx.fillRect(x + 10, y + 13, 18, 1);

  // 耳タグ
  targetCtx.fillStyle = '#f87171';
  targetCtx.fillRect(x + 2, y + 15, 3, 5);

  if (isExhausted) {
    targetCtx.fillStyle = '#38bdf8';
    targetCtx.fillRect(x + width + 2, y + 2, 3, 5);
  }

  targetCtx.restore();
}

// 🧪 育成：ランダムなパーツを持つゾンビを生成
function generateRandomZombie() {
  const colors = ['#4a584e', '#3d4d5c', '#5a4d4d'];
  const clothesList = ['none', 'patient', 'suit'];
  const headList = ['none', 'bandage', 'electrode'];
  const eyeList = ['hollow', 'glow', 'stitched'];
  
  const num = Math.floor(Math.random() * 900) + 100;

  currentZombie = {
    name: `検体 No.${num}`,
    color: colors[Math.floor(Math.random() * colors.length)],
    clothes: clothesList[Math.floor(Math.random() * clothesList.length)],
    head: headList[Math.floor(Math.random() * headList.length)],
    eye: eyeList[Math.floor(Math.random() * eyeList.length)],
    speed: Math.floor(Math.random() * 20) + 40,
    power: Math.floor(Math.random() * 20) + 40,
    stamina: Math.floor(Math.random() * 20) + 40
  };

  remainingTurns = 5;
  updateNurtureUI();
}

function updateNurtureUI() {
  document.getElementById('nurture-turn-txt').textContent = `残 ${remainingTurns} 調整`;
  document.getElementById('nurture-zombie-name').textContent = currentZombie.name;
  document.getElementById('stat-spd').textContent = currentZombie.speed;
  document.getElementById('stat-pow').textContent = currentZombie.power;
  document.getElementById('stat-stm').textContent = currentZombie.stamina;

  const previewCanvas = document.getElementById('zombieCanvas');
  const pCtx = previewCanvas.getContext('2d');
  pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  drawZombieCharacter(pCtx, 41, 38, 38, 42, currentZombie, false, globalTime * 0.5);

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
  startTime = Date.now();
  globalTime = 0;
  
  // プレイヤーパラメータ・パーツを反映
  runners[0] = { ...runners[0], ...currentZombie, maxStm: currentZombie.stamina * 2.2, stm: currentZombie.stamina * 2.2, dist: 0, boostTimer: 0, knockback: 0 };

  // 🤖 ライバルのステータスとランダムパーツ設定
  const clothesList = ['none', 'patient', 'suit'];
  const headList = ['none', 'bandage', 'electrode'];
  const eyeList = ['hollow', 'glow', 'stitched'];

  for (let i = 1; i < 4; i++) {
    runners[i].dist = 0;
    runners[i].clothes = clothesList[Math.floor(Math.random() * clothesList.length)];
    runners[i].head = headList[Math.floor(Math.random() * headList.length)];
    runners[i].eye = eyeList[Math.floor(Math.random() * eyeList.length)];
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

// 🧪 UIにスキル効果説明（desc）をセット
function selectRandomFlasks() {
  const shuffled = [...ALL_SKILLS].sort(() => 0.5 - Math.random());
  currentFlasks = shuffled.slice(0, 3).map(s => ({ ...s, charge: 0, max: 100 }));
  currentFlasks.forEach((flask, idx) => {
    const iconEl = document.getElementById(`flask-icon-${idx}`);
    const nameEl = document.getElementById(`flask-name-${idx}`);
    const descEl = document.getElementById(`flask-desc-${idx}`);
    
    if (iconEl) iconEl.textContent = flask.icon;
    if (nameEl) nameEl.textContent = flask.name;
    if (descEl) descEl.textContent = flask.desc; // 効果をUIに表示
  });
}

function triggerSkill(index, power) {
  if (!currentFlasks[index]) return;
  const flask = currentFlasks[index];
  const isMax = power >= 100;
  const playerRunner = runners[0];

  if (flask.id === 'meteor' || flask.id === 'volcano') {
    particles.push({ type: 'meteor', x: canvas.width / 2, y: -50, targetY: 200, radius: isMax ? 35 : 18, power: power });
    if (isMax) shakeTime = 12;
  } else if (flask.id === 'mach') {
    playerRunner.boostTimer = Math.floor((power / 100) * 140);
    effects.push({ text: `神経加速`, x: playerRunner.x + 19, y: playerRunner.y - 12, color: '#388bfd' });
  } else if (flask.id === 'barrier') {
    playerRunner.isBarrier = true;
    setTimeout(() => { playerRunner.isBarrier = false; }, (power / 100) * 3500);
    effects.push({ text: `組織硬化`, x: playerRunner.x + 19, y: playerRunner.y - 12, color: '#8957e5' });
  } else if (flask.id === 'meat') {
    effects.push({ text: `組織妨害`, x: canvas.width / 2, y: 150, color: '#da3633' });
    for (let i = 1; i < 4; i++) {
      const powResistance = Math.floor(runners[i].powAttr * 0.4);
      runners[i].knockback = Math.max(10, 45 - powResistance);
    }
  } else if (flask.id === 'heal') {
    playerRunner.stm = Math.min(playerRunner.maxStm, playerRunner.stm + 50);
    playerRunner.boostTimer = 70;
    effects.push({ text: `強心刺激`, x: playerRunner.x + 19, y: playerRunner.y - 12, color: '#238636' });
  }
  flask.charge = 0;
}

function aiTriggerSkill(runner) {
  const skills = ['mach', 'barrier', 'meat', 'heal'];
  const skill = skills[Math.floor(Math.random() * skills.length)];
  
  if (skill === 'mach') {
    runner.boostTimer = 100;
    effects.push({ text: `加速`, x: runner.x + 19, y: runner.y - 12, color: '#f87171' });
  } else if (skill === 'barrier') {
    runner.isBarrier = true;
    setTimeout(() => { runner.isBarrier = false; }, 2500);
    effects.push({ text: `硬化`, x: runner.x + 19, y: runner.y - 12, color: '#a371f7' });
  } else if (skill === 'meat') {
    effects.push({ text: `妨害！`, x: runner.x + 19, y: runner.y - 12, color: '#da3633' });
    runners.forEach(r => {
      if (r.id !== runner.id && !r.isBarrier) {
        r.knockback = Math.max(10, 35 - Math.floor(r.powAttr * 0.3));
      }
    });
  } else if (skill === 'heal') {
    runner.stm = Math.min(runner.maxStm, runner.stm + 40);
    effects.push({ text: `回復`, x: runner.x + 19, y: runner.y - 12, color: '#3fb950' });
  }
  runner.skillCd = Math.floor(Math.random() * 400) + 400;
}

function finishRace() {
  isGameRunning = false;
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
    if (r.knockback > 0) { r.knockback--; baseSpeed *= 0.25; }

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

  if (remainingDistance <= 0) { finishRace(); return; }

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

  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6); shakeTime--; }

  ctx.fillStyle = '#1e222a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  scrollY = (scrollY + 0.25) % 60;

  ctx.fillStyle = '#12151c';
  ctx.fillRect(0, 0, 10, canvas.height);
  ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);

  ctx.strokeStyle = '#333a48';
  ctx.lineWidth = 1;
  ctx.setLineDash([10, 15]);
  for (let x of [90, 170, 250]) {
    ctx.beginPath();
    ctx.moveTo(x, -60 + scrollY);
    ctx.lineTo(x, canvas.height + 60 + scrollY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 描画（パーツ合成の zData に丸ごとランナー情報を渡す）
  const drawOrder = [...runners].sort((a, b) => a.y - b.y);
  drawOrder.forEach(r => {
    drawZombieCharacter(ctx, r.x, r.y, 38, 42, r, r.stm <= 0, r.dist * 0.4);
    if (r.isBarrier) {
      ctx.strokeStyle = '#8957e5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x + 19, r.y + 20, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor') {
      p.y += 8; ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (p.y >= p.targetY) {
        shakeTime = 8;
        for (let j = 1; j < 4; j++) {
          const powResist = Math.floor(runners[j].powAttr * 0.3);
          runners[j].knockback = Math.max(8, 35 - powResist);
        }
        effects.push({ text: `衝撃波`, x: p.x, y: p.y, color: '#f87171' });
        particles.splice(i, 1);
      }
    }
  }

  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y); eff.y -= 0.8; if (eff.y < 120) effects.splice(i, 1);
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
      if (!isGameRunning || currentFlasks.length === 0) return;
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