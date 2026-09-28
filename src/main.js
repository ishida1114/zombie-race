const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 画面揺れ（Screen Shake）用
let shakeTime = 0;

// レース状態
let scrollY = 0;
const scrollSpeed = 4;

// プレイヤー（緑）
const player = {
  x: 155,
  y: 380,
  width: 46,
  height: 46,
  color: '#4ade80'
};

// ライバルAI（赤・青）
const rivals = [
  { x: 55, y: 150, width: 46, height: 46, color: '#f43f5e', speed: 3.8, name: 'ライバルA' },
  { x: 255, y: 220, width: 46, height: 46, color: '#3b82f6', speed: 4.2, name: 'ライバルB' }
];

// テキスト演出
const effects = [];

// フラスコデータ（チャージスピードを約10〜12秒でMAXになるように調整）
const flasks = [
  { name: 'メテオ', charge: 0, max: 100, speed: 0.12 }, // 約13秒
  { name: 'マッハ', charge: 0, max: 100, speed: 0.20 }, // 約8秒
  { name: 'バリア', charge: 0, max: 100, speed: 0.15 }  // 約11秒
];

// メインループ
function update() {
  // 1. フラスコ充填
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
      if (flask.charge >= 100) {
        cardEl.classList.add('ready');
      } else {
        cardEl.classList.remove('ready');
      }
    }
  });

  // 2. 画面描画準備（画面揺れの計算）
  ctx.save();
  if (shakeTime > 0) {
    const shakeX = (Math.random() - 0.5) * 12;
    const shakeY = (Math.random() - 0.5) * 12;
    ctx.translate(shakeX, shakeY);
    shakeTime--;
  }

  ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);

  // 3. 背景（縦スクロール）
  scrollY = (scrollY + scrollSpeed) % 60;
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

  // 4. ライバルAIの描画と移動（上下にゆらゆら）
  rivals.forEach(r => {
    r.y += (Math.random() - 0.48) * 2; // 少し位置が前後する
    if (r.y < 80) r.y = 80;
    if (r.y > 350) r.y = 350;

    ctx.fillStyle = r.color;
    ctx.fillRect(r.x, r.y, r.width, r.height);
  });

  // 5. プレイヤーゾンビ（緑）
  ctx.fillStyle = player.color;
  ctx.shadowColor = player.color;
  ctx.shadowBlur = 10;
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.shadowBlur = 0;

  // 6. テキスト演出
  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i];
    ctx.fillStyle = eff.color;
    ctx.font = eff.isMax ? 'bold 22px sans-serif' : 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y);
    
    eff.y -= 1.2;
    if (eff.y < 180) {
      effects.splice(i, 1);
    }
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
        const power = Math.floor(flask.charge);
        const isMax = power >= 100;

        // MAX発動なら画面揺れ発生！
        if (isMax) {
          shakeTime = 15; // 15フレーム揺らす
        }

        effects.push({
          text: isMax ? `💥 FULL POWER: ${flask.name}!!` : `🧪 ${flask.name} (${power}%)`,
          x: canvas.width / 2,
          y: player.y - 20,
          color: isMax ? '#f43f5e' : '#facc15',
          isMax: isMax
        });

        flask.charge = 0;
      } else {
        effects.push({
          text: 'まだ溜まってない！',
          x: canvas.width / 2,
          y: player.y - 20,
          color: '#94a3b8',
          isMax: false
        });
      }
    });
  });
}

initEvents();
update();