/* effects.js —— 文字特效的执行层（阶段五实现）
 * 样式已在 css/effects.css 定义，这里只负责"什么时候、对哪些字"加 class。
 *
 * 计划接口：
 *   Effects.type(el, text, opts)     逐字插入，可设置偶发重复某字（咚咚咚咚）
 *   Effects.blood(el)                灰度→血色，0.8s
 *   Effects.shake(el)                抖动
 *   Effects.eat(el)                  吃掉指定字符（保留浅痕）
 *   Effects.flash()                  全屏雪花 0.25s，用于幕间转场
 *   Effects.code(el, "00:07:20", {roll:true})   时间码变化，roll=惯性滚动
 *
 * 使用纪律：blood ≤ 5 次，shake ≤ 4 次（全篇）。超过就不再是恐怖，是装饰。
 */

// TODO(阶段五): 实现上述六个函数
export const Effects = {};
