const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false;
let raceState = 'INIT';
let startCountdown = 3.0;
let shakeTime = 0;
let scrollY = 0;
let globalTime = 0;
let remainingDistance = 1000;
let totalDistance = 1000;
let startTime = 0;
let flashEffect = { alpha: 0, color: '#ffffff' };

const CITIES = [
  { id: 'tokyo', name: '東京', distance: 1000, color: '#e11d48', bgType: 'normal', desc: '【標準】平均的な基本コース。' },
  { id: 'osaka', name: '大阪', distance: 1000, color: '#ca8a04', bgType: 'normal', desc: '【乱戦】ライバル達の気性が荒い。' },
  { id: 'nagoya', name: '名古屋', distance: 1000, color: '#16a34a', bgType: 'normal', desc: '【鉄壁】ライバルの筋力が高い。' },
  { id: 'fukuoka', name: '福岡', distance: 700, color: '#0284c7', bgType: 'normal', desc: '【短距離】序盤からのスピード勝負。' },
  { id: 'sapporo', name: '札幌', distance: 1200, color: '#93c5fd', bgType: 'snow', desc: '【雪道】体力が削られる長距離戦。' }
];
let currentCity = CITIES[0];

const ZOMBIE_COLORS = [
  { name: '標準', filter: 'none' }, { name: '猛毒', filter: 'hue-rotate(90deg) saturate(120%)' },
  { name: '深淵', filter: 'hue-rotate(210deg) saturate(100%) brightness(0.9)' }, { name: '狂暴', filter: 'hue-rotate(-50deg) saturate(150%) brightness(1.1)' },
  { name: '蒼白', filter: 'grayscale(70%) brightness(1.2) hue-rotate(180deg)' }, { name: '黒曜', filter: 'grayscale(60%) brightness(0.6) contrast(1.3)' },
];
const ZOMBIE_SIZES = [
  { name: '標準', scaleX: 1.0, scaleY: 1.0 }, { name: '巨漢', scaleX: 1.25, scaleY: 1.3 }, { name: '肥満', scaleX: 1.3, scaleY: 0.95 }
];

const RUNNING_STYLES = ['逃げ', '先行', '差し', '追込'];

// 📦 牧場（ローカルストレージ）データ管理と【古いデータのエラー復旧処理】
let myZombies = JSON.parse(localStorage.getItem('myZombies')) || [];
myZombies.forEach(z => {
  if (!z.colorInfo) z.colorInfo = ZOMBIE_COLORS[0];
  if (!z.sizeInfo) z.sizeInfo = ZOMBIE_SIZES[0];
  if (!z.style) z.style = '先行';
  if (z.mentality === undefined) z.mentality = 50;
  if (z.magic === undefined) z.magic = 50;
  if (z.remainingTurns === undefined) z.remainingTurns = 0;
});
let activeZombieIndex = null;
let isNurturing = false;

const zombieVideo = document.createElement('video');
zombieVideo.src = '/zombie1.mp4';
zombieVideo.loop = true; zombieVideo.muted = true; zombieVideo.playsInline = true; zombieVideo.autoplay = true;
zombieVideo.addEventListener('canplay', () => zombieVideo.play().catch(() => {}));
const offCanvas = document.createElement('canvas'); const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

function updateChromaKeyFrame(targetW, targetH) {
  if (zombieVideo.readyState < 2 || zombieVideo.paused) return null;
  if (offCanvas.width !== targetW) offCanvas.width = targetW;
  if (offCanvas.height !== targetH) offCanvas.height = targetH;
  offCtx.clearRect(0, 0, targetW, targetH); offCtx.drawImage(zombieVideo, 0, 0, targetW, targetH);
  const data = offCtx.getImageData(0, 0, targetW, targetH);
  for (let i = 0; i < data.data.length; i += 4) { if (data.data[i+1] > 80 && data.data[i+1] > data.data[i]*1.2 && data.data[i+1] > data.data[i+2]*1.2) data.data[i+3] = 0; }
  offCtx.putImageData(data, 0, 0); return offCanvas;
}

const runners = []; const effects = []; let particles = [];

function createExplosion(x, y, color, count, speedMax, sizeBase, type = 'spark') {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * speedMax;
    particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (type === 'fire' ? 2 : 0), life: 1.0, decay: Math.random() * 0.03 + 0.015, color: color, size: Math.random() * sizeBase + sizeBase/2, type: type });
  }
}

