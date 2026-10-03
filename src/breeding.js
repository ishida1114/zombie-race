// ==========================================
// 🧬 配合（ブリーディング）管理モジュール
// ==========================================

const BreedingManager = {
  // 初期の上限キャップ（200）と交配による上限拡張量（+20）
  BASE_CAP: 200,
  CAP_BONUS_PER_GEN: 20,

  /**
   * 2匹の親ゾンビから新しい子ゾンビを交配生成する
   * @param {Object} parentA - 親ゾンビ1
   * @param {Object} parentB - 親ゾンビ2
   * @returns {Object} 新しい子ゾンビデータ
   */
  breed(parentA, parentB) {
    // 親の世代（generation）の大きい方 + 1 を子の世代とする
    const genA = parentA.generation || 1;
    const genB = parentB.generation || 1;
    const childGen = Math.max(genA, genB) + 1;

    // ステータス上限キャップ（配合を重ねるごとに+20ずつ解放）
    const childCap = this.BASE_CAP + (childGen - 1) * this.CAP_BONUS_PER_GEN;

    // 親のステータス平均 ＋ 遺伝揺らぎ（-5 ～ +10）
    const calcInheritedStat = (statA, statB) => {
      const avg = Math.floor((statA + statB) / 2);
      const mutation = Math.floor(Math.random() * 16) - 5; // 微変異
      return Math.min(childCap, Math.max(20, avg + mutation));
    };

    // 脚質のランダム継承
    const styles = [parentA.style, parentB.style, '逃げ', '先行', '差し', '追込'];
    const inheritedStyle = styles[Math.floor(Math.random() * styles.length)];

    // 見た目のランダム継承
    const inheritedVidIdx = Math.random() < 0.5 ? parentA.videoIndex : parentB.videoIndex;

    const childZombie = {
      name: `${parentA.name.substring(0, 2)}${parentB.name.substring(parentB.name.length - 2)}ジュニア`,
      generation: childGen,
      statCap: childCap, // この個体の能力上限
      style: inheritedStyle,
      speed: calcInheritedStat(parentA.speed, parentB.speed),
      power: calcInheritedStat(parentA.power, parentB.power),
      stamina: calcInheritedStat(parentA.stamina, parentB.stamina),
      mentality: calcInheritedStat(parentA.mentality, parentB.mentality),
      magic: calcInheritedStat(parentA.magic, parentB.magic),
      colorInfo: parentA.colorInfo || { name: '標準', filter: 'none' },
      sizeInfo: parentA.sizeInfo || { name: '標準', scaleX: 1.0, scaleY: 1.0 },
      remainingTurns: 5,
      matches: 0,
      wins: 0,
      videoIndex: inheritedVidIdx
    };

    return childZombie;
  },

  /**
   * 育成コマンド等で上限（キャップ）に達しているかチェックする
   */
  isCapReached(zombie, currentVal) {
    const cap = zombie.statCap || this.BASE_CAP;
    return currentVal >= cap;
  }
};