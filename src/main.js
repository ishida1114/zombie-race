const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- レース状態管理 ---
let scrollY = 0;
const scrollSpeed = 5;

// ゾンビ（プレイヤー）の位置
const zombie = {
  x: 155,
  y: 380,
  width: 50,
  height: 50,
  speed: 5
};

// --- フラスコ（スキル）管理 ---
const flasks = [
  { name: 'メテオ', charge: 0, max: 100, speed: 0.4 },
  { name: 'マッハ', charge: 0, max: 100, speed: 0.6 },
  { name: 'バリア', charge: 0, max: 100, speed: 0.3 }
];

// 画面の更新処理（メインループ）
function update() {
  // 1. フラスコのゲージ充填処理
  flasks.forEach((flask, index) => {
    if (flask.charge < flask.max) {
      flask.charge = Math.min(flask.max, flask.charge + flask.speed);
    }

    // UI反映
    const fillEl = document.getElementById(`flask-fill-${index}`);
    const percentEl = document.getElementById(`flask-percent-${index}`);
    const cardEl = fillEl.closest('.flask-card');

    fillEl.style.height = `${flask.charge}%`;
    percentEl.textContent = `${Math.floor(flask.charge)}%`;

    if (flask.charge >= 100) {
      cardEl.classList.add('ready');
    } else {
      cardEl.classList.remove('ready');
    }
  });

  // 2. コースの背景描画（縦スクロール）
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  scrollY = (scrollY + scrollSpeed) % 60;
  
  // レーン境界線
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

  // 3. ゾンビ（仮描画）
  ctx.fillStyle = '#4ade80';
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur = 10;
  ctx.fillRect(zombie.x, zombie.y, zombie.width, zombie.height);
  ctx.shadowBlur = 0;

  requestAnimationFrame(update);
}

// --- フラスコタップ（途中撃ち）イベント ---
document.querySelectorAll('.flask-card').forEach((card) => {
  card.addEventListener('click', () => {
    const index = parseInt(card.dataset.index);
    const flask = flasks[index];

    if (flask.charge > 10) { // 10%以上あれば撃てる
      const power = Math.floor(flask.charge);
      console.log(`🧪 ${flask.name} を ${power}% の威力で発動！`);
      
      // ゲージリセット
      flask.charge = 0;
    } else {
      console.log('まだ液体の量が足りない！');
    }
  });
});

// ループ開始
update();