const ALL_SKILLS = [
  { id: 'meteor', name: 'メテオ', icon: '☄️', desc: '全体大ダメージ', speed: 0.035 }, { id: 'volcano', name: 'ボルケーノ', icon: '🌋', desc: '全体停止', speed: 0.038 },
  { id: 'tornado', name: 'トルネード', icon: '🌪️', desc: '全体後退', speed: 0.040 }, { id: 'frog', name: 'カエルの雨', icon: '🐸', desc: '視界ジャック', speed: 0.060 },
  { id: 'psycho', name: '追尾サイコガン', icon: '🔫', desc: '最寄り確殺', speed: 0.045 }, { id: 'poison', name: '口から毒液', icon: '🤮', desc: '前方直線レーザー', speed: 0.050 },
  { id: 'stone', name: '小石投げ', icon: '🪨', desc: '一瞬怯ませる', speed: 0.080 }, { id: 'hard', name: '硬化', icon: '🪨', desc: '無敵(停止)', speed: 0.050 },
  { id: 'barrier', name: 'バリア', icon: '🛡️', desc: '走りつつ防ぐ', speed: 0.045 }, { id: 'slip', name: 'コケ避け', icon: '🤸', desc: '運ゲー回避', speed: 0.065 },
  { id: 'heal', name: '体力回復', icon: '💉', desc: 'スタミナ回復', speed: 0.040 }, { id: 'mach', name: 'マッハ', icon: '⚡', desc: '超加速ワープ', speed: 0.035 },
  { id: 'meat', name: '生肉ばらまき', icon: '🥩', desc: 'ライバル停止', speed: 0.030 }, { id: 'curse', name: '呪い', icon: '👻', desc: '敵ゲージ減少', speed: 0.045 }
];
let currentFlasks = [];

function applyKnockback(runner, baseKnockback) {
  if (runner.isHard) { effects.push({ text: `硬化無効!`, x: runner.x + 24, y: runner.y - 12, color: '#94a3b8' }); createExplosion(runner.x + 24, runner.y + 16, '#94a3b8', 10, 2, 3, 'spark'); return; }
  if (runner.barrierPower > 0) { baseKnockback -= Math.floor(baseKnockback * (runner.barrierPower / 100)); effects.push({ text: `バリア軽減`, x: runner.x + 24, y: runner.y - 12, color: '#a855f7' }); createExplosion(runner.x + 24, runner.y + 16, '#a855f7', 15, 3, 4, 'spark'); }
  const defense = Math.floor(runner.powAttr * 0.8); const finalKnockback = baseKnockback - defense;
  if (finalKnockback <= 0) { runner.knockback = 0; effects.push({ text: `GUARD!`, x: runner.x + 24, y: runner.y - 12, color: '#facc15' }); createExplosion(runner.x + 24, runner.y + 16, '#facc15', 8, 2, 2, 'spark'); }
  else { runner.knockback = Math.max(runner.knockback, finalKnockback); runner.stm = Math.max(0, runner.stm - (finalKnockback * 0.5)); createExplosion(runner.x + 24, runner.y + 16, '#dc2626', 20, 4, 3, 'blood'); }
}

function drawZombieCharacter(targetCtx, x, y, width, height, zData, processedCanvas, isExhausted) {
  targetCtx.save(); const isKnockback = zData.knockback > 0;
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.45)'; targetCtx.beginPath(); targetCtx.ellipse(x + width / 2, y + height - 2, (width / 2 - 4) * zData.sizeInfo.scaleX, 5, 0, 0, Math.PI * 2); targetCtx.fill();
  if (processedCanvas) {
    targetCtx.translate(x + width / 2, y + height); targetCtx.scale(zData.sizeInfo.scaleX, zData.sizeInfo.scaleY);
    if (isKnockback) targetCtx.rotate(-0.35);
    let filterStr = zData.colorInfo.filter;
    if (isKnockback) filterStr = 'brightness(200%) sepia(100%) hue-rotate(-50deg)'; else if (zData.isHard) filterStr = 'grayscale(100%) brightness(0.8)'; else if (isExhausted) filterStr += ' grayscale(80%) brightness(0.6)';
    targetCtx.filter = filterStr; targetCtx.drawImage(processedCanvas, -width / 2, -height, width, height); targetCtx.filter = 'none';
  }
  if (isExhausted && !isKnockback && !zData.isHard) { targetCtx.translate(x + width / 2, y + height); targetCtx.fillStyle = '#38bdf8'; targetCtx.fillRect((width / 2 - 4) * zData.sizeInfo.scaleX, -height + 4, 3, 5); }
  targetCtx.restore();
}

