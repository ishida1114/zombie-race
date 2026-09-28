const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let shakeTime = 0;
let scrollY = 0;

// 🚶 スピードを大幅に低下（「歩く」くらいのじわじわ移動）
let currentScrollSpeed = 0.8;
const baseScrollSpeed = 0.8;

// 距離を長く（約35〜45秒間のデッドヒート）
let remainingDistance = 1000;
const totalDistance = 1000;
let startTime = 0;

// 🧪 プレイヤー（YOU）
let currentZombie = {
  name: '検体 No.101',
  color: '#3fb950', // 緑
  speed: 50,
  power: 50,
  stamina: 50
};

let remainingTurns = 5;

// 🏃 4人の走者（プレイヤー ＋ AI 3人）
const runners = [
  { id: 0, name: 'YOU', x: 25, y: 280, width: 38, height: 42, color: '#3fb950', speedBonus: 0, boostTimer: 0, isBarrier: false, knockback: 0 },
  { id: 1, name: 'No.088', x: 105, y: 285, width: 38, height: 42, color: '#f85149', speedBonus: 0, boostTimer: 0, isBarrier: false, knockback: 0 },
  { id: 2, name: 'No.204', x: 185, y: 275, width: 38, height: 42, color: '#a371f7', speedBonus: 0, boostTimer: 0, isBarrier: false, knockback: 0 },
  { id: 3, name: 'No.305', x: 265, y: 290, width: 38, height: 42, color: '#d29922', speedBonus: 0, boostTimer: 0, isBarrier: false, knockback: 0 }
];

const particles = [];
const effects = [];

const ALL_SKILLS = [
  { id: 'meteor', name: '細胞活性', icon: '🧪', speed: 0.12 },
  { id: 'mach', name: '神経加速', icon: '⚡', speed: 0.20 },
  { id: 'barrier', name: '硬化膜', icon: '🛡️', speed: 0.15 },
  { id: 'volcano', name: '暴走反応', icon: '🔥', speed: 0.10 },
  { id: 'meat', name: '組織投与', icon: '🥩', speed: 0.14 },
  { id: 'heal', name: '強心刺激', icon: '💉', speed: 0.18 }
];

let currentFlasks = [];

// 🎨 ゾンビの描画（影、落ちくぼんだ目、検体タグなどのグラフィック表現）
function drawZombieCharacter(targetCtx, x, y, width, height, color) {
  // 足元の影
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  targetCtx.beginPath();
  targetCtx.ellipse(x + width / 2, y + height + 2, width / 2, 6, 0, 0, Math.PI * 2);
  targetCtx.fill();

  // 胴体（うつむいて歩く前傾姿勢）
  targetCtx.fillStyle = color;
  targetCtx.fillRect(x + 4, y + 10, width - 8, height - 10);

  // 頭部
  targetCtx.fillRect(x + 2, y, width - 4, 16);

  // 落ちくぼんだ目（暗がり）
  targetCtx.fillStyle = '#090a0f';
  targetCtx.fillRect(x + 8, y + 4, 7, 7);
  targetCtx.fillRect(x + 23, y + 4, 7, 7);

  // 小さな光のない目（白）
  targetCtx.fillStyle = '#cbd5e1';
  targetCtx.fillRect(x + 10, y + 6, 2, 2);
  targetCtx.fillRect(x + 25, y + 6, 2, 2);

  // 口（引きつった傷痕）
  targetCtx.fillStyle = '#1e293b';
  targetCtx.fillRect(x + 10, y + 13, 18, 1);

  // 検体識別マーカー（首元の耳タグ風）
  targetCtx.fillStyle = '#f87171';
  targetCtx.fillRect(x, y + 16, 4, 6);
}

