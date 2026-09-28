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

// ユーザーが置いてくれた4枚の歩行画像だけを使用
const assets = {
  zombieWalk: [new Image(), new Image(), new Image(), new Image()]
};
assets.zombieWalk[0].src = '/zombie_walk1.png';
assets.zombieWalk[1].src = '/zombie_walk2.png';
assets.zombieWalk[2].src = '/zombie_walk3.png';
assets.zombieWalk[3].src = '/zombie_walk4.png';

let currentZombie = {
  name: '検体 No.101',
  hue: 0,
  head: 'none',   // none, cap(赤い帽子), worker(ヘルメット)
  eye: 'none',    // none, sunglasses(サングラス), bandage(目隠し包帯)
  speed: 50, power: 50, stamina: 50
};

let remainingTurns = 5;

const runners = [
  { id: 0, name: 'YOU', x: 20, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, hue: 0, head: 'none', eye: 'none', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 9999 },
  { id: 1, name: 'No.088', x: 100, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, hue: 90, head: 'worker', eye: 'none', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 300 },
  { id: 2, name: 'No.204', x: 180, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, hue: 180, head: 'none', eye: 'bandage', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 450 },
  { id: 3, name: 'No.305', x: 260, y: 220, dist: 0, stm: 100, maxStm: 100, spdAttr: 50, powAttr: 50, hue: 270, head: 'cap', eye: 'sunglasses', boostTimer: 0, isBarrier: false, knockback: 0, skillCd: 600 }
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

// 🎨 ドット絵画像 ＋ プログラムによる変形・合成処理
function drawZombieCharacter(targetCtx, x, y, width, height, zData, isExhausted, distPhase) {
  targetCtx.save();
  targetCtx.imageSmoothingEnabled = false; // ドット絵くっきり化

  let frameIndex = 0;
  let bounce = 0;
  const isKnockback = zData.knockback > 0; // ★ダメージ中かどうか判定

  if (!isExhausted && !isKnockback) {
    const animSpeed = distPhase * 0.8; 
    frameIndex = Math.floor(animSpeed) % 4;
    bounce = Math.abs(Math.sin(animSpeed * Math.PI / 2)) * 3;
  } else {
    frameIndex = Math.floor(globalTime * 0.04) % 4;
  }

  // 影
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  targetCtx.beginPath();
  targetCtx.ellipse(x + width / 2, y + height - 2, width / 2 - 4, 5, 0, 0, Math.PI * 2);
  targetCtx.fill();

  const img = assets.zombieWalk[frameIndex];

  if (img.complete && img.naturalWidth > 0) {
    let filterStr = `hue-rotate(${zData.hue}deg)`;

    // ★プログラムによる「のけぞり・ダメージ表現」
    if (isKnockback) {
      filterStr = 'brightness(150%) sepia(100%) hue-rotate(-50deg) saturate(300%)'; // ダメージで赤くフラッシュ
      targetCtx.translate(x + width / 2, y + height);
      targetCtx.rotate(-0.4); // 重心を軸に大きく後ろへ反けぞる（回転）
      targetCtx.translate(-(x + width / 2), -(y + height));
    } else if (isExhausted) {
      filterStr += ' grayscale(80%) brightness(0.6)';
      targetCtx.translate(x + width / 2, y + height);
      targetCtx.rotate(0.15); // バテると前に倒れ込む
      targetCtx.translate(-(x + width / 2), -(y + height));
    }

    targetCtx.filter = filterStr;

    // バウンド位置の計算
    const drawY = y - bounce;
    
    // ① 基本画像の描画
    targetCtx.drawImage(img, x, drawY, width, height);
    targetCtx.filter = 'none'; // フィルターリセット

    // ② ★画像を使わないプログラム着せ替え（Canvas APIで画像の上に図形を合成）
    
    // --- 頭の装飾 ---
    if (zData.head === 'cap') {
      targetCtx.fillStyle = '#dc2626'; // 赤いキャップ
      targetCtx.fillRect(x + 12, drawY - 2, width - 20, 8); // 帽子本体
      targetCtx.fillRect(x + 4, drawY + 4, width - 16, 3); // つば
    } else if (zData.head === 'worker') {
      targetCtx.fillStyle = '#facc15'; // 工事用ヘルメット（黄）
      targetCtx.beginPath();
      targetCtx.arc(x + width / 2 - 2, drawY + 6, width / 2 - 6, Math.PI, 0);
      targetCtx.fill();
      targetCtx.fillRect(x + 6, drawY + 6, width - 12, 3); // つば
    }

    // --- 目の装飾 ---
    if (zData.eye === 'sunglasses') {
      targetCtx.fillStyle = '#020617'; // サングラス（黒）
      targetCtx.fillRect(x + 10, drawY + 12, width - 18, 6); // レンズ
      targetCtx.fillStyle = '#f8fafc'; // レンズの反射光
      targetCtx.fillRect(x + 12, drawY + 13, 3, 2);
    } else if (zData.eye === 'bandage') {
      targetCtx.fillStyle = '#e2e8f0'; // 目隠し包帯
      targetCtx.fillRect(x + 8, drawY + 10, width - 12, 8);
      targetCtx.fillStyle = '#94a3b8'; // 包帯の影線
      targetCtx.fillRect(x + 8, drawY + 14, width - 12, 1);
    }

  } else {
    // フォールバック（画像がない場合）
    targetCtx.fillStyle = isExhausted ? '#64748b' : `hsl(${120 + zData.hue}, 60%, 50%)`;
    targetCtx.fillRect(x + 4, y + 10, width - 8, height - 14);
    targetCtx.fillRect(x + 2, y, width - 4, 16);
  }

  // 汗エフェクト
  if (isExhausted && !isKnockback) {
    targetCtx.fillStyle = '#38bdf8';
    targetCtx.fillRect(x + width - 6, y + 4, 3, 5);
  }

  targetCtx.restore();
}

function generateRandomZombie() {
  const num = Math.floor(Math.random() * 900) + 100;
  const headList = ['none', 'cap', 'worker'];
  const eyeList = ['none', 'sunglasses', 'bandage'];

  currentZombie = {
    name: `検体 No.${num}`,
    hue: Math.floor(Math.random() * 360),
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
  
  pCtx.imageSmoothingEnabled = false;
  pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  // 育成画面でもプログラム着せ替えを反映
  drawZombieCharacter(pCtx, 20, 10, 80, 100, currentZombie, false, globalTime * 0.1);

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
  
  runners[0] = { 
    ...runners[0], 
    spdAttr: currentZombie.speed, powAttr: currentZombie.power, hue: currentZombie.hue,
    head: currentZombie.head, eye: currentZombie.eye,
    maxStm: currentZombie.stamina * 2.2, stm: currentZombie.stamina * 2.2, dist: 0, boostTimer: 0, knockback: 0 
  };

  const headList = ['none', 'cap', 'worker'];
  const eyeList = ['none', 'sunglasses', 'bandage'];

  for (let i = 1; i < 4; i++) {
    runners[i].dist = 0;
    runners[i].hue = Math.floor(Math.random() * 360);
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
    effects.push({ text: `神経加速`, x: playerRunner.x + 24, y: playerRunner.y - 12, color: '#388bfd' });
  } else if (flask.id === 'barrier') {
    playerRunner.isBarrier = true;
    setTimeout(() => { playerRunner.isBarrier = false; }, (power / 100) * 3500);
    effects.push({ text: `組織硬化`, x: playerRunner.x + 24, y: playerRunner.y - 12, color: '#8957e5' });
  } else if (flask.id === 'meat') {
    effects.push({ text: `組織妨害`, x: canvas.width / 2, y: 150, color: '#da3633' });
    for (let i = 1; i < 4; i++) {
      const powResistance = Math.floor(runners[i].powAttr * 0.4);
      runners[i].knockback = Math.max(15, 60 - powResistance); // ノックバック時間を少し長めに
    }
  } else if (flask.id === 'heal') {
    playerRunner.stm = Math.min(playerRunner.maxStm, playerRunner.stm + 50);
    playerRunner.boostTimer = 70;
    effects.push({ text: `強心刺激`, x: playerRunner.x + 24, y: playerRunner.y - 12, color: '#238636' });
  }
  flask.charge = 0;
}

function aiTriggerSkill(runner) {
  const skills = ['mach', 'barrier', 'meat', 'heal'];
  const skill = skills[Math.floor(Math.random() * skills.length)];
  
  if (skill === 'mach') {
    runner.boostTimer = 100;
    effects.push({ text: `加速`, x: runner.x + 24, y: runner.y - 12, color: '#f87171' });
  } else if (skill === 'barrier') {
    runner.isBarrier = true;
    setTimeout(() => { runner.isBarrier = false; }, 2500);
    effects.push({ text: `硬化`, x: runner.x + 24, y: runner.y - 12, color: '#a371f7' });
  } else if (skill === 'meat') {
    effects.push({ text: `妨害！`, x: runner.x + 24, y: runner.y - 12, color: '#da3633' });
    runners.forEach(r => {
      if (r.id !== runner.id && !r.isBarrier) {
        r.knockback = Math.max(15, 50 - Math.floor(r.powAttr * 0.3));
      }
    });
  } else if (skill === 'heal') {
    runner.stm = Math.min(runner.maxStm, runner.stm + 40);
    effects.push({ text: `回復`, x: runner.x + 24, y: runner.y - 12, color: '#3fb950' });
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
  ctx.imageSmoothingEnabled = false;

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
    if (r.knockback > 0) { r.knockback--; baseSpeed *= 0; } // ★ダメージ中は完全に足が止まる

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

  const drawOrder = [...runners].sort((a, b) => a.y - b.y);
  drawOrder.forEach(r => {
    drawZombieCharacter(ctx, r.x - 4, r.y - 12, 48, 56, r, r.stm <= 0, r.dist);
    
    if (r.isBarrier) {
      ctx.strokeStyle = '#8957e5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x + 20, r.y + 16, 28, 0, Math.PI * 2);
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
          runners[j].knockback = Math.max(15, 60 - powResist);
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