const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// レース状態
let scrollY = 0;
const scrollSpeed = 5;

// ゾンビ（プレイヤー）
const zombie = {
  x: 155,
  y: 380,
  width: 50,
  height: 50
};

// 画面上に表示する技発動テキスト演出
const effects = [];

// フラスコ（スキル）データ
const flasks = [
  { name: 'メテオ', charge: 0, max: 100, speed: 0.5 },
  { name: 'マッハ', charge: 0, max: 100, speed: 0.8 },
  { name: 'バリア', charge: 0, max: 100, speed: 0.4 }
];

// メイン描画ループ
function update() {
  // 1. フラスコ充電 & UI反映
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

  // 2. 背景（縦スクロール）描画
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  // 3. ゾンビ（緑の四角）
  ctx.fillStyle = '#4ade80';
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 10;
  ctx.fillRect(zombie.x, zombie.y, zombie.width, zombie.height);
  ctx.shadowBlur = 0;

  // 4. スキル発動テキストアニメーション
  for (let i = effects.length - 1; i >= 0; i--) {
    const eff = effects[i];
    ctx.fillStyle = eff.color;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(eff.text, eff.x, eff.y);
    
    eff.y -= 1.5; // ふわっと上に浮き上がる
    eff.alpha -= 0.02;
    if (eff.y < 200) {
      effects.splice(i, 1);
    }
  }

  requestAnimationFrame(update);
}

// --- フラスコタップイベント ---
function initEvents() {
  document.querySelectorAll('.flask-card').forEach((card) => {
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const index = parseInt(card.dataset.index);
      const flask = flasks[index];

      if (flask.charge >= 10) { // 10%以上で途中撃ち可能
        const power = Math.floor(flask.charge);
        
        // 画面上にポップテキストを生成
        effects.push({
          text: `🧪 ${flask.name} (${power}%)!`,
          x: canvas.width / 2,
          y: zombie.y - 15,
          color: power >= 100 ? '#38bdf8' : '#facc15'
        });

        // ゲージリセット
        flask.charge = 0;
      } else {
        effects.push({
          text: 'まだ液が足りない！',
          x: canvas.width / 2,
          y: zombie.y - 15,
          color: '#ef4444'
        });
      }
    });
  });
}

// イベント初期化 & ループ開始
initEvents();
update();