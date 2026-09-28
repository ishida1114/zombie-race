* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
}

html, body {
  width: 100%;
  height: 100%;
  background-color: #0f141c;
  color: #fff;
  font-family: 'Hiragino Kaku Gothic ProN', 'メイリオ', sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

/* 🎮 ゲームフレーム */
#game-container {
  position: relative;
  height: min(92vh, 800px);
  width: calc(min(92vh, 800px) * (360 / 660));
  max-width: 95vw;
  background-color: #1a202c;
  border: 4px solid #334155;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
}

.hidden {
  display: none !important;
}

/* 🧟 タイトル画面（レトロトーン） */
#title-screen {
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, #1e293b 0%, #0f172a 100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 10% 5%;
  text-align: center;
}

.title-logo-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.title-sub {
  font-size: clamp(13px, 2.2vh, 16px);
  color: #fbbf24;
  font-weight: bold;
  letter-spacing: 3px;
  margin-bottom: 12px;
}

.title-logo-img {
  width: 90%;
  max-width: 320px;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px rgba(0,0,0,0.7));
}

/* 昭和風ボタン */
.retro-btn {
  background: linear-gradient(to bottom, #dc2626, #991b1b);
  border: 2px solid #f87171;
  border-radius: 8px;
  padding: 12px 36px;
  cursor: pointer;
  box-shadow: 0 4px 0 #7f1d1d;
  transition: transform 0.05s, box-shadow 0.05s;
  touch-action: manipulation;
  z-index: 10;
}

.retro-btn:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 #7f1d1d;
}

.retro-btn span {
  font-size: clamp(16px, 2.5vh, 20px);
  font-weight: bold;
  color: #fff;
  letter-spacing: 2px;
}

/* 🏁 レース画面 ＆ HUD */
#race-screen {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

#race-hud {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  height: 40px;
  background: rgba(15, 23, 42, 0.9);
  border: 2px solid #475569;
  border-radius: 6px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 5;
}

.hud-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hud-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: bold;
}

.hud-val {
  font-size: 18px;
  color: #facc15;
  font-weight: bold;
}

canvas {
  width: 100%;
  height: 75%;
  background-color: #262a33; /* アスファルトカラー */
  display: block;
}

/* フラスコエリア（ここだけサイエンス発光） */
#flask-container {
  width: 100%;
  height: 25%;
  background: #0f172a;
  border-top: 4px solid #334155;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 2%;
}

.flask-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  width: 30%;
  height: 90%;
  justify-content: center;
  touch-action: manipulation;
}

.flask-wrapper {
  position: relative;
  width: 60%;
  max-width: 58px;
  height: 65%;
  background: rgba(255, 255, 255, 0.05);
  border: 3px solid #64748b;
  border-radius: 8px 8px 22px 22px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}

.flask-card:active .flask-wrapper {
  transform: scale(0.92);
}

.flask-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 0%;
  background: linear-gradient(to top, #06b6d4, #22d3ee);
  transition: height 0.1s linear;
  pointer-events: none;
}

.flask-card.ready .flask-wrapper {
  border-color: #22d3ee;
  box-shadow: 0 0 15px #22d3ee;
}

.flask-icon {
  position: relative;
  z-index: 2;
  font-size: clamp(20px, 3.8vh, 26px);
  pointer-events: none;
}

.flask-name {
  font-size: clamp(10px, 1.8vh, 12px);
  font-weight: bold;
  margin-top: 4px;
  color: #cbd5e1;
}

.flask-percent {
  font-size: clamp(11px, 1.8vh, 13px);
  color: #38bdf8;
  font-weight: bold;
}

/* 🏆 リザルト画面 */
#result-screen {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  padding: 10% 5%;
  z-index: 20;
}

.result-title {
  font-size: 24px;
  color: #f87171;
  font-weight: bold;
  letter-spacing: 2px;
}

.rank-badge {
  font-size: 64px;
  color: #facc15;
  font-weight: bold;
  text-shadow: 3px 3px 0 #000;
}

.result-detail {
  font-size: 18px;
  color: #e2e8f0;
}