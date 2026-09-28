const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let shakeTime = 0;
let scrollY = 0;
let currentScrollSpeed = 4;
const baseScrollSpeed = 4;

let remainingDistance = 1000;
let startTime = 0;

// 🧪 ゾンビデータ（パーツ・ステータス）
let currentZombie = {
  name: '検体 No.13',
  color: '#4ade80', // 肌の色
  eyeType: 'normal',
  speed: 50,
  power: 50,
  stamina: 50
};

let remainingTurns = 5;

// プレイヤー＆ライバル
const player = { x: 155, y: 380, width: 46, height: 46, color: '#4ade80', isBarrier: false, barrierTimer: 0, boostTimer: 0 };
const rivals = [
  { x: 55, y: 150, width: 46, height: 46, color: '#f43f5e', name: '赤ゾンビ', knockback: 0 },
  { x: 255, y: 220, width: 46, height: 46, color: '#3b82f6', name: '青ゾンビ', knockback: 0 }
];

const particles = [];
const effects = [];

const ALL_SKILLS = [
  { id: 'meteor', name: 'メテオ', icon: '☄️', speed: 0.12 },
  { id: 'mach', name: 'マッハ', icon: '⚡', speed: 0.20 },
  { id: 'barrier', name: 'バリア', icon: '🛡️', speed: 0.15 },
  { id: 'volcano', name: 'ボルケーノ', icon: '🌋', speed: 0.10 },
  { id: 'meat', name: '生肉まき', icon: '🥩', speed: 0.14 },
  { id: 'heal', name: 'ドーピング', icon: '💉', speed: 0.18 }
];

let currentFlasks = [];

// 🎨 ゾンビ描画関数（育成画面 ＆ レース画面で共用）
function drawZombieCharacter(targetCtx, x, y, width, height, color, eyeType) {
  // 体
  targetCtx.fillStyle = color;
  targetCtx.fillRect(x, y, width, height);

  // 目
  targetCtx.fillStyle = '#ffffff';
  targetCtx.fillRect(x + 8, y + 12, 10, 10);
  targetCtx.fillRect(x + 28, y + 12, 10, 10);

  targetCtx.fillStyle = '#000000';
  if (eyeType === 'angry') {
    targetCtx.fillRect(x + 10, y + 14, 6, 6);
    targetCtx.fillRect(x + 30, y + 14, 6, 6);
  } else {
    targetCtx.fillRect(x + 12, y + 14, 4, 4);
    targetCtx.fillRect(x + 30, y + 14, 4, 4);
  }

  // 縫い目（ゾンビ感）
  targetCtx.strokeStyle = '#1e293b';
  targetCtx.lineWidth = 2;
  targetCtx.beginPath();
  targetCtx.moveTo(x + 5, y + 30);
  targetCtx.lineTo(x + 40, y + 30);
  targetCtx.stroke();
}

// 🧪 育成：野良ゾンビ生成（スカウト）
function generateRandomZombie() {
  const colors = ['#4ade80', '#38bdf8', '#f43f5e', '#facc15']; // 緑, 青, 赤, 黄
  const eyes = ['normal', 'angry'];
  const num = Math.floor(Math.random() * 900) + 100;

  currentZombie = {
    name: `検体 No.${num}`,
    color: colors[Math.floor(Math.random() * colors.length)],
    eyeType: eyes[Math.floor(Math.random() * eyes.length)],
    speed: Math.floor(Math.random() * 20) + 40,
    power: Math.floor(Math.random() * 20) + 40,
    stamina: Math.floor(Math.random() * 20) + 40
  };

  remainingTurns = 5;
  updateNurtureUI();
}

