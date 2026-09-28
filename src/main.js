const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const podiumCanvas = document.getElementById('podiumCanvas');
const pCtx = podiumCanvas.getContext('2d');

let isGameRunning = false;
let raceState = 'INIT'; // INIT, COUNTDOWN, RACING, FINISH_SLOW, FINISHED
let startCountdown = 3.0;
let shakeTime = 0;
let scrollY = 0;
let globalTime = 0;
let remainingDistance = 400; // 🌟 基準を400mに変更
let totalDistance = 400;
let startTime = 0;
let flashEffect = { alpha: 0, color: '#ffffff' };

// 📦 牧場（ローカルストレージ）
let myZombies = JSON.parse(localStorage.getItem('myZombies')) || [];
myZombies.forEach(z => {
  if (!z.colorInfo) z.colorInfo = { name: '標準', filter: 'none' };
  if (!z.sizeInfo) z.sizeInfo = { name: '標準', scaleX: 1.0, scaleY: 1.0 };
  if (!z.style) z.style = '先行';
  if (z.mentality === undefined) z.mentality = 50;
  if (z.magic === undefined) z.magic = 50;
  if (z.remainingTurns === undefined) z.remainingTurns = 0;
  if (z.bestTime === undefined) z.bestTime = null;
  if (z.bestCity === undefined) z.bestCity = '';
});
let activeZombieIndex = null;
let isNurturing = false;

