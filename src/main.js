const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let shakeTime = 0;
let scrollY = 0;
let currentScrollSpeed = 4;
const baseScrollSpeed = 4;

// プレイヤー＆ライバル
const player = { x: 155, y: 380, width: 46, height: 46, color: '#4ade80', isBarrier: false, barrierTimer: 0, boostTimer: 0 };
const rivals = [
  { x: 55, y: 150, width: 46, height: 46, color: '#f43f5e', name: '赤ゾンビ', knockback: 0 },
  { x: 255, y: 220, width: 46, height: 46, color: '#3b82f6', name: '青ゾンビ', knockback: 0 }
];

const particles = [];
const effects = [];

const flasks = [
  { name: 'メテオ', charge: 0, max: 100, speed: 0.12 },
  { name: 'マッハ', charge: 0, max: 100, speed: 0.20 },
  { name: 'バリア', charge: 0, max: 100, speed: 0.15 }
];

// --- レース開始発動機能 ---
function startRace() {
  if (isGameRunning) return;
  
  const titleScreen = document.getElementById('title-screen');
  const raceScreen = document.getElementById('race-screen');

  if (titleScreen) titleScreen.classList.add('hidden');
  if (raceScreen) raceScreen.classList.remove('hidden');

  isGameRunning = true;
  requestAnimationFrame(update);
}

// スキル発動処理
function triggerSkill(index, power) {
  const isMax = power >= 100;
  if (index === 0) {
    particles.push({ type: 'meteor', x: canvas.width / 2, y: -50, targetY: 200, radius: isMax ? 40 : 20, power: power });
    if (isMax) shakeTime = 20;
  } else if (index === 1) {
    player.boostTimer = Math.floor((power / 100) * 120);
    effects.push({ text: `⚡ SPEED UP!!`, x: player.x + 23, y: player.y - 10, color: '#38bdf8' });
  } else if (index === 2) {
    player.isBarrier = true;
    player.barrierTimer = Math.floor((power / 100) * 180);
    effects.push({ text: `🛡️ BARRIER!!`, x: player.x + 23, y: player.y - 10, color: '#a855f7' });
  }
  flasks[index].charge = 0;
}

// ループ処理
function update() {
  if (!isGameRunning) return;

  // 1. フラスコ充填
  flasks.forEach((flask, index) => {
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

  // 2. 移動＆計算
  if (player.boostTimer > 0) { player.boostTimer--; currentScrollSpeed = baseScrollSpeed * 2.5; }
  else { currentScrollSpeed = baseScrollSpeed; }

  if (player.barrierTimer > 0) { player.barrierTimer--; if (player.barrierTimer === 0) player.isBarrier = false; }

  // 3. 画面描画
  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); shakeTime--; }
  ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);

  // 背景
  scrollY = (scrollY + currentScrollSpeed) % 60;
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.setLineDash([20, 20]);
  for (let x of [120, 240]) { ctx.beginPath(); ctx.moveTo(x, -60 + scrollY); ctx.lineTo(x, canvas.height + 60 + scrollY); ctx.stroke(); }
  ctx.setLineDash([]);

  // ライバル
  rivals.forEach(r => {
    if (r.knockback > 0) { r.y += 4; r.knockback--; }
    else { if (player.boostTimer > 0) r.y += 3; else r.y += (Math.random() - 0.48) * 2; }
    if (r.y < 50) r.y = 50; if (r.y > 420) r.y = 420;
    ctx.fillStyle = r.color; ctx.fillRect(r.x, r.y, r.width, r.height);
  });

  // プレイヤー
  ctx.fillStyle = player.color; ctx.shadowColor = player.color; ctx.shadowBlur = 10;
  ctx.fillRect(player.x, player.y, player.width, player.height); ctx.shadowBlur = 0;

  if (player.isBarrier) {
    ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 4; ctx.beginPath();
    ctx.arc(player.x + 23, player.y + 23, 35, 0, Math.PI * 2); ctx.stroke();
  }

  // パーティクル（メテオ）
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

  // テキスト
  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y); eff.y -= 1.5; if (eff.y < 150) effects.splice(i, 1);
  }

  ctx.restore();
  requestAnimationFrame(update);
}

// 初期化
function init() {
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startRace);
    startBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startRace();
    });
  }

  document.querySelectorAll('.flask-card').forEach((card) => {
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const index = parseInt(card.dataset.index);
      const flask = flasks[index];
      if (flask.charge >= 10) { triggerSkill(index, Math.floor(flask.charge)); }
      else { effects.push({ text: '液不足！', x: player.x + 23, y: player.y - 10, color: '#94a3b8' }); }
    });
  });
}

// DOM読み込み完了後に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}