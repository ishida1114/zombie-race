const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let raceState = 'INIT';
let startCountdown = 3.0;
let shakeTime = 0;
let scrollY = 0;
let globalTime = 0;

let remainingDistance = 1000;
const totalDistance = 1000;
let startTime = 0;

const ZOMBIE_COLORS = [
  { name: '標準', filter: 'none' },
  { name: '猛毒', filter: 'hue-rotate(90deg) saturate(120%)' },
  { name: '深淵', filter: 'hue-rotate(210deg) saturate(100%) brightness(0.9)' },
  { name: '狂暴', filter: 'hue-rotate(-50deg) saturate(150%) brightness(1.1)' },
  { name: '蒼白', filter: 'grayscale(70%) brightness(1.2) hue-rotate(180deg)' },
  { name: '黒曜', filter: 'grayscale(60%) brightness(0.6) contrast(1.3)' },
];

const ZOMBIE_SIZES = [
  { name: '標準', scaleX: 1.0, scaleY: 1.0 },
  { name: '巨漢', scaleX: 1.25, scaleY: 1.3 },
  { name: '肥満', scaleX: 1.3, scaleY: 0.95 }
];

const RUNNING_STYLES = ['逃げ', '先行', '差し', '追込'];

const zombieVideo = document.createElement('video');
zombieVideo.src = '/zombie1.mp4';
zombieVideo.loop = true;
zombieVideo.muted = true;
zombieVideo.playsInline = true;
zombieVideo.autoplay = true;
zombieVideo.addEventListener('canplay', () => zombieVideo.play().catch(() => {}));

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
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > 80 && g > r * 1.2 && g > b * 1.2) data[i + 3] = 0;
  }
  offCtx.putImageData(imgData, 0, 0);
  return offCanvas;
}

// 🧪 構想通りの全ステータス
let currentZombie = {
  name: '検体 No.101',
  colorInfo: ZOMBIE_COLORS[0],
  sizeInfo: ZOMBIE_SIZES[0],
  style: '先行',
  speed: 50, power: 50, stamina: 50, mentality: 50, magic: 50
};

let remainingTurns = 5;

const runners = [];
const particles = [];
const effects = [];

// 🧪 クセ強フラスコ一覧（初期構想を完全網羅）
const ALL_SKILLS = [
  { id: 'meteor', name: 'メテオ', icon: '☄️', desc: '全体大ダメージ', speed: 0.035, type: 'attack' },
  { id: 'volcano', name: 'ボルケーノ', icon: '🌋', desc: '全体停止', speed: 0.038, type: 'attack' },
  { id: 'tornado', name: 'トルネード', icon: '🌪️', desc: '全体後退', speed: 0.040, type: 'attack' },
  { id: 'frog', name: 'カエルの雨', icon: '🐸', desc: '視界不良(ネタ)', speed: 0.060, type: 'attack' },
  { id: 'psycho', name: '追尾サイコガン', icon: '🔫', desc: '最寄り確殺', speed: 0.045, type: 'attack' },
  { id: 'poison', name: '口から毒液', icon: '🤮', desc: '前方直線', speed: 0.050, type: 'attack' },
  { id: 'stone', name: '小石投げ', icon: '🪨', desc: 'ショボい(ハズレ)', speed: 0.080, type: 'attack' },
  { id: 'hard', name: '硬化', icon: '🪨', desc: '完全無敵(停止)', speed: 0.050, type: 'defense' },
  { id: 'barrier', name: 'バリア', icon: '🛡️', desc: '動きながら防ぐ', speed: 0.045, type: 'defense' },
  { id: 'slip', name: 'コケ避け', icon: '🤸', desc: '運ゲー回避', speed: 0.065, type: 'defense' },
  { id: 'heal', name: '体力回復', icon: '💉', desc: 'ドーピング', speed: 0.040, type: 'other' },
  { id: 'mach', name: 'マッハ', icon: '⚡', desc: '超加速ワープ', speed: 0.035, type: 'other' },
  { id: 'meat', name: '生肉ばらまき', icon: '🥩', desc: '本能停止(逆転)', speed: 0.030, type: 'other' },
  { id: 'curse', name: '呪い', icon: '👻', desc: '敵ゲージ減少', speed: 0.045, type: 'other' }
];

