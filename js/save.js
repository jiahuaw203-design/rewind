/* save.js —— 双存档
 *
 * 两个 key，语义完全不同，别混：
 *   rewind.game_save   玩家可见的进度。玩家可以清、可以覆盖。结局达成后清空。
 *   rewind.meta_save   玩家不知道存在的痕迹。只增不改，永不随"新游戏"清空。
 *
 * meta_save：
 *   playthrough    通关次数（决定标题与第二周目解锁）
 *   endings        已解锁结局 id 列表（结局收集页用）
 *   flags_history  每轮选过的关键 flag（用于变体文本 / 以后的"带子记得你"）
 *   first_seen     第一次打开的日期
 */

const GK = 'rewind.game_save';
const MK = 'rewind.meta_save';

const EMPTY_META = {
  playthrough: 0,
  endings: [],
  flags_history: [],
  first_seen: '',
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch (err) {
    // 存档被写坏（或玩家手动改坏了）也是本作的一部分，不报错，直接当没有
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // Safari 隐私模式 / 配额满 —— 不弹错，游戏照玩，只是这次记不住
    console.warn('[save] 写入失败，本轮不落盘：', err.message);
    return false;
  }
}

export const Save = {
  /* ── 玩家进度 ── */
  loadGame() {
    const g = read(GK);
    if (!g) return null;
    if (!g.current || !g.flags) return null;
    return {
      current: g.current,
      flags: g.flags || {},
      deviations: g.deviations || {},
      visited: g.visited || [],
      startedAt: g.startedAt || '',
    };
  },

  writeGame(state) {
    return write(GK, state);
  },

  clearGame() {
    try {
      localStorage.removeItem(GK);
    } catch (err) {
      /* 忽略 */
    }
  },

  /* ── 玩家不知道的那一份 ── */
  readMeta() {
    const m = read(MK);
    if (!m) return Object.assign({}, EMPTY_META);
    return {
      playthrough: Number(m.playthrough) || 0,
      endings: Array.isArray(m.endings) ? m.endings.slice() : [],
      flags_history: Array.isArray(m.flags_history) ? m.flags_history.slice() : [],
      first_seen: m.first_seen || '',
    };
  },

  /* touch = 只合并不覆盖：playthrough 取大，endings / flags_history 取并集 */
  touchMeta(patch) {
    const meta = Save.readMeta();
    if (!meta.first_seen) meta.first_seen = new Date().toISOString();
    if (typeof patch.playthrough === 'number') {
      meta.playthrough = Math.max(meta.playthrough, patch.playthrough);
    }
    if (Array.isArray(patch.endings)) {
      patch.endings.forEach((id) => {
        if (!meta.endings.includes(id)) meta.endings.push(id);
      });
    }
    if (Array.isArray(patch.flags_history)) {
      patch.flags_history.forEach((f) => {
        if (!meta.flags_history.includes(f)) meta.flags_history.push(f);
      });
    }
    write(MK, meta);
    return meta;
  },

  unlockEnding(id) {
    const meta = Save.readMeta();
    const fresh = !meta.endings.includes(id);
    Save.touchMeta({ endings: [id] });
    return fresh;
  },

  playthrough() {
    return Save.readMeta().playthrough;
  },
};