// 🧪 育成スカウト
function generateRandomZombie() {
  const corpseColors = ['#3fb950', '#2ea043', '#238636'];
  const num = Math.floor(Math.random() * 900) + 100;

  currentZombie = {
    name: `検体 No.${num}`,
    color: corpseColors[Math.floor(Math.random() * corpseColors.length)],
    speed: Math.floor(Math.random() * 15) + 45,
    power: Math.floor(Math.random() * 15) + 45,
    stamina: Math.floor(Math.random() * 15) + 45
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
  drawZombieCharacter(pCtx, 41, 38, 38, 42, currentZombie.color);

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

  if (type === 'spd') currentZombie.speed += Math.floor(Math.random() * 8) + 8;
  if (type === 'pow') currentZombie.power += Math.floor(Math.random() * 8) + 8;
  if (type === 'stm') currentZombie.stamina += Math.floor(Math.random() * 8) + 8;

  remainingTurns--;
  updateNurtureUI();
}

// 🏁 レース開始
function startRace() {
  if (isGameRunning) return;

  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('nurture-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('race-screen').classList.remove('hidden');

  remainingDistance = totalDistance;
  startTime = Date.now();
  
  // 4人の初期設定（中央〜やや下のスタート位置）
  runners[0].color = currentZombie.color;
  runners[0].speedBonus = (currentZombie.speed - 50) * 0.01;
  runners[0].y = 280;

  for (let i = 1; i < 4; i++) {
    runners[i].y = 280 + (Math.random() - 0.5) * 20;
    runners[i].speedBonus = (Math.random() - 0.5) * 0.1;
    runners[i].boostTimer = 0;
    runners[i].knockback = 0;
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
    if (iconEl) iconEl.textContent = flask.icon;
    if (nameEl) nameEl.textContent = flask.name;
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
    playerRunner.boostTimer = Math.floor((power / 100) * 120);
    effects.push({ text: `加速反応`, x: playerRunner.x + 19, y: playerRunner.y - 12, color: '#388bfd' });
  } else if (flask.id === 'barrier') {
    playerRunner.isBarrier = true;
    setTimeout(() => { playerRunner.isBarrier = false; }, (power / 100) * 3000);
    effects.push({ text: `組織硬化`, x: playerRunner.x + 19, y: playerRunner.y - 12, color: '#8957e5' });
  } else if (flask.id === 'meat') {
    effects.push({ text: `組織投擲`, x: canvas.width / 2, y: 150, color: '#da3633' });
    for (let i = 1; i < 4; i++) runners[i].knockback = 35;
  } else if (flask.id === 'heal') {
    effects.push({ text: `強心刺激`, x: playerRunner.x + 19, y: playerRunner.y - 12, color: '#238636' });
    playerRunner.boostTimer = 80;
  }

  flask.charge = 0;
}

function finishRace() {
  isGameRunning = false;
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // 順位確定（Y座標が小さい＝画面の上＝先頭）
  const sorted = [...runners].sort((a, b) => a.y - b.y);
  const playerRank = sorted.findIndex(r => r.id === 0) + 1;

  const badgeEl = document.getElementById('result-rank-badge');
  const detailEl = document.getElementById('result-detail');
  const resultScreen = document.getElementById('result-screen');

  if (badgeEl) badgeEl.textContent = `${playerRank}位`;
  if (detailEl) detailEl.textContent = `走破タイム: ${elapsedSec}秒`;
  if (resultScreen) resultScreen.classList.remove('hidden');
}

function update() {
  if (!isGameRunning) return;

  // フラスコ充填
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

  // レース進行とノロノロ速度の移動計算
  const playerRunner = runners[0];
  let pSpeed = baseScrollSpeed + playerRunner.speedBonus;
  if (playerRunner.boostTimer > 0) {
    playerRunner.boostTimer--;
    pSpeed *= 1.8;
  }

  remainingDistance -= pSpeed * 0.25;
  if (remainingDistance <= 0) {
    remainingDistance = 0;
    finishRace();
    return;
  }

  // 4人の個別AI・ノックバック・前後ゆらぎ移動
  for (let i = 0; i < 4; i++) {
    const r = runners[i];
    if (r.knockback > 0) {
      r.y += 1.5; // 被弾・踏みとどまり減速
      r.knockback--;
    } else {
      // プレイヤー基準の相対位置ズレ
      if (i !== 0) {
        let rSpeed = baseScrollSpeed + r.speedBonus;
        if (r.boostTimer > 0) { r.boostTimer--; rSpeed *= 1.8; }
        
        // プレイヤーとの相対移動（じわじわ差が開く・縮まる）
        r.y += (pSpeed - rSpeed) * 0.8 + (Math.random() - 0.5) * 0.4;
      }
    }
    
    // 移動可能可視領域（画面中央部を維持）
    if (r.y < 80) r.y = 80;
    if (r.y > 360) r.y = 360;
  }

  // HUD & 進行ミニマップ（横一列メーター）の更新
  document.getElementById('hud-dist').textContent = `${Math.floor(remainingDistance)}m`;

  const sortedRunners = [...runners].sort((a, b) => a.y - b.y);
  const myRank = sortedRunners.findIndex(r => r.id === 0) + 1;
  document.getElementById('hud-rank').textContent = `${myRank}位 / 4人`;

  // 横一列のミニマップ進行度反映
  const progressRatio = 1 - (remainingDistance / totalDistance);
  for (let i = 0; i < 4; i++) {
    const r = runners[i];
    // Y座標の位置ズレをコース全体の微差としてメーターに反映
    const relativeOffset = (280 - r.y) / 5000;
    const individualProgress = Math.min(1, Math.max(0, progressRatio + relativeOffset));
    
    const markerEl = document.getElementById(`runner-marker-${i}`);
    if (markerEl) {
      markerEl.style.left = `${individualProgress * 100}%`;
    }
  }

  // 描画処理
  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6); shakeTime--; }

  // 1. 日常のアスファルト道路
  ctx.fillStyle = '#1e222a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  scrollY = (scrollY + pSpeed) % 60;

  // 2. 4レーンの道路仕切り（歩道・レーン線）
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

  // 黄色の薄い中央線
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(170, -60 + scrollY);
  ctx.lineTo(170, canvas.height + 60 + scrollY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3. 4人のゾンビ描画
  // Y座標順（後ろから順に描画して重なりを自然にする）
  const drawOrder = [...runners].sort((a, b) => b.y - a.y);
  drawOrder.forEach(r => {
    drawZombieCharacter(ctx, r.x, r.y, r.width, r.height, r.color);

    if (r.isBarrier) {
      ctx.strokeStyle = '#8957e5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x + 19, r.y + 20, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // パーティクル（メテオ）
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor') {
      p.y += 8; ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (p.y >= p.targetY) {
        shakeTime = 8;
        for (let j = 1; j < 4; j++) runners[j].knockback = Math.floor((p.power / 100) * 25);
        effects.push({ text: `衝撃波`, x: p.x, y: p.y, color: '#f87171' });
        particles.splice(i, 1);
      }
    }
  }

  // テキスト演出
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}