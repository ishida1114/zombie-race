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
  color: '#86efac', // ゾンビらしい青緑色
  clothes: 'none',  // 服の種類 (none, patient, suit)
  head: 'none',     // 頭の装飾 (none, electrode, bandage)
  eye: 'hollow',    // 目の状態 (hollow, glow, stitched)
  speed: 50, power: 50, stamina: 50
};

let remainingTurns = 5;

// 🏃 4人の走者
const runners = [
  { id: 0, name: 'YOU', x: 25, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, color: '#86efac', clothes: 'none', head: 'none', eye: 'hollow', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 9999 },
  { id: 1, name: 'No.088', x: 105, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, color: '#fca5a5', clothes: 'patient', head: 'none', eye: 'glow', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 300 },
  { id: 2, name: 'No.204', x: 185, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, color: '#c4b5fd', clothes: 'none', head: 'bandage', eye: 'stitched', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 450 },
  { id: 3, name: 'No.305', x: 265, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, color: '#fde047', clothes: 'suit', head: 'electrode', eye: 'hollow', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 600 }
];

const particles = [];
const effects = [];

const ALL_SKILLS = [
  { id: 'meteor', name: '細胞活性', icon: '🧪', desc: '前方妨害', speed: 0.15 },
  { id: 'mach', name: '神経加速', icon: '⚡', desc: '一時加速', speed: 0.22 },
  { id: 'barrier', name: '硬化膜', icon: '🛡️', desc: '妨害無効', speed: 0.18 },
  { id: 'volcano', name: '暴走反応', icon: '🔥', desc: '大妨害', speed: 0.12 },
  { id: 'meat', name: '組織投与', icon: '🥩', desc: '全体妨害', speed: 0.16 },
  { id: 'heal', name: '強心刺激', icon: '💉', desc: 'スタミナ回復', speed: 0.20 }
];

let currentFlasks = [];

// 🎨 ドット絵生成エンジン（16x16ピクセルマップ）
function drawZombieCharacter(targetCtx, x, y, width, height, zData, isExhausted, distPhase) {
  targetCtx.save();
  const movePhase = isExhausted ? 0 : distPhase * 0.6;
  const bounce = isExhausted ? 0 : Math.abs(Math.sin(movePhase)) * 4;
  const bodyRoll = Math.sin(movePhase * 0.5) * 0.05;

  // 足元の影
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  targetCtx.beginPath();
  targetCtx.ellipse(x + width / 2, y + height, width / 2 - 4, 4, 0, 0, Math.PI * 2);
  targetCtx.fill();

  // 歩行バウンドと揺れ
  targetCtx.translate(x + width / 2, y + height - bounce);
  targetCtx.rotate(isExhausted ? 0.1 : bodyRoll);
  targetCtx.translate(-(x + width / 2), -(y + height));

  // 🧟 参考画像をリスペクトした16x16のゾンビドット絵配列
  const spriteMap = [
    "0000011111100000",
    "0000122222210000",
    "0001222222221000",
    "0012442224422100", // 大きな目
    "0014544245442100", // 瞳
    "0014444244442100",
    "0001222222221000",
    "0000115555110000", // 口
    "00001B5BB5B10000", // 歯と暗がり
    "0000011661100000", // 垂れた舌・血
    "0011177777711100", // 肩・服
    "0122177777712210", // 腕と胴体
    "0122119999112210", // 手とズボン
    "0011019999101100",
    "0000122112210000", // 足
    "0000111001110000"
  ];

  // パーツによるドット絵の上書き（装飾）
  if (zData.head === 'bandage') {
    spriteMap[1] = "00001DDDDDD10000"; // 包帯
    spriteMap[2] = "00012DDDDDD21000";
  } else if (zData.head === 'electrode') {
    spriteMap[0] = "0000011661100000"; // 赤いランプ
    spriteMap[1] = "0000111111110000"; // 装置基部
  }

  // 🎨 カラーパレット設定
  let skinColor = isExhausted ? '#64748b' : zData.color; // バテると血の気が引く
  let clothesColor = skinColor;
  if (zData.clothes === 'patient') clothesColor = '#94a3b8'; // 患者服
  else if (zData.clothes === 'suit') clothesColor = '#1e293b'; // 黒スーツ
  if (isExhausted) clothesColor = '#475569';

  const palette = {
    '0': null,
    '1': '#0f172a', // 輪郭線
    '2': skinColor, // 肌色
    '4': (zData.eye === 'glow') ? '#fca5a5' : (zData.eye === 'stitched' ? skinColor : '#f8fafc'), // 白目
    '5': (zData.eye === 'glow') ? '#ef4444' : (zData.eye === 'stitched' ? '#0f172a' : '#1e293b'), // 瞳
    '6': '#e11d48', // 舌・血
    '7': clothesColor, // 服
    '9': '#334155', // ズボン
    'B': '#cbd5e1', // 歯
    'D': '#e2e8f0'  // 包帯
  };

  // 16x16の配列をCanvasにピクセルとして描画
  const pixelSize = width / 16;
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const char = spriteMap[row][col];
      if (char !== '0' && palette[char]) {
        targetCtx.fillStyle = palette[char];
        targetCtx.fillRect(
          x + col * pixelSize, 
          y + row * pixelSize, 
          Math.ceil(pixelSize), 
          Math.ceil(pixelSize)
        );
      }
    }
  }

  // バテ状態の汗エフェクト
  if (isExhausted) {
    targetCtx.fillStyle = '#38bdf8';
    targetCtx.fillRect(x + width - 4, y + 4, 3, 5);
  }

  targetCtx.restore();
}

function generateRandomZombie() {
  const colors = ['#86efac', '#6ee7b7', '#93c5fd', '#fca5a5', '#d8b4fe'];
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
  
  // 育成画面に大きくドット絵を表示
  drawZombieCharacter(pCtx, 20, 16, 80, 80, currentZombie, false, globalTime * 0.5);

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
  runners[0] = { 
    ...runners[0], 
    spdAttr: currentZombie.speed, powAttr: currentZombie.power, color: currentZombie.color,
    clothes: currentZombie.clothes, head: currentZombie.head, eye: currentZombie.eye,
    maxStm: currentZombie.stamina * 2.2, stm: currentZombie.stamina * 2.2, dist: 0, boostTimer: 0, knockback: 0 
  };

  const clothesList = ['none', 'patient', 'suit'];
  const headList = ['none', 'bandage', 'electrode'];
  const eyeList = ['hollow', 'glow', 'stitched'];
  const colors = ['#86efac', '#6ee7b7', '#93c5fd', '#fca5a5', '#d8b4fe'];

  for (let i = 1; i < 4; i++) {
    runners[i].dist = 0;
    runners[i].color = colors[Math.floor(Math.random() * colors.length)];
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

  // 描画（ドット絵エンジン）
  const drawOrder = [...runners].sort((a, b) => a.y - b.y);
  drawOrder.forEach(r => {
    // 40x40のサイズでドット絵を描画
    drawZombieCharacter(ctx, r.x - 2, r.y, 40, 40, r, r.stm <= 0, r.dist);
    if (r.isBarrier) {
      ctx.strokeStyle = '#8957e5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x + 18, r.y + 20, 28, 0, Math.PI * 2);
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