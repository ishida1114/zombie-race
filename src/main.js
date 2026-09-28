const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let shakeTime = 0;
let scrollY = 0;
let currentScrollSpeed = 4;
const baseScrollSpeed = 4;

let remainingDistance = 1000;
let startTime = 0;

// プレイヤー＆ライバル
const player = { x: 155, y: 380, width: 46, height: 46, color: '#4ade80', isBarrier: false, barrierTimer: 0, boostTimer: 0 };
const rivals = [
  { x: 55, y: 150, width: 46, height: 46, color: '#f43f5e', name: '赤ゾンビ', knockback: 0 },
  { x: 255, y: 220, width: 46, height: 46, color: '#3b82f6', name: '青ゾンビ', knockback: 0 }
];

const particles = [];
const effects = [];

// 全スキルプール
const ALL_SKILLS = [
  { id: 'meteor', name: 'メテオ', icon: '☄️', speed: 0.12 },
  { id: 'mach', name: 'マッハ', icon: '⚡', speed: 0.20 },
  { id: 'barrier', name: 'バリア', icon: '🛡️', speed: 0.15 },
  { id: 'volcano', name: 'ボルケーノ', icon: '🌋', speed: 0.10 },
  { id: 'meat', name: '生肉まき', icon: '🥩', speed: 0.14 },
  { id: 'heal', name: 'ドーピング', icon: '💉', speed: 0.18 }
];

let currentFlasks = [];

// ランダムスキル選択
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

// レース開始（二重起動を厳格に防止）
function startRace() {
  if (isGameRunning) return; // すでに動いている場合はスキップ

  const titleScreen = document.getElementById('title-screen');
  const resultScreen = document.getElementById('result-screen');
  const raceScreen = document.getElementById('race-screen');

  if (titleScreen) titleScreen.classList.add('hidden');
  if (resultScreen) resultScreen.classList.add('hidden');
  if (raceScreen) raceScreen.classList.remove('hidden');

  remainingDistance = 1000;
  startTime = Date.now();
  player.y = 380;
  rivals[0].y = 150;
  rivals[1].y = 220;
  
  selectRandomFlasks();
  
  isGameRunning = true;
  requestAnimationFrame(update);
}

// スキル発動処理
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

// レース終了処理
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

// メイン描画ループ
function update() {
  if (!isGameRunning) return;

  // 1. フラスコ充填
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

  // 2. 移動・距離計算
  if (player.boostTimer > 0) { player.boostTimer--; currentScrollSpeed = baseScrollSpeed * 2.2; }
  else { currentScrollSpeed = baseScrollSpeed; }

  remainingDistance -= Math.floor(currentScrollSpeed * 0.4);
  if (remainingDistance <= 0) { remainingDistance = 0; finishRace(); return; }

  const distEl = document.getElementById('hud-dist');
  const rankEl = document.getElementById('hud-rank');
  if (distEl) distEl.textContent = `${remainingDistance}m`;
  
  const currentRank = [player.y, rivals[0].y, rivals[1].y].sort((a, b) => a - b).indexOf(player.y) + 1;
  if (rankEl) rankEl.textContent = `${currentRank}位`;

  if (player.barrierTimer > 0) { player.barrierTimer--; if (player.barrierTimer === 0) player.isBarrier = false; }

  // 3. Canvas描画
  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); shakeTime--; }

  // アスファルト道路背景
  ctx.fillStyle = '#2b303a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  scrollY = (scrollY + currentScrollSpeed) % 80;

  // 歩道・ガードレール
  ctx.fillStyle = '#1e232d';
  ctx.fillRect(0, 0, 20, canvas.height);
  ctx.fillRect(canvas.width - 20, 0, 20, canvas.height);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(20, 0, 4, canvas.height);
  ctx.fillRect(canvas.width - 24, 0, 4, canvas.height);

  // 昭和道路の黄色いセンターライン
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.setLineDash([30, 30]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, -80 + scrollY);
  ctx.lineTo(canvas.width / 2, canvas.height + 80 + scrollY);
  ctx.stroke();
  ctx.setLineDash([]);

  // レーンガイド
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

  // プレイヤー描画
  ctx.fillStyle = player.color; ctx.shadowColor = player.color; ctx.shadowBlur = 8;
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

  // テキスト演出
  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y); eff.y -= 1.5; if (eff.y < 150) effects.splice(i, 1);
  }

  ctx.restore();
  requestAnimationFrame(update);
}

// 初期化（クリーンなイベント登録）
function init() {
  const startBtn = document.getElementById('start-btn');
  const retryBtn = document.getElementById('retry-btn');

  if (startBtn) {
    startBtn.onclick = (e) => {
      e.preventDefault();
      startRace();
    };
  }

  if (retryBtn) {
    retryBtn.onclick = (e) => {
      e.preventDefault();
      isGameRunning = false;
      document.getElementById('result-screen').classList.add('hidden');
      document.getElementById('race-screen').classList.add('hidden');
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