// 🏙️ 都市設定（400m基準で調整）
const CITIES = [
  { id: 'tokyo', name: '東京', distance: 400, color: '#e11d48', bgType: 'normal', desc: '【標準】約80秒の基本コース。' },
  { id: 'osaka', name: '大阪', distance: 400, color: '#ca8a04', bgType: 'normal', desc: '【乱戦】ライバル達がサボりやすい。' },
  { id: 'nagoya', name: '名古屋', distance: 400, color: '#16a34a', bgType: 'normal', desc: '【鉄壁】ライバルが妨害を弾きやすい。' },
  { id: 'fukuoka', name: '福岡', distance: 300, color: '#0284c7', bgType: 'normal', desc: '【短距離】序盤からのスピード勝負。' },
  { id: 'sapporo', name: '札幌', distance: 500, color: '#93c5fd', bgType: 'snow', desc: '【雪道】体力が削られる長距離戦。' }
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

// 🧟 CPUの哀愁ある名前リスト
const CPU_NAMES = ['田中', '鈴木', '山田', '店長', '部長', '課長', 'バイト', '斎藤', '高橋', '伊藤', '先輩', '新人'];

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

// スキルチャージ速度の調整（80秒レース向け）
const ALL_SKILLS = [
  { id: 'meteor', name: 'メテオ', icon: '☄️', desc: '全体大ダメージ', speed: 0.050 }, { id: 'volcano', name: 'ボルケーノ', icon: '🌋', desc: '全体停止', speed: 0.052 },
  { id: 'tornado', name: 'トルネード', icon: '🌪️', desc: '全体後退', speed: 0.055 }, { id: 'frog', name: 'カエルの雨', icon: '🐸', desc: '視界ジャック', speed: 0.075 },
  { id: 'psycho', name: '追尾サイコガン', icon: '🔫', desc: '最寄り確殺', speed: 0.060 }, { id: 'poison', name: '口から毒液', icon: '🤮', desc: '前方ロックオン', speed: 0.065 },
  { id: 'stone', name: '小石投げ', icon: '🪨', desc: '一瞬怯ませる', speed: 0.095 }, { id: 'hard', name: '硬化', icon: '🪨', desc: '無敵(停止)', speed: 0.065 },
  { id: 'barrier', name: 'バリア', icon: '🛡️', desc: '走りつつ防ぐ', speed: 0.060 }, { id: 'slip', name: 'コケ避け', icon: '🤸', desc: '運ゲー回避', speed: 0.080 },
  { id: 'heal', name: '体力回復', icon: '💉', desc: 'スタミナ回復', speed: 0.055 }, { id: 'mach', name: 'マッハ', icon: '⚡', desc: '超加速ワープ', speed: 0.050 },
  { id: 'meat', name: '生肉ばらまき', icon: '🥩', desc: 'ライバル停止', speed: 0.045 }, { id: 'curse', name: '呪い', icon: '👻', desc: '敵ゲージ減少', speed: 0.060 }
];
let currentFlasks = [];

function applyKnockback(runner, baseKnockback) {
  if (runner.isHard) { effects.push({ text: `硬化無効!`, x: runner.x + 32, y: runner.y - 12, color: '#94a3b8' }); createExplosion(runner.x + 32, runner.y + 20, '#94a3b8', 10, 2, 3, 'spark'); return; }
  if (runner.barrierPower > 0) { baseKnockback -= Math.floor(baseKnockback * (runner.barrierPower / 100)); effects.push({ text: `バリア軽減`, x: runner.x + 32, y: runner.y - 12, color: '#a855f7' }); createExplosion(runner.x + 32, runner.y + 20, '#a855f7', 15, 3, 4, 'spark'); }
  const defense = Math.floor(runner.powAttr * 0.8); const finalKnockback = baseKnockback - defense;
  if (finalKnockback <= 0) { runner.knockback = 0; effects.push({ text: `GUARD!`, x: runner.x + 32, y: runner.y - 12, color: '#facc15' }); createExplosion(runner.x + 32, runner.y + 20, '#facc15', 8, 2, 2, 'spark'); }
  else { runner.knockback = Math.max(runner.knockback, finalKnockback); runner.stm = Math.max(0, runner.stm - (finalKnockback * 0.5)); createExplosion(runner.x + 32, runner.y + 20, '#dc2626', 20, 4, 3, 'blood'); }
}

function drawZombieCharacter(targetCtx, x, y, width, height, zData, processedCanvas, isExhausted, isRacing = false) {
  targetCtx.save(); const isKnockback = zData.knockback > 0;
  
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.45)'; targetCtx.beginPath(); targetCtx.ellipse(x + width / 2, y + height - 2, (width / 2 - 4) * zData.sizeInfo.scaleX, 5, 0, 0, Math.PI * 2); targetCtx.fill();
  
  if (processedCanvas) {
    targetCtx.translate(x + width / 2, y + height); targetCtx.scale(zData.sizeInfo.scaleX, zData.sizeInfo.scaleY);
    if (isKnockback) targetCtx.rotate(-0.35);
    let filterStr = zData.colorInfo.filter;
    if (isKnockback) filterStr = 'brightness(200%) sepia(100%) hue-rotate(-50deg)'; else if (zData.isHard) filterStr = 'grayscale(100%) brightness(0.8)'; else if (isExhausted) filterStr += ' grayscale(80%) brightness(0.6)';
    targetCtx.filter = filterStr; targetCtx.drawImage(processedCanvas, -width / 2, -height, width, height); targetCtx.filter = 'none';
  }
  
  // 🌟 名前と「ニク…」「？」の吹き出し表示
  if (isRacing) {
    targetCtx.translate(x + width / 2, y + height);
    targetCtx.textAlign = 'center';
    
    if (isExhausted && !isKnockback && !zData.isHard) {
      targetCtx.fillStyle = '#fff'; targetCtx.font = 'bold 16px sans-serif';
      targetCtx.fillText('ニク…', 0, -height - 10);
    } else if (zData.isSlacking) {
      targetCtx.fillStyle = '#facc15'; targetCtx.font = 'bold 20px sans-serif';
      targetCtx.fillText('？', 0, -height - 10);
    } else {
      targetCtx.fillStyle = zData.id === 0 ? '#38bdf8' : '#e2e8f0'; targetCtx.font = 'bold 12px sans-serif';
      targetCtx.fillText(zData.name, 0, -height - 10);
    }
  }

  targetCtx.restore();
}

function drawJapaneseStreetBackground() {
  const isSnow = currentCity.bgType === 'snow';
  ctx.fillStyle = isSnow ? '#e2e8f0' : '#1e232e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isSnow ? '#cbd5e1' : '#131720'; ctx.fillRect(0, 0, 16, canvas.height); ctx.fillRect(canvas.width - 16, 0, 16, canvas.height);
  ctx.fillStyle = isSnow ? '#94a3b8' : '#374151'; ctx.fillRect(16, 0, 2, canvas.height); ctx.fillRect(canvas.width - 18, 0, 2, canvas.height);
  ctx.strokeStyle = isSnow ? '#94a3b8' : '#2d3748'; ctx.lineWidth = 1; ctx.setLineDash([16, 24]);
  // 4車線用に線を引く
  const laneW = canvas.width / 4;
  for (let i=1; i<4; i++) { ctx.beginPath(); ctx.moveTo(laneW*i, -80 + scrollY); ctx.lineTo(laneW*i, canvas.height + 80 + scrollY); ctx.stroke(); } ctx.setLineDash([]);
  ctx.strokeStyle = '#eab308'; ctx.lineWidth = 3; ctx.setLineDash([30, 24]);
  ctx.beginPath(); ctx.moveTo(canvas.width/2, -80 + scrollY); ctx.lineTo(canvas.width/2, canvas.height + 80 + scrollY); ctx.stroke(); ctx.setLineDash([]);
}

