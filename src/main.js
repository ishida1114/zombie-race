const canvas = document.getElementById('gameCanvas'); const ctx = canvas.getContext('2d');
const podiumCanvas = document.getElementById('podiumCanvas'); const pCtx = podiumCanvas.getContext('2d');

let isGameRunning = false; let raceState = 'INIT'; let startCountdown = 3.0;
let shakeTime = 0; let scrollY = 0; let globalTime = 0;
let remainingDistance = 400; let totalDistance = 400; let startTime = 0;
let flashEffect = { alpha: 0, color: '#ffffff' };

// 📖 モード管理 ('story' | 'free')
let currentGameMode = 'story';
let podiumAnimationId = null;
let currentSortedRunners = [];
let currentWinningTime = "0.00";

// 🎤 リアルタイム実況テロップ変数
let liveCommentary = "レース開始直前！各検体、枠順につきました。";
let lastTopRunnerId = null;

// 🎊 サイケカラー紙吹雪パーティクル
let confettiParticles = [];

// 🌐 オンラインランキング共有用 (JSONBlob API エンドポイント)
const ONLINE_RANKING_URL = 'https://jsonblob.com/api/jsonBlob/1356882299833835520';

// 🖼️ 新規素材のロード
const successCutinImg = new Image();
successCutinImg.src = '/success_cutin.png';

const eyeVideo = document.createElement('video');
eyeVideo.src = '/zombie_eye.mp4';
eyeVideo.loop = true; eyeVideo.muted = true; eyeVideo.playsInline = true;

// 🛣️ 都市別地面画像の動的ロード管理
const ROAD_IMAGES = {
  tokyo:   { src: '/roadtokyo.webp',   img: new Image(), loaded: false },
  osaka:   { src: '/roadoosaka.webp',  img: new Image(), loaded: false },
  nagoya:  { src: '/roadnagoya.webp',  img: new Image(), loaded: false },
  sapporo: { src: '/roadsapporo.webp', img: new Image(), loaded: false },
  fukuoka: { src: '/roadfukuoka.webp', img: new Image(), loaded: false }
};

Object.keys(ROAD_IMAGES).forEach(cityId => {
  const item = ROAD_IMAGES[cityId];
  item.img.src = item.src;
  item.img.onload = () => { item.loaded = true; };
});

// ==========================================
// 🌐 オンラインデータ同期機能
// ==========================================
async function fetchOnlineChamps() {
  try {
    const res = await fetch(ONLINE_RANKING_URL);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        weeklyChamps = data;
        localStorage.setItem('weeklyChamps', JSON.stringify(weeklyChamps));
      }
    }
  } catch (err) {
    console.warn('[OnlineSync] サーバーからのランキング取得に失敗 (オフライン動作):', err);
  }
}

async function updateOnlineChamps(newChamps) {
  try {
    await fetch(ONLINE_RANKING_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newChamps)
    });
  } catch (err) {
    console.warn('[OnlineSync] サーバーへのランキング送信に失敗 (オフライン動作):', err);
  }
}

// ==========================================
// 🎵 音響管理システム (画面中央上部に配置 ＆ 重なり防止)
// ==========================================
const AudioManager = {
  basePathBGM: 'audio/bgm/',
  basePathSE: 'audio/se/',

  bgmList: {
    opening: 'opening.m4a',
    tokyo: 'tokyo.m4a',
    osaka: 'oosaka.m4a',
    nagoya: 'nagoya.mp4',
    fukuoka: 'fukuoka.mp4',
    sapporo: 'sapporo.m4a',
    ending: 'ending.mp4'
  },
  seList: {
    button: 'button.mp3',
    drumroll: 'drumroll.mp3',
    success: 'success.mp3',
    countdown: 'countdown.mp3',
    damage: 'damage.mp3',
    goalin: 'goalin.mp3'
  },

  currentBGM: null,
  currentBGMKey: null,
  audioUnlocked: false,
  isMuted: false,

  init() {
    this.createMuteButtonUI();

    const unlock = () => {
      if (this.audioUnlocked) return;
      this.audioUnlocked = true;
      const dummy = new Audio();
      dummy.play().catch(() => {});
      if (!this.currentBGM && !this.isMuted) this.playBGM('opening');
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('pointerdown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('pointerdown', unlock);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .btn, .retro-btn, .retro-btn-small, .city-btn, .zc-btn, .cmd-btn, .shop-btn, [role="button"]');
      if (btn && btn.id !== 'sound-toggle-btn') this.playSE('button');
    });
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.currentBGM) this.currentBGM.pause();
    } else {
      if (this.currentBGM) {
        this.currentBGM.play().catch(err => console.warn("BGM再生失敗:", err));
      } else if (this.currentBGMKey) {
        const key = this.currentBGMKey;
        this.currentBGMKey = null;
        this.playBGM(key);
      } else {
        this.playBGM('opening');
      }
    }
    this.updateMuteButtonUI();
    return this.isMuted;
  },

  createMuteButtonUI() {
    if (document.getElementById('sound-toggle-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'sound-toggle-btn';
    btn.className = 'sound-toggle-btn';
    btn.style.cssText = `
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      padding: 6px 16px;
      font-size: 13px;
      font-weight: bold;
      background: rgba(15, 23, 42, 0.9);
      color: #38bdf8;
      border: 1px solid #38bdf8;
      border-radius: 20px;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.6);
      transition: all 0.2s;
    `;
    btn.onclick = (e) => {
      e.stopPropagation();
      this.toggleMute();
    };
    document.body.appendChild(btn);
    this.updateMuteButtonUI();
  },

  updateMuteButtonUI() {
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.textContent = this.isMuted ? '🔇 音: OFF' : '🔊 音: ON';
      btn.style.color = this.isMuted ? '#94a3b8' : '#38bdf8';
      btn.style.borderColor = this.isMuted ? '#64748b' : '#38bdf8';
    }
  },

  playBGM(key) {
    if (!this.bgmList[key]) return;
    if (this.currentBGMKey === key && this.currentBGM && !this.currentBGM.paused) return;
    
    this.stopBGM();
    this.currentBGMKey = key;

    if (this.isMuted) return;

    const path = this.basePathBGM + this.bgmList[key];
    const audio = new Audio(path);
    audio.loop = true;
    audio.volume = 0.5;
    
    this.currentBGM = audio;

    audio.play().catch(err => {
      console.warn(`[AudioManager] BGM再生失敗 (${path}):`, err);
    });
  },

  stopBGM() {
    if (this.currentBGM) {
      this.currentBGM.pause();
      this.currentBGM.currentTime = 0;
      this.currentBGM = null;
    }
  },

  playSE(key) {
    if (this.isMuted || !this.seList[key]) return null;
    const path = this.basePathSE + this.seList[key];
    const se = new Audio(path);
    se.volume = 0.7;
    se.play().catch(err => {
      console.warn(`[AudioManager] SE再生失敗 (${path}):`, err);
    });
    return se;
  }
};

// 📦 データ管理
let myZombies = JSON.parse(localStorage.getItem('myZombies')) || [];
let zombieMoney = parseInt(localStorage.getItem('zombieMoney')) || 0;
let weeklyChamps = JSON.parse(localStorage.getItem('weeklyChamps')) || {};
let clearedCities = JSON.parse(localStorage.getItem('clearedCities')) || ['fukuoka'];
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
  localStorage.setItem('clearedCities', JSON.stringify(clearedCities));
}

function getTitle(z) {
  if (z.wins >= 50) return ['生ける伝説', '世紀末覇者', '神速のバケモノ'][Math.floor(Math.random()*3)];
  if (z.wins >= 10) return ['常勝の', '不沈艦', '音速の'][Math.floor(Math.random()*3)];
  if (z.matches >= 10) return ['歴戦の', '傷だらけの', '噛みつき魔'][Math.floor(Math.random()*3)];
  return ['駆け出しの', 'ヨチヨチの', '迷い込んだ'][Math.floor(Math.random()*3)];
}