function drawJapaneseStreetBackground() {
  const isSnow = currentCity.bgType === 'snow';
  ctx.fillStyle = isSnow ? '#e2e8f0' : '#1e232e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isSnow ? '#cbd5e1' : '#131720'; ctx.fillRect(0, 0, 12, canvas.height); ctx.fillRect(canvas.width - 12, 0, 12, canvas.height);
  ctx.fillStyle = isSnow ? '#94a3b8' : '#374151'; ctx.fillRect(12, 0, 2, canvas.height); ctx.fillRect(canvas.width - 14, 0, 2, canvas.height);
  ctx.strokeStyle = isSnow ? '#94a3b8' : '#2d3748'; ctx.lineWidth = 1; ctx.setLineDash([12, 18]);
  for (let x of [90, 170, 250]) { ctx.beginPath(); ctx.moveTo(x, -60 + scrollY); ctx.lineTo(x, canvas.height + 60 + scrollY); ctx.stroke(); } ctx.setLineDash([]);
  ctx.strokeStyle = '#eab308'; ctx.lineWidth = 3; ctx.setLineDash([24, 20]);
  ctx.beginPath(); ctx.moveTo(170, -60 + scrollY); ctx.lineTo(170, canvas.height + 60 + scrollY); ctx.stroke(); ctx.setLineDash([]);
}

function renderGarage() {
  const list = document.getElementById('garage-list'); list.innerHTML = '';
  document.getElementById('garage-count').textContent = myZombies.length;
  myZombies.forEach((z, idx) => {
    const card = document.createElement('div'); card.className = 'zombie-card';
    card.innerHTML = `
      <div class="zc-header"><span class="zc-name">${z.name}</span><span class="zc-style">${z.style}</span></div>
      <div class="zc-stats"><span>速:${z.speed}</span><span>力:${z.power}</span><span>体:${z.stamina}</span><span>気:${z.mentality}</span><span>魔:${z.magic}</span><span>残:${z.remainingTurns}</span></div>
      <div class="zc-actions">
        <button class="zc-btn-race" onclick="openCitySelect(${idx})">出走</button>
        <button class="zc-btn-nurture" onclick="openNurture(${idx})" ${z.remainingTurns <= 0 ? 'disabled' : ''}>育成</button>
        <button class="zc-btn-delete" onclick="deleteZombie(${idx})">逃がす</button>
      </div>
    `;
    list.appendChild(card);
  });
  if (myZombies.length === 0) list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">検体が居ません。探索してください。</div>';
}

window.openCitySelect = (idx) => { activeZombieIndex = idx; document.getElementById('garage-screen').classList.add('hidden'); renderCitySelect(); document.getElementById('city-select-screen').classList.remove('hidden'); };
window.openNurture = (idx) => { activeZombieIndex = idx; document.getElementById('garage-screen').classList.add('hidden'); updateNurtureUI(); document.getElementById('nurture-screen').classList.remove('hidden'); };
window.deleteZombie = (idx) => { if(confirm('本当に逃がしますか？')) { myZombies.splice(idx, 1); saveZombies(); renderGarage(); } };

function saveZombies() { localStorage.setItem('myZombies', JSON.stringify(myZombies)); }

function doScout() {
  if (myZombies.length >= 3) { alert('牧場がいっぱいです。逃がしてから探してください。'); return; }
  const cityVal = document.getElementById('scout-city').value;
  const styleVal = document.getElementById('scout-style').value;
  let nameVal = document.getElementById('scout-name').value || '名無しゾンビ';
  
  let spd = 40 + Math.floor(Math.random()*20), pow = 40 + Math.floor(Math.random()*20), stm = 40 + Math.floor(Math.random()*20), mnt = 40 + Math.floor(Math.random()*20), mag = 40 + Math.floor(Math.random()*20);
  if(cityVal==='osaka') mnt+=15; if(cityVal==='nagoya') pow+=15; if(cityVal==='fukuoka') spd+=15; if(cityVal==='sapporo') stm+=15;

  const newZ = {
    name: nameVal, colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)], sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)],
    style: styleVal, speed: spd, power: pow, stamina: stm, mentality: mnt, magic: mag, remainingTurns: 5
  };
  myZombies.push(newZ); saveZombies();
  alert(`${nameVal} を捕獲しました！牧場へ送ります。`);
  document.getElementById('scout-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden');
}

function updateNurtureUI() {
  const z = myZombies[activeZombieIndex];
  if (!z) return;
  document.getElementById('nurture-turn-txt').textContent = `残 ${z.remainingTurns} 調整`;
  document.getElementById('nurture-zombie-name').textContent = `[${z.sizeInfo.name}/${z.colorInfo.name}] ${z.name}`;
  document.getElementById('stat-style').textContent = z.style;
  document.getElementById('stat-spd').textContent = z.speed; document.getElementById('stat-pow').textContent = z.power; document.getElementById('stat-stm').textContent = z.stamina; document.getElementById('stat-mnt').textContent = z.mentality; document.getElementById('stat-mag').textContent = z.magic;
  const pCtx = document.getElementById('zombieCanvas').getContext('2d'); pCtx.clearRect(0, 0, 120, 120);
  drawZombieCharacter(pCtx, 30, 20, 60, 80, { ...z, knockback: 0 }, updateChromaKeyFrame(60, 80), false);
  const cmdBox = document.querySelector('.command-container');
  if (z.remainingTurns <= 0) cmdBox.classList.add('hidden'); else cmdBox.classList.remove('hidden');
}

