const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let shakeTime = 0;
let scrollY = 0;
let currentScrollSpeed = 4;
const baseScrollSpeed = 4;

let remainingDistance = 1000;
let startTime = 0;

// 🧪 ゾンビデータ（冷徹な検体パラメータ）
let currentZombie = {
  name: '検体 No.101',
  color: '#526058', // 灰緑色
  eyeType: 'hollow',
  speed: 50,
  power: 50,
  stamina: 50
};

let remainingTurns = 5;

// プレイヤー＆ライバル（冷たいトーンのゾンビ群）
const player = { x: 155, y: 380, width: 44, height: 44, color: '#526058', isBarrier: false, barrierTimer: 0, boostTimer: 0 };
const rivals = [
  { x: 55, y: 150, width: 44, height: 44, color: '#4a5568', name: '検体 No.088', knockback: 0 },
  { x: 255, y: 220, width: 44, height: 44, color: '#634e56', name: '検体 No.204', knockback: 0 }
];

const particles = [];
const effects = [];

const ALL_SKILLS = [
  { id: 'meteor', name: '細胞活性', icon: '🧪', speed: 0.12 },
  { id: 'mach', name: '神経加速', icon: '⚡', speed: 0.20 },
  { id: 'barrier', name: '硬化膜', icon: '🛡️', speed: 0.15 },
  { id: 'volcano', name: '暴走反応', icon: '🔥', speed: 0.10 },
  { id: 'meat', name: '組織投与', icon: '🥩', speed: 0.14 },
  { id: 'heal', name: '強心剤', icon: '💉', speed: 0.18 }
];

let currentFlasks = [];

// 🎨 ゾンビ描画：過度なアニメ表現を排除した淡々とした個体描画
function drawZombieCharacter(targetCtx, x, y, width, height, color, eyeType) {
  // 人型素体（落ちついた死体色）
  targetCtx.fillStyle = color;
  targetCtx.fillRect(x, y, width, height);

  // 落ちくぼんだ眼孔
  targetCtx.fillStyle = '#0f1117';
  targetCtx.fillRect(x + 9, y + 10, 8, 8);
  targetCtx.fillRect(x + 27, y + 10, 8, 8);

  // 小さな虹彩（無機質な視線）
  targetCtx.fillStyle = '#d1d5db';
  targetCtx.fillRect(x + 12, y + 13, 2, 2);
  targetCtx.fillRect(x + 30, y + 13, 2, 2);

  // 口元・縫い痕
  targetCtx.fillStyle = '#111827';
  targetCtx.fillRect(x + 12, y + 26, 20, 2);
  
  // 耳タグ／管理識別記号風のマーキング
  targetCtx.fillStyle = '#e5e7eb';
  targetCtx.fillRect(x + 2, y + 4, 4, 6);
}

// 🧪 個体スカウト（淡々とした抽選）
function generateRandomZombie() {
  const corpseColors = ['#4a584e', '#3d4d5c', '#5a4d4d', '#525252']; // 灰緑, 灰青, くすみ赤紫, 暗灰色
  const num = Math.floor(Math.random() * 900) + 100;

  currentZombie = {
    name: `検体 No.${num}`,
    color: corpseColors[Math.floor(Math.random() * corpseColors.length)],
    eyeType: 'hollow',
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
  drawZombieCharacter(pCtx, 38, 38, 44, 44, currentZombie.color, currentZombie.eyeType);

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

function startRace() {
  if (isGameRunning) return;

  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('nurture-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('race-screen').classList.remove('hidden');

  remainingDistance = 1000;
  startTime = Date.now();
  
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
    particles.push({ type: 'meteor', x: canvas.width / 2, y: -50, targetY: 200, radius: isMax ? 35 : 18, power: power });
    if (isMax) shakeTime = 12;
  } else if (flask.id === 'mach') {
    player.boostTimer = Math.floor((power / 100) * 100);
    effects.push({ text: `加速反応`, x: player.x + 22, y: player.y - 12, color: '#388bfd' });
  } else if (flask.id === 'barrier') {
    player.isBarrier = true;
    player.barrierTimer = Math.floor((power / 100) * 150);
    effects.push({ text: `組織硬化`, x: player.x + 22, y: player.y - 12, color: '#8957e5' });
  } else if (flask.id === 'meat') {
    effects.push({ text: `組織投擲`, x: canvas.width / 2, y: 150, color: '#da3633' });
    rivals.forEach(r => r.knockback = 30);
  } else if (flask.id === 'heal') {
    effects.push({ text: `強心刺激`, x: player.x + 22, y: player.y - 12, color: '#238636' });
    player.boostTimer = 50;
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
  if (detailEl) detailEl.textContent = `走破タイム: ${elapsedSec}秒`;
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

  const spdBonus = (currentZombie.speed - 50) * 0.02;
  if (player.boostTimer > 0) { player.boostTimer--; currentScrollSpeed = (baseScrollSpeed + spdBonus) * 2.0; }
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
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8); shakeTime--; }

  // 1. 日本の日常のアスファルト道路
  ctx.fillStyle = '#21252d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  scrollY = (scrollY + currentScrollSpeed) % 80;

  // 2. 側道・ガードレール
  ctx.fillStyle = '#16191f';
  ctx.fillRect(0, 0, 18, canvas.height);
  ctx.fillRect(canvas.width - 18, 0, 18, canvas.height);

  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(18, 0, 2, canvas.height);
  ctx.fillRect(canvas.width - 20, 0, 2, canvas.height);

  // 3. 黄色のセンターライン（日本の一般的な道路）
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 4;
  ctx.setLineDash([24, 24]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, -80 + scrollY);
  ctx.lineTo(canvas.width / 2, canvas.height + 80 + scrollY);
  ctx.stroke();
  ctx.setLineDash([]);

  // レーン境界線
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.setLineDash([12, 18]);
  for (let x of [100, 260]) {
    ctx.beginPath();
    ctx.moveTo(x, -80 + scrollY);
    ctx.lineTo(x, canvas.height + 80 + scrollY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // ライバル描画
  rivals.forEach(r => {
    if (r.knockback > 0) { r.y += 3; r.knockback--; }
    else { if (player.boostTimer > 0) r.y += 2; else r.y += (Math.random() - 0.48) * 1.5; }
    if (r.y < 50) r.y = 50; if (r.y > 380) r.y = 380;
    drawZombieCharacter(ctx, r.x, r.y, r.width, r.height, r.color, 'hollow');
  });

  // プレイヤー描画
  drawZombieCharacter(ctx, player.x, player.y, player.width, player.height, player.color, currentZombie.eyeType);

  if (player.isBarrier) {
    ctx.strokeStyle = '#8957e5'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.arc(player.x + 22, player.y + 22, 30, 0, Math.PI * 2); ctx.stroke();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor') {
      p.y += 10; ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (p.y >= p.targetY) {
        shakeTime = 10; rivals.forEach(r => r.knockback = Math.floor((p.power / 100) * 25));
        effects.push({ text: `衝撃波`, x: p.x, y: p.y, color: '#f87171' });
        particles.splice(i, 1);
      }
    }
  }

  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y); eff.y -= 1.2; if (eff.y < 150) effects.splice(i, 1);
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