const CITIES = [
  { id: 'fukuoka', name: '福岡', distance: 300, color: '#0284c7', bgType: 'normal', desc: '【初級】最速配達員の成れの果てが待つ街。', nextCity: 'osaka', freeBasePrize: 300 },
  { id: 'osaka', name: '大阪', distance: 400, color: '#ca8a04', bgType: 'normal', desc: '【中級】サボり魔を生んだ元大口スポンサー。', nextCity: 'nagoya', freeBasePrize: 400 },
  { id: 'nagoya', name: '名古屋', distance: 400, color: '#16a34a', bgType: 'normal', desc: '【中級】フルアーマーの元警備隊長。', nextCity: 'sapporo', freeBasePrize: 500 },
  { id: 'sapporo', name: '札幌', distance: 500, color: '#93c5fd', bgType: 'snow', desc: '【上級】凍結施設から逃げた元所長。', nextCity: 'tokyo', freeBasePrize: 700 },
  { id: 'tokyo', name: '東京', distance: 400, color: '#e11d48', bgType: 'normal', desc: '【ラスボス】闇市ドーピングのマッドサイエンティスト。', nextCity: null, freeBasePrize: 1000 }
];
let currentCity = CITIES[0];

const STORY_BOSSES = {
  fukuoka: { name: '爆走デリバリー', title: '元最速配達員', quote: '「冷める前に届けるのが俺のプライドだァ！」' },
  osaka:   { name: 'ナニワの金主', title: '元大口スポンサー', quote: '「金さえ払えばサボってもええんやで！」' },
  nagoya:  { name: 'フルアーマー鉄壁', title: '元警備隊長', quote: '「この装甲を打ち破れると思うなよ…！」' },
  sapporo: { name: '凍血のDr.ゼロ', title: '元冷凍研究所長', quote: '「凍てつく極寒の中で朽ち果てるがいい…」' },
  tokyo:   { name: 'Dr.マッドゾンビ', title: '最悪の異能科学者', quote: '「フハハ！究極のワクチンで我らは【超ゾンビ】となる！」' }
};

const STORY_DIFFICULTY = {
  fukuoka: { min: -0.15, max: 0.05 },
  osaka:   { min: -0.15, max: 0.10 },
  nagoya:  { min: -0.10, max: 0.10 },
  sapporo: { min: -0.10, max: 0.15 },
  tokyo:   { min: 0.15,  max: 0.40 }
};

const FREE_CITY_MULTIPLIERS = {
  fukuoka: 0.88,
  osaka:   0.92,
  nagoya:  0.96,
  sapporo: 1.00,
  tokyo:   1.04
};

const ZOMBIE_COLORS = [{ name: '標準', filter: 'none' }];
const ZOMBIE_SIZES = [{ name: '標準', scaleX: 1.0, scaleY: 1.0 }, { name: '巨漢', scaleX: 1.25, scaleY: 1.3 }, { name: '肥満', scaleX: 1.3, scaleY: 0.95 }];
const RUNNING_STYLES = ['逃げ', '先行', '差し', '追込'];
const CPU_NAMES = ['田中', '鈴木', '山田', '店長', '部長', '課長', 'バイト', '新人', '先輩'];

const VIDEO_SOURCES = ['/zombie1.mp4', '/zombie2.mp4', '/zombie3.mp4', '/zombie4.mp4', '/zombie5.mp4'];
const zombieVideos = []; const offCanvases = []; const offCtxs = [];
const lastValidCanvases = [];

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
  
  if (!v || v.readyState < 2) {
    return lastValidCanvases[idx] || null;
  }
  if (v.paused) v.play().catch(() => {});
  
  if (c.width !== targetW) c.width = targetW; 
  if (c.height !== targetH) c.height = targetH;
  cx.imageSmoothingEnabled = false;
  cx.clearRect(0, 0, targetW, targetH);
  
  const vw = v.videoWidth || 100; const vh = v.videoHeight || 100;
  cx.drawImage(v, 0, 0, vw, vh, 0, 0, targetW, targetH);
  const data = cx.getImageData(0, 0, targetW, targetH);
  
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i], g = data.data[i+1], b = data.data[i+2];
    if (g > 90 && (g - r) > 40 && (g - b) > 40) {
      data.data[i+3] = 0; 
    }
  }
  
  cx.putImageData(data, 0, 0); 
  lastValidCanvases[idx] = c;
  return c;
}

const runners = []; const effects = []; let particles = [];

const ALL_SKILLS = [
  { id: 'meteor', name: 'メテオ', desc: '隕石爆発でライバル大打撃', type: 'auto', speed: 0.045 },
  { id: 'lightning', name: '雷', desc: '雷撃で自分以外の敵を数秒麻痺！', type: 'auto', speed: 0.050 },
  { id: 'frog', name: 'カエル', desc: '巨大カエルで視界ジャック', type: 'auto', speed: 0.070 },
  { id: 'poison', name: '毒液', desc: '前方の敵に毒ダメージ', type: 'auto', speed: 0.060 },
  { id: 'stone', name: '小石', desc: '最寄りの敵に石を投げつけ', type: 'auto', speed: 0.090 }
];
const SYRINGE_SKILLS = [
  { id: 'mach', name: 'マッハ', desc: '一定時間超絶ダッシュ！' },
  { id: 'heal', name: 'ヒール', desc: 'スタミナを大幅超回復！' },
  { id: 'barrier', name: 'バリア', desc: '一定時間完全無敵！' },
  { id: 'psycho', name: 'サイコ', desc: '最寄りの敵を狙い撃ち大爆発！' }
];

let currentAutoFlasks = []; let currentSyringe = null; let syringeUsed = false;
let peer = null; let peerConnections = []; let myPeerId = null; let isPvpMode = false; let pvpMembers = [];
let hasIntruder = false;

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
  else { 
    runner.knockback = Math.max(runner.knockback, finalKnockback); runner.stm = Math.max(0, runner.stm - (finalKnockback * 0.5)); 
    effects.push({ text: `ギャッ!`, runner: runner, isBalloon: true, life: 40, bgColor: '#ef4444', textColor: '#fff' }); 
    createExplosion(runner.x, runner.y, '#dc2626', 20, 4, 3, 'blood'); 
    AudioManager.playSE('damage');
    liveCommentary = `💥 ${runner.name}にダメージヒット！足止めされている！`;
  }
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
    
    let filterStr = 'none';
    if (zData.colorInfo && zData.colorInfo.filter !== 'none') {
      filterStr = zData.colorInfo.filter;
    } else if (isKnockback) {
      filterStr = 'brightness(180%) sepia(80%) hue-rotate(-30deg)'; 
    } else if (zData.isHard) {
      filterStr = 'grayscale(100%) brightness(0.8)'; 
    } else if (isExhausted) {
      filterStr = 'grayscale(80%) brightness(0.6)';
    }
    
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
    
    targetCtx.fillStyle = zData.id === 0 ? '#38bdf8' : (zData.colorInfo && zData.colorInfo.filter !== 'none' ? '#ef4444' : '#cbd5e1'); 
    targetCtx.fillText(dispName, 0, -5);
  }
  
  targetCtx.restore();
}