function executeCommand(type) {
  if (isNurturing) return; isNurturing = true;
  document.getElementById('nurture-result-overlay').classList.remove('hidden'); document.getElementById('drumroll-text').classList.remove('hidden'); document.getElementById('result-label').classList.add('hidden'); document.getElementById('result-status-changes').classList.add('hidden');
  let tick = 0;
  const drumInterval = setInterval(() => {
    tick++; document.getElementById('drumroll-text').textContent = `調整中 ${Math.floor(Math.random() * 89 + 10)} ...`;
    if (tick > 12) { clearInterval(drumInterval); showNurtureResult(type); }
  }, 100);
}

function showNurtureResult(type) {
  const rand = Math.random(); let resultType = 1; if (rand < 0.20) resultType = 2; else if (rand > 0.85) resultType = 0;
  let mainStat = ''; let subStat = ''; let mainStatName = ''; let subStatName = '';
  if (type === 'spd') { mainStat = 'speed'; subStat = 'mentality'; mainStatName = '速さ'; subStatName = '気性'; } else if (type === 'pow') { mainStat = 'power'; subStat = 'magic'; mainStatName = '力強さ'; subStatName = '異能'; } else if (type === 'stm') { mainStat = 'stamina'; subStat = 'speed'; mainStatName = '体力'; subStatName = '速さ'; }
  let mainInc = resultType === 2 ? 20 : (resultType === 1 ? 10 : 3); let subDec = resultType === 2 ? -5 : (resultType === 1 ? -3 : -1);
  
  document.getElementById('drumroll-text').classList.add('hidden'); document.getElementById('result-label').classList.remove('hidden'); document.getElementById('result-status-changes').classList.remove('hidden');
  const rLbl = document.getElementById('result-label');
  if (resultType===2){ rLbl.textContent='大成功!!'; rLbl.className='result-label lbl-great'; } else if(resultType===1){ rLbl.textContent='成功'; rLbl.className='result-label lbl-good'; } else { rLbl.textContent='失敗...'; rLbl.className='result-label lbl-bad'; }
  document.getElementById('result-status-changes').innerHTML = `<div>${mainStatName} <span class="change-up">+${mainInc}</span></div><div>${subStatName} <span class="change-down">${subDec}</span></div>`;

  setTimeout(() => {
    myZombies[activeZombieIndex][mainStat] += mainInc; myZombies[activeZombieIndex][subStat] += subDec; myZombies[activeZombieIndex].remainingTurns--;
    saveZombies(); document.getElementById('nurture-result-overlay').classList.add('hidden'); isNurturing = false; updateNurtureUI();
  }, 1500);
}

function renderCitySelect() {
  const container = document.getElementById('city-list'); container.innerHTML = '';
  CITIES.forEach(city => {
    const btn = document.createElement('div'); btn.className = 'city-btn';
    btn.innerHTML = `<span class="city-name" style="color:${city.color}">${city.name} (${city.distance}m)</span><span class="city-desc">${city.desc}</span>`;
    btn.onclick = () => { currentCity = city; document.getElementById('city-select-screen').classList.add('hidden'); startRace(); };
    container.appendChild(btn);
  });
}

function startRace() {
  if (isGameRunning) return;
  const cutin = document.getElementById('cutin-screen');
  cutin.querySelector('.cutin-bg').style.background = currentCity.color;
  document.getElementById('cutin-en').textContent = currentCity.id.toUpperCase(); document.getElementById('cutin-ja').textContent = currentCity.name;
  cutin.classList.remove('hidden');
  setTimeout(() => { cutin.classList.add('hidden'); document.getElementById('race-screen').classList.remove('hidden'); setupRaceState(); }, 1900);
}

