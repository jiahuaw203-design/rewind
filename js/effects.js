/* effects.js —— 文字特效的执行层
 * 样式在 css/effects.css，这里只决定"什么时候、对哪些字"加 class。
 *
 * 使用纪律：blood ≤ 5 次，shake ≤ 4 次（全篇）。超过就不再是恐怖，是装饰。
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let skipping = false; // 玩家点了屏幕 → 当前这段字直接铺完

export const Effects = {
  setSkip(v) {
    skipping = !!v;
  },

  /* 逐字插入。dup > 0 时偶发重复一个字（信号不稳的那种重复，如"咚咚咚咚"）。 */
  async type(el, text, opts = {}) {
    const speed = opts.speed ?? 24;
    const dup = opts.dup ?? 0;

    if (skipping) {
      el.textContent = text;
      return;
    }

    el.classList.add('fx-type');
    el.textContent = '';

    let out = '';
    for (const ch of text) {
      if (skipping) break;
      out += ch;
      const isPunct = '，。、：；？！—…'.includes(ch);
      if (dup > 0 && !isPunct && Math.random() < dup) {
        el.textContent = out + ch; // 重复那一格
        await sleep(speed * 1.6);
      }
      el.textContent = out;
      await sleep(speed);
    }

    el.textContent = text;
    el.classList.remove('fx-type');
  },

  /* 被吃掉的字：随机挑 n 个非空白字符，渐隐只留浅痕 */
  eat(el, n = 2) {
    const txt = el.textContent || '';
    const idx = [];
    for (let i = 0; i < txt.length; i++) {
      if (!/\s/.test(txt[i]) && !'，。、：；！？'.includes(txt[i])) idx.push(i);
    }
    if (!idx.length) return;

    const picked = new Set();
    while (picked.size < Math.min(n, idx.length)) {
      picked.add(idx[Math.floor(Math.random() * idx.length)]);
    }

    el.textContent = '';
    for (let i = 0; i < txt.length; i++) {
      if (picked.has(i)) {
        const s = document.createElement('span');
        s.className = 'fx-eaten';
        s.textContent = txt[i];
        el.appendChild(s);
      } else {
        el.appendChild(document.createTextNode(txt[i]));
      }
    }
  },

  /* 灰度 → 干掉的红，0.8s */
  blood(el) {
    if (el) el.classList.add('fx-blood');
  },

  /* 单字横向抖，幅度极小 */
  shake(el) {
    if (el) el.classList.add('fx-shake');
  },

  /* 全屏白噪，0.25s，用于幕间转场 */
  flash() {
    const d = document.createElement('div');
    d.className = 'fx-flash';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 300);
  },

  /* 时间码：直接换是"跳"，roll = 惯性滚一下 */
  code(el, value, opts = {}) {
    if (!el) return;
    if (opts.roll) {
      el.classList.add('rolling');
      el.style.transform = 'translateY(-6px)';
      el.style.opacity = '0.4';
      setTimeout(() => {
        el.textContent = value;
        el.style.transform = '';
        el.style.opacity = '';
        setTimeout(() => el.classList.remove('rolling'), 200);
      }, 160);
    } else {
      el.textContent = value;
    }
  },
};

export { sleep };