// 🧪 育成画面のUI更新 ＆ ゾンビプレビュー描画
function updateNurtureUI() {
  document.getElementById('nurture-turn-txt').textContent = `残 ${remainingTurns} ターン`;
  document.getElementById('nurture-zombie-name').textContent = currentZombie.name;
  document.getElementById('stat-spd').textContent = currentZombie.speed;
  document.getElementById('stat-pow').textContent = currentZombie.power;
  document.getElementById('stat-stm').textContent = currentZombie.stamina;

  const previewCanvas = document.getElementById('zombieCanvas');
  const pCtx = previewCanvas.getContext('2d');
  pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  drawZombieCharacter(pCtx, 30, 30, 60, 60, currentZombie.color, currentZombie.eyeType);

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

// 🧪 コマンド実行（トレーニング）
function executeCommand(type) {
  if (remainingTurns <= 0) return;

  if (type === 'spd') currentZombie.speed += Math.floor(Math.random() * 10) + 10;
  if (type === 'pow') currentZombie.power += Math.floor(Math.random() * 10) + 10;
  if (type === 'stm') currentZombie.stamina += Math.floor(Math.random() * 10) + 10;

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

  remainingDistance = 1000;
  startTime = Date.now();
  
  // 育てたステータスを反映
  player.color = currentZombie.color;
  player.y = 380;
  rivals[0].y = 150;
  rivals[1].y = 220;
  
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

  if (flask.id === 'meteor' || flask.id === 'volcano') {
    particles.push({ type: 'meteor', x: canvas.width / 2, y: -50, targetY: 200, radius: isMax ? 40 : 20, power: power });
    if (isMax) shakeTime = 20;
  } else if (flask.id === 'mach') {
    player.boostTimer = Math.floor((power / 100) * 120);
    effects.push({ text: `⚡ ダッシュ!!`, x: player.x + 23, y: player.y - 10, color: '#38bdf8' });
  } else if (flask.id === 'barrier') {
    player.isBarrier = true;
    player.barrierTimer = Math.floor((power / 100) * 180);
    effects.push({ text: `🛡️ バリア!!`, x: player.x + 23, y: player.y - 10, color: '#a855f7' });
  } else if (flask.id === 'meat') {
    effects.push({ text: `🥩 生肉トラップ!!`, x: canvas.width / 2, y: 150, color: '#f43f5e' });
    rivals.forEach(r => r.knockback = 40);
  } else if (flask.id === 'heal') {
    effects.push({ text: `💉 ドーピング!!`, x: player.x + 23, y: player.y - 10, color: '#4ade80' });
    player.boostTimer = 60;
  }

  flask.charge = 0;
}

function finishRace() {
  isGameRunning = false;
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  const allRunners = [
    { name: 'YOU', y: player.y },
    { name: rivals[0].name, y: rivals[0].y },
    { name: rivals[1].name, y: rivals[1].y }
  ].sort((a, b) => a.y - b.y);

  const playerRank = allRunners.findIndex(r => r.name === 'YOU') + 1;
  const rankText = playerRank === 1 ? '1位' : playerRank === 2 ? '2位' : '3位';

  const badgeEl = document.getElementById('result-rank-badge');
  const detailEl = document.getElementById('result-detail');
  const resultScreen = document.getElementById('result-screen');

  if (badgeEl) badgeEl.textContent = rankText;
  if (detailEl) detailEl.textContent = `タイム: ${elapsedSec}秒`;
  if (resultScreen) resultScreen.classList.remove('hidden');
}

function update() {
  if (!isGameRunning) return;

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

  // 育てたスピード値が基本速度に影響
  const spdBonus = (currentZombie.speed - 50) * 0.02;
  if (player.boostTimer > 0) { player.boostTimer--; currentScrollSpeed = (baseScrollSpeed + spdBonus) * 2.2; }
  else { currentScrollSpeed = baseScrollSpeed + spdBonus; }

  remainingDistance -= Math.floor(currentScrollSpeed * 0.4);
  if (remainingDistance <= 0) { remainingDistance = 0; finishRace(); return; }

  const distEl = document.getElementById('hud-dist');
  const rankEl = document.getElementById('hud-rank');
  if (distEl) distEl.textContent = `${remainingDistance}m`;
  
  const currentRank = [player.y, rivals[0].y, rivals[1].y].sort((a, b) => a - b).indexOf(player.y) + 1;
  if (rankEl) rankEl.textContent = `${currentRank}位`;

  if (player.barrierTimer > 0) { player.barrierTimer--; if (player.barrierTimer === 0) player.isBarrier = false; }

  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); shakeTime--; }

  ctx.fillStyle = '#2b303a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  scrollY = (scrollY + currentScrollSpeed) % 80;

  ctx.fillStyle = '#1e232d';
  ctx.fillRect(0, 0, 20, canvas.height);
  ctx.fillRect(canvas.width - 20, 0, 20, canvas.height);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(20, 0, 4, canvas.height);
  ctx.fillRect(canvas.width - 24, 0, 4, canvas.height);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.setLineDash([30, 30]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, -80 + scrollY);
  ctx.lineTo(canvas.width / 2, canvas.height + 80 + scrollY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.setLineDash([15, 20]);
  for (let x of [100, 260]) {
    ctx.beginPath();
    ctx.moveTo(x, -80 + scrollY);
    ctx.lineTo(x, canvas.height + 80 + scrollY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ライバル描画
  rivals.forEach(r => {
    if (r.knockback > 0) { r.y += 4; r.knockback--; }
    else { if (player.boostTimer > 0) r.y += 2.5; else r.y += (Math.random() - 0.48) * 1.8; }
    if (r.y < 50) r.y = 50; if (r.y > 380) r.y = 380;
    ctx.fillStyle = r.color; ctx.fillRect(r.x, r.y, r.width, r.height);
  });

  // プレイヤー描画（育てたパーツゾンビ）
  drawZombieCharacter(ctx, player.x, player.y, player.width, player.height, player.color, currentZombie.eyeType);

  if (player.isBarrier) {
    ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 4; ctx.beginPath();
    ctx.arc(player.x + 23, player.y + 23, 35, 0, Math.PI * 2); ctx.stroke();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor') {
      p.y += 12; ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (p.y >= p.targetY) {
        shakeTime = 15; rivals.forEach(r => r.knockback = Math.floor((p.power / 100) * 30));
        effects.push({ text: `💥 BOOM!!`, x: p.x, y: p.y, color: '#ef4444' });
        particles.splice(i, 1);
      }
    }
  }

  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y); eff.y -= 1.5; if (eff.y < 150) effects.splice(i, 1);
  }

  ctx.restore();
  requestAnimationFrame(update);
}

function init() {
  const startBtn = document.getElementById('start-btn');
  const toRaceBtn = document.getElementById('to-race-btn');
  const retryBtn = document.getElementById('retry-btn');

  // スタート ＞ 育成画面へ
  if (startBtn) {
    startBtn.onclick = (e) => {
      e.preventDefault();
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('nurture-screen').classList.remove('hidden');
      generateRandomZombie();
    };
  }

  // 育成終了 ＞ レース画面へ
  if (toRaceBtn) {
    toRaceBtn.onclick = (e) => {
      e.preventDefault();
      startRace();
    };
  }

  // 育成コマンドタップ
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
      } else {
        effects.push({ text: '液不足！', x: player.x + 23, y: player.y - 10, color: '#94a3b8' });
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}