function drawJapaneseStreetBackground() {
  const roadData = ROAD_IMAGES[currentCity.id];
  if (roadData && roadData.loaded) {
    ctx.save();
    const imgH = roadData.img.height * (canvas.width / roadData.img.width);
    const sy = (scrollY * 12) % imgH;
    for (let y = -imgH + sy; y < canvas.height + imgH; y += imgH) {
      ctx.drawImage(roadData.img, 0, y, canvas.width, imgH);
    }
    ctx.restore();
    return;
  }

  const isSnow = currentCity.bgType === 'snow';
  ctx.fillStyle = isSnow ? '#e2e8f0' : '#1e232e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isSnow ? '#cbd5e1' : '#131720'; ctx.fillRect(0, 0, 20, canvas.height); ctx.fillRect(canvas.width - 20, 0, 20, canvas.height);
  ctx.fillStyle = isSnow ? '#94a3b8' : '#374151'; ctx.fillRect(20, 0, 2, canvas.height); ctx.fillRect(canvas.width - 22, 0, 2, canvas.height);
  ctx.strokeStyle = isSnow ? '#94a3b8' : '#2d3748'; ctx.lineWidth = 2; ctx.setLineDash([20, 30]);
  const laneW = canvas.width / 4;
  for (let i=1; i<4; i++) { ctx.beginPath(); ctx.moveTo(laneW*i, -100 + scrollY); ctx.lineTo(laneW*i, canvas.height + 100 + scrollY); ctx.stroke(); } ctx.setLineDash([]);
}

function drawLiveCommentary() {
  if (raceState !== 'RACING' && raceState !== 'COUNTDOWN' && raceState !== 'FINISH_SLOW') return;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(12, 10, canvas.width - 24, 34);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 10, canvas.width - 24, 34);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🎤 ${liveCommentary}`, canvas.width / 2, 27);
  ctx.restore();
}

function updateMoneyDisp() { 
  ['title-money', 'garage-money', 'shop-money'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = zombieMoney;
    }
  });
}

function renderGarage() {
  updateMoneyDisp();
  AudioManager.playBGM('opening');
  const list = document.getElementById('garage-list'); if (!list) return;
  list.innerHTML = ''; 
  const countEl = document.getElementById('garage-count'); if (countEl) countEl.textContent = myZombies.length;
  
  myZombies.forEach((z, idx) => {
    const card = document.createElement('div'); card.className = 'zombie-card';
    let recordHtml = z.bestTime ? `<div class="zc-record">👑 ${z.bestTime}s (${z.bestCity})</div>` : '';
    card.innerHTML = `
      <div class="zc-header"><span class="zc-name"><span class="zc-title">【${getTitle(z)}】</span>${z.name}</span><span class="zc-style">${z.style}</span></div>
      <div class="zc-stats"><span>速:${z.speed}</span><span>力:${z.power}</span><span>体:${z.stamina}</span><span>気性:${z.mentality}</span><span>異能:${z.magic}</span></div>
      ${recordHtml}
      <div class="zc-actions">
        <button class="zc-btn btn-race" onclick="openCitySelect(${idx}, 'story')">ストーリー</button>
        <button class="zc-btn btn-race" style="background:#ca8a04;" onclick="openCitySelect(${idx}, 'free')">フリーレース</button>
        <button class="zc-btn btn-shop" onclick="openShop(${idx})">強化</button>
        <button class="zc-btn btn-del" style="background:#64748b;" onclick="renameZombie(${idx})">名前変更</button>
        <button class="zc-btn btn-del" onclick="deleteZombie(${idx})">逃がす</button>
      </div>
    `;
    list.appendChild(card);
  });
  if (myZombies.length === 0) list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:40px 20px;">検体が居ません。<br>探索してください。</div>';
}

window.renameZombie = (idx) => {
  const currentName = myZombies[idx].name;
  const newName = prompt("新しい検体名を入力してください", currentName);
  if (newName && newName.trim() !== "") {
    myZombies[idx].name = newName.trim();
    saveGame();
    renderGarage();
  }
};

window.openCitySelect = (idx, mode = 'story') => { 
  activeZombieIndex = idx; 
  currentGameMode = mode;
  document.getElementById('garage-screen').classList.add('hidden'); 
  renderCitySelect(); 
  document.getElementById('city-select-screen').classList.remove('hidden'); 
};

window.deleteZombie = (idx) => { if(confirm('本当に逃がしますか？')) { myZombies.splice(idx, 1); saveGame(); renderGarage(); } };

window.openShop = (idx) => {
  activeZombieIndex = idx; updateMoneyDisp();
  const targetEl = document.getElementById('shop-target-name');
  if (targetEl) targetEl.textContent = myZombies[idx].name;
  document.getElementById('garage-screen').classList.add('hidden'); 
  document.getElementById('shop-screen').classList.remove('hidden');
};

document.querySelectorAll('.shop-btn').forEach(btn => {
  btn.onclick = () => {
    const price = parseInt(btn.dataset.price); const stat = btn.dataset.stat;
    if (zombieMoney < price) { alert('Z$が足りません！'); return; }
    
    if (confirm(`300Z$消費して【${btn.textContent.trim()}】を強化しますか？`)) {
      zombieMoney -= price;
      
      const drum = AudioManager.playSE('drumroll');
      setTimeout(() => {
        if(drum) drum.pause();
        AudioManager.playSE('success');
        
        const isCritical = Math.random() < 0.1;
        const inc = isCritical ? 5 : Math.floor(Math.random() * 3) + 2;
        
        myZombies[activeZombieIndex][stat] += inc;
        saveGame(); updateMoneyDisp();
        
        if (isCritical) {
          alert(`🔥【超成功！！】 ステータスが +${inc} 爆発上昇した！`);
        } else {
          alert(`💉 強化完了！ ステータスが +${inc} 上昇！`);
        }
      }, 1000);
    }
  };
});

document.getElementById('close-shop-btn').onclick = () => { document.getElementById('shop-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };

function startEyeTapMiniGame(onComplete) {
  let overlay = document.getElementById('eye-minigame-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'eye-minigame-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.92); z-index: 15000;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    `;
    document.body.appendChild(overlay);
  }

  let hitCount = 0;
  const targetHits = 3;
  
  overlay.innerHTML = `
    <div style="position: absolute; top: 30px; font-size: 20px; font-weight: bold; color: #38bdf8; text-shadow: 0 0 10px #38bdf8; text-align: center;">
      🔍 潜伏中の検体を捕捉せよ！<br>
      <span style="font-size: 14px; color: #facc15;">暗闇で光る「ゾンビの目」をタップ！ (${hitCount}/${targetHits})</span>
    </div>
  `;

  overlay.style.display = 'flex';
  
  const videoElem = document.createElement('video');
  videoElem.src = '/zombie_eye.mp4';
  videoElem.loop = true; videoElem.muted = true; videoElem.playsInline = true;
  videoElem.style.cssText = `
    position: absolute; width: 120px; height: 120px; border-radius: 50%;
    cursor: pointer; border: 3px solid #ef4444; box-shadow: 0 0 20px #ef4444;
    transition: transform 0.1s; object-fit: cover;
  `;

  function moveVideo() {
    const maxX = window.innerWidth - 140;
    const maxY = window.innerHeight - 140;
    const rx = Math.max(20, Math.floor(Math.random() * maxX));
    const ry = Math.max(80, Math.floor(Math.random() * maxY));
    videoElem.style.left = `${rx}px`;
    videoElem.style.top = `${ry}px`;
    videoElem.play().catch(() => {});
  }

  moveVideo();
  overlay.appendChild(videoElem);

  videoElem.onclick = (e) => {
    e.stopPropagation();
    AudioManager.playSE('button');
    hitCount++;
    createExplosion(e.clientX, e.clientY, '#38bdf8', 20, 5, 4, 'spark');
    
    const statusTxt = overlay.querySelector('span');
    if (statusTxt) statusTxt.textContent = `暗闇で光る「ゾンビの目」をタップ！ (${hitCount}/${targetHits})`;

    if (hitCount >= targetHits) {
      overlay.style.display = 'none';
      if (videoElem.parentNode) videoElem.parentNode.removeChild(videoElem);
      onComplete(true);
    } else {
      moveVideo();
    }
  };
}