function setupRaceState() {
  // 🌟 エラー防止：ゾンビが選択されていない場合はタイトルへ戻す
  const z = myZombies[activeZombieIndex];
  if (!z) { alert('出走エラー：検体が見つかりません'); location.reload(); return; }

  totalDistance = currentCity.distance; remainingDistance = totalDistance; globalTime = 0; raceState = 'COUNTDOWN'; startCountdown = 3.0;
  document.getElementById('countdown-overlay').classList.remove('hidden');
  document.getElementById('slime-overlay').classList.remove('active');
  runners.length = 0; particles.length = 0;

  // 🌟 スタミナの適正化（×10に増加し、消費量とのバランスを取る）
  runners.push({ id: 0, name: z.name, x: 20, y: 220, dist: 0, stm: z.stamina * 10, maxStm: z.stamina * 10, spdAttr: z.speed, powAttr: z.power, mntAttr: z.mentality, magAttr: z.magic, colorInfo: z.colorInfo, sizeInfo: z.sizeInfo, style: z.style, boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, skillCd: 9999 });

  for (let i = 1; i < 4; i++) {
    const aiStm = (z.stamina + (Math.floor(Math.random() * 30) - 15)) * 10;
    let mntBase = z.mentality; let powBase = z.power;
    if (currentCity.id === 'osaka') mntBase -= 30; if (currentCity.id === 'nagoya') powBase += 30;
    runners.push({ id: i, name: `No.${100 + i * 8}`, x: 20 + i * 80, y: 220, dist: 0, stm: aiStm, maxStm: aiStm, spdAttr: z.speed + (Math.floor(Math.random() * 30) - 15), powAttr: powBase + (Math.floor(Math.random() * 30) - 15), mntAttr: mntBase + (Math.floor(Math.random() * 30) - 15), magAttr: z.magic + (Math.floor(Math.random() * 30) - 15), colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)], sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)], style: RUNNING_STYLES[Math.floor(Math.random() * RUNNING_STYLES.length)], boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, skillCd: Math.floor(Math.random() * 300) + 400 });
  }
  selectRandomFlasks(); isGameRunning = true; requestAnimationFrame(update);
}

function selectRandomFlasks() {
  const shuffled = [...ALL_SKILLS].sort(() => 0.5 - Math.random());
  currentFlasks = shuffled.slice(0, 3).map(s => ({ ...s, charge: 0, max: 100 }));
  currentFlasks.forEach((flask, idx) => { document.getElementById(`flask-icon-${idx}`).textContent = flask.icon; document.getElementById(`flask-name-${idx}`).textContent = flask.name; });
}