let currentFlasks = [];

// 🛡️ 防御システム（パワーをノックバック耐性に変換）
function applyKnockback(runner, baseKnockback) {
  if (runner.isHard) {
    effects.push({ text: `硬化無効!`, x: runner.x + 24, y: runner.y - 12, color: '#94a3b8' });
    return;
  }
  if (runner.barrierPower > 0) {
    const cut = Math.floor(baseKnockback * (runner.barrierPower / 100));
    baseKnockback -= cut;
    effects.push({ text: `バリア軽減`, x: runner.x + 24, y: runner.y - 12, color: '#a855f7' });
  }

  const defense = Math.floor(runner.powAttr * 0.8);
  const finalKnockback = baseKnockback - defense;
  
  if (finalKnockback <= 0) {
    runner.knockback = 0;
    effects.push({ text: `GUARD!`, x: runner.x + 24, y: runner.y - 12, color: '#facc15' });
  } else {
    runner.knockback = Math.max(runner.knockback, finalKnockback);
    runner.stm = Math.max(0, runner.stm - (finalKnockback * 0.5)); // 体力も削られる
  }
}

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
    else if (zData.isHard) filterStr = 'grayscale(100%) brightness(0.8)'; // 硬化中は石の色
    else if (isExhausted) filterStr += ' grayscale(80%) brightness(0.6)';
    
    targetCtx.filter = filterStr;
    targetCtx.drawImage(processedCanvas, -width / 2, -height, width, height);
    targetCtx.filter = 'none';
  }

  if (isExhausted && !isKnockback && !zData.isHard) {
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
    ctx.beginPath(); ctx.moveTo(x, -60 + scrollY); ctx.lineTo(x, canvas.height + 60 + scrollY); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 20]);
  ctx.beginPath(); ctx.moveTo(170, -60 + scrollY); ctx.lineTo(170, canvas.height + 60 + scrollY); ctx.stroke();
  ctx.setLineDash([]);
}

function generateRandomZombie() {
  const num = Math.floor(Math.random() * 900) + 100;
  currentZombie = {
    name: `検体 No.${num}`,
    colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)],
    sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)],
    style: RUNNING_STYLES[Math.floor(Math.random() * RUNNING_STYLES.length)],
    speed: Math.floor(Math.random() * 20) + 40,
    power: Math.floor(Math.random() * 20) + 40,
    stamina: Math.floor(Math.random() * 20) + 40,
    mentality: Math.floor(Math.random() * 20) + 40,
    magic: Math.floor(Math.random() * 20) + 40
  };
  remainingTurns = 5;
  updateNurtureUI();
}

function updateNurtureUI() {
  document.getElementById('nurture-turn-txt').textContent = `残 ${remainingTurns} 調整`;
  document.getElementById('nurture-zombie-name').textContent = `[${currentZombie.sizeInfo.name}/${currentZombie.colorInfo.name}] ${currentZombie.name}`;
  
  document.getElementById('stat-style').textContent = currentZombie.style;
  document.getElementById('stat-spd').textContent = currentZombie.speed;
  document.getElementById('stat-pow').textContent = currentZombie.power;
  document.getElementById('stat-stm').textContent = currentZombie.stamina;
  document.getElementById('stat-mnt').textContent = currentZombie.mentality;
  document.getElementById('stat-mag').textContent = currentZombie.magic;

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
  if (type === 'spd') { currentZombie.speed += 10; currentZombie.mentality -= 3; }
  if (type === 'pow') { currentZombie.power += 10; currentZombie.magic -= 3; }
  if (type === 'stm') { currentZombie.stamina += 10; currentZombie.speed -= 3; }
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
  raceState = 'COUNTDOWN';
  startCountdown = 3.0;
  document.getElementById('countdown-overlay').classList.remove('hidden');

  runners.length = 0;
  runners.push({ 
    id: 0, name: 'YOU', x: 20, y: 220, dist: 0, 
    stm: currentZombie.stamina * 3, maxStm: currentZombie.stamina * 3, 
    spdAttr: currentZombie.speed, powAttr: currentZombie.power, mntAttr: currentZombie.mentality, magAttr: currentZombie.magic,
    colorInfo: currentZombie.colorInfo, sizeInfo: currentZombie.sizeInfo, style: currentZombie.style,
    boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, skillCd: 9999 
  });

  for (let i = 1; i < 4; i++) {
    const aiStm = (currentZombie.stamina + (Math.floor(Math.random() * 30) - 15)) * 3;
    runners.push({
      id: i, name: `No.${100 + i * 8}`, x: 20 + i * 80, y: 220, dist: 0,
      stm: aiStm, maxStm: aiStm,
      spdAttr: currentZombie.speed + (Math.floor(Math.random() * 30) - 15),
      powAttr: currentZombie.power + (Math.floor(Math.random() * 30) - 15),
      mntAttr: currentZombie.mentality + (Math.floor(Math.random() * 30) - 15),
      magAttr: currentZombie.magic + (Math.floor(Math.random() * 30) - 15),
      colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)],
      sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)],
      style: RUNNING_STYLES[Math.floor(Math.random() * RUNNING_STYLES.length)],
      boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0,
      skillCd: Math.floor(Math.random() * 300) + 400
    });
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