function doScout() {
  const cityVal = document.getElementById('scout-city').value; 
  const styleVal = document.getElementById('scout-style').value;
  let nameVal = document.getElementById('scout-name').value || '名無し';

  startEyeTapMiniGame((isBonus) => {
    let spd = 40 + Math.floor(Math.random()*20), pow = 40 + Math.floor(Math.random()*20), stm = 40 + Math.floor(Math.random()*20), mnt = 40 + Math.floor(Math.random()*20), mag = 40 + Math.floor(Math.random()*20);
    
    if (isBonus) {
      spd += 3; pow += 3; stm += 3; mnt += 3; mag += 3;
      alert('✨ 捕捉大成功！素質が開花し、初期ステータス ALL +3 ボーナス獲得！');
    }

    if (cityVal === 'tokyo') {
      spd += 3; pow += 3; stm += 3; mnt += 3; mag += 3;
    } else {
      if(cityVal==='osaka') mnt+=15; 
      if(cityVal==='nagoya') pow+=15; 
      if(cityVal==='fukuoka') spd+=15; 
      if(cityVal==='sapporo') stm+=15;
    }

    const vidIdx = Math.floor(Math.random() * VIDEO_SOURCES.length);
    const newZ = { name: nameVal, colorInfo: ZOMBIE_COLORS[0], sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)], style: styleVal, speed: spd, power: pow, stamina: stm, mentality: mnt, magic: mag, remainingTurns: 5, matches: 0, wins: 0, videoIndex: vidIdx };
    myZombies.push(newZ); saveGame(); activeZombieIndex = myZombies.length - 1;
    
    const overlay = document.getElementById('found-overlay'); overlay.classList.remove('hidden');
    setTimeout(() => { overlay.classList.add('hidden'); document.getElementById('scout-screen').classList.add('hidden'); updateNurtureUI(); document.getElementById('nurture-screen').classList.remove('hidden'); }, 2000);
  });
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

let activeDrumrollAudio = null;

function executeCommand(type) {
  if (isNurturing) return; isNurturing = true;
  document.getElementById('nurture-result-overlay').classList.remove('hidden'); document.getElementById('drumroll-text').classList.remove('hidden'); document.getElementById('result-label').classList.add('hidden'); document.getElementById('result-status-changes').classList.add('hidden');
  
  activeDrumrollAudio = AudioManager.playSE('drumroll');
  
  let tick = 0; const drumInterval = setInterval(() => {
    tick++; document.getElementById('drumroll-text').textContent = `調整中 ${Math.floor(Math.random() * 89 + 10)} ...`;
    if (tick > 12) { 
      clearInterval(drumInterval); 
      if (activeDrumrollAudio) { activeDrumrollAudio.pause(); activeDrumrollAudio = null; }
      showNurtureResult(type); 
    }
  }, 100);
}

function showNurtureResult(type) {
  AudioManager.playSE('success');
  const rand = Math.random(); let rType = rand < 0.2 ? 2 : (rand > 0.85 ? 0 : 1);
  let ms='', ss='', mName='', sName='';
  if (type === 'spd') { ms='speed'; ss='mentality'; mName='速さ'; sName='気性'; } else if (type === 'pow') { ms='power'; ss='magic'; mName='力強さ'; sName='異能'; } else if (type === 'stm') { ms='stamina'; ss='speed'; mName='体力'; sName='速さ'; }
  let inc = rType===2?20:(rType===1?10:3); let dec = rType===2?-5:(rType===1?-3:-1);
  
  document.getElementById('drumroll-text').classList.add('hidden'); document.getElementById('result-label').classList.remove('hidden'); document.getElementById('result-status-changes').classList.remove('hidden');
  const rl = document.getElementById('result-label');
  
  if(rType===2){ 
    rl.textContent='大成功!!'; rl.className='result-label lbl-great'; 
    flashEffect.alpha = 1.0; flashEffect.color = '#facc15';
    showSuccessCutinImage();
  } else if(rType===1){ 
    rl.textContent='成功'; rl.className='result-label lbl-good'; 
  } else { 
    rl.textContent='失敗...'; rl.className='result-label lbl-bad'; 
  }
  
  document.getElementById('result-status-changes').innerHTML = `<div>${mName} <span class="change-up">+${inc}</span></div><div>${sName} <span class="change-down">${dec}</span></div>`;
  setTimeout(() => { myZombies[activeZombieIndex][ms]+=inc; myZombies[activeZombieIndex][ss]+=dec; myZombies[activeZombieIndex].remainingTurns--; saveGame(); document.getElementById('nurture-result-overlay').classList.add('hidden'); isNurturing = false; updateNurtureUI(); }, 1500);
}

function showSuccessCutinImage() {
  let imgOverlay = document.getElementById('success-cutin-pop');
  if (!imgOverlay) {
    imgOverlay = document.createElement('div');
    imgOverlay.id = 'success-cutin-pop';
    imgOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 12000; pointer-events: none; display: flex; align-items: center; justify-content: center;
    `;
    document.body.appendChild(imgOverlay);
  }
  
  imgOverlay.innerHTML = `
    <img src="/success_cutin.png" style="
      max-width: 80%; max-height: 60%; object-fit: contain; filter: drop-shadow(0 0 25px #facc15);
      animation: popZoom 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    " />
  `;
  imgOverlay.style.display = 'flex';
  setTimeout(() => { imgOverlay.style.display = 'none'; }, 1200);
}

document.getElementById('send-to-garage-btn').onclick = () => {
  document.getElementById('nurture-screen').classList.add('hidden');
  if (myZombies.length > 3) {
    const list = document.getElementById('release-list'); list.innerHTML = '';
    myZombies.forEach((z, idx) => {
      const card = document.createElement('div'); card.className = 'zombie-card';
      card.innerHTML = `<div class="zc-header"><span class="zc-name">${z.name}</span></div><div class="zc-stats"><span>速:${z.speed}</span><span>力:${z.power}</span><span>体:${z.stamina}</span><span>気性:${z.mentality}</span><span>異能:${z.magic}</span></div><button class="zc-btn btn-del" style="margin-top:8px;" onclick="doRelease(${idx})">逃がす</button>`;
      list.appendChild(card);
    });
    document.getElementById('release-screen').classList.remove('hidden');
  } else { renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); }
};

window.doRelease = (idx) => { 
  myZombies.splice(idx, 1); 
  saveGame(); 
  if (myZombies.length > 3) {
    document.getElementById('send-to-garage-btn').click();
  } else {
    document.getElementById('release-screen').classList.add('hidden'); 
    renderGarage(); 
    document.getElementById('garage-screen').classList.remove('hidden'); 
  }
};

async function renderCitySelect() {
  await fetchOnlineChamps(); // 💡 遠征先一覧を開くたびにオンラインの最新王者を非同期取得
  const container = document.getElementById('city-list'); if(!container) return;
  container.innerHTML = '';
  
  CITIES.forEach(city => {
    const isUnlocked = currentGameMode === 'free' || clearedCities.includes(city.id);
    const btn = document.createElement('div'); 
    btn.className = `city-btn ${isUnlocked ? '' : 'locked'}`;
    if (!isUnlocked) btn.style.opacity = '0.5';

    const champ = weeklyChamps[city.id];
    let champHtml = champ ? `<div class="city-champ">👑 サーバー王者: ${champ.name} (${champ.time}s)</div>` : `<div class="city-champ">👑 サーバー王者: まだ誰もいません！</div>`;
    let lockTag = isUnlocked ? '' : '<span style="color:#ef4444; font-weight:bold;"> [未解放]</span>';
    
    let descHtml = city.desc;
    if (currentGameMode === 'free' && isUnlocked) {
      descHtml += `<br><span style="color:#facc15; font-weight:bold; font-size:12px;">💰 1着賞金: ${city.freeBasePrize} Z$</span>`;
    }

    btn.innerHTML = `<span class="city-name" style="color:${city.color}">${city.name} (${city.distance}m)${lockTag}</span><span class="city-desc">${descHtml}</span>${champHtml}`;
    
    if (isUnlocked) {
      btn.onclick = () => { 
        currentCity = city; 
        document.getElementById('city-select-screen').classList.add('hidden'); 
        
        if (currentGameMode === 'story') {
          showStoryCutscene(city, () => { showPaddock(); });
        } else {
          showPaddock(); 
        }
      };
    } else {
      btn.onclick = () => { alert('前の都市をストーリーモードでクリアすると解放されます！'); };
    }
    container.appendChild(btn);
  });
}

function showStoryCutscene(city, onComplete) {
  let modal = document.getElementById('story-modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'story-modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.95); z-index: 10000;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 20px; box-sizing: border-box; color: #fff; text-align: center;
    `;
    document.body.appendChild(modal);
  }

  const boss = STORY_BOSSES[city.id] || { name: '強敵ゾンビ', title: '街の覇者', quote: '「負けんぞ！」' };

  modal.innerHTML = `
    <div style="max-width: 480px; width: 100%; background: #1e293b; border: 2px solid ${city.color}; border-radius: 16px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
      <div style="font-size: 14px; color: ${city.color}; font-weight: bold; margin-bottom: 8px;">📖 STORY RACE</div>
      <h2 style="font-size: 28px; margin: 0 0 12px 0; color: #f8fafc;">STAGE: ${city.name}</h2>
      <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px; line-height: 1.5;">${city.desc}</p>
      
      <div style="background: rgba(0,0,0,0.5); border-left: 4px solid ${city.color}; padding: 14px; border-radius: 8px; margin-bottom: 24px; text-align: left;">
        <div style="font-size: 12px; color: #cbd5e1; font-weight: bold;">【STAGE BOSS】</div>
        <div style="font-size: 18px; font-weight: bold; color: #facc15; margin: 6px 0;">【${boss.title}】${boss.name}</div>
        <div style="font-size: 13px; font-style: italic; color: #f8fafc; margin-top: 6px; line-height: 1.4;">${boss.quote}</div>
      </div>
      
      <button id="story-start-btn" style="
        width: 100%; padding: 14px; font-size: 18px; font-weight: bold;
        background: linear-gradient(135deg, ${city.color}, #0369a1); color: #fff;
        border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      ">出走準備（検体確認へ）</button>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('story-start-btn').onclick = () => {
    modal.style.display = 'none';
    onComplete();
  };
}

function showEndingTruthModal() {
  let modal = document.getElementById('truth-modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'truth-modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(10, 15, 30, 0.96); z-index: 20000;
      display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
      padding: 20px; box-sizing: border-box; color: #fff; overflow-y: auto;
    `;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="max-width: 520px; width: 100%; background: #1e293b; border: 2px solid #e11d48; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(225,29,72,0.4); margin: auto;">
      <div style="font-size: 14px; color: #f43f5e; font-weight: bold; text-align: center; letter-spacing: 2px;">🏆 STORY ALL CLEAR 🏆</div>
      <h2 style="font-size: 24px; text-align: center; margin: 8px 0 16px 0; color: #facc15;">全都市制覇：隠された『真実』</h2>
      
      <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px; text-align: center;">
        東京のDr.マッドゾンビを倒し、ついに手に入れた特効薬ワクチン。<br>
        だが、あなたが倒してきたボスたちには、知られざる【真相】があった…！
      </p>

      <div style="display: flex; flex-direction: column; gap: 12px; text-align: left; font-size: 13px;">
        <div style="background: rgba(15, 23, 42, 0.7); padding: 12px; border-left: 4px solid #0284c7; border-radius: 6px;">
          <div style="color: #38bdf8; font-weight: bold;">🚚 【福岡】爆走デリバリーの真実</div>
          <div style="color: #e2e8f0; margin-top: 4px; line-height: 1.4;">
            冷めないピザを届けていたわけではない。彼はゾンビ化初期、市民へ「緊急予防薬」を命がけで配送していた英雄だった。
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.7); padding: 12px; border-left: 4px solid #ca8a04; border-radius: 6px;">
          <div style="color: #facc15; font-weight: bold;">💰 【大阪】ナニワの金主の真実</div>
          <div style="color: #e2e8f0; margin-top: 4px; line-height: 1.4;">
            金を撒いてサボらせていた富豪は、全私財を投じてワクチン開発を影で支援していた大恩人だった。手遅れとなり自らも感染した。
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.7); padding: 12px; border-left: 4px solid #16a34a; border-radius: 6px;">
          <div style="color: #4ade80; font-weight: bold;">🛡️ 【名古屋】フルアーマー鉄壁の真実</div>
          <div style="color: #e2e8f0; margin-top: 4px; line-height: 1.4;">
            道を阻んでいた重装甲は妨害のためではない。感染拡大を防ぐため、自ら身体を封印し防衛線となって孤軍奮闘していた。
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.7); padding: 12px; border-left: 4px solid #93c5fd; border-radius: 6px;">
          <div style="color: #93c5fd; font-weight: bold;">❄️ 【札幌】凍血のDr.ゼロの真実</div>
          <div style="color: #e2e8f0; margin-top: 4px; line-height: 1.4;">
            極寒施設で立ち塞がった所長は、ウイルスの死滅条件を解明するため、自らを凍結実験台にして生き延びていた研究者だった。
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.9); padding: 12px; border-left: 4px solid #e11d48; border-radius: 6px; border: 1px solid #f43f5e;">
          <div style="color: #f43f5e; font-weight: bold;">💉 【東京＆衝撃の結末】特効薬の真実</div>
          <div style="color: #fff; margin-top: 4px; line-height: 1.5; font-weight: bold;">
            すべてのボスを倒し、ついにワクチンを自分に投与したあなた。<br>
            しかし、人間に戻るどころか知性と圧倒的筋力を兼ね備えた最悪の『超ゾンビ（新世界の王）』として覚醒してしまったのだった…！
          </div>
        </div>
      </div>

      <button id="truth-close-btn" style="
        width: 100%; padding: 14px; font-size: 16px; font-weight: bold; margin-top: 20px;
        background: linear-gradient(135deg, #e11d48, #9f1239); color: #fff;
        border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      ">真相を受け入れ、ガレージへ戻る</button>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('truth-close-btn').onclick = () => {
    modal.style.display = 'none';
  };
}