function triggerSkill(index, power) {
  if (!currentFlasks[index] || raceState !== 'RACING') return;
  const flask = currentFlasks[index]; const isMax = power >= 100; const player = runners[0];
  const magBonus = player.magAttr > 50 ? (player.magAttr - 50) * 0.5 : 0; const effectivePower = isMax ? 100 + magBonus : power * 0.6 + magBonus;
  flashEffect.alpha = isMax ? 0.8 : 0.4; flashEffect.color = '#ffffff';

  if (flask.id === 'meteor') { flashEffect.color = '#ef4444'; particles.push({ type: 'meteor_drop', x: canvas.width / 2, y: -100, targetY: 200, radius: isMax ? 50 : 15, power: effectivePower }); createExplosion(player.x + 24, player.y + 16, '#38bdf8', 15, 3, 3, 'spark'); effects.push({ text: `SAFE`, x: player.x + 24, y: player.y - 12, color: '#38bdf8' }); } 
  else if (flask.id === 'volcano') { flashEffect.color = '#f97316'; shakeTime = 15; effects.push({ text: `溶岩噴出!`, x: canvas.width/2, y: 200, color: '#f97316' }); runners.forEach(r => { if (r.id !== 0) { applyKnockback(r, effectivePower); r.isHard = false; createExplosion(r.x + 24, r.y + 40, '#f97316', 30, 5, 4, 'fire'); } }); } 
  else if (flask.id === 'tornado') { shakeTime = 10; effects.push({ text: `竜巻!`, x: canvas.width/2, y: 200, color: '#a3e635' }); createExplosion(canvas.width/2, 200, '#a3e635', 50, 8, 3, 'spark'); runners.forEach(r => { if (r.id !== 0) r.dist -= effectivePower * 0.2; }); } 
  else if (flask.id === 'frog') { effects.push({ text: `ベチャッ!!`, x: canvas.width/2, y: 200, color: '#4ade80' }); document.getElementById('slime-overlay').classList.add('active'); setTimeout(() => { document.getElementById('slime-overlay').classList.remove('active'); }, 4000); } 
  else if (flask.id === 'psycho') { let target = runners[1]; runners.forEach(r => { if (r.id !== 0 && Math.abs(r.dist - player.dist) < Math.abs(target.dist - player.dist)) target = r; }); effects.push({ text: `レーザー!`, x: player.x, y: player.y, color: '#38bdf8' }); createExplosion(target.x + 24, target.y + 16, '#38bdf8', 40, 6, 4, 'spark'); applyKnockback(target, effectivePower * 1.5); } 
  else if (flask.id === 'poison') { effects.push({ text: isMax ? `極太毒ゲロ!` : `ペッ`, x: player.x, y: player.y - 30, color: '#a3e635' }); particles.push({ type: 'poison_laser', x: player.x + 24, y: player.y, width: isMax ? 40 : 10, life: 1.0 }); createExplosion(player.x + 24, player.y - 50, '#a3e635', isMax ? 30 : 10, 2, 8, 'spark'); runners.forEach(r => { if (r.id !== 0 && r.dist > player.dist && Math.abs(r.x - player.x) < 40) applyKnockback(r, effectivePower); }); } 
  else if (flask.id === 'stone') { effects.push({ text: `小石投げ`, x: player.x, y: player.y - 20, color: '#94a3b8' }); let target = runners[1]; runners.forEach(r => { if (r.id !== 0 && Math.abs(r.dist - player.dist) < Math.abs(target.dist - player.dist)) target = r; }); particles.push({ type: 'stone_throw', startX: player.x + 24, startY: player.y, targetX: target.x + 24, targetY: target.y + 16, progress: 0, targetRunner: target }); } 
  else if (flask.id === 'hard') { player.isHard = true; player.knockback = effectivePower; effects.push({ text: `完全硬化`, x: player.x + 24, y: player.y - 12, color: '#94a3b8' }); createExplosion(player.x + 24, player.y + 16, '#cbd5e1', 20, 2, 3, 'spark'); setTimeout(() => { player.isHard = false; }, effectivePower * 30); } 
  else if (flask.id === 'barrier') { flashEffect.color = '#a855f7'; player.barrierPower = effectivePower; effects.push({ text: `透過バリア`, x: player.x + 24, y: player.y - 12, color: '#a855f7' }); createExplosion(player.x + 24, player.y + 16, '#a855f7', 30, 4, 3, 'spark'); setTimeout(() => { player.barrierPower = 0; }, 3000); } 
  else if (flask.id === 'slip') { effects.push({ text: `謎ポーズ`, x: player.x + 24, y: player.y - 12, color: '#facc15' }); if (Math.random() > 0.5) player.barrierPower = 50; } 
  else if (flask.id === 'heal') { flashEffect.color = '#22c55e'; player.stm = Math.min(player.maxStm, player.stm + effectivePower * 1.5); effects.push({ text: `超回復`, x: player.x + 24, y: player.y - 12, color: '#22c55e' }); createExplosion(player.x + 24, player.y + 16, '#4ade80', 40, 2, 3, 'fire'); } 
  else if (flask.id === 'mach') { flashEffect.color = '#facc15'; player.boostTimer = effectivePower * 1.5; effects.push({ text: `マッハ!!`, x: player.x + 24, y: player.y - 12, color: '#facc15' }); createExplosion(player.x + 24, player.y + 16, '#facc15', 50, 6, 4, 'spark'); } 
  else if (flask.id === 'meat') { effects.push({ text: `生肉散布!`, x: canvas.width/2, y: 150, color: '#ef4444' }); createExplosion(canvas.width/2, 150, '#dc2626', 60, 7, 5, 'blood'); runners.forEach(r => { if (r.id !== 0) r.knockback = Math.random() * effectivePower; }); } 
  else if (flask.id === 'curse') { flashEffect.color = '#7c3aed'; effects.push({ text: `呪い...`, x: canvas.width/2, y: 150, color: '#7c3aed' }); createExplosion(canvas.width/2, 150, '#7c3aed', 40, 3, 3, 'fire'); }
  flask.charge = 0;
}

function aiTriggerSkill(runner) {
  const skills = ['mach', 'barrier', 'meat', 'heal']; const skill = skills[Math.floor(Math.random() * skills.length)];
  if (skill === 'mach') { runner.boostTimer = 80; createExplosion(runner.x + 24, runner.y + 16, '#facc15', 20, 4, 3, 'spark'); } 
  else if (skill === 'barrier') { runner.barrierPower = 100; setTimeout(() => { runner.barrierPower = 0; }, 2000); createExplosion(runner.x + 24, runner.y + 16, '#a855f7', 20, 3, 3, 'spark'); }
  else if (skill === 'meat') { runners.forEach(r => { if (r.id !== runner.id) applyKnockback(r, 40); }); createExplosion(canvas.width/2, 150, '#dc2626', 30, 5, 4, 'blood'); }
  else if (skill === 'heal') { runner.stm = Math.min(runner.maxStm, runner.stm + 40); createExplosion(runner.x + 24, runner.y + 16, '#4ade80', 20, 2, 3, 'fire'); }
  runner.skillCd = Math.floor(Math.random() * 400) + 600;
}

function finishRace() {
  raceState = 'FINISHED'; document.getElementById('countdown-overlay').classList.add('hidden');
  document.getElementById('slime-overlay').classList.remove('active'); 
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const sorted = [...runners].sort((a, b) => b.dist - a.dist);
  const playerRank = sorted.findIndex(r => r.id === 0) + 1;
  document.getElementById('result-rank-badge').textContent = `${playerRank}位`;
  document.getElementById('result-detail').textContent = `走破タイム: ${elapsedSec}秒`;
  document.getElementById('result-screen').classList.remove('hidden');
}