function renderGarage() {
  const list = document.getElementById('garage-list'); list.innerHTML = ''; document.getElementById('garage-count').textContent = myZombies.length;
  myZombies.forEach((z, idx) => {
    const card = document.createElement('div'); card.className = 'zombie-card';
    let recordHtml = z.bestTime ? `<span class="zc-record">👑 ${z.bestTime}s (${z.bestCity})</span>` : '';
    card.innerHTML = `
      <div class="zc-header"><span class="zc-name">${z.name}</span><span class="zc-style">${z.style}</span></div>
      <div class="zc-stats"><span>速:${z.speed}</span><span>力:${z.power}</span><span>体:${z.stamina}</span><span>気:${z.mentality}</span><span>魔:${z.magic}</span></div>
      ${recordHtml}
      <div class="zc-actions">
        <button class="zc-btn-race" onclick="openCitySelect(${idx})">出走する</button>
        <button class="zc-btn-delete" onclick="deleteZombie(${idx})">逃がす</button>
      </div>
    `;
    list.appendChild(card);
  });
  if (myZombies.length === 0) list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px 20px;">検体が居ません。<br>探索してください。</div>';
}

window.openCitySelect = (idx) => { activeZombieIndex = idx; document.getElementById('garage-screen').classList.add('hidden'); renderCitySelect(); document.getElementById('city-select-screen').classList.remove('hidden'); };
window.deleteZombie = (idx) => { if(confirm('本当に逃がしますか？')) { myZombies.splice(idx, 1); saveZombies(); renderGarage(); } };
function saveZombies() { localStorage.setItem('myZombies', JSON.stringify(myZombies)); }

function doScout() {
  if (myZombies.length >= 3) { alert('牧場がいっぱいです。逃がしてから探してください。'); return; }
  const cityVal = document.getElementById('scout-city').value; const styleVal = document.getElementById('scout-style').value;
  let nameVal = document.getElementById('scout-name').value || '名無しゾンビ';
  let spd = 40 + Math.floor(Math.random()*20), pow = 40 + Math.floor(Math.random()*20), stm = 40 + Math.floor(Math.random()*20), mnt = 40 + Math.floor(Math.random()*20), mag = 40 + Math.floor(Math.random()*20);
  if(cityVal==='osaka') mnt+=15; if(cityVal==='nagoya') pow+=15; if(cityVal==='fukuoka') spd+=15; if(cityVal==='sapporo') stm+=15;
  const newZ = { name: nameVal, colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)], sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)], style: styleVal, speed: spd, power: pow, stamina: stm, mentality: mnt, magic: mag, remainingTurns: 5, bestTime: null, bestCity: '' };
  myZombies.push(newZ); saveZombies(); activeZombieIndex = myZombies.length - 1;
  
  // 🌟 発見演出から強制的に育成画面へ
  const overlay = document.getElementById('found-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.add('hidden');
    document.getElementById('scout-screen').classList.add('hidden');
    updateNurtureUI(); document.getElementById('nurture-screen').classList.remove('hidden');
  }, 2000);
}