function showPaddock() {
  const z = myZombies[activeZombieIndex || 0]; if(!z) return;
  const grid = document.getElementById('paddock-grid'); if(!grid) return;
  grid.innerHTML = '';
  
  runners.length = 0; 
  const lanePadding = 30;
  const laneW = (canvas.width - lanePadding * 2) / 4;
  
  runners.push({ id: 0, name: z.name, title: getTitle(z), isPlayer: true, x: lanePadding + laneW*0 + laneW/2, y: 400, dist: 0, stm: z.stamina * 10, maxStm: z.stamina * 10, spdAttr: z.speed, powAttr: z.power, mntAttr: z.mentality, magAttr: z.magic, colorInfo: z.colorInfo, sizeInfo: z.sizeInfo, style: z.style, boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, isSlacking: false, videoIndex: z.videoIndex, skillCd: Math.floor(Math.random() * 150) + 150 });
  
  const playerTotal = z.speed + z.power + z.stamina + z.mentality + z.magic;
  const diffSetting = STORY_DIFFICULTY[currentCity.id] || STORY_DIFFICULTY.fukuoka;

  hasIntruder = false;

  for (let i = 1; i < 4; i++) {
    let name = CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)];
    let bossTitle = '対戦者';
    
    if (currentGameMode === 'story' && i === 1 && STORY_BOSSES[currentCity.id]) {
      const boss = STORY_BOSSES[currentCity.id];
      name = boss.name;
      bossTitle = boss.title;
    }

    let isIntruder = false;
    if (currentGameMode === 'free' && i === 1 && Math.random() < 0.10) {
      isIntruder = true;
      hasIntruder = true;
      name = '漆黒の暴走体';
      bossTitle = '乱入検体';
    }

    if (isPvpMode && pvpMembers[i]) name = pvpMembers[i].name;

    let cpuSpd, cpuPow, cpuStmVal, cpuMnt, cpuMag;

    if (currentGameMode === 'story') {
      const rate = diffSetting.min + Math.random() * (diffSetting.max - diffSetting.min);
      const targetTotal = 300 * (1 + rate);
      const weights = [Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5];
      const wSum = weights.reduce((a, b) => a + b, 0);

      cpuSpd = Math.round((weights[0] / wSum) * targetTotal);
      cpuPow = Math.round((weights[1] / wSum) * targetTotal);
      cpuStmVal = Math.round((weights[2] / wSum) * targetTotal);
      cpuMnt = Math.round((weights[3] / wSum) * targetTotal);
      cpuMag = Math.round((weights[4] / wSum) * targetTotal);
    } else {
      let targetTotal;
      if (isIntruder) {
        targetTotal = playerTotal * 1.0;
      } else {
        const cityMult = FREE_CITY_MULTIPLIERS[currentCity.id] || 1.0;
        const rate = (Math.random() * 0.10) - 0.05;
        targetTotal = playerTotal * 0.90 * cityMult * (1 + rate);
      }
      
      const weights = [Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5];
      const wSum = weights.reduce((a, b) => a + b, 0);

      cpuSpd = Math.round((weights[0] / wSum) * targetTotal);
      cpuPow = Math.round((weights[1] / wSum) * targetTotal);
      cpuStmVal = Math.round((weights[2] / wSum) * targetTotal);
      cpuMnt = Math.round((weights[3] / wSum) * targetTotal);
      cpuMag = Math.round((weights[4] / wSum) * targetTotal);
    }

    if (currentCity.id === 'osaka') cpuMnt = Math.max(10, cpuMnt - 20);
    if (currentCity.id === 'nagoya') cpuPow += 20;

    const vidIdx = Math.floor(Math.random() * VIDEO_SOURCES.length);
    const cpuStm = Math.max(100, cpuStmVal * 10);
    const cpuColorInfo = isIntruder ? { filter: 'brightness(0) drop-shadow(0 0 10px #ef4444)' } : ZOMBIE_COLORS[0];

    const cpuZ = { id: i, name: name, title: bossTitle, isPlayer: false, x: lanePadding + laneW*i + laneW/2, y: 400, dist: 0, stm: cpuStm, maxStm: cpuStm, spdAttr: cpuSpd, powAttr: cpuPow, mntAttr: cpuMnt, magAttr: cpuMag, colorInfo: cpuColorInfo, sizeInfo: ZOMBIE_SIZES[Math.floor(Math.random() * ZOMBIE_SIZES.length)], style: RUNNING_STYLES[Math.floor(Math.random() * RUNNING_STYLES.length)], boostTimer: 0, knockback: 0, isHard: false, barrierPower: 0, isSlacking: false, videoIndex: vidIdx, skillCd: Math.floor(Math.random() * 200) + 150, isIntruder: isIntruder };
    runners.push(cpuZ);
  }

  runners.forEach((r, i) => {
    const card = document.createElement('div'); card.className = `pd-card c-${i}`; card.style.animationDelay = `${i * 0.2}s`;
    let titleStyle = r.isIntruder ? 'color:#ef4444; font-weight:900;' : '';
    let nameStyle = r.isIntruder ? 'color:#ef4444; text-shadow:0 0 5px #ef4444;' : '';
    card.innerHTML = `<div class="pd-name" style="${nameStyle}"><span class="pd-title" style="${titleStyle}">【${r.title}】</span>${r.name}</div><div class="pd-stats">脚質: ${r.style} / 評価値: ${r.spdAttr + r.powAttr + Math.floor(r.stm/10) + r.mntAttr + r.magAttr}</div>`;
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
  if (hasIntruder) {
    liveCommentary = `⚠️ 警告！正体不明の【漆黒の暴走体】が乱入してきました！！`;
  } else {
    liveCommentary = `各検体スタート位置につきました！距離${totalDistance}mの勝負！`;
  }
  lastTopRunnerId = null;

  AudioManager.playBGM(currentCity.id);

  document.getElementById('countdown-overlay').classList.remove('hidden'); document.getElementById('finish-overlay').classList.add('hidden'); document.getElementById('slime-overlay').classList.remove('active');
  particles.length = 0; effects.length = 0; syringeUsed = false;
  
  const shuffledAuto = [...ALL_SKILLS].sort(() => 0.5 - Math.random());
  currentAutoFlasks = shuffledAuto.slice(0, 2).map(s => ({ ...s, charge: 0, max: 100 }));
  
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

  liveCommentary = `⚡ ${userRunner.name}が異能【${skillData.name}】を発動！！`;

  if (isPvpMode && isPlayer) broadcast({ type: 'SYNC_SKILL', runnerId: 0, skill: skillData });

  if (skillData.id === 'meteor') { 
    particles.push({ type: 'meteor_drop', x: canvas.width / 2, y: -100, targetY: 300, radius: 60, power: effectivePower, user: userRunner }); 
    createExplosion(userRunner.x, userRunner.y, '#38bdf8', 15, 3, 3, 'spark'); 
  } 
  else if (skillData.id === 'lightning') { 
    shakeTime = 20; 
    flashEffect.alpha = 0.9; 
    flashEffect.color = '#fef08a'; 
    runners.forEach(r => { 
      if (r.id !== userRunner.id) { 
        applyKnockback(r, effectivePower * 1.2); 
        particles.push({ type: 'lightning_strike', x: r.x, y: r.y - 120, targetY: r.y + 20, life: 30 });
      } 
    }); 
  } 
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
  else if (skillData.id === 'barrier') { 
    userRunner.barrierPower = effectivePower; 
    createExplosion(userRunner.x, userRunner.y, '#a855f7', 30, 4, 3, 'spark'); 
    setTimeout(() => { userRunner.barrierPower = 0; }, 6000); 
  } 
  else if (skillData.id === 'heal') { userRunner.stm = Math.min(userRunner.maxStm, userRunner.stm + effectivePower * 2.0); createExplosion(userRunner.x, userRunner.y, '#4ade80', 40, 2, 3, 'fire'); } 
  else if (skillData.id === 'mach') { userRunner.boostTimer = effectivePower * 2.0; createExplosion(userRunner.x, userRunner.y, '#facc15', 50, 6, 4, 'spark'); } 
}

document.getElementById('syringe-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (raceState !== 'RACING' || syringeUsed || !currentSyringe) return;
  syringeUsed = true; document.getElementById('syringe-btn').classList.add('used');
  flashEffect.alpha = 0.8; flashEffect.color = '#ffffff'; triggerSkill(currentSyringe, runners[0]);
});

