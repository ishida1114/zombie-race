const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// コースの縦スクロールオフセット
let scrollY = 0;
const scrollSpeed = 4;

// プレイヤー（ゾンビ）の初期位置
const player = {
  x: 155,
  y: 480,
  width: 50,
  height: 50,
  speed: 4
};

// ゲームメインループ
function gameLoop() {
  // 1. 画面クリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. コース（背景）の縦スクロール描画
  scrollY = (scrollY + scrollSpeed) % 40;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  for (let y = scrollY - 40; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(120, y);
    ctx.lineTo(120, y + 20); // レーン境界線
    ctx.moveTo(240, y);
    ctx.lineTo(240, y + 20);
    ctx.stroke();
  }

  // 3. ゾンビ（仮の矩形描画）
  ctx.fillStyle = '#4ade80'; // ゾンビグリーン
  ctx.fillRect(player.x, player.y, player.width, player.height);

  requestAnimationFrame(gameLoop);
}

// ループ開始
gameLoop();