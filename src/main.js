const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let shakeTime = 0;
let scrollY = 0;
let currentScrollSpeed = 4;
const baseScrollSpeed = 4;

// プレイヤー（緑ゾンビ）
const player = {
  x: 155,
  y: 380,
  width: 46,
  height: 46,
  color: '#4ade80',
  isBarrier: false,
  barrierTimer: 0,
  boostTimer: 0
};

// ライバルAI
const rivals = [
  { x: 55, y: 150, width: 46, height: 46, color: '#f43f5e', name: '赤ゾンビ', knockback: 0 },
  { x: 255, y: 220, width: 46, height: 46, color: '#3b82f6', name: '青ゾンビ', knockback: 0 }
];

// 画面エフェクト（隕石・テキストなど）
const particles = [];
const effects = [];

// フラスコデータ
const flasks = [
  { name: 'メテオ', charge: 0, max: 100, speed: 0.12 },
  { name: 'マッハ', charge: 0, max: 100, speed: 0.20 },
  { name: 'バリア', charge: 0, max: 100, speed: 0.15 }
];

// --- スキル発動処理 ---
function triggerSkill(index, power) {
  const isMax = power >= 100;

  if (index === 0) {
    // ☄️ メテオ：隕石パーティクルを生成＆敵を吹き飛ばす
    particles.push({
      type: 'meteor',
      x: canvas.width / 2,
      y: -50,
      targetY: 200,
      radius: isMax ? 40 : 20,
      power: power
    });
    if (isMax) shakeTime = 20;

  } else if (index === 1) {
    // ⚡ マッハ：プレイヤーを超加速させる
    player.boostTimer = Math.floor((power / 100) * 120); // 最大2秒間加速
    effects.push({ text: `⚡ SPEED UP!!`, x: player.x + 23, y: player.y - 10, color: '#38bdf8' });

  } else if (index === 2) {
    // 🛡️ バリア：シールドを展開
    player.isBarrier = true;
    player.barrierTimer = Math.floor((power / 100) * 180); // 最大3秒間無敵
    effects.push({ text: `🛡️ BARRIER!!`, x: player.x + 23, y: player.y - 10, color: '#a855f7' });
  }

  // ゲージリセット
  flasks[index].charge = 0;
}

// メイン更新ループ
function update() {
  // 1. フラスコチャージ
  flasks.forEach((flask, index) => {
    if (flask.charge < flask.max) {
      flask.charge = Math.min(flask.max, flask.charge + flask.speed);
    }
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

  // 2. ブースト状態の計算
  if (player.boostTimer > 0) {
    player.boostTimer--;
    currentScrollSpeed = baseScrollSpeed * 2.5; // スピード2.5倍
  } else {
    currentScrollSpeed = baseScrollSpeed;
  }

  // 3. バリア状態の計算
  if (player.barrierTimer > 0) {
    player.barrierTimer--;
    if (player.barrierTimer === 0) player.isBarrier = false;
  }

  // 4. 画面揺れ準備
  ctx.save();
  if (shakeTime > 0) {
    ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    shakeTime--;
  }

  ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);

  // 5. 背景（縦スクロール）
  scrollY = (scrollY + currentScrollSpeed) % 60;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 20]);
  for (let x of [120, 240]) {
    ctx.beginPath();
    ctx.moveTo(x, -60 + scrollY);
    ctx.lineTo(x, canvas.height + 60 + scrollY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 6. ライバルAIの更新と描画
  rivals.forEach(r => {
    // 隕石等のノックバック（吹き飛び）処理
    if (r.knockback > 0) {
      r.y += 4; // 下に押し戻される
      r.knockback--;
    } else {
      // ブースト中はライバルが後ろに置き去りにされるように見える
      if (player.boostTimer > 0) r.y += 3;
      else r.y += (Math.random() - 0.48) * 2;
    }

    if (r.y < 50) r.y = 50;
    if (r.y > 420) r.y = 420;

    ctx.fillStyle = r.color;
    ctx.fillRect(r.x, r.y, r.width, r.height);
  });

  // 7. プレイヤーゾンビ描画
  ctx.fillStyle = player.color;
  ctx.shadowColor = player.color;
  ctx.shadowBlur = 10;
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.shadowBlur = 0;

  // バリアのエフェクト描画
  if (player.isBarrier) {
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x + 23, player.y + 23, 35, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 8. パーティクル（メテオ）の更新と描画
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'meteor') {
      p.y += 12; // 隕石が降下
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // 着地（着弾）時の処理
      if (p.y >= p.targetY) {
        shakeTime = 15;
        // ライバル全員を吹き飛ばす
        rivals.forEach(r => r.knockback = Math.floor((p.power / 100) * 30));
        effects.push({ text: `💥 BOOM!!`, x: p.x, y: p.y, color: '#ef4444' });
        particles.splice(i, 1);
      }
    }
  }

  // 9. テキストエフェクト描画
  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i];
    ctx.fillStyle = eff.color;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y);
    eff.y -= 1.5;
    if (eff.y < 150) effects.splice(i, 1);
  }

  ctx.restore();
  requestAnimationFrame(update);
}

// タップイベント
function initEvents() {
  document.querySelectorAll('.flask-card').forEach((card) => {
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const index = parseInt(card.dataset.index);
      const flask = flasks[index];

      if (flask.charge >= 10) {
        triggerSkill(index, Math.floor(flask.charge));
      } else {
        effects.push({ text: '液不足！', x: player.x + 23, y: player.y - 10, color: '#94a3b8' });
      }
    });
  });
}

initEvents();
update();