function update() {
  if (!isGameRunning) { requestAnimationFrame(update); return; }
  globalTime++; const cdEl = document.getElementById('countdown-overlay');

  if (raceState === 'COUNTDOWN') {
    startCountdown -= 1 / 60;
    if (startCountdown > 0) { cdEl.textContent = Math.ceil(startCountdown); } 
    else { cdEl.textContent = "START!"; setTimeout(() => { if (raceState === 'RACING') cdEl.classList.add('hidden'); }, 1000); raceState = 'RACING'; startTime = Date.now(); }
  }

  if (raceState === 'RACING') {
    const player = runners[0]; const magBonusSpeed = player.magAttr > 50 ? (player.magAttr - 50) * 0.001 : 0;
    currentFlasks.forEach((flask, index) => {
      if (flask.charge < flask.max) flask.charge = Math.min(flask.max, flask.charge + flask.speed + magBonusSpeed);
      const fillEl = document.getElementById(`flask-fill-${index}`); const percentEl = document.getElementById(`flask-percent-${index}`);
      if (fillEl && percentEl) { fillEl.style.height = `${flask.charge}%`; percentEl.textContent = `${Math.floor(flask.charge)}%`; const cardEl = fillEl.closest('.flask-card'); if (flask.charge >= 100) cardEl.classList.add('ready'); else cardEl.classList.remove('ready'); }
    });

    for (let i = 0; i < 4; i++) {
      const r = runners[i]; 
      // 🌟 バランス調整：ベース速度を向上させ、1レースを30秒前後のテンポに
      let baseSpeed = 0.45 + (r.spdAttr - 50) * 0.005; 
      
      if (Math.random() < 0.05) { const mntPenalty = r.mntAttr < 50 ? (50 - r.mntAttr) * 0.01 : 0; baseSpeed -= Math.random() * mntPenalty; }
      
      const progress = r.dist / totalDistance; 
      // 🌟 バランス調整：スタミナ消費量を調整
      let stmDrain = currentCity.bgType === 'snow' ? 0.35 : 0.25; 
      
      if (r.style === '逃げ') { if (progress < 0.35) { baseSpeed *= 1.4; stmDrain *= 1.5; } else if (progress > 0.7) { baseSpeed *= 0.85; } } 
      else if (r.style === '先行') { if (progress > 0.2 && progress < 0.6) { baseSpeed *= 1.15; stmDrain *= 1.1; } } 
      else if (r.style === '差し') { if (progress > 0.5 && progress < 0.8) { baseSpeed *= 1.25; stmDrain *= 1.1; } } 
      else if (r.style === '追込') { if (progress > 0.65) { baseSpeed *= 1.45; stmDrain *= 0.9; } }

      // 🌟 バランス調整：スタミナが切れると大きく失速する
      if (r.stm > 0) r.stm -= stmDrain; 
      else baseSpeed *= 0.4; 

      if (r.boostTimer > 0) { r.boostTimer--; baseSpeed *= 2.0; if (globalTime % 5 === 0) createExplosion(r.x + 24, r.y + 24, '#facc15', 2, 2, 2, 'spark'); }
      if (r.knockback > 0) { r.knockback--; baseSpeed *= 0; }
      r.dist += Math.max(0, baseSpeed);
      if (i !== 0 && remainingDistance < 900) { r.skillCd--; if (r.skillCd <= 0) aiTriggerSkill(r); }
    }

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const r1 = runners[i]; const r2 = runners[j];
        if (Math.abs(r1.dist - r2.dist) < 8) {
          if (r1.powAttr > r2.powAttr) { r1.dist += 0.08; r2.dist -= 0.08; } else if (r2.powAttr > r1.powAttr) { r2.dist += 0.08; r1.dist -= 0.08; }
        }
      }
    }
    const leadingDist = Math.max(...runners.map(r => r.dist)); remainingDistance = Math.max(0, totalDistance - leadingDist);
    if (remainingDistance <= 200 && remainingDistance > 0 && startCountdown <= 0) { const countVal = Math.min(5, Math.max(1, Math.ceil(remainingDistance / 40))); cdEl.textContent = countVal; cdEl.classList.remove('hidden'); }
    if (remainingDistance <= 0) { finishRace(); return; }
  }

  const avgDist = runners.reduce((acc, r) => acc + r.dist, 0) / 4;
  for (let i = 0; i < 4; i++) {
    const r = runners[i]; const diffFromAvg = r.dist - avgDist; r.y = 220 - diffFromAvg * 4.5;
    if (r.y < 80) r.y = 80; if (r.y > 340) r.y = 340;
  }
  document.getElementById('hud-dist').textContent = `${Math.floor(remainingDistance)}m`;
  const sortedRunners = [...runners].sort((a, b) => b.dist - a.dist);
  document.getElementById('hud-rank').textContent = `${sortedRunners.findIndex(r => r.id === 0) + 1}位 / 4人`;
  for (let i = 0; i < 4; i++) { document.getElementById(`runner-marker-${i}`).style.left = `${Math.min(1, Math.max(0, runners[i].dist / totalDistance)) * 100}%`; }

  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10); shakeTime--; }
  if (raceState === 'RACING') scrollY = (scrollY + 0.5) % 60; // スクロール速度もアップ
  drawJapaneseStreetBackground();

  const processedCanvas = updateChromaKeyFrame(54, 64);
  const drawOrder = [...runners].sort((a, b) => a.y - b.y);
  drawOrder.forEach(r => {
    drawZombieCharacter(ctx, r.x - 6, r.y - 16, 54, 64, r, processedCanvas, r.stm <= 0);
    if (r.barrierPower > 0) { ctx.strokeStyle = `rgba(168, 85, 247, ${r.barrierPower / 100})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 20, r.y + 16, 28 * r.sizeInfo.scaleX, 0, Math.PI * 2); ctx.stroke(); }
  });

  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor_drop') {
      p.y += 12; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (p.y >= p.targetY) { shakeTime = 20; createExplosion(p.x, p.y, '#f97316', 100, 10, 8, 'spark'); for (let j = 1; j < 4; j++) applyKnockback(runners[j], p.power); effects.push({ text: `大爆発!!`, x: p.x, y: p.y, color: '#ef4444' }); particles.splice(i, 1); }
    } else if (p.type === 'poison_laser') {
      ctx.fillStyle = '#84cc16'; ctx.fillRect(p.x - p.width/2, 0, p.width, p.y); p.life -= 0.05;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'stone_throw') {
      p.progress += 0.08; const currentX = p.startX + (p.targetX - p.startX) * p.progress; const currentY = p.startY + (p.targetY - p.startY) * p.progress - Math.sin(p.progress * Math.PI) * 40; 
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(currentX, currentY, 4, 0, Math.PI * 2); ctx.fill();
      if (p.progress >= 1) { applyKnockback(p.targetRunner, 30); effects.push({ text: `イテッ`, x: currentX, y: currentY, color: '#f8fafc' }); particles.splice(i, 1); }
    } else {
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); } else { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath(); if (p.type === 'frog') ctx.fillRect(p.x, p.y, p.size, p.size); else ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1.0;

  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(eff.text, eff.x, eff.y);
    if (raceState === 'RACING') eff.y -= 0.8; if (eff.y < 80) effects.splice(i, 1);
  }
  if (flashEffect.alpha > 0) { ctx.fillStyle = flashEffect.color; ctx.globalAlpha = flashEffect.alpha; ctx.fillRect(0, 0, canvas.width, canvas.height); flashEffect.alpha -= 0.05; ctx.globalAlpha = 1.0; }

  ctx.restore(); requestAnimationFrame(update);
}

function init() {
  document.getElementById('nav-scout-btn').onclick = (e) => { e.preventDefault(); document.getElementById('title-screen').classList.add('hidden'); document.getElementById('scout-screen').classList.remove('hidden'); };
  document.getElementById('nav-garage-btn').onclick = (e) => { e.preventDefault(); document.getElementById('title-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };
  document.getElementById('do-scout-btn').onclick = (e) => { e.preventDefault(); doScout(); };
  document.getElementById('back-to-title-1').onclick = (e) => { e.preventDefault(); document.getElementById('scout-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); };
  document.getElementById('back-to-title-2').onclick = (e) => { e.preventDefault(); document.getElementById('garage-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); };
  document.getElementById('back-to-garage-1').onclick = (e) => { e.preventDefault(); document.getElementById('city-select-screen').classList.add('hidden'); document.getElementById('garage-screen').classList.remove('hidden'); };
  document.getElementById('back-to-garage-2').onclick = (e) => { e.preventDefault(); document.getElementById('nurture-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };

  document.querySelectorAll('.cmd-btn').forEach(btn => { btn.onclick = (e) => { e.preventDefault(); executeCommand(btn.dataset.cmd); }; });

  document.getElementById('retry-btn').onclick = (e) => { e.preventDefault(); isGameRunning = false; document.getElementById('result-screen').classList.add('hidden'); document.getElementById('race-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };

  document.querySelectorAll('.flask-card').forEach((card) => { card.addEventListener('pointerdown', (e) => { e.preventDefault(); if (raceState !== 'RACING' || currentFlasks.length === 0) return; const index = parseInt(card.dataset.index); const flask = currentFlasks[index]; if (flask && flask.charge >= 10) triggerSkill(index, Math.floor(flask.charge)); }); });
  
  requestAnimationFrame(update);
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }