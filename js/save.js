/* save.js —— 双存档（阶段五实现）
 *
 * 两个 key，语义完全不同，别混：
 *   rewind.game_save   玩家可见的进度。玩家可以清、可以覆盖。
 *   rewind.meta_save   玩家不知道存在的痕迹。只增不改，永不随"新游戏"清空。
 *
 * meta_save 里存什么：
 *   playthrough    通关次数（决定标题与第二周目解锁）
 *   endings        已解锁结局 id 列表（结局收集页用）
 *   flags_history  每轮选过的关键 flag（用于变体文本）
 *   first_seen     第一次打开的日期
 *
 * 计划接口：
 *   Save.loadGame() / Save.writeGame(state) / Save.clearGame()
 *   Save.readMeta() / Save.touchMeta(patch)   // touch = 只合并不覆盖
 *   Save.unlockEnding(id)
 *   Save.playthrough()
 */

// TODO(阶段五): 实现上述接口
export const Save = {};