// 💥 フラスコ効果の発動（全14種再現）
function triggerSkill(index, power) {
  if (!currentFlasks[index] || raceState !== 'RACING') return;
  const flask = currentFlasks[index];
  const isMax = power >= 100;
  const player = runners[0];

  // 異能（magic）による補正
  const magBonus = player.magAttr > 50 ? (player.magAttr - 50) * 0.5 : 0;
  const effectivePower = isMax ? 100 + magBonus : power * 0.6 + magBonus;

  if (flask.id === 'meteor') {
    particles.push({ type: 'meteor', x: canvas.width / 2, y: -50, targetY: 200, radius: isMax ? 50 : 15, power: effectivePower });
    if (isMax) { shakeTime = 20; effects.push({ text: `大隕石!!`, x: canvas.width/2, y: 150, color: '#ef4444' }); }
  } else if (flask.id === 'volcano') {
    effects.push({ text: `溶岩噴出!`, x: canvas.width/2, y: 200, color: '#f97316' });
    runners.forEach(r => { if (r.id !== 0) { applyKnockback(r, effectivePower); r.isHard = false; } });
  } else if (flask.id === 'tornado') {
    effects.push({ text: `竜巻!`, x: canvas.width/2, y: 200, color: '#a3e635' });
    runners.forEach(r => { if (r.id !== 0) r.dist -= effectivePower * 0.2; });
  } else if (flask.id === 'frog') {
    effects.push({ text: `ゲコゲコ...`, x: canvas.width/2, y: 200, color: '#4ade80' });
    // TODO: 画面いっぱいにカエル描画のエフェクト追加
  } else if (flask.id === 'psycho') {
    effects.push({ text: `追尾レーザー!`, x: player.x, y: player.y, color: '#38bdf8' });
    let target = runners[1];
    runners.forEach(r => { if (r.id !== 0 && Math.abs(r.dist - player.dist) < Math.abs(target.dist - player.dist)) target = r; });
    applyKnockback(target, effectivePower * 1.5);
  } else if (flask.id === 'poison') {
    effects.push({ text: isMax ? `極太毒ゲロ!` : `ペッ`, x: player.x, y: player.y - 30, color: '#a3e635' });
    runners.forEach(r => { if (r.id !== 0 && r.dist > player.dist && r.x === player.x) applyKnockback(r, effectivePower); });
  } else if (flask.id === 'stone') {
    effects.push({ text: `小石...`, x: player.x, y: player.y - 20, color: '#94a3b8' });
    runners.forEach(r => { if (r.id !== 0 && Math.abs(r.dist - player.dist) < 20) applyKnockback(r, 10); });
  } else if (flask.id === 'hard') {
    player.isHard = true;
    player.knockback = effectivePower; // 停止するが無敵
    effects.push({ text: `完全硬化`, x: player.x + 24, y: player.y - 12, color: '#94a3b8' });
    setTimeout(() => { player.isHard = false; }, effectivePower * 30);
  } else if (flask.id === 'barrier') {
    player.barrierPower = effectivePower;
    effects.push({ text: `透過バリア`, x: player.x + 24, y: player.y - 12, color: '#a855f7' });
    setTimeout(() => { player.barrierPower = 0; }, 3000);
  } else if (flask.id === 'slip') {
    effects.push({ text: `謎ポーズ`, x: player.x + 24, y: player.y - 12, color: '#facc15' });
    if (Math.random() > 0.5) player.barrierPower = 50;
  } else if (flask.id === 'heal') {
    player.stm = Math.min(player.maxStm, player.stm + effectivePower * 1.5);
    effects.push({ text: `超回復`, x: player.x + 24, y: player.y - 12, color: '#22c55e' });
  } else if (flask.id === 'mach') {
    player.boostTimer = effectivePower * 1.5;
    effects.push({ text: `マッハ!!`, x: player.x + 24, y: player.y - 12, color: '#facc15' });
  } else if (flask.id === 'meat') {
    effects.push({ text: `生肉散布!`, x: canvas.width/2, y: 150, color: '#ef4444' });
    runners.forEach(r => { if (r.id !== 0) r.knockback = Math.random() * effectivePower; });
  } else if (flask.id === 'curse') {
    effects.push({ text: `呪い...`, x: canvas.width/2, y: 150, color: '#7c3aed' });
  }

  flask.charge = 0;
}