function updateNurtureUI() {
  const z = myZombies[activeZombieIndex]; if (!z) return;
  document.getElementById('nurture-turn-txt').textContent = `残 ${z.remainingTurns} 調整`;
  document.getElementById('nurture-zombie-name').textContent = `[${z.sizeInfo.name}/${z.colorInfo.name}] ${z.name}`;
  document.getElementById('stat-style').textContent = z.style; document.getElementById('stat-spd').textContent = z.speed; document.getElementById('stat-pow').textContent = z.power; document.getElementById('stat-stm').textContent = z.stamina; document.getElementById('stat-mnt').textContent = z.mentality; document.getElementById('stat-mag').textContent = z.magic;
  const pCtx = document.getElementById('zombieCanvas').getContext('2d'); pCtx.clearRect(0, 0, 160, 160);
  drawZombieCharacter(pCtx, 40, 20, 80, 110, { ...z, knockback: 0 }, updateChromaKeyFrame(80, 110), false);
  const cmdBox = document.querySelector('.command-container'); const sendBtn = document.getElementById('send-to-garage-btn');
  if (z.remainingTurns <= 0) { cmdBox.classList.add('hidden'); sendBtn.classList.remove('hidden'); } else { cmdBox.classList.remove('hidden'); sendBtn.classList.add('hidden'); }
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
  let mainStat = '', subStat = '', mainStatName = '', subStatName = '';
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

document.getElementById('send-to-garage-btn').onclick = (e) => {
  e.preventDefault(); document.getElementById('nurture-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden');
};

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
  const z = myZombies[activeZombieIndex]; if (!z) { alert('エラー：検体がいません'); location.reload(); return; }
  totalDistance = currentCity.distance; remainingDistance = totalDistance; globalTime = 0; raceState = 'COUNTDOWN'; startCountdown = 3.0;
  document.getElementById('countdown-overlay').classList.remove('hidden'); document.getElementById('finish-overlay').classList.add('hidden'); document.getElementById('slime-overlay').classList.remove('active');
  runners.length = 0; particles.length = 0; effects.length = 0;

  // 🌟 スタミナは「400m=80秒」走り切れる適正な係数(×15)を付与
  const laneW = canvas.width / 4;
  runners.push({ id: 0, name: z.name, x: laneW*0 + laneW/2 - 32, y: 300, dist: 0, stm: z.stamina * 15, maxStm: z.stamina * 15, spdAttr: z.speed, powAttr: z.power, mntAttr: z.mentality, magAttr: z.magic, colorInfo: z.colorInfo, sizeInfo: z.sizeInfo, style: z.style, boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, skillCd: 9999, isSlacking: false });

  for (let i = 1; i < 4; i++) {
    const aiStm = (z.stamina + (Math.floor(Math.random() * 30) - 15)) * 15;
    let mntBase = z.mentality; let powBase = z.power;
    if (currentCity.id === 'osaka') mntBase -= 30; if (currentCity.id === 'nagoya') powBase += 30;
    
    // CPUランダムネーム
    const cpuName = CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)];
    
    runners.push({ id: i, name: cpuName, x: laneW*i + laneW/2 - 32, y: 300, dist: 0, stm: aiStm, maxStm: aiStm, spdAttr: z.speed + (Math.floor(Math.random() * 30) - 15), powAttr: powBase + (Math.floor(Math.random() * 30) - 15), mntAttr: mntBase + (Math.floor(Math.random() * 30) - 15), magAttr: z.magic + (Math.floor(Math.random() * 30) - 15), colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)], sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)], style: RUNNING_STYLES[Math.floor(Math.random() * RUNNING_STYLES.length)], boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, skillCd: Math.floor(Math.random() * 300) + 400, isSlacking: false });
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

  if (flask.id === 'meteor') { flashEffect.color = '#ef4444'; particles.push({ type: 'meteor_drop', x: canvas.width / 2, y: -100, targetY: 300, radius: isMax ? 60 : 20, power: effectivePower }); createExplosion(player.x + 32, player.y + 20, '#38bdf8', 15, 3, 3, 'spark'); effects.push({ text: `SAFE`, x: player.x + 32, y: player.y - 12, color: '#38bdf8' }); } 
  else if (flask.id === 'volcano') { flashEffect.color = '#f97316'; shakeTime = 15; effects.push({ text: `溶岩噴出!`, x: canvas.width/2, y: 300, color: '#f97316' }); runners.forEach(r => { if (r.id !== 0) { applyKnockback(r, effectivePower); r.isHard = false; createExplosion(r.x + 32, r.y + 50, '#f97316', 30, 5, 4, 'fire'); } }); } 
  else if (flask.id === 'tornado') { shakeTime = 10; effects.push({ text: `竜巻!`, x: canvas.width/2, y: 300, color: '#a3e635' }); createExplosion(canvas.width/2, 300, '#a3e635', 50, 8, 3, 'spark'); runners.forEach(r => { if (r.id !== 0) r.dist -= effectivePower * 0.3; }); } 
  else if (flask.id === 'frog') { effects.push({ text: `ベチャッ!!`, x: canvas.width/2, y: 300, color: '#4ade80' }); document.getElementById('slime-overlay').classList.add('active'); setTimeout(() => { document.getElementById('slime-overlay').classList.remove('active'); }, 4000); } 
  else if (flask.id === 'psycho') { let target = runners[1]; runners.forEach(r => { if (r.id !== 0 && Math.abs(r.dist - player.dist) < Math.abs(target.dist - player.dist)) target = r; }); effects.push({ text: `レーザー!`, x: player.x, y: player.y, color: '#38bdf8' }); createExplosion(target.x + 32, target.y + 20, '#38bdf8', 40, 6, 4, 'spark'); applyKnockback(target, effectivePower * 1.5); } 
  else if (flask.id === 'poison') { effects.push({ text: isMax ? `広範囲毒ゲロ!` : `ペッ`, x: player.x, y: player.y - 30, color: '#a3e635' }); const targets = runners.filter(r => r.id !== 0 && r.dist > player.dist && r.dist - player.dist < 300); if (targets.length > 0) { targets.forEach(t => { particles.push({ type: 'poison_line', startX: player.x+32, startY: player.y, targetX: t.x+32, targetY: t.y+20, width: isMax?20:8, life: 1.0 }); applyKnockback(t, effectivePower); effects.push({text: 'POISON!', x: t.x+32, y: t.y-20, color: '#a3e635'}); }); } else { particles.push({ type: 'poison_laser', x: player.x + 32, y: player.y, width: isMax ? 40 : 10, life: 1.0 }); } } 
  else if (flask.id === 'stone') { effects.push({ text: `小石投げ`, x: player.x, y: player.y - 20, color: '#94a3b8' }); let target = runners[1]; runners.forEach(r => { if (r.id !== 0 && Math.abs(r.dist - player.dist) < Math.abs(target.dist - player.dist)) target = r; }); particles.push({ type: 'stone_throw', startX: player.x + 32, startY: player.y, targetX: target.x + 32, targetY: target.y + 20, progress: 0, targetRunner: target }); } 
  else if (flask.id === 'hard') { player.isHard = true; player.knockback = effectivePower; effects.push({ text: `完全硬化`, x: player.x + 32, y: player.y - 12, color: '#94a3b8' }); createExplosion(player.x + 32, player.y + 20, '#cbd5e1', 20, 2, 3, 'spark'); setTimeout(() => { player.isHard = false; }, effectivePower * 30); } 
  else if (flask.id === 'barrier') { flashEffect.color = '#a855f7'; player.barrierPower = effectivePower; effects.push({ text: `透過バリア`, x: player.x + 32, y: player.y - 12, color: '#a855f7' }); createExplosion(player.x + 32, player.y + 20, '#a855f7', 30, 4, 3, 'spark'); setTimeout(() => { player.barrierPower = 0; }, 3000); } 
  else if (flask.id === 'slip') { effects.push({ text: `謎ポーズ`, x: player.x + 32, y: player.y - 12, color: '#facc15' }); if (Math.random() > 0.5) player.barrierPower = 50; } 
  else if (flask.id === 'heal') { flashEffect.color = '#22c55e'; player.stm = Math.min(player.maxStm, player.stm + effectivePower * 2.0); effects.push({ text: `超回復`, x: player.x + 32, y: player.y - 12, color: '#22c55e' }); createExplosion(player.x + 32, player.y + 20, '#4ade80', 40, 2, 3, 'fire'); } 
  else if (flask.id === 'mach') { flashEffect.color = '#facc15'; player.boostTimer = effectivePower * 2.0; effects.push({ text: `マッハ!!`, x: player.x + 32, y: player.y - 12, color: '#facc15' }); createExplosion(player.x + 32, player.y + 20, '#facc15', 50, 6, 4, 'spark'); } 
  else if (flask.id === 'meat') { effects.push({ text: `生肉散布!`, x: canvas.width/2, y: 200, color: '#ef4444' }); createExplosion(canvas.width/2, 200, '#dc2626', 60, 7, 5, 'blood'); runners.forEach(r => { if (r.id !== 0) r.knockback = Math.random() * effectivePower; }); } 
  else if (flask.id === 'curse') { flashEffect.color = '#7c3aed'; effects.push({ text: `呪い...`, x: canvas.width/2, y: 200, color: '#7c3aed' }); createExplosion(canvas.width/2, 200, '#7c3aed', 40, 3, 3, 'fire'); }
  flask.charge = 0;
}

