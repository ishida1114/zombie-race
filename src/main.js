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

let flashEffect = { alpha: 0, color: '#ffffff' }; // 画面フラッシュ用

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

let currentZombie = {
  name: '検体 No.101',
  colorInfo: ZOMBIE_COLORS[0],
  sizeInfo: ZOMBIE_SIZES[0],
  style: '先行',
  speed: 50, power: 50, stamina: 50, mentality: 50, magic: 50
};

let remainingTurns = 5;

const runners = [];
const effects = [];

// 🎇 本格的なパーティクル（光の粒）配列
let particles = [];

// 🎇 パーティクル生成エンジン（画像不要で光や爆発を描く）
function createExplosion(x, y, color, count, speedMax, sizeBase, type = 'spark') {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * speedMax;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (type === 'fire' ? 2 : 0), // 炎は上に昇る
      life: 1.0,
      decay: Math.random() * 0.03 + 0.015,
      color: color,
      size: Math.random() * sizeBase + sizeBase/2,
      type: type
    });
  }
}

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

function applyKnockback(runner, baseKnockback) {
  if (runner.isHard) {
    effects.push({ text: `硬化無効!`, x: runner.x + 24, y: runner.y - 12, color: '#94a3b8' });
    createExplosion(runner.x + 24, runner.y + 16, '#94a3b8', 10, 2, 3, 'spark'); // 弾くエフェクト
    return;
  }
  if (runner.barrierPower > 0) {
    const cut = Math.floor(baseKnockback * (runner.barrierPower / 100));
    baseKnockback -= cut;
    effects.push({ text: `バリア軽減`, x: runner.x + 24, y: runner.y - 12, color: '#a855f7' });
    createExplosion(runner.x + 24, runner.y + 16, '#a855f7', 15, 3, 4, 'spark'); // バリア発光
  }

  const defense = Math.floor(runner.powAttr * 0.8);
  const finalKnockback = baseKnockback - defense;
  
  if (finalKnockback <= 0) {
    runner.knockback = 0;
    effects.push({ text: `GUARD!`, x: runner.x + 24, y: runner.y - 12, color: '#facc15' });
    createExplosion(runner.x + 24, runner.y + 16, '#facc15', 8, 2, 2, 'spark');
  } else {
    runner.knockback = Math.max(runner.knockback, finalKnockback);
    runner.stm = Math.max(0, runner.stm - (finalKnockback * 0.5));
    // ダメージエフェクト（血飛沫）
    createExplosion(runner.x + 24, runner.y + 16, '#dc2626', 20, 4, 3, 'blood');
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
    else if (zData.isHard) filterStr = 'grayscale(100%) brightness(0.8)';
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
  particles.length = 0; // パーティクル初期化

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

// 💥 ド派手スキル演出の実装
function triggerSkill(index, power) {
  if (!currentFlasks[index] || raceState !== 'RACING') return;
  const flask = currentFlasks[index];
  const isMax = power >= 100;
  const player = runners[0];

  const magBonus = player.magAttr > 50 ? (player.magAttr - 50) * 0.5 : 0;
  const effectivePower = isMax ? 100 + magBonus : power * 0.6 + magBonus;

  // 全体フラッシュ
  flashEffect.alpha = isMax ? 0.8 : 0.4;
  flashEffect.color = '#ffffff';

  if (flask.id === 'meteor') {
    flashEffect.color = '#ef4444'; // 赤フラッシュ
    particles.push({ type: 'meteor_drop', x: canvas.width / 2, y: -100, targetY: 200, radius: isMax ? 50 : 15, power: effectivePower });
  } 
  else if (flask.id === 'volcano') {
    flashEffect.color = '#f97316';
    shakeTime = 15;
    effects.push({ text: `溶岩噴出!`, x: canvas.width/2, y: 200, color: '#f97316' });
    runners.forEach(r => { 
      if (r.id !== 0) {
        applyKnockback(r, effectivePower); r.isHard = false;
        createExplosion(r.x + 24, r.y + 40, '#f97316', 30, 5, 4, 'fire'); // 足元から炎
      }
    });
  } 
  else if (flask.id === 'tornado') {
    shakeTime = 10;
    effects.push({ text: `竜巻!`, x: canvas.width/2, y: 200, color: '#a3e635' });
    createExplosion(canvas.width/2, 200, '#a3e635', 50, 8, 3, 'spark'); // 緑の嵐
    runners.forEach(r => { if (r.id !== 0) r.dist -= effectivePower * 0.2; });
  } 
  else if (flask.id === 'frog') {
    effects.push({ text: `ゲコゲコ...`, x: canvas.width/2, y: 200, color: '#4ade80' });
    createExplosion(canvas.width/2, -20, '#4ade80', 60, 4, 5, 'frog'); // 緑の四角（カエル代わり）が降る
  } 
  else if (flask.id === 'psycho') {
    let target = runners[1];
    runners.forEach(r => { if (r.id !== 0 && Math.abs(r.dist - player.dist) < Math.abs(target.dist - player.dist)) target = r; });
    effects.push({ text: `レーザー!`, x: player.x, y: player.y, color: '#38bdf8' });
    createExplosion(target.x + 24, target.y + 16, '#38bdf8', 40, 6, 4, 'spark'); // 青い大爆発
    applyKnockback(target, effectivePower * 1.5);
  } 
  else if (flask.id === 'poison') {
    effects.push({ text: isMax ? `極太毒ゲロ!` : `ペッ`, x: player.x, y: player.y - 30, color: '#a3e635' });
    createExplosion(player.x + 24, player.y - 10, '#a3e635', isMax ? 50 : 10, 5, 4, 'spark');
    runners.forEach(r => { if (r.id !== 0 && r.dist > player.dist && r.x === player.x) applyKnockback(r, effectivePower); });
  } 
  else if (flask.id === 'stone') {
    effects.push({ text: `小石...`, x: player.x, y: player.y - 20, color: '#94a3b8' });
    runners.forEach(r => { if (r.id !== 0 && Math.abs(r.dist - player.dist) < 20) applyKnockback(r, 10); });
  } 
  else if (flask.id === 'hard') {
    player.isHard = true;
    player.knockback = effectivePower;
    effects.push({ text: `完全硬化`, x: player.x + 24, y: player.y - 12, color: '#94a3b8' });
    createExplosion(player.x + 24, player.y + 16, '#cbd5e1', 20, 2, 3, 'spark');
    setTimeout(() => { player.isHard = false; }, effectivePower * 30);
  } 
  else if (flask.id === 'barrier') {
    flashEffect.color = '#a855f7';
    player.barrierPower = effectivePower;
    effects.push({ text: `透過バリア`, x: player.x + 24, y: player.y - 12, color: '#a855f7' });
    createExplosion(player.x + 24, player.y + 16, '#a855f7', 30, 4, 3, 'spark');
    setTimeout(() => { player.barrierPower = 0; }, 3000);
  } 
  else if (flask.id === 'slip') {
    effects.push({ text: `謎ポーズ`, x: player.x + 24, y: player.y - 12, color: '#facc15' });
    if (Math.random() > 0.5) player.barrierPower = 50;
  } 
  else if (flask.id === 'heal') {
    flashEffect.color = '#22c55e';
    player.stm = Math.min(player.maxStm, player.stm + effectivePower * 1.5);
    effects.push({ text: `超回復`, x: player.x + 24, y: player.y - 12, color: '#22c55e' });
    createExplosion(player.x + 24, player.y + 16, '#4ade80', 40, 2, 3, 'fire'); // 上に昇る回復の光
  } 
  else if (flask.id === 'mach') {
    flashEffect.color = '#facc15';
    player.boostTimer = effectivePower * 1.5;
    effects.push({ text: `マッハ!!`, x: player.x + 24, y: player.y - 12, color: '#facc15' });
    createExplosion(player.x + 24, player.y + 16, '#facc15', 50, 6, 4, 'spark'); // 電撃スパーク
  } 
  else if (flask.id === 'meat') {
    effects.push({ text: `生肉散布!`, x: canvas.width/2, y: 150, color: '#ef4444' });
    createExplosion(canvas.width/2, 150, '#dc2626', 60, 7, 5, 'blood'); // 大量の肉（血）
    runners.forEach(r => { if (r.id !== 0) r.knockback = Math.random() * effectivePower; });
  } 
  else if (flask.id === 'curse') {
    flashEffect.color = '#7c3aed';
    effects.push({ text: `呪い...`, x: canvas.width/2, y: 150, color: '#7c3aed' });
    createExplosion(canvas.width/2, 150, '#7c3aed', 40, 3, 3, 'fire');
  }

  flask.charge = 0;
}

function aiTriggerSkill(runner) {
  const skills = ['mach', 'barrier', 'meat', 'heal'];
  const skill = skills[Math.floor(Math.random() * skills.length)];
  
  if (skill === 'mach') {
    runner.boostTimer = 80;
    effects.push({ text: `加速`, x: runner.x + 24, y: runner.y - 12, color: '#ef4444' });
    createExplosion(runner.x + 24, runner.y + 16, '#facc15', 20, 4, 3, 'spark');
  } 
  else if (skill === 'barrier') { 
    runner.barrierPower = 100; setTimeout(() => { runner.barrierPower = 0; }, 2000); 
    effects.push({ text: `バリア`, x: runner.x + 24, y: runner.y - 12, color: '#a855f7' }); 
    createExplosion(runner.x + 24, runner.y + 16, '#a855f7', 20, 3, 3, 'spark');
  }
  else if (skill === 'meat') { 
    runners.forEach(r => { if (r.id !== runner.id) applyKnockback(r, 40); }); 
    effects.push({ text: `妨害!`, x: runner.x + 24, y: runner.y - 12, color: '#ef4444' }); 
    createExplosion(canvas.width/2, 150, '#dc2626', 30, 5, 4, 'blood');
  }
  else if (skill === 'heal') { 
    runner.stm = Math.min(runner.maxStm, runner.stm + 40); 
    effects.push({ text: `回復`, x: runner.x + 24, y: runner.y - 12, color: '#22c55e' }); 
    createExplosion(runner.x + 24, runner.y + 16, '#4ade80', 20, 2, 3, 'fire');
  }
  
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
    const magBonusSpeed = player.magAttr > 50 ? (player.magAttr - 50) * 0.001 : 0;

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
      
      if (Math.random() < 0.05) {
        const mntPenalty = r.mntAttr < 50 ? (50 - r.mntAttr) * 0.01 : 0;
        baseSpeed -= Math.random() * mntPenalty;
      }

      const progress = r.dist / totalDistance;
      let stmDrain = 0.08; 
      
      if (r.style === '逃げ') {
        if (progress < 0.3) { baseSpeed *= 1.3; stmDrain = 0.15; }
        else if (progress > 0.7) { baseSpeed *= 0.8; }
      } else if (r.style === '先行') {
        if (progress > 0.2 && progress < 0.6) { baseSpeed *= 1.15; stmDrain = 0.10; }
      } else if (r.style === '差し') {
        if (progress > 0.5 && progress < 0.8) { baseSpeed *= 1.2; stmDrain = 0.10; }
      } else if (r.style === '追込') {
        if (progress > 0.7) { baseSpeed *= 1.4; stmDrain = 0.05; }
      }

      if (r.stm > 0) r.stm -= stmDrain;
      else baseSpeed *= 0.3;

      if (r.boostTimer > 0) { 
        r.boostTimer--; baseSpeed *= 2.0; 
        if (globalTime % 5 === 0) createExplosion(r.x + 24, r.y + 24, '#facc15', 2, 2, 2, 'spark'); // 加速中のエフェクト
      }
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
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10); shakeTime--; }

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

  // 🎇 パーティクルの更新と描画（加算合成で光らせる）
  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor_drop') {
      // 隕石の落下
      p.y += 12;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (p.y >= p.targetY) {
        shakeTime = 20;
        createExplosion(p.x, p.y, '#f97316', 100, 10, 8, 'spark'); // 大爆発エフェクト
        for (let j = 1; j < 4; j++) applyKnockback(runners[j], p.power);
        effects.push({ text: `大爆発!!`, x: p.x, y: p.y, color: '#ef4444' });
        particles.splice(i, 1);
      }
    } else {
      // 光の粒子の飛散
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        if (p.type === 'frog') ctx.fillRect(p.x, p.y, p.size, p.size); // カエル（四角）
        else ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;

  // テキストエフェクト
  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y);
    if (raceState === 'RACING') eff.y -= 0.8;
    if (eff.y < 80) effects.splice(i, 1);
  }

  // 画面フラッシュ
  if (flashEffect.alpha > 0) {
    ctx.fillStyle = flashEffect.color;
    ctx.globalAlpha = flashEffect.alpha;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashEffect.alpha -= 0.05;
    ctx.globalAlpha = 1.0;
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