function doFinish() {
  raceState = 'FINISH_SLOW'; document.getElementById('slime-overlay').classList.remove('active'); document.getElementById('finish-overlay').classList.remove('hidden');
  
  AudioManager.playSE('goalin');

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  setTimeout(() => {
    raceState = 'FINISHED'; 
    document.getElementById('finish-overlay').classList.add('hidden');
    
    const sorted = [...runners].sort((a, b) => b.dist - a.dist); const playerRank = sorted.findIndex(r => r.id === 0) + 1;
    const z = myZombies[activeZombieIndex || 0]; if(z) z.matches++; let prize = 0;
    
    let isChampUpdated = false;
    let isStoryAllClear = false;

    if (playerRank === 1) { 
      if(z) z.wins++; 
      prize = (currentGameMode === 'free') ? (currentCity.freeBasePrize || 300) : 500;
      if (z && (!z.bestTime || parseFloat(elapsedSec) < parseFloat(z.bestTime))) { z.bestTime = elapsedSec; z.bestCity = currentCity.name; }
      
      const currentChamp = weeklyChamps[currentCity.id];
      if (!currentChamp || parseFloat(elapsedSec) < parseFloat(currentChamp.time)) {
        weeklyChamps[currentCity.id] = { name: z ? z.name : '名無し', time: elapsedSec };
        isChampUpdated = true;
        updateOnlineChamps(weeklyChamps); // 💡 1着でレコード更新時にオンライン同期送信
      }

      if (currentGameMode === 'story' && currentCity.nextCity && !clearedCities.includes(currentCity.nextCity)) {
        clearedCities.push(currentCity.nextCity);
      } else if (currentGameMode === 'story' && currentCity.id === 'tokyo') {
        isStoryAllClear = true;
      }
    } 
    else if (playerRank === 2) prize = (currentGameMode === 'free') ? Math.floor((currentCity.freeBasePrize || 300) * 0.6) : 300; 
    else if (playerRank === 3) prize = (currentGameMode === 'free') ? Math.floor((currentCity.freeBasePrize || 300) * 0.2) : 100; 
    else prize = 50;
    
    zombieMoney += prize; saveGame(); 
    document.getElementById('prize-money').textContent = `獲得賞金: ${prize} Z$`;
    const noticeEl = document.getElementById('champ-notice');
    if (isChampUpdated) noticeEl.classList.remove('hidden'); else noticeEl.classList.add('hidden');

    AudioManager.playBGM('ending');

    startPodiumAnimation(sorted, elapsedSec); 
    document.getElementById('result-screen').classList.remove('hidden');

    if (isStoryAllClear) {
      setTimeout(() => { showEndingTruthModal(); }, 1200);
    }
  }, 2500);
}

function initConfettiParticles() {
  confettiParticles = [];
  const colors = ['#ff007f', '#00f0ff', '#cc00ff', '#39ff14', '#ffe600', '#ff0055'];
  for (let i = 0; i < 80; i++) {
    confettiParticles.push({
      x: Math.random() * podiumCanvas.width,
      y: Math.random() * -podiumCanvas.height,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 2 + 1.5,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.1
    });
  }
}

function startPodiumAnimation(sortedRunners, winningTime) {
  currentSortedRunners = sortedRunners;
  currentWinningTime = winningTime;
  
  if (podiumAnimationId) cancelAnimationFrame(podiumAnimationId);
  initConfettiParticles();

  const listContainer = document.getElementById('result-list'); 
  listContainer.innerHTML = '';
  sortedRunners.forEach((r, idx) => {
    const row = document.createElement('div'); row.className = `result-row rank-${idx+1}`;
    const timeStr = idx === 0 ? `${winningTime}s` : `+${(Math.random()*3 + 1).toFixed(2)}s`;
    row.innerHTML = `<span class="res-rank">${idx+1}</span><span class="res-name">${r.name}</span><span class="res-time">${timeStr}</span>`;
    listContainer.appendChild(row);
  });

  function loop() {
    if (raceState === 'FINISHED') {
      renderPodiumFrame();
      podiumAnimationId = requestAnimationFrame(loop);
    }
  }
  loop();
}

function renderPodiumFrame() {
  if (!currentSortedRunners || currentSortedRunners.length === 0) return;
  pCtx.clearRect(0, 0, podiumCanvas.width, podiumCanvas.height);
  pCtx.imageSmoothingEnabled = false;
  
  pCtx.fillStyle = '#facc15'; pCtx.fillRect(140, 100, 80, 140); 
  pCtx.fillStyle = '#94a3b8'; pCtx.fillRect(60, 140, 80, 100); 
  pCtx.fillStyle = '#b45309'; pCtx.fillRect(220, 160, 80, 80);
  pCtx.fillStyle = '#0f131a'; pCtx.font = 'bold 36px sans-serif'; pCtx.textAlign = 'center'; 
  pCtx.fillText('1', 180, 150); pCtx.fillText('2', 100, 180); pCtx.fillText('3', 260, 200);
  
  const pcs = VIDEO_SOURCES.map((_, i) => updateChromaKeyFrame(i, 64, 80));

  if (currentSortedRunners[0]) {
    const pc = pcs[currentSortedRunners[0].videoIndex] || pcs[0];
    drawZombieCharacter(pCtx, 140+40, 100-80, 64, 80, currentSortedRunners[0], pc, false, false);
  }
  if (currentSortedRunners[1]) {
    const pc = pcs[currentSortedRunners[1].videoIndex] || pcs[0];
    drawZombieCharacter(pCtx, 60+40, 140-80, 64, 80, currentSortedRunners[1], pc, false, false);
  }
  if (currentSortedRunners[2]) {
    const pc = pcs[currentSortedRunners[2].videoIndex] || pcs[0];
    drawZombieCharacter(pCtx, 220+40, 160-80, 64, 80, currentSortedRunners[2], pc, false, false);
  }

  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.angle += p.vAngle;
    if (p.y > podiumCanvas.height) p.y = -10;
    
    pCtx.save();
    pCtx.translate(p.x, p.y);
    pCtx.rotate(p.angle);
    pCtx.fillStyle = p.color;
    pCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
    pCtx.restore();
  });
}