function aiTriggerSkill(runner) {
  const skills = ['mach', 'barrier', 'meat', 'heal']; const skill = skills[Math.floor(Math.random() * skills.length)];
  if (skill === 'mach') { runner.boostTimer = 80; createExplosion(runner.x + 32, runner.y + 20, '#facc15', 20, 4, 3, 'spark'); } 
  else if (skill === 'barrier') { runner.barrierPower = 100; setTimeout(() => { runner.barrierPower = 0; }, 2000); createExplosion(runner.x + 32, runner.y + 20, '#a855f7', 20, 3, 3, 'spark'); }
  else if (skill === 'meat') { runners.forEach(r => { if (r.id !== runner.id) applyKnockback(r, 40); }); createExplosion(canvas.width/2, 200, '#dc2626', 30, 5, 4, 'blood'); }
  else if (skill === 'heal') { runner.stm = Math.min(runner.maxStm, runner.stm + 40); createExplosion(runner.x + 32, runner.y + 20, '#4ade80', 20, 2, 3, 'fire'); }
  runner.skillCd = Math.floor(Math.random() * 400) + 600;
}

function doFinish() {
  raceState = 'FINISH_SLOW';
  document.getElementById('slime-overlay').classList.remove('active');
  const fo = document.getElementById('finish-overlay');
  fo.classList.remove('hidden');
  
  // 1位の走破タイム確定
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  
  setTimeout(() => {
    raceState = 'FINISHED';
    const sorted = [...runners].sort((a, b) => b.dist - a.dist);
    const playerRank = sorted.findIndex(r => r.id === 0) + 1;
    
    // ベストタイム更新処理
    if (playerRank === 1) {
      const z = myZombies[activeZombieIndex];
      const timeNum = parseFloat(elapsedSec);
      if (!z.bestTime || timeNum < parseFloat(z.bestTime)) {
        z.bestTime = elapsedSec; z.bestCity = currentCity.name; saveZombies();
      }
    }

    renderPodium(sorted, elapsedSec);
    document.getElementById('result-screen').classList.remove('hidden');
  }, 2500); // 2.5秒のスロー演出後にリザルトへ
}

// 🏆 表彰台の描画
function renderPodium(sortedRunners, winningTime) {
  pCtx.clearRect(0, 0, podiumCanvas.width, podiumCanvas.height);
  
  // 台座の描画
  pCtx.fillStyle = '#facc15'; pCtx.fillRect(140, 100, 80, 140); // 1位
  pCtx.fillStyle = '#94a3b8'; pCtx.fillRect(60, 140, 80, 100); // 2位
  pCtx.fillStyle = '#b45309'; pCtx.fillRect(220, 160, 80, 80); // 3位
  
  pCtx.fillStyle = '#0f131a'; pCtx.font = 'bold 36px sans-serif'; pCtx.textAlign = 'center';
  pCtx.fillText('1', 180, 150); pCtx.fillText('2', 100, 180); pCtx.fillText('3', 260, 200);

  const processedCanvas = updateChromaKeyFrame(64, 80) || updateChromaKeyFrame(64, 80); // フォールバック対応

  // 1位
  drawZombieCharacter(pCtx, 140+8, 100-80, 64, 80, sortedRunners[0], processedCanvas, false, false);
  // 2位
  if(sortedRunners[1]) drawZombieCharacter(pCtx, 60+8, 140-80, 64, 80, sortedRunners[1], processedCanvas, false, false);
  // 3位
  if(sortedRunners[2]) drawZombieCharacter(pCtx, 220+8, 160-80, 64, 80, sortedRunners[2], processedCanvas, false, false);

  // リストの生成
  const listContainer = document.getElementById('result-list');
  listContainer.innerHTML = '';
  sortedRunners.forEach((r, idx) => {
    const row = document.createElement('div'); row.className = `result-row rank-${idx+1}`;
    // タイムは1位のみ実数、2位以降は適当にプラスする
    const timeStr = idx === 0 ? `${winningTime}s` : `+${(Math.random()*3 + 1).toFixed(2)}s`;
    row.innerHTML = `<span class="res-rank">${idx+1}</span><span class="res-name">${r.name}</span><span class="res-time">${timeStr}</span>`;
    listContainer.appendChild(row);
  });
}

function update() {
  if (!isGameRunning) { requestAnimationFrame(update); return; }
  globalTime++; const cdEl = document.getElementById('countdown-overlay');

  if (raceState === 'COUNTDOWN') {
    startCountdown -= 1 / 60;
    if (startCountdown > 0) { cdEl.textContent = Math.ceil(startCountdown); } 
    else { cdEl.textContent = "START!"; setTimeout(() => { if (raceState === 'RACING') cdEl.classList.add('hidden'); }, 1000); raceState = 'RACING'; startTime = Date.now(); }
  }

  // 🌟 FINISH時のスローモーション演出
  let dt = raceState === 'FINISH_SLOW' ? 0.2 : 1.0; 

  if (raceState === 'RACING' || raceState === 'FINISH_SLOW') {
    const player = runners[0]; const magBonusSpeed = player.magAttr > 50 ? (player.magAttr - 50) * 0.001 : 0;
    currentFlasks.forEach((flask, index) => {
      if (flask.charge < flask.max) flask.charge = Math.min(flask.max, flask.charge + (flask.speed + magBonusSpeed) * dt);
      const fillEl = document.getElementById(`flask-fill-${index}`); const percentEl = document.getElementById(`flask-percent-${index}`);
      if (fillEl && percentEl) { fillEl.style.height = `${flask.charge}%`; percentEl.textContent = `${Math.floor(flask.charge)}%`; const cardEl = fillEl.closest('.flask-card'); if (flask.charge >= 100) cardEl.classList.add('ready'); else cardEl.classList.remove('ready'); }
    });

    for (let i = 0; i < 4; i++) {
      const r = runners[i]; 
      
      // 🌟 気性の可視化（サボりシステム）
      if (!r.isSlacking && Math.random() < 0.003 && r.mntAttr < 70) {
        // 気性が低いほどサボりやすい
        const slackChance = (70 - r.mntAttr) * 0.01;
        if (Math.random() < slackChance) {
          r.isSlacking = true;
          r.knockback = 60; // 約1秒立ち止まる
          setTimeout(() => { r.isSlacking = false; }, 1000);
        }
      }

      // 400m（約80〜100秒）向けの基礎スピード調整
      let baseSpeed = 0.08 + (r.spdAttr - 50) * 0.001; 
      const progress = r.dist / totalDistance; 
      let stmDrain = currentCity.bgType === 'snow' ? 0.025 : 0.018; 
      
      // 脚質ごとのスタミナ配分
      if (r.style === '逃げ') { if (progress < 0.4) { baseSpeed *= 1.5; stmDrain *= 1.8; } else if (progress > 0.7) { baseSpeed *= 0.8; } } 
      else if (r.style === '先行') { if (progress > 0.2 && progress < 0.6) { baseSpeed *= 1.2; stmDrain *= 1.2; } } 
      else if (r.style === '差し') { if (progress > 0.5 && progress < 0.8) { baseSpeed *= 1.3; stmDrain *= 1.1; } } 
      else if (r.style === '追込') { if (progress > 0.7) { baseSpeed *= 1.6; stmDrain *= 0.8; } }

      if (r.stm > 0) r.stm -= stmDrain * dt; 
      else baseSpeed *= 0.3; // バテたら超減速

      if (r.boostTimer > 0) { r.boostTimer -= dt; baseSpeed *= 2.5; if (globalTime % 5 === 0) createExplosion(r.x + 32, r.y + 32, '#facc15', 2, 2, 2, 'spark'); }
      if (r.knockback > 0) { r.knockback -= dt; baseSpeed *= 0; }
      r.dist += Math.max(0, baseSpeed) * dt;
      if (i !== 0 && remainingDistance < 350) { r.skillCd -= dt; if (r.skillCd <= 0) aiTriggerSkill(r); }
    }

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const r1 = runners[i]; const r2 = runners[j];
        if (Math.abs(r1.dist - r2.dist) < 8) {
          if (r1.powAttr > r2.powAttr) { r1.dist += 0.05*dt; r2.dist -= 0.05*dt; } else if (r2.powAttr > r1.powAttr) { r2.dist += 0.05*dt; r1.dist -= 0.05*dt; }
        }
      }
    }
    const leadingDist = Math.max(...runners.map(r => r.dist)); remainingDistance = Math.max(0, totalDistance - leadingDist);
    if (raceState === 'RACING') {
      if (remainingDistance <= 50 && remainingDistance > 0 && startCountdown <= 0) { const countVal = Math.min(5, Math.max(1, Math.ceil(remainingDistance / 10))); cdEl.textContent = countVal; cdEl.classList.remove('hidden'); }
      if (remainingDistance <= 0) { doFinish(); }
    }
  }

  const avgDist = runners.reduce((acc, r) => acc + r.dist, 0) / 4;
  for (let i = 0; i < 4; i++) {
    const r = runners[i]; const diffFromAvg = r.dist - avgDist; r.y = 300 - diffFromAvg * 6.0;
    if (r.y < 100) r.y = 100; if (r.y > 450) r.y = 450;
  }
  document.getElementById('hud-dist').textContent = `${Math.floor(remainingDistance)}m`;
  const sortedRunners = [...runners].sort((a, b) => b.dist - a.dist);
  document.getElementById('hud-rank').textContent = `${sortedRunners.findIndex(r => r.id === 0) + 1}位 / 4人`;
  for (let i = 0; i < 4; i++) { document.getElementById(`runner-marker-${i}`).style.left = `${Math.min(1, Math.max(0, runners[i].dist / totalDistance)) * 100}%`; }

  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10); shakeTime -= dt; }
  
  if (raceState === 'RACING' || raceState === 'FINISH_SLOW') scrollY = (scrollY + 0.15 * dt) % 80;
  drawJapaneseStreetBackground();

  const processedCanvas = updateChromaKeyFrame(64, 80);
  const drawOrder = [...runners].sort((a, b) => a.y - b.y);
  drawOrder.forEach(r => {
    drawZombieCharacter(ctx, r.x - 16, r.y - 16, 64, 80, r, processedCanvas, r.stm <= 0, true);
    if (r.barrierPower > 0) { ctx.strokeStyle = `rgba(168, 85, 247, ${r.barrierPower / 100})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 32, r.y + 20, 32 * r.sizeInfo.scaleX, 0, Math.PI * 2); ctx.stroke(); }
  });

  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor_drop') {
      p.y += 12 * dt; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (p.y >= p.targetY) { shakeTime = 20; createExplosion(p.x, p.y, '#f97316', 100, 10, 8, 'spark'); for (let j = 1; j < 4; j++) applyKnockback(runners[j], p.power); effects.push({ text: `大爆発!!`, x: p.x, y: p.y, color: '#ef4444' }); particles.splice(i, 1); }
    } else if (p.type === 'poison_laser') {
      ctx.fillStyle = '#84cc16'; ctx.fillRect(p.x - p.width/2, 0, p.width, p.y); p.life -= 0.05 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'poison_line') {
      ctx.strokeStyle = '#84cc16'; ctx.lineWidth = p.width; ctx.globalAlpha = p.life;
      ctx.beginPath(); ctx.moveTo(p.startX, p.startY); ctx.lineTo(p.targetX, p.targetY); ctx.stroke(); ctx.globalAlpha = 1.0;
      p.life -= 0.05 * dt; if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'stone_throw') {
      p.progress += 0.03 * dt; const currentX = p.startX + (p.targetX - p.startX) * p.progress; const currentY = p.startY + (p.targetY - p.startY) * p.progress - Math.sin(p.progress * Math.PI) * 50; 
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(currentX, currentY, 6, 0, Math.PI * 2); ctx.fill();
      if (p.progress >= 1) { applyKnockback(p.targetRunner, 40); effects.push({ text: `イテッ`, x: currentX, y: currentY, color: '#f8fafc' }); createExplosion(currentX, currentY, '#f8fafc', 5, 2, 2, 'spark'); particles.splice(i, 1); }
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.life <= 0) { particles.splice(i, 1); } else { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath(); if (p.type === 'frog') ctx.fillRect(p.x, p.y, p.size, p.size); else ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1.0;

  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; ctx.fillStyle = eff.color; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(eff.text, eff.x, eff.y);
    if (raceState === 'RACING' || raceState === 'FINISH_SLOW') eff.y -= 0.8 * dt; if (eff.y < 80) effects.splice(i, 1);
  }
  if (flashEffect.alpha > 0) { ctx.fillStyle = flashEffect.color; ctx.globalAlpha = flashEffect.alpha; ctx.fillRect(0, 0, canvas.width, canvas.height); flashEffect.alpha -= 0.05 * dt; ctx.globalAlpha = 1.0; }

  ctx.restore(); requestAnimationFrame(update);
}

function init() {
  document.getElementById('nav-scout-btn').onclick = (e) => { e.preventDefault(); document.getElementById('title-screen').classList.add('hidden'); document.getElementById('scout-screen').classList.remove('hidden'); };
  document.getElementById('nav-garage-btn').onclick = (e) => { e.preventDefault(); document.getElementById('title-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };
  document.getElementById('do-scout-btn').onclick = (e) => { e.preventDefault(); doScout(); };
  document.getElementById('back-to-title-1').onclick = (e) => { e.preventDefault(); document.getElementById('scout-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); };
  document.getElementById('back-to-title-2').onclick = (e) => { e.preventDefault(); document.getElementById('garage-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); };
  document.getElementById('back-to-garage-1').onclick = (e) => { e.preventDefault(); document.getElementById('city-select-screen').classList.add('hidden'); document.getElementById('garage-screen').classList.remove('hidden'); };
  document.getElementById('retry-btn').onclick = (e) => { e.preventDefault(); isGameRunning = false; document.getElementById('result-screen').classList.add('hidden'); document.getElementById('race-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };

  document.querySelectorAll('.cmd-btn').forEach(btn => { btn.onclick = (e) => { e.preventDefault(); executeCommand(btn.dataset.cmd); }; });
  document.querySelectorAll('.flask-card').forEach((card) => { card.addEventListener('pointerdown', (e) => { e.preventDefault(); if (raceState !== 'RACING' || currentFlasks.length === 0) return; const index = parseInt(card.dataset.index); const flask = currentFlasks[index]; if (flask && flask.charge >= 10) triggerSkill(index, Math.floor(flask.charge)); }); });
  
  requestAnimationFrame(update);
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }