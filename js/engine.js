/* engine.js —— 通用引擎（阶段五实现，本阶段只占位，不含任何剧情）
 *
 * 计划对外接口（阶段五按此实现，保持稳定，避免后面改剧本时要动引擎）：
 *   Engine.load()          读取 data/script.json / endings.json / meta.json
 *   Engine.start()         从 start 节点开始渲染
 *   Engine.render(nodeId)  渲染一个节点：切换场景、正文、时间码、选项
 *   Engine.choose(index)   处理点击：lock / deviation / silent / set 的判定
 *   Engine.evaluate(when)  按 endings.json 的 router 判定结局（ending 或 before_act4）
 *
 * 场景切换（已由 css/scenes.css 实现，引擎只需两步）：
 *   1) 节点 scene 与当前不同 → 给 <html> 加 class "is-wiping"，.wipe-label 写场景名
 *   2) 260ms 后写 document.documentElement.dataset.scene = node.scene
 *      560ms 后移除 class。擦除动画跑一半再换调子，切换感才像"剪切"。
 *
 * 判定顺序（务必按这个顺序，否则失控感会失控）：
 *   1) 选项是否 lock 未满足 → 不显示
 *   2) 是否命中 deviation（仅 kind=action 可命中，branch 永不命中）
 *   3) 是否 silent → 无反应，停留
 *   4) 正常跳转，写入 set 里的 flag
 *   5) 到叶节点 → evaluate('ending') 取结局
 */

export const Engine = {};

// TODO(阶段五): 实现 setScene(id, label)