function aiTriggerSkill(runner) {
  // CPUも簡易的にスキルを使う
  const skills = ['mach', 'barrier', 'meat', 'heal'];
  const skill = skills[Math.floor(Math.random() * skills.length)];
  
  if (skill === 'mach') { runner.boostTimer = 80; effects.push({ text: `加速`, x: runner.x + 24, y: runner.y - 12, color: '#ef4444' }); }
  else if (skill === 'barrier') { runner.barrierPower = 100; setTimeout(() => { runner.barrierPower = 0; }, 2000); effects.push({ text: `バリア`, x: runner.x + 24, y: runner.y - 12, color: '#a855f7' }); }
  else if (skill === 'meat') { runners.forEach(r => { if (r.id !== runner.id) applyKnockback(r, 40); }); effects.push({ text: `妨害!`, x: runner.x + 24, y: runner.y - 12, color: '#ef4444' }); }
  else if (skill === 'heal') { runner.stm = Math.min(runner.maxStm, runner.stm + 40); effects.push({ text: `回復`, x: runner.x + 24, y: runner.y - 12, color: '#22c55e' }); }
  
  runner.skillCd = Math.floor(Math.random() * 400) + 600;
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
    if (document.getElementById('nurture-screen').classList.contains('hidden') === false) { globalTime++; updateNurtureUI(); }
    requestAnimationFrame(update); return;
  }
  globalTime++;

  const cdEl = document.getElementById('countdown-overlay');

  if (raceState === 'COUNTDOWN') {
    startCountdown -= 1 / 60;
    if (startCountdown > 0) { cdEl.textContent = Math.ceil(startCountdown); } 
    else {
      cdEl.textContent = "START!";
      setTimeout(() => { if (raceState === 'RACING') cdEl.classList.add('hidden'); }, 1000);
      raceState = 'RACING'; startTime = Date.now();
    }
  }

  if (raceState === 'RACING') {
    const player = runners[0];
    const magBonusSpeed = player.magAttr > 50 ? (player.magAttr - 50) * 0.001 : 0; // 異能が高いとチャージが早い

    currentFlasks.forEach((flask, index) => {
      if (flask.charge < flask.max) flask.charge = Math.min(flask.max, flask.charge + flask.speed + magBonusSpeed);
      const fillEl = document.getElementById(`flask-fill-${index}`);
      const percentEl = document.getElementById(`flask-percent-${index}`);
      if (fillEl && percentEl) {
        fillEl.style.height = `${flask.charge}%`; percentEl.textContent = `${Math.floor(flask.charge)}%`;
        const cardEl = fillEl.closest('.flask-card');
        if (flask.charge >= 100) cardEl.classList.add('ready'); else cardEl.classList.remove('ready');
      }
    });

    for (let i = 0; i < 4; i++) {
      const r = runners[i];
      let baseSpeed = 0.20 + (r.spdAttr - 50) * 0.003;
      
      // 気性による速度ムラ
      if (Math.random() < 0.05) {
        const mntPenalty = r.mntAttr < 50 ? (50 - r.mntAttr) * 0.01 : 0;
        baseSpeed -= Math.random() * mntPenalty;
      }

      // 脚質による補正（距離に応じて変化）
      const progress = r.dist / totalDistance;
      let stmDrain = 0.08; // デフォルト消費
      
      if (r.style === '逃げ') {
        if (progress < 0.3) { baseSpeed *= 1.3; stmDrain = 0.15; } // 序盤激早、消費激しい
        else if (progress > 0.7) { baseSpeed *= 0.8; } // 終盤バテる
      } else if (r.style === '先行') {
        if (progress > 0.2 && progress < 0.6) { baseSpeed *= 1.15; stmDrain = 0.10; }
      } else if (r.style === '差し') {
        if (progress > 0.5 && progress < 0.8) { baseSpeed *= 1.2; stmDrain = 0.10; }
      } else if (r.style === '追込') {
        if (progress > 0.7) { baseSpeed *= 1.4; stmDrain = 0.05; } // 終盤激早、燃費良し
      }

      if (r.stm > 0) r.stm -= stmDrain;
      else baseSpeed *= 0.3; // スタミナ切れは一気に遅くなる

      if (r.boostTimer > 0) { r.boostTimer--; baseSpeed *= 2.0; }
      if (r.knockback > 0) { r.knockback--; baseSpeed *= 0; }

      r.dist += Math.max(0, baseSpeed);

      if (i !== 0 && remainingDistance < 900) {
        r.skillCd--; if (r.skillCd <= 0) aiTriggerSkill(r);
      }
    }

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const r1 = runners[i]; const r2 = runners[j];
        if (Math.abs(r1.dist - r2.dist) < 8) {
          if (r1.powAttr > r2.powAttr) { r1.dist += 0.08; r2.dist -= 0.08; }
          else if (r2.powAttr > r1.powAttr) { r2.dist += 0.08; r1.dist -= 0.08; }
        }
      }
    }

    const leadingDist = Math.max(...runners.map(r => r.dist));
    remainingDistance = Math.max(0, totalDistance - leadingDist);

    if (remainingDistance <= 200 && remainingDistance > 0 && startCountdown <= 0) {
      const countVal = Math.min(5, Math.max(1, Math.ceil(remainingDistance / 40)));
      cdEl.textContent = countVal; cdEl.classList.remove('hidden');
    }

    if (remainingDistance <= 0) { finishRace(); return; }
  }

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

  if (raceState === 'RACING') scrollY = (scrollY + 0.25) % 60;
  drawJapaneseStreetBackground();

  const processedCanvas = updateChromaKeyFrame(54, 64);

  const drawOrder = [...runners].sort((a, b) => a.y - b.y);
  drawOrder.forEach(r => {
    drawZombieCharacter(ctx, r.x - 6, r.y - 16, 54, 64, r, processedCanvas, r.stm <= 0);
    if (r.barrierPower > 0) {
      ctx.strokeStyle = `rgba(168, 85, 247, ${r.barrierPower / 100})`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 20, r.y + 16, 28 * r.sizeInfo.scaleX, 0, Math.PI * 2); ctx.stroke();
    }
  });

  if (raceState === 'RACING') {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.type === 'meteor') {
        p.y += 8; ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        if (p.y >= p.targetY) {
          shakeTime = 8;
          for (let j = 1; j < 4; j++) applyKnockback(runners[j], p.power);
          effects.push({ text: `ドゴォン!`, x: p.x, y: p.y, color: '#ef4444' });
          particles.splice(i, 1);
        }
      }
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(eff.text, eff.x, eff.y); eff.y -= 0.8; if (eff.y < 120) effects.splice(i, 1);
    }
  } else {
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