function update() {
  if (!isGameRunning) { requestAnimationFrame(update); return; }
  
  ctx.imageSmoothingEnabled = false;
  
  globalTime++; const cdEl = document.getElementById('countdown-overlay');

  if (raceState === 'COUNTDOWN') {
    const prevCD = Math.ceil(startCountdown);
    startCountdown -= 1 / 60;
    const currentCD = Math.ceil(startCountdown);

    if (prevCD !== currentCD && currentCD > 0) {
      AudioManager.playSE('countdown');
    }

    if (startCountdown > 0) { cdEl.textContent = Math.ceil(startCountdown); } 
    else { cdEl.textContent = "START!"; if (!hasIntruder) liveCommentary = "一斉にスタート！！激しい位置取り合戦だ！"; setTimeout(() => { if (raceState === 'RACING') cdEl.classList.add('hidden'); }, 1000); raceState = 'RACING'; startTime = Date.now(); }
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
        const isTokyoBoss = (currentGameMode === 'story' && currentCity.id === 'tokyo' && i === 1);
        r.skillCd -= dt * (isTokyoBoss ? 1.5 : 1.0); 
        if (r.skillCd <= 0) { 
          const cpuSkill = ALL_SKILLS[Math.floor(Math.random()*ALL_SKILLS.length)];
          triggerSkill(cpuSkill, r); 
          r.skillCd = Math.floor(Math.random() * 250) + 200; 
        }
      }
    });

    for (let i = 0; i < 4; i++) {
      const r = runners[i]; 
      
      if (currentGameMode === 'story' && currentCity.id === 'tokyo' && r.id === 1) {
        if (remainingDistance <= 150 && !r.hasMadDoped) {
          r.hasMadDoped = true;
          liveCommentary = `⚠️ Dr.マッドゾンビが究極の薬を注射！【マッハ＋バリア】発動！！`;
          triggerSkill(SYRINGE_SKILLS.find(s=>s.id==='mach'), r);
          triggerSkill(SYRINGE_SKILLS.find(s=>s.id==='barrier'), r);
        }
      }

      if (!r.isSlacking && Math.random() < 0.003 && r.mntAttr < 70) { 
        if (Math.random() < (70 - r.mntAttr) * 0.01) { 
          r.isSlacking = true; r.knockback = 60; 
          liveCommentary = `❓ ${r.name}がサボり始めた！集中力が切れている！`;
          setTimeout(() => { r.isSlacking = false; }, 1000); 
        } 
      }
      
      let baseSpeed = 0.08 + (r.spdAttr - 50) * 0.001; 
      const progress = r.dist / totalDistance; 
      let stmDrain = currentCity.bgType === 'snow' ? 0.045 : 0.028; 

      if (r.style === '逃げ') { 
        if (progress < 0.4) { baseSpeed *= 1.5; stmDrain *= 1.8; } 
        else if (progress > 0.7) { baseSpeed *= 0.8; } 
      } 
      else if (r.style === '先行') { 
        if (progress > 0.2 && progress < 0.6) { baseSpeed *= 1.2; stmDrain *= 1.2; } 
      } 
      else if (r.style === '差し') { 
        if (progress > 0.5 && progress < 0.8) { baseSpeed *= 1.3; stmDrain *= 1.1; } 
      } 
      else if (r.style === '追込') { 
        if (progress < 0.7) { 
          baseSpeed *= 0.85; 
          stmDrain *= 0.5; 
        } else { 
          baseSpeed *= 2.3; 
          stmDrain *= 1.2;
          if (globalTime % 3 === 0) {
            createExplosion(r.x, r.y + 30, r.id === 0 ? '#38bdf8' : '#ef4444', 3, 3, 3, 'spark');
          }
          if (Math.random() < 0.02) {
            liveCommentary = `🔥 ${r.name}の追込スパート炸裂！怒涛の大外一気！`;
          }
        } 
      }
      
      if (r.stm > 0) r.stm -= stmDrain * dt; else baseSpeed *= 0.65;
      
      if (r.boostTimer > 0) { r.boostTimer -= dt; baseSpeed *= 2.5; if (globalTime % 5 === 0) createExplosion(r.x, r.y, '#facc15', 2, 2, 2, 'spark'); }
      if (r.knockback > 0) { r.knockback -= dt; baseSpeed *= 0; }
      r.dist += Math.max(0, baseSpeed) * dt;
    }

    for (let i = 0; i < 4; i++) { for (let j = i + 1; j < 4; j++) { const r1 = runners[i]; const r2 = runners[j]; if (Math.abs(r1.dist - r2.dist) < 8) { if (r1.powAttr > r2.powAttr) { r1.dist += 0.05*dt; r2.dist -= 0.05*dt; } else if (r2.powAttr > r1.powAttr) { r2.dist += 0.05*dt; r1.dist -= 0.05*dt; } } } }
    
    const leadingDist = Math.max(...runners.map(r => r.dist)); 
    remainingDistance = Math.max(0, totalDistance - leadingDist);
    
    const sortedRunners = [...runners].sort((a, b) => b.dist - a.dist);
    const topRunner = sortedRunners[0];

    if (topRunner.id !== lastTopRunnerId && remainingDistance > 50) {
      lastTopRunnerId = topRunner.id;
      liveCommentary = `👑 ${topRunner.name}が先頭に躍り出た！`;
    }
    if (remainingDistance <= 100 && remainingDistance > 80) {
      liveCommentary = `🏁 残り100m！叩き合いの直線コース！`;
    } else if (remainingDistance <= 30 && remainingDistance > 10) {
      liveCommentary = `🔥 栄光のゴールは目前！最後の力を振り絞る！`;
    }

    if (raceState === 'RACING') {
      if (remainingDistance <= 50 && remainingDistance > 0 && startCountdown <= 0) { const countVal = Math.min(5, Math.max(1, Math.ceil(remainingDistance / 10))); cdEl.textContent = countVal; cdEl.classList.remove('hidden'); }
      if (remainingDistance <= 0) { doFinish(); }
    }
    
    document.getElementById('hud-dist').textContent = `${Math.floor(remainingDistance)}m`;
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

  const processedCanvases = VIDEO_SOURCES.map((_, i) => updateChromaKeyFrame(i, 72, 90));

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
    } 
    else if (p.type === 'lightning_strike') {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      let currX = p.x; let currY = p.y;
      const segs = 5; const dy = (p.targetY - p.y) / segs;
      for (let s = 0; s < segs; s++) {
        currY += dy; currX += (Math.random() - 0.5) * 30;
        ctx.lineTo(currX, currY);
      }
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      createExplosion(p.x, p.targetY, '#facc15', 3, 3, 2, 'spark');
      p.life -= 2 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    else if (p.type === 'giant_frog') {
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

  drawLiveCommentary();

  ctx.restore(); requestAnimationFrame(update);
}

function init() {
  updateMoneyDisp();
  initPeerJS();
  AudioManager.init();
  fetchOnlineChamps(); // 💡 起動時に最新のオンラインランキングを取得
  
  const navScout = document.getElementById('nav-scout-btn');
  if(navScout) navScout.onclick = () => { document.getElementById('title-screen').classList.add('hidden'); document.getElementById('scout-screen').classList.remove('hidden'); };
  
  const navGarage = document.getElementById('nav-garage-btn');
  if(navGarage) navGarage.onclick = () => { 
    document.getElementById('title-screen').classList.add('hidden'); 
    if (myZombies.length > 3) {
      document.getElementById('send-to-garage-btn').click();
    } else {
      renderGarage(); 
      document.getElementById('garage-screen').classList.remove('hidden'); 
    }
  };

  const navPvp = document.getElementById('nav-pvp-btn');
  if(navPvp) navPvp.onclick = () => { updatePvpSelectUI(); document.getElementById('title-screen').classList.add('hidden'); document.getElementById('pvp-screen').classList.remove('hidden'); };

  const navHowto = document.getElementById('nav-howto-btn');
  if(navHowto) navHowto.onclick = () => { document.getElementById('howto-modal').classList.remove('hidden'); };

  const closeHowto = document.getElementById('close-howto-btn');
  if(closeHowto) closeHowto.onclick = () => { document.getElementById('howto-modal').classList.add('hidden'); };

  const howtoModal = document.getElementById('howto-modal');
  if(howtoModal) howtoModal.addEventListener('click', (e) => { if (e.target.id === 'howto-modal') howtoModal.classList.add('hidden'); });

  const doScoutBtn = document.getElementById('do-scout-btn');
  if(doScoutBtn) doScoutBtn.onclick = doScout;

  const back1 = document.getElementById('back-to-title-1');
  if(back1) back1.onclick = () => { document.getElementById('scout-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); AudioManager.playBGM('opening'); };

  const back2 = document.getElementById('back-to-title-2');
  if(back2) back2.onclick = () => { document.getElementById('garage-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); AudioManager.playBGM('opening'); };

  const backPvp = document.getElementById('back-to-title-pvp');
  if(backPvp) backPvp.onclick = () => { document.getElementById('pvp-screen').classList.add('hidden'); document.getElementById('title-screen').classList.remove('hidden'); AudioManager.playBGM('opening'); };

  const backGarage1 = document.getElementById('back-to-garage-1');
  if(backGarage1) backGarage1.onclick = () => { document.getElementById('city-select-screen').classList.add('hidden'); document.getElementById('garage-screen').classList.remove('hidden'); };

  const retryBtn = document.getElementById('retry-btn');
  if(retryBtn) retryBtn.onclick = () => { isGameRunning = false; isPvpMode = false; document.getElementById('result-screen').classList.add('hidden'); document.getElementById('race-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };

  document.querySelectorAll('.cmd-btn').forEach(btn => { btn.onclick = () => { executeCommand(btn.dataset.cmd); }; });
  
  const closeShop = document.getElementById('close-shop-btn');
  if(closeShop) closeShop.onclick = () => { document.getElementById('shop-screen').classList.add('hidden'); renderGarage(); document.getElementById('garage-screen').classList.remove('hidden'); };

  requestAnimationFrame(update);
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }