const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
const podiumCanvas = document.getElementById('podiumCanvas'); const pCtx = podiumCanvas.getContext('2d');

let isGameRunning = false; let raceState = 'INIT'; let startCountdown = 3.0;
let shakeTime = 0; let scrollY = 0; let globalTime = 0;
let remainingDistance = 400; let totalDistance = 400; let startTime = 0;
let flashEffect = { alpha: 0, color: '#ffffff' };

// 📦 データ管理
let myZombies = JSON.parse(localStorage.getItem('myZombies')) || [];
let zombieMoney = parseInt(localStorage.getItem('zombieMoney')) || 0;
let weeklyChamps = JSON.parse(localStorage.getItem('weeklyChamps')) || {};
let weekStart = parseInt(localStorage.getItem('weekStart')) || Date.now();

if (Date.now() - weekStart > 7 * 24 * 60 * 60 * 1000) {
  weeklyChamps = {};
  weekStart = Date.now();
  localStorage.setItem('weekStart', weekStart.toString());
  localStorage.setItem('weeklyChamps', JSON.stringify(weeklyChamps));
}

myZombies.forEach(z => {
  if (!z.colorInfo) z.colorInfo = { name: '標準', filter: 'none' };
  if (!z.sizeInfo) z.sizeInfo = { name: '標準', scaleX: 1.0, scaleY: 1.0 };
  if (!z.style) z.style = '先行';
  if (z.mentality === undefined) z.mentality = 50; if (z.magic === undefined) z.magic = 50;
  if (z.remainingTurns === undefined) z.remainingTurns = 0;
  if (z.matches === undefined) z.matches = 0; if (z.wins === undefined) z.wins = 0;
  if (z.videoIndex === undefined) z.videoIndex = 0;
});
let activeZombieIndex = null; let isNurturing = false;

function saveGame() { 
  localStorage.setItem('myZombies', JSON.stringify(myZombies)); 
  localStorage.setItem('zombieMoney', zombieMoney.toString());
  localStorage.setItem('weeklyChamps', JSON.stringify(weeklyChamps));
}

function getTitle(z) {
  if (z.wins >= 50) return ['生ける伝説', '世紀末覇者', '神速のバケモノ'][Math.floor(Math.random()*3)];
  if (z.wins >= 10) return ['常勝の', '不沈艦', '音速の'][Math.floor(Math.random()*3)];
  if (z.matches >= 10) return ['歴戦の', '傷だらけの', '噛みつき魔'][Math.floor(Math.random()*3)];
  return ['駆け出しの', 'ヨチヨチの', '迷い込んだ'][Math.floor(Math.random()*3)];
}

const CITIES = [
  { id: 'tokyo', name: '東京', distance: 400, color: '#e11d48', bgType: 'normal', desc: '【標準】約80秒の基本コース。' },
  { id: 'osaka', name: '大阪', distance: 400, color: '#ca8a04', bgType: 'normal', desc: '【乱戦】ライバル達がサボりやすい。' },
  { id: 'nagoya', name: '名古屋', distance: 400, color: '#16a34a', bgType: 'normal', desc: '【鉄壁】ライバルが妨害を弾きやすい。' },
  { id: 'fukuoka', name: '福岡', distance: 300, color: '#0284c7', bgType: 'normal', desc: '【短距離】序盤からのスピード勝負。' },
  { id: 'sapporo', name: '札幌', distance: 500, color: '#93c5fd', bgType: 'snow', desc: '【雪道】体力が削られる長距離戦。' }
];
let currentCity = CITIES[0];

const ZOMBIE_COLORS = [{ name: '標準', filter: 'none' }, { name: '猛毒', filter: 'hue-rotate(90deg) saturate(120%)' }, { name: '深淵', filter: 'hue-rotate(210deg) saturate(100%) brightness(0.9)' }, { name: '狂暴', filter: 'hue-rotate(-50deg) saturate(150%) brightness(1.1)' }, { name: '蒼白', filter: 'grayscale(70%) brightness(1.2) hue-rotate(180deg)' }, { name: '黒曜', filter: 'grayscale(60%) brightness(0.6) contrast(1.3)' }];
const ZOMBIE_SIZES = [{ name: '標準', scaleX: 1.0, scaleY: 1.0 }, { name: '巨漢', scaleX: 1.25, scaleY: 1.3 }, { name: '肥満', scaleX: 1.3, scaleY: 0.95 }];
const RUNNING_STYLES = ['逃げ', '先行', '差し', '追込'];
const CPU_NAMES = ['田中', '鈴木', '山田', '店長', '部長', '課長', 'バイト', '新人', '先輩'];

const VIDEO_SOURCES = ['/zombie1.mp4', '/zombie2.mp4', '/zombie3.mp4'];
const zombieVideos = []; const offCanvases = []; const offCtxs = [];

VIDEO_SOURCES.forEach(src => {
  const v = document.createElement('video');
  v.src = src; v.loop = true; v.muted = true; v.playsInline = true; v.autoplay = true;
  v.addEventListener('canplay', () => v.play().catch(() => {}));
  zombieVideos.push(v);
  const c = document.createElement('canvas');
  offCanvases.push(c); 
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = false;
  offCtxs.push(cx);
});

function updateChromaKeyFrame(idx, targetW, targetH) {
  const v = zombieVideos[idx]; const c = offCanvases[idx]; const cx = offCtxs[idx];
  if (!v || v.readyState < 2 || v.paused) return null;
  if (c.width !== targetW) c.width = targetW; if (c.height !== targetH) c.height = targetH;
  cx.imageSmoothingEnabled = false;
  cx.clearRect(0, 0, targetW, targetH);
  
  const vw = v.videoWidth || 100; const vh = v.videoHeight || 100;
  const cropX = vw * 0.03; const cropY = vh * 0.08; const cropW = vw * 0.94; const cropH = vh * 0.92;

  cx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
  const data = cx.getImageData(0, 0, targetW, targetH);
  
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      const r = data.data[i], g = data.data[i+1], b = data.data[i+2];
      if (g > 75 && g > r * 1.15 && g > b * 1.15) {
        data.data[i+3] = 0; 
      }
      if (y < targetH * 0.12 && (x > targetW * 0.5 || x < targetW * 0.2)) {
        if (r > 150 && g > 150 && b > 150) {
          data.data[i+3] = 0;
        }
      }
    }
  }
  
  cx.putImageData(data, 0, 0); return c;
}

const runners = []; const effects = []; let particles = [];

// 🧪 スキル（異能）定義 ＆ 説明文プロパティ追加
const ALL_SKILLS = [
  { id: 'meteor', name: 'メテオ', desc: '隕石爆発でライバル大打撃', type: 'auto', speed: 0.045 },
  { id: 'volcano', name: '溶岩', desc: '全体ノックバック＆吹き飛ばし', type: 'auto', speed: 0.048 },
  { id: 'tornado', name: '竜巻', desc: '竜巻で敵を後退させる', type: 'auto', speed: 0.050 },
  { id: 'frog', name: 'カエル', desc: '巨大カエルで視界ジャック', type: 'auto', speed: 0.070 },
  { id: 'poison', name: '毒液', desc: '前方の敵に毒ダメージ', type: 'auto', speed: 0.060 },
  { id: 'stone', name: '小石', desc: '最寄りの敵に石を投げつけ', type: 'auto', speed: 0.090 },
  { id: 'meat', name: '生肉', desc: '足止め罠で足止め', type: 'auto', speed: 0.040 }
];

const SYRINGE_SKILLS = [
  { id: 'mach', name: 'マッハ', desc: '一定時間超絶ダッシュ！' },
  { id: 'heal', name: 'ヒール', desc: 'スタミナを大幅超回復！' },
  { id: 'barrier', name: 'バリア', desc: '一定時間完全無敵！' },
  { id: 'psycho', name: 'サイコ', desc: '最寄りの敵を狙い撃ち大爆発！' }
];

let currentAutoFlasks = []; let currentSyringe = null; let syringeUsed = false;

let peer = null; let peerConnections = []; let myPeerId = null; let isPvpMode = false; let pvpMembers = [];

function initPeerJS() {
  if (typeof Peer === 'undefined') { document.getElementById('pvp-net-status').textContent = 'P2P通信未対応'; return; }
  const randomId = 'zombie-' + Math.floor(Math.random() * 8999 + 1000);
  peer = new Peer(randomId);
  peer.on('open', (id) => {
    myPeerId = id;
    document.getElementById('pvp-net-status').textContent = `オンライン (ID: ${id})`;
  });
  peer.on('connection', (conn) => {
    peerConnections.push(conn);
    setupConnEvents(conn);
  });
}

function setupConnEvents(conn) {
  conn.on('data', (data) => {
    if (data.type === 'JOIN_ROOM') {
      pvpMembers.push({ id: conn.peer, name: data.zombieName });
      updateLobbyUI();
      broadcast({ type: 'UPDATE_MEMBERS', members: pvpMembers, cityId: currentCity.id });
    } else if (data.type === 'UPDATE_MEMBERS') {
      pvpMembers = data.members;
      if(data.cityId) {
        const foundCity = CITIES.find(c => c.id === data.cityId);
        if(foundCity) currentCity = foundCity;
      }
      updateLobbyUI();
    } else if (data.type === 'START_RACE') {
      isPvpMode = true;
      if(data.cityId) {
        const foundCity = CITIES.find(c => c.id === data.cityId);
        if(foundCity) currentCity = foundCity;
      }
      document.getElementById('pvp-screen').classList.add('hidden');
      showPaddock();
    } else if (data.type === 'SYNC_SKILL') {
      const runner = runners.find(r => r.id === data.runnerId);
      if (runner) triggerSkill(data.skill, runner);
    }
  });
}

function broadcast(data) {
  peerConnections.forEach(c => { if(c.open) c.send(data); });
}

function updatePvpSelectUI() {
  const zSelect = document.getElementById('pvp-zombie-select'); zSelect.innerHTML = '';
  if (myZombies.length === 0) {
    zSelect.innerHTML = '<option value="-1">検体が居ません（探索してください）</option>';
  } else {
    myZombies.forEach((z, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${z.name} (速${z.speed} 体${z.stamina} ${z.style})`;
      zSelect.appendChild(opt);
    });
  }
}

function updateLobbyUI() {
  const list = document.getElementById('member-list'); list.innerHTML = '';
  document.getElementById('lobby-city-name').textContent = currentCity.name;
  pvpMembers.forEach(m => {
    const row = document.createElement('div'); row.className = 'member-row';
    row.innerHTML = `<span>🧟 ${m.name}</span><span style="color:#94a3b8;">ID: ${m.id}</span>`;
    list.appendChild(row);
  });
}

document.getElementById('create-room-btn').onclick = () => {
  if (!myPeerId) { alert('通信の初期化中です...'); return; }
  const zIdx = parseInt(document.getElementById('pvp-zombie-select').value);
  if (isNaN(zIdx) || zIdx < 0) { alert('出走させるゾンビを選んでください！'); return; }
  
  activeZombieIndex = zIdx;
  const cityVal = document.getElementById('pvp-city-select').value;
  currentCity = CITIES.find(c => c.id === cityVal) || CITIES[0];
  
  const z = myZombies[activeZombieIndex];
  pvpMembers = [{ id: myPeerId, name: z ? z.name : 'ホスト' }];
  document.getElementById('lobby-room-id').textContent = myPeerId;
  document.getElementById('room-lobby').classList.remove('hidden');
  updateLobbyUI();
};

document.getElementById('join-room-btn').onclick = () => {
  const targetId = document.getElementById('room-id-input').value.trim();
  if (!targetId || !peer) return;
  const zIdx = parseInt(document.getElementById('pvp-zombie-select').value);
  if (isNaN(zIdx) || zIdx < 0) { alert('出走させるゾンビを選んでください！'); return; }
  
  activeZombieIndex = zIdx;
  const conn = peer.connect(targetId);
  peerConnections.push(conn);
  setupConnEvents(conn);
  conn.on('open', () => {
    const z = myZombies[activeZombieIndex];
    conn.send({ type: 'JOIN_ROOM', zombieName: z ? z.name : 'ゲスト' });
    document.getElementById('lobby-room-id').textContent = targetId;
    document.getElementById('room-lobby').classList.remove('hidden');
  });
};

document.getElementById('start-pvp-race-btn').onclick = () => {
  broadcast({ type: 'START_RACE', cityId: currentCity.id });
  isPvpMode = true;
  document.getElementById('pvp-screen').classList.add('hidden');
  showPaddock();
};

function drawSpeechBalloon(targetCtx, text, x, y, bgColor='#ffffff', textColor='#000') {
  targetCtx.save(); targetCtx.font = 'bold 13px sans-serif';
  const tw = targetCtx.measureText(text).width; const w = tw + 16; const h = 24;
  targetCtx.fillStyle = bgColor; targetCtx.beginPath(); targetCtx.roundRect(x - w/2, y - h, w, h, 6); targetCtx.fill();
  targetCtx.strokeStyle = '#000'; targetCtx.lineWidth = 2; targetCtx.stroke();
  targetCtx.beginPath(); targetCtx.moveTo(x-4, y); targetCtx.lineTo(x+4, y); targetCtx.lineTo(x, y+6); targetCtx.fill(); targetCtx.stroke();
  targetCtx.fillStyle = textColor; targetCtx.textAlign = 'center'; targetCtx.textBaseline = 'middle'; targetCtx.fillText(text, x, y - h/2);
  targetCtx.restore();
}

function createExplosion(x, y, color, count, speedMax, sizeBase, type = 'spark') {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2; const speed = Math.random() * speedMax;
    particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (type === 'fire' ? 2 : 0), life: 1.0, decay: Math.random() * 0.03 + 0.015, color: color, size: Math.random() * sizeBase + sizeBase/2, type: type });
  }
}

function applyKnockback(runner, baseKnockback) {
  if (runner.isHard) { effects.push({ text: `硬化!`, runner: runner, isBalloon: true, life: 40, bgColor: '#cbd5e1', textColor: '#000' }); createExplosion(runner.x, runner.y, '#94a3b8', 10, 2, 3, 'spark'); return; }
  if (runner.barrierPower > 0) { baseKnockback -= Math.floor(baseKnockback * (runner.barrierPower / 100)); effects.push({ text: `弾いた!`, runner: runner, isBalloon: true, life: 40, bgColor: '#a855f7', textColor: '#fff' }); createExplosion(runner.x, runner.y, '#a855f7', 15, 3, 4, 'spark'); }
  const defense = Math.floor(runner.powAttr * 0.8); const finalKnockback = baseKnockback - defense;
  if (finalKnockback <= 0) { runner.knockback = 0; effects.push({ text: `GUARD!`, runner: runner, isBalloon: true, life: 40, bgColor: '#38bdf8', textColor: '#000' }); }
  else { runner.knockback = Math.max(runner.knockback, finalKnockback); runner.stm = Math.max(0, runner.stm - (finalKnockback * 0.5)); effects.push({ text: `ギャッ!`, runner: runner, isBalloon: true, life: 40, bgColor: '#ef4444', textColor: '#fff' }); createExplosion(runner.x, runner.y, '#dc2626', 20, 4, 3, 'blood'); }
}

function drawZombieCharacter(targetCtx, x, y, width, height, zData, processedCanvas, isExhausted, isRacing = false) {
  targetCtx.save(); 
  const isKnockback = zData.knockback > 0;
  
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.45)'; 
  targetCtx.beginPath(); 
  targetCtx.ellipse(x, y + height - 5, (width / 2 - 4) * zData.sizeInfo.scaleX, 6, 0, 0, Math.PI * 2); 
  targetCtx.fill();

  targetCtx.translate(x, y + height);
  
  if (processedCanvas) {
    targetCtx.save();
    targetCtx.scale(zData.sizeInfo.scaleX, zData.sizeInfo.scaleY);
    if (isKnockback) targetCtx.rotate(-0.35);
    let filterStr = zData.colorInfo.filter;
    if (isKnockback) filterStr = 'brightness(200%) sepia(100%) hue-rotate(-50deg)'; 
    else if (zData.isHard) filterStr = 'grayscale(100%) brightness(0.8)'; 
    else if (isExhausted) filterStr += ' grayscale(80%) brightness(0.6)';
    targetCtx.filter = filterStr; 
    targetCtx.drawImage(processedCanvas, -width / 2, -height, width, height); 
    targetCtx.restore();
  }
  
  if (isRacing) {
    targetCtx.textAlign = 'center';
    if (isExhausted && !isKnockback && !zData.isHard) drawSpeechBalloon(targetCtx, 'ニク…', 0, -height - 10, '#fff', '#000');
    else if (zData.isSlacking) drawSpeechBalloon(targetCtx, '？', 0, -height - 10, '#facc15', '#000');
    
    let dispName = zData.name; 
    if(dispName.length > 5) dispName = dispName.substring(0,4) + '…';
    
    targetCtx.font = 'bold 12px sans-serif';
    targetCtx.lineWidth = 3;
    targetCtx.strokeStyle = '#000';
    targetCtx.strokeText(dispName, 0, -5);
    
    targetCtx.fillStyle = zData.id === 0 ? '#38bdf8' : '#cbd5e1'; 
    targetCtx.fillText(dispName, 0, -5);
  }
  
  targetCtx.restore();
}

function drawJapaneseStreetBackground() {
  const isSnow = currentCity.bgType === 'snow';
  ctx.fillStyle = isSnow ? '#e2e8f0' : '#1e232e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isSnow ? '#cbd5e1' : '#131720'; ctx.fillRect(0, 0, 20, canvas.height); ctx.fillRect(canvas.width - 20, 0, 20, canvas.height);
  ctx.fillStyle = isSnow ? '#94a3b8' : '#374151'; ctx.fillRect(20, 0, 2, canvas.height); ctx.fillRect(canvas.width - 22, 0, 2, canvas.height);
  ctx.strokeStyle = isSnow ? '#94a3b8' : '#2d3748'; ctx.lineWidth = 2; ctx.setLineDash([20, 30]);
  const laneW = canvas.width / 4;
  for (let i=1; i<4; i++) { ctx.beginPath(); ctx.moveTo(laneW*i, -100 + scrollY); ctx.lineTo(laneW*i, canvas.height + 100 + scrollY); ctx.stroke(); } ctx.setLineDash([]);
}

function updateMoneyDisp() { document.getElementById('title-money').textContent = zombieMoney; document.getElementById('garage-money').textContent = zombieMoney; document.getElementById('shop-money').textContent = zombieMoney; }

function renderGarage() {
  updateMoneyDisp();
  const list = document.getElementById('garage-list'); list.innerHTML = ''; document.getElementById('garage-count').textContent = myZombies.length;
  myZombies.forEach((z, idx) => {
    const card = document.createElement('div'); card.className = 'zombie-card';
    let recordHtml = z.bestTime ? `<div class="zc-record">👑 ${z.bestTime}s (${z.bestCity})</div>` : '';
    card.innerHTML = `
      <div class="zc-header"><span class="zc-name"><span class="zc-title">【${getTitle(z)}】</span>${z.name}</span><span class="zc-style">${z.style}</span></div>
      <div class="zc-stats"><span>速:${z.speed}</span><span>力:${z.power}</span><span>体:${z.stamina}</span><span>気:${z.mentality}</span><span>魔:${z.magic}</span></div>
      ${recordHtml}
      <div class="zc-actions">
        <button class="zc-btn btn-race" onclick="openCitySelect(${idx})">出走</button>
        <button class="zc-btn btn-shop" onclick="openShop(${idx})">強化</button>
        <button class="zc-btn btn-del" onclick="deleteZombie(${idx})">逃がす</button>
      </div>
    `;
    list.appendChild(card);
  });
  if (myZombies.length === 0) list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px 20px;">検体が居ません。<br>探索してください。</div>';
}

window.openCitySelect = (idx) => { activeZombieIndex = idx; document.getElementById('garage-screen').classList.add('hidden'); renderCitySelect(); document.getElementById('city-select-screen').classList.remove('hidden'); };
window.deleteZombie = (idx) => { if(confirm('本当に逃がしますか？')) { myZombies.splice(idx, 1); saveGame(); renderGarage(); } };

window.openShop = (idx) => {
  activeZombieIndex = idx; updateMoneyDisp();
  document.getElementById('shop-target-name').textContent = myZombies[idx].name;
  document.getElementById('garage-screen').classList.add('hidden'); document.getElementById('shop-screen').classList.remove('hidden');
};
document.querySelectorAll('.shop-btn').forEach(btn => {
  btn.onclick = () => {
    const price = parseInt(btn.dataset.price); const stat = btn.dataset.stat;
    if (zombieMoney < price) { alert('Z$が足りません！'); return; }
    if (confirm(`300Z$消費して強化しますか？`)) { zombieMoney -= price; myZombies[activeZombieIndex][stat] += 3; saveGame(); updateMoneyDisp(); alert('強化完了！'); }
  };
});
document.getElementById('close-shop-btn').onclick = () => { document.getElementById('shop-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };

function doScout() {
  const cityVal = document.getElementById('scout-city').value; const styleVal = document.getElementById('scout-style').value;
  let nameVal = document.getElementById('scout-name').value || '名無し';
  let spd = 40 + Math.floor(Math.random()*20), pow = 40 + Math.floor(Math.random()*20), stm = 40 + Math.floor(Math.random()*20), mnt = 40 + Math.floor(Math.random()*20), mag = 40 + Math.floor(Math.random()*20);
  if(cityVal==='osaka') mnt+=15; if(cityVal==='nagoya') pow+=15; if(cityVal==='fukuoka') spd+=15; if(cityVal==='sapporo') stm+=15;
  const vidIdx = Math.floor(Math.random() * VIDEO_SOURCES.length);
  const newZ = { name: nameVal, colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)], sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)], style: styleVal, speed: spd, power: pow, stamina: stm, mentality: mnt, magic: mag, remainingTurns: 5, matches: 0, wins: 0, videoIndex: vidIdx };
  myZombies.push(newZ); saveGame(); activeZombieIndex = myZombies.length - 1;
  const overlay = document.getElementById('found-overlay'); overlay.classList.remove('hidden');
  setTimeout(() => { overlay.classList.add('hidden'); document.getElementById('scout-screen').classList.add('hidden'); updateNurtureUI(); document.getElementById('nurture-screen').classList.remove('hidden'); }, 2000);
}

function updateNurtureUI() {
  const z = myZombies[activeZombieIndex]; if (!z) return;
  document.getElementById('nurture-turn-txt').textContent = `残 ${z.remainingTurns} 調整`; document.getElementById('nurture-zombie-name').textContent = z.name;
  document.getElementById('stat-style').textContent = z.style; document.getElementById('stat-spd').textContent = z.speed; document.getElementById('stat-pow').textContent = z.power; document.getElementById('stat-stm').textContent = z.stamina; document.getElementById('stat-mnt').textContent = z.mentality; document.getElementById('stat-mag').textContent = z.magic;
  const zCtx = document.getElementById('zombieCanvas').getContext('2d');
  zCtx.imageSmoothingEnabled = false;
  zCtx.clearRect(0, 0, 160, 160);
  drawZombieCharacter(zCtx, 80, 20, 80, 110, { ...z, knockback: 0 }, updateChromaKeyFrame(z.videoIndex, 80, 110), false);
  if (z.remainingTurns <= 0) { document.querySelector('.command-container').classList.add('hidden'); document.getElementById('send-to-garage-btn').classList.remove('hidden'); } else { document.querySelector('.command-container').classList.remove('hidden'); document.getElementById('send-to-garage-btn').classList.add('hidden'); }
}

function executeCommand(type) {
  if (isNurturing) return; isNurturing = true;
  document.getElementById('nurture-result-overlay').classList.remove('hidden'); document.getElementById('drumroll-text').classList.remove('hidden'); document.getElementById('result-label').classList.add('hidden'); document.getElementById('result-status-changes').classList.add('hidden');
  let tick = 0; const drumInterval = setInterval(() => {
    tick++; document.getElementById('drumroll-text').textContent = `調整中 ${Math.floor(Math.random() * 89 + 10)} ...`;
    if (tick > 12) { clearInterval(drumInterval); showNurtureResult(type); }
  }, 100);
}

function showNurtureResult(type) {
  const rand = Math.random(); let rType = rand < 0.2 ? 2 : (rand > 0.85 ? 0 : 1);
  let ms='', ss='', mName='', sName='';
  if (type === 'spd') { ms='speed'; ss='mentality'; mName='速さ'; sName='気性'; } else if (type === 'pow') { ms='power'; ss='magic'; mName='力強さ'; sName='異能'; } else if (type === 'stm') { ms='stamina'; ss='speed'; mName='体力'; sName='速さ'; }
  let inc = rType===2?20:(rType===1?10:3); let dec = rType===2?-5:(rType===1?-3:-1);
  document.getElementById('drumroll-text').classList.add('hidden'); document.getElementById('result-label').classList.remove('hidden'); document.getElementById('result-status-changes').classList.remove('hidden');
  const rl = document.getElementById('result-label');
  if(rType===2){ rl.textContent='大成功!!'; rl.className='result-label lbl-great'; } else if(rType===1){ rl.textContent='成功'; rl.className='result-label lbl-good'; } else { rl.textContent='失敗...'; rl.className='result-label lbl-bad'; }
  document.getElementById('result-status-changes').innerHTML = `<div>${mName} <span class="change-up">+${inc}</span></div><div>${sName} <span class="change-down">${dec}</span></div>`;
  setTimeout(() => { myZombies[activeZombieIndex][ms]+=inc; myZombies[activeZombieIndex][ss]+=dec; myZombies[activeZombieIndex].remainingTurns--; saveGame(); document.getElementById('nurture-result-overlay').classList.add('hidden'); isNurturing = false; updateNurtureUI(); }, 1500);
}

document.getElementById('send-to-garage-btn').onclick = () => {
  document.getElementById('nurture-screen').classList.add('hidden');
  if (myZombies.length > 3) {
    const list = document.getElementById('release-list'); list.innerHTML = '';
    myZombies.forEach((z, idx) => {
      const card = document.createElement('div'); card.className = 'zombie-card';
      card.innerHTML = `<div class="zc-header"><span class="zc-name">${z.name}</span></div><div class="zc-stats"><span>速:${z.speed}</span><span>力:${z.power}</span><span>体:${z.stamina}</span><span>気:${z.mentality}</span><span>魔:${z.magic}</span></div><button class="zc-btn btn-del" style="margin-top:8px;" onclick="doRelease(${idx})">逃がす</button>`;
      list.appendChild(card);
    });
    document.getElementById('release-screen').classList.remove('hidden');
  } else { renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); }
};
window.doRelease = (idx) => { myZombies.splice(idx, 1); saveGame(); document.getElementById('release-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };

function renderCitySelect() {
  const container = document.getElementById('city-list'); container.innerHTML = '';
  CITIES.forEach(city => {
    const btn = document.createElement('div'); btn.className = 'city-btn';
    const champ = weeklyChamps[city.id];
    let champHtml = champ ? `<div class="city-champ">👑 週次王者: ${champ.name} (${champ.time}s)</div>` : `<div class="city-champ">👑 週次王者: 記録なし</div>`;
    btn.innerHTML = `<span class="city-name" style="color:${city.color}">${city.name} (${city.distance}m)</span><span class="city-desc">${city.desc}</span>${champHtml}`;
    btn.onclick = () => { currentCity = city; document.getElementById('city-select-screen').classList.add('hidden'); showPaddock(); };
    container.appendChild(btn);
  });
}

function showPaddock() {
  const z = myZombies[activeZombieIndex || 0]; if(!z) return;
  const grid = document.getElementById('paddock-grid'); grid.innerHTML = '';
  
  runners.length = 0; const laneW = canvas.width / 4;
  
  runners.push({ id: 0, name: z.name, title: getTitle(z), isPlayer: true, x: laneW*0 + laneW/2, y: 400, dist: 0, stm: z.stamina * 10, maxStm: z.stamina * 10, spdAttr: z.speed, powAttr: z.power, mntAttr: z.mentality, magAttr: z.magic, colorInfo: z.colorInfo, sizeInfo: z.sizeInfo, style: z.style, boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, isSlacking: false, videoIndex: z.videoIndex, skillCd: Math.floor(Math.random() * 150) + 150 });
  
  for (let i = 1; i < 4; i++) {
    let mntBase = z.mentality; let powBase = z.power; if (currentCity.id === 'osaka') mntBase -= 30; if (currentCity.id === 'nagoya') powBase += 30;
    
    let name = CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)];
    if (isPvpMode && pvpMembers[i]) name = pvpMembers[i].name;

    const vidIdx = Math.floor(Math.random() * VIDEO_SOURCES.length);
    const cpuStm = (z.stamina + (Math.floor(Math.random() * 30) - 15)) * 10;
    const cpuZ = { id: i, name: name, title: '対戦者', isPlayer: false, x: laneW*i + laneW/2, y: 400, dist: 0, stm: cpuStm, maxStm: cpuStm, spdAttr: z.speed + (Math.floor(Math.random() * 30) - 15), powAttr: powBase + (Math.floor(Math.random() * 30) - 15), mntAttr: mntBase + (Math.floor(Math.random() * 30) - 15), magAttr: z.magic + (Math.floor(Math.random() * 30) - 15), colorInfo: ZOMBIE_COLORS[Math.floor(Math.random() * ZOMBIE_COLORS.length)], sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)], style: RUNNING_STYLES[Math.floor(Math.random() * RUNNING_STYLES.length)], boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, isSlacking: false, videoIndex: vidIdx, skillCd: Math.floor(Math.random() * 200) + 150 };
    runners.push(cpuZ);
  }

  runners.forEach((r, i) => {
    const card = document.createElement('div'); card.className = `pd-card c-${i}`; card.style.animationDelay = `${i * 0.2}s`;
    card.innerHTML = `<div class="pd-name"><span class="pd-title">【${r.title}】</span>${r.name}</div><div class="pd-stats">脚質: ${r.style} / 評価値: ${r.spdAttr + r.powAttr + Math.floor(r.stm/10) + r.mntAttr + r.magAttr}</div>`;
    grid.appendChild(card);
  });
  
  const btnWrapper = document.createElement('div'); btnWrapper.style.marginTop = '24px'; btnWrapper.style.animation = 'fadeIn 0.5s 1.2s forwards'; btnWrapper.style.opacity = '0'; 
  btnWrapper.innerHTML = `<button class="retro-btn" id="start-cutin-btn"><span>レースへ向かう</span></button>`;
  grid.appendChild(btnWrapper);
  
  document.getElementById('paddock-screen').classList.remove('hidden');
  document.getElementById('start-cutin-btn').onclick = () => { document.getElementById('paddock-screen').classList.add('hidden'); startRaceCutin(); };
}

function startRaceCutin() {
  const cutin = document.getElementById('cutin-screen');
  cutin.querySelector('.cutin-bg').style.background = currentCity.color;
  document.getElementById('cutin-en').textContent = currentCity.id.toUpperCase(); document.getElementById('cutin-ja').textContent = currentCity.name;
  cutin.classList.remove('hidden');
  setTimeout(() => { cutin.classList.add('hidden'); document.getElementById('race-screen').classList.remove('hidden'); setupRaceState(); }, 1800);
}

function setupRaceState() {
  totalDistance = currentCity.distance; remainingDistance = totalDistance; globalTime = 0; raceState = 'COUNTDOWN'; startCountdown = 3.0;
  document.getElementById('countdown-overlay').classList.remove('hidden'); document.getElementById('finish-overlay').classList.add('hidden'); document.getElementById('slime-overlay').classList.remove('active');
  particles.length = 0; effects.length = 0; syringeUsed = false;
  
  const shuffledAuto = [...ALL_SKILLS].sort(() => 0.5 - Math.random());
  currentAutoFlasks = shuffledAuto.slice(0, 2).map(s => ({ ...s, charge: 0, max: 100 }));
  
  // 🌟 UIへスキル名と「説明文」をセット
  document.getElementById('flask-name-0').textContent = currentAutoFlasks[0].name; 
  document.getElementById('flask-desc-0').textContent = currentAutoFlasks[0].desc;
  document.getElementById('flask-name-1').textContent = currentAutoFlasks[1].name; 
  document.getElementById('flask-desc-1').textContent = currentAutoFlasks[1].desc;
  
  currentSyringe = SYRINGE_SKILLS[Math.floor(Math.random() * SYRINGE_SKILLS.length)];
  document.getElementById('syringe-name').textContent = currentSyringe.name;
  document.getElementById('syringe-desc').textContent = currentSyringe.desc;
  document.getElementById('syringe-btn').classList.remove('used');
  document.getElementById('p-name-disp').textContent = runners[0].name;
  
  isGameRunning = true; requestAnimationFrame(update);
}

function triggerSkill(skillData, userRunner) {
  if (raceState !== 'RACING') return; const isPlayer = userRunner.id === 0;
  const magBonus = userRunner.magAttr > 50 ? (userRunner.magAttr - 50) * 0.5 : 0; const effectivePower = 100 + magBonus;
  
  createExplosion(userRunner.x, userRunner.y + 20, isPlayer ? '#38bdf8' : '#ef4444', 25, 6, 4, 'fire');
  effects.push({ text: `【異能】${skillData.name}!!`, runner: userRunner, isBalloon: true, life: 70, bgColor: isPlayer ? '#0284c7' : '#b91c1c', textColor: '#ffffff' });

  if (isPvpMode && isPlayer) broadcast({ type: 'SYNC_SKILL', runnerId: 0, skill: skillData });

  if (skillData.id === 'meteor') { particles.push({ type: 'meteor_drop', x: canvas.width / 2, y: -100, targetY: 300, radius: 60, power: effectivePower, user: userRunner }); createExplosion(userRunner.x, userRunner.y, '#38bdf8', 15, 3, 3, 'spark'); } 
  else if (skillData.id === 'volcano') { shakeTime = 15; effects.push({ text: `溶岩噴出!`, runner: userRunner, color: '#f97316', life: 50 }); runners.forEach(r => { if (r.id !== userRunner.id) { applyKnockback(r, effectivePower); r.isHard = false; createExplosion(r.x, r.y+20, '#f97316', 30, 5, 4, 'fire'); } }); } 
  else if (skillData.id === 'tornado') { shakeTime = 10; effects.push({ text: `竜巻!`, runner: userRunner, color: '#a3e635', life: 50 }); createExplosion(canvas.width/2, 300, '#a3e635', 50, 8, 3, 'spark'); runners.forEach(r => { if (r.id !== userRunner.id) r.dist -= effectivePower * 0.3; }); } 
  else if (skillData.id === 'frog') { 
    particles.push({ type: 'giant_frog', y: canvas.height + 150, targetY: canvas.height / 2 + 50, scale: 0.2, life: 120 });
    shakeTime = 15;
    document.getElementById('slime-overlay').classList.add('active'); 
    setTimeout(() => { document.getElementById('slime-overlay').classList.remove('active'); }, 3500); 
  } 
  else if (skillData.id === 'psycho') { let target = runners.find(r=>r.id!==userRunner.id); runners.forEach(r => { if (r.id !== userRunner.id && Math.abs(r.dist - userRunner.dist) < Math.abs(target.dist - userRunner.dist)) target = r; }); createExplosion(target.x, target.y, '#38bdf8', 40, 6, 4, 'spark'); applyKnockback(target, effectivePower * 1.5); } 
  else if (skillData.id === 'poison') { const targets = runners.filter(r => r.id !== userRunner.id && r.dist > userRunner.dist && r.dist - userRunner.dist < 300); if (targets.length > 0) { targets.forEach(t => { particles.push({ type: 'poison_line', startX: userRunner.x, startY: userRunner.y, targetX: t.x, targetY: t.y, width: 20, life: 1.0 }); applyKnockback(t, effectivePower); }); } else { particles.push({ type: 'poison_laser', x: userRunner.x, y: userRunner.y, width: 40, life: 1.0 }); } } 
  else if (skillData.id === 'stone') { let target = runners.find(r=>r.id!==userRunner.id); runners.forEach(r => { if (r.id !== userRunner.id && Math.abs(r.dist - userRunner.dist) < Math.abs(target.dist - userRunner.dist)) target = r; }); particles.push({ type: 'stone_throw', startX: userRunner.x, startY: userRunner.y, targetX: target.x, targetY: target.y, progress: 0, targetRunner: target }); } 
  else if (skillData.id === 'hard') { userRunner.isHard = true; userRunner.knockback = effectivePower; createExplosion(userRunner.x, userRunner.y, '#cbd5e1', 20, 2, 3, 'spark'); setTimeout(() => { userRunner.isHard = false; }, effectivePower * 30); } 
  else if (skillData.id === 'barrier') { userRunner.barrierPower = effectivePower; createExplosion(userRunner.x, userRunner.y, '#a855f7', 30, 4, 3, 'spark'); setTimeout(() => { userRunner.barrierPower = 0; }, 3000); } 
  else if (skillData.id === 'heal') { userRunner.stm = Math.min(userRunner.maxStm, userRunner.stm + effectivePower * 2.0); createExplosion(userRunner.x, userRunner.y, '#4ade80', 40, 2, 3, 'fire'); } 
  else if (skillData.id === 'mach') { userRunner.boostTimer = effectivePower * 2.0; createExplosion(userRunner.x, userRunner.y, '#facc15', 50, 6, 4, 'spark'); } 
  else if (skillData.id === 'meat') { createExplosion(canvas.width/2, 200, '#dc2626', 60, 7, 5, 'blood'); runners.forEach(r => { if (r.id !== userRunner.id) r.knockback = Math.random() * effectivePower; }); } 
}

document.getElementById('syringe-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (raceState !== 'RACING' || syringeUsed || !currentSyringe) return;
  syringeUsed = true; document.getElementById('syringe-btn').classList.add('used');
  flashEffect.alpha = 0.8; flashEffect.color = '#ffffff'; triggerSkill(currentSyringe, runners[0]);
});

function doFinish() {
  raceState = 'FINISH_SLOW'; document.getElementById('slime-overlay').classList.remove('active'); document.getElementById('finish-overlay').classList.remove('hidden');
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  setTimeout(() => {
    raceState = 'FINISHED'; const sorted = [...runners].sort((a, b) => b.dist - a.dist); const playerRank = sorted.findIndex(r => r.id === 0) + 1;
    const z = myZombies[activeZombieIndex || 0]; if(z) z.matches++; let prize = 0;
    
    let isChampUpdated = false;
    if (playerRank === 1) { 
      if(z) z.wins++; prize = 500; 
      if (z && (!z.bestTime || parseFloat(elapsedSec) < parseFloat(z.bestTime))) { z.bestTime = elapsedSec; z.bestCity = currentCity.name; }
      
      const currentChamp = weeklyChamps[currentCity.id];
      if (!currentChamp || parseFloat(elapsedSec) < parseFloat(currentChamp.time)) {
        weeklyChamps[currentCity.id] = { name: z ? z.name : '名無し', time: elapsedSec };
        isChampUpdated = true;
      }
    } 
    else if (playerRank === 2) prize = 300; else if (playerRank === 3) prize = 100; else prize = 50;
    
    zombieMoney += prize; saveGame(); 
    document.getElementById('prize-money').textContent = `獲得賞金: ${prize} Z$`;
    const noticeEl = document.getElementById('champ-notice');
    if (isChampUpdated) noticeEl.classList.remove('hidden'); else noticeEl.classList.add('hidden');

    renderPodium(sorted, elapsedSec); document.getElementById('result-screen').classList.remove('hidden');
  }, 2500);
}

function renderPodium(sortedRunners, winningTime) {
  pCtx.clearRect(0, 0, podiumCanvas.width, podiumCanvas.height);
  pCtx.imageSmoothingEnabled = false;
  pCtx.fillStyle = '#facc15'; pCtx.fillRect(140, 100, 80, 140); pCtx.fillStyle = '#94a3b8'; pCtx.fillRect(60, 140, 80, 100); pCtx.fillStyle = '#b45309'; pCtx.fillRect(220, 160, 80, 80);
  pCtx.fillStyle = '#0f131a'; pCtx.font = 'bold 36px sans-serif'; pCtx.textAlign = 'center'; pCtx.fillText('1', 180, 150); pCtx.fillText('2', 100, 180); pCtx.fillText('3', 260, 200);
  
  const pc0 = updateChromaKeyFrame(0, 64, 80); const pc1 = updateChromaKeyFrame(1, 64, 80); const pc2 = updateChromaKeyFrame(2, 64, 80); const pcs = [pc0, pc1, pc2];

  drawZombieCharacter(pCtx, 140+40, 100-80, 64, 80, sortedRunners[0], pcs[sortedRunners[0].videoIndex]||pcs[0], false, false);
  if(sortedRunners[1]) drawZombieCharacter(pCtx, 60+40, 140-80, 64, 80, sortedRunners[1], pcs[sortedRunners[1].videoIndex]||pcs[0], false, false);
  if(sortedRunners[2]) drawZombieCharacter(pCtx, 220+40, 160-80, 64, 80, sortedRunners[2], pcs[sortedRunners[2].videoIndex]||pcs[0], false, false);

  const listContainer = document.getElementById('result-list'); listContainer.innerHTML = '';
  sortedRunners.forEach((r, idx) => {
    const row = document.createElement('div'); row.className = `result-row rank-${idx+1}`;
    const timeStr = idx === 0 ? `${winningTime}s` : `+${(Math.random()*3 + 1).toFixed(2)}s`;
    row.innerHTML = `<span class="res-rank">${idx+1}</span><span class="res-name">${r.name}</span><span class="res-time">${timeStr}</span>`;
    listContainer.appendChild(row);
  });
}

function update() {
  if (!isGameRunning) { requestAnimationFrame(update); return; }
  
  ctx.imageSmoothingEnabled = false;
  
  globalTime++; const cdEl = document.getElementById('countdown-overlay');

  if (raceState === 'COUNTDOWN') {
    startCountdown -= 1 / 60;
    if (startCountdown > 0) { cdEl.textContent = Math.ceil(startCountdown); } 
    else { cdEl.textContent = "START!"; setTimeout(() => { if (raceState === 'RACING') cdEl.classList.add('hidden'); }, 1000); raceState = 'RACING'; startTime = Date.now(); }
  }

  let dt = raceState === 'FINISH_SLOW' ? 0.2 : 1.0; 

  if (raceState === 'RACING' || raceState === 'FINISH_SLOW') {
    const player = runners[0]; const magBonusSpeed = player.magAttr > 50 ? (player.magAttr - 50) * 0.001 : 0;
    currentAutoFlasks.forEach((flask, index) => {
      if (flask.charge < flask.max) flask.charge = Math.min(flask.max, flask.charge + (flask.speed + magBonusSpeed) * dt);
      if (flask.charge >= flask.max && raceState === 'RACING') { triggerSkill(flask, player); flask.charge = 0; }
      const fillEl = document.getElementById(`flask-fill-${index}`); if (fillEl) fillEl.style.height = `${flask.charge}%`;
    });

    runners.forEach((r, i) => {
      if (i !== 0 && remainingDistance < 380) {
        r.skillCd -= dt; 
        if (r.skillCd <= 0) { 
          const cpuSkill = ALL_SKILLS[Math.floor(Math.random()*ALL_SKILLS.length)];
          triggerSkill(cpuSkill, r); 
          r.skillCd = Math.floor(Math.random() * 250) + 200; 
        }
      }
    });

    for (let i = 0; i < 4; i++) {
      const r = runners[i]; 
      if (!r.isSlacking && Math.random() < 0.003 && r.mntAttr < 70) { if (Math.random() < (70 - r.mntAttr) * 0.01) { r.isSlacking = true; r.knockback = 60; setTimeout(() => { r.isSlacking = false; }, 1000); } }
      let baseSpeed = 0.08 + (r.spdAttr - 50) * 0.001; const progress = r.dist / totalDistance; 
      
      let stmDrain = currentCity.bgType === 'snow' ? 0.045 : 0.028; 
      if (r.style === '逃げ') { if (progress < 0.4) { baseSpeed *= 1.5; stmDrain *= 1.8; } else if (progress > 0.7) { baseSpeed *= 0.8; } } 
      else if (r.style === '先行') { if (progress > 0.2 && progress < 0.6) { baseSpeed *= 1.2; stmDrain *= 1.2; } } 
      else if (r.style === '差し') { if (progress > 0.5 && progress < 0.8) { baseSpeed *= 1.3; stmDrain *= 1.1; } } 
      else if (r.style === '追込') { if (progress > 0.7) { baseSpeed *= 1.6; stmDrain *= 0.8; } }
      
      if (r.stm > 0) r.stm -= stmDrain * dt; else baseSpeed *= 0.65;
      
      if (r.boostTimer > 0) { r.boostTimer -= dt; baseSpeed *= 2.5; if (globalTime % 5 === 0) createExplosion(r.x, r.y, '#facc15', 2, 2, 2, 'spark'); }
      if (r.knockback > 0) { r.knockback -= dt; baseSpeed *= 0; }
      r.dist += Math.max(0, baseSpeed) * dt;
    }

    for (let i = 0; i < 4; i++) { for (let j = i + 1; j < 4; j++) { const r1 = runners[i]; const r2 = runners[j]; if (Math.abs(r1.dist - r2.dist) < 8) { if (r1.powAttr > r2.powAttr) { r1.dist += 0.05*dt; r2.dist -= 0.05*dt; } else if (r2.powAttr > r1.powAttr) { r2.dist += 0.05*dt; r1.dist -= 0.05*dt; } } } }
    const leadingDist = Math.max(...runners.map(r => r.dist)); remainingDistance = Math.max(0, totalDistance - leadingDist);
    if (raceState === 'RACING') {
      if (remainingDistance <= 50 && remainingDistance > 0 && startCountdown <= 0) { const countVal = Math.min(5, Math.max(1, Math.ceil(remainingDistance / 10))); cdEl.textContent = countVal; cdEl.classList.remove('hidden'); }
      if (remainingDistance <= 0) { doFinish(); }
    }
    
    document.getElementById('hud-dist').textContent = `${Math.floor(remainingDistance)}m`;
    const sortedRunners = [...runners].sort((a, b) => b.dist - a.dist);
    document.getElementById('hud-rank').textContent = `${sortedRunners.findIndex(r => r.id === 0) + 1}位`;
    for (let i = 0; i < 4; i++) { document.getElementById(`runner-marker-${i}`).style.left = `${Math.min(1, Math.max(0, runners[i].dist / totalDistance)) * 100}%`; }
    const pStmBar = document.getElementById('p-stm-bar'); const pStmRatio = player.stm / player.maxStm;
    pStmBar.style.width = `${pStmRatio * 100}%`; if (pStmRatio < 0.2) pStmBar.classList.add('danger'); else pStmBar.classList.remove('danger');
  }

  const avgDist = runners.reduce((acc, r) => acc + r.dist, 0) / 4;
  for (let i = 0; i < 4; i++) {
    const r = runners[i]; const diffFromAvg = r.dist - avgDist; r.y = (canvas.height/2) - diffFromAvg * 6.0;
  }

  ctx.save();
  if (shakeTime > 0) { ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10); shakeTime -= dt; }
  if (raceState === 'RACING' || raceState === 'FINISH_SLOW') scrollY = (scrollY + 0.15 * dt) % 100;
  drawJapaneseStreetBackground();

  const processedCanvases = [
    updateChromaKeyFrame(0, 72, 90) || updateChromaKeyFrame(0, 72, 90),
    updateChromaKeyFrame(1, 72, 90) || updateChromaKeyFrame(1, 72, 90),
    updateChromaKeyFrame(2, 72, 90) || updateChromaKeyFrame(2, 72, 90)
  ];

  const drawOrder = [...runners].sort((a, b) => a.y - b.y);
  drawOrder.forEach(r => {
    drawZombieCharacter(ctx, r.x, r.y, 72, 90, r, processedCanvases[r.videoIndex] || processedCanvases[0], r.stm <= 0, true);
    if (r.barrierPower > 0) { ctx.strokeStyle = `rgba(168, 85, 247, ${r.barrierPower / 100})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y + 20, 36 * r.sizeInfo.scaleX, 0, Math.PI * 2); ctx.stroke(); }
  });

  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor_drop') {
      p.y += 12 * dt; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (p.y >= p.targetY) { shakeTime = 20; createExplosion(p.x, p.y, '#f97316', 100, 10, 8, 'spark'); runners.forEach(r => { if(r.id !== p.user.id) applyKnockback(r, p.power); }); particles.splice(i, 1); }
    } else if (p.type === 'giant_frog') {
      p.y += (p.targetY - p.y) * 0.1 * dt;
      if (p.scale < 3.0) p.scale += 0.08 * dt;
      p.life -= dt;
      ctx.save();
      ctx.translate(canvas.width / 2, p.y);
      ctx.scale(p.scale, p.scale);
      ctx.font = '60px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐸', 0, 0);
      ctx.restore();
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'poison_laser') { ctx.fillStyle = '#84cc16'; ctx.fillRect(p.x - p.width/2, 0, p.width, p.y); p.life -= 0.05 * dt; if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'poison_line') { ctx.strokeStyle = '#84cc16'; ctx.lineWidth = p.width; ctx.globalAlpha = p.life; ctx.beginPath(); ctx.moveTo(p.startX, p.startY); ctx.lineTo(p.targetX, p.targetY); ctx.stroke(); ctx.globalAlpha = 1.0; p.life -= 0.05 * dt; if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'stone_throw') {
      p.progress += 0.03 * dt; const currentX = p.startX + (p.targetX - p.startX) * p.progress; const currentY = p.startY + (p.targetY - p.startY) * p.progress - Math.sin(p.progress * Math.PI) * 50; 
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(currentX, currentY, 6, 0, Math.PI * 2); ctx.fill();
      if (p.progress >= 1) { applyKnockback(p.targetRunner, 40); createExplosion(currentX, currentY, '#f8fafc', 5, 2, 2, 'spark'); particles.splice(i, 1); }
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      if (p.life <= 0) { particles.splice(i, 1); } else { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath(); if (p.type === 'frog') ctx.fillRect(p.x, p.y, p.size, p.size); else ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1.0;

  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i]; 
    eff.life -= dt;
    if (eff.runner && eff.isBalloon) {
      drawSpeechBalloon(ctx, eff.text, eff.runner.x, eff.runner.y - 70, eff.bgColor || '#facc15', eff.textColor || '#000');
    } else if (!eff.runner) {
      ctx.fillStyle = eff.color || '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(eff.text, eff.x, eff.y);
      if (raceState === 'RACING' || raceState === 'FINISH_SLOW') eff.y -= 0.8 * dt;
    }
    if (eff.life <= 0) effects.splice(i, 1);
  }
  if (flashEffect.alpha > 0) { ctx.fillStyle = flashEffect.color; ctx.globalAlpha = flashEffect.alpha; ctx.fillRect(0, 0, canvas.width, canvas.height); flashEffect.alpha -= 0.05 * dt; ctx.globalAlpha = 1.0; }

  ctx.restore(); requestAnimationFrame(update);
}

function init() {
  updateMoneyDisp();
  initPeerJS();
  
  document.getElementById('nav-scout-btn').onclick = () => { document.getElementById('title-screen').classList.add('hidden'); document.getElementById('scout-screen').classList.remove('hidden'); };
  document.getElementById('nav-garage-btn').onclick = () => { document.getElementById('title-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };
  document.getElementById('nav-pvp-btn').onclick = () => { 
    updatePvpSelectUI(); 
    document.getElementById('title-screen').classList.add('hidden'); 
    document.getElementById('pvp-screen').classList.remove('hidden'); 
  };
  
  document.getElementById('do-scout-btn').onclick = doScout;
  document.getElementById('back-to-title-1').onclick = () => { document.getElementById('scout-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); };
  document.getElementById('back-to-title-2').onclick = () => { document.getElementById('garage-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); };
  document.getElementById('back-to-title-pvp').onclick = () => { document.getElementById('pvp-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); };
  document.getElementById('back-to-garage-1').onclick = () => { document.getElementById('city-select-screen').classList.add('hidden'); document.getElementById('garage-screen').classList.remove('hidden'); };
  document.getElementById('retry-btn').onclick = () => { isGameRunning = false; isPvpMode = false; document.getElementById('result-screen').classList.add('hidden'); document.getElementById('race-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };
  
  document.querySelectorAll('.cmd-btn').forEach(btn => { btn.onclick = () => { executeCommand(btn.dataset.cmd); }; });
  requestAnimationFrame(update);
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }