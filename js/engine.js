/* engine.js —— 通用引擎（v0.9：线索本 / 紧张度 / 探索次数 / 路由 / 限时选项）
 *
 * 数据驱动，四份 JSON：
 *   data/script.json   节点（正文、选项、旗标、线索、路由、结局）
 *   data/endings.json  结局的名字与收集页文案
 *   data/meta.json     跨周目规则（标题变化、第二周目解锁、变体文本）
 *   data/clues.json    线索 id → 中文描述
 *
 * 进入节点的处理顺序（顺序错了，失控感会失控）：
 *   1) route 判定：按顺序看 [{when, next}]，先命中先跳走（例：翻完三个摊 → 强制出门）
 *   2) 写 set / clue / tension / spend
 *   3) 切场景 → 打正文（含条件文本）→ 挂特效
 *   4) 出选项：requires 不满足的**不渲染**；requires + grey 的渲染成灰色不可点
 *   5) 节点带 ending → 收尾血字 → 解锁 → playthrough +1 → 清 game_save
 *
 * 选项判定顺序：
 *   1) lock 未满足（且没有 grey）→ 不渲染
 *   2) requires 不满足（且没有 grey）→ 不渲染
 *   3) 命中 deviation（仅 kind=action）→ 改跳 target（只此一次）
 *   4) 正常跳转
 */

import { Save } from './save.js';
import { Effects, sleep } from './effects.js';

const SCENE_NAMES = {
  s0: '楼道',
  s1: '阿磊的客厅',
  s2: '带子画面',
  s3: '厨房',
  s4: '空客厅',
  s5: '结局客厅',
  s6: '白屏',
  s7: '旧货市场',
  s8: '小饭馆',
};

const S = {
  script: null,
  endings: null,
  meta: null,
  clueText: {},
  nodes: Object.create(null),
  state: null,
  busy: false,
  timer: null,
  phase: 'boot',
};

const dom = {};
const $ = (id) => document.getElementById(id);

/* ── 场景切换 ───────────────────────────── */
function setScene(id) {
  if (!id || dom.root.dataset.scene === id) return sleep(0);
  return new Promise((resolve) => {
    dom.wipeLabel.textContent = SCENE_NAMES[id] || '';
    dom.root.classList.add('is-wiping');
    setTimeout(() => {
      dom.root.dataset.scene = id;
    }, 260);
    setTimeout(() => {
      dom.root.classList.remove('is-wiping');
      resolve();
    }, 560);
  });
}

function titleOf(n) {
  const stages = (S.meta && S.meta.title_stages) || [];
  let out = '倒带';
  stages.forEach((st) => {
    if (n >= st.playthrough) out = st.title;
  });
  if (n >= 2) out = `已倒带 ${n} 次`;
  return out;
}

function FX(node) {
  const raw = node.effect;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return {
    type: list.includes('type'),
    blood: list.includes('blood'),
    shake: list.includes('shake'),
    eaten: list.includes('eaten'),
    flash: list.includes('flash'),
  };
}

/* ── 条件求值 ────────────────────────────
   支持：flag / !flag / clue:线索id / clues>=3 / tension>=6 / flips<=0 / topics==2
   多个条件之间是"且"。 */
function counterOf(name) {
  if (name === 'clues') return (S.state.clues || []).length;
  if (name === 'playthrough') return Save.playthrough();
  return Number((S.state.counters || {})[name] || 0);
}

function test(cond) {
  if (!cond) return true;
  const c = String(cond).trim();

  if (c.startsWith('!')) return !S.state.flags[c.slice(1)];

  if (c.startsWith('clue:')) return (S.state.clues || []).includes(c.slice(5));

  const num = c.match(/^([a-z_]+)\s*(>=|<=|==|>|<)\s*(\d+)$/i);
  if (num) {
    const left = counterOf(num[1]);
    const right = Number(num[3]);
    switch (num[2]) {
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '<': return left < right;
      case '==': return left === right;
      default: return false;
    }
  }

  return !!S.state.flags[c];
}

function cond(list) {
  return (list || []).every(test);
}

/* ── 线索本 ─────────────────────────────── */
function noteClue(ids) {
  if (!ids || !ids.length) return;
  S.state.clues = S.state.clues || [];
  const fresh = [];
  ids.forEach((id) => {
    if (!S.state.clues.includes(id)) {
      S.state.clues.push(id);
      fresh.push(id);
    }
  });
  if (fresh.length) {
    dom.noteBtn.classList.add('has-new');
    setTimeout(() => dom.noteBtn.classList.remove('has-new'), 2200);
    if (dom.notePanel.classList.contains('open')) drawNotebook();
  }
}

function drawNotebook() {
  const list = S.state.clues || [];
  dom.noteList.innerHTML = '';
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'note-empty';
    p.textContent = '还没有记下什么。';
    dom.noteList.appendChild(p);
    return;
  }
  list.forEach((id) => {
    const p = document.createElement('p');
    p.className = 'note-item';
    p.textContent = S.clueText[id] || id;
    dom.noteList.appendChild(p);
  });
}

/* ── 主对象 ─────────────────────────────── */
export const Engine = {
  async boot() {
    dom.root = document.documentElement;
    dom.title = $('title');
    dom.act = $('act');
    dom.code = $('timecode');
    dom.stage = $('stage');
    dom.choices = $('choices');
    dom.wipeLabel = $('wipeLabel');
    dom.noteBtn = $('noteBtn');
    dom.notePanel = $('notePanel');
    dom.noteList = $('noteList');
    dom.timerBar = $('timerBar');

    dom.stage.addEventListener('click', () => {
      if (S.busy) Effects.setSkip(true);
    });

    dom.noteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.notePanel.classList.toggle('open');
      if (dom.notePanel.classList.contains('open')) drawNotebook();
    });
    dom.notePanel.addEventListener('click', (e) => e.stopPropagation());

    try {
      await Engine.load();
    } catch (err) {
      Engine.error(err);
      return;
    }
    Engine.showTitle();
  },

  async load() {
    const grab = (path) =>
      fetch(path, { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
        return r.json();
      });

    const [script, endings, meta, clues] = await Promise.all([
      grab('data/script.json'),
      grab('data/endings.json'),
      grab('data/meta.json'),
      grab('data/clues.json'),
    ]);

    S.script = script;
    S.endings = endings;
    S.meta = meta;
    S.clueText = (clues && clues.clues) || {};
    S.nodes = Object.create(null);
    (script.nodes || []).forEach((n) => {
      S.nodes[n.id] = n;
    });
    console.info(
      `[engine] 剧本 ${script.nodes.length} 节点 · 起始 ${script.start} · 结局 ${endings.endings.length} 个 · 线索 ${Object.keys(S.clueText).length} 条`
    );
  },

  error(err) {
    dom.stage.innerHTML = `
      <div class="error-card">
        <p class="line">读取剧本失败：${err.message}</p>
        <p class="line dim">如果是双击打开的（file://），浏览器会拦截本地 JSON——这是预期行为。</p>
        <pre class="log">python -m http.server 8230
http://localhost:8230/</pre>
      </div>`;
    dom.choices.innerHTML = '';
    dom.code.textContent = '—';
  },

  newState() {
    const init = S.script.init || {};
    return {
      current: S.script.start,
      flags: Object.assign({}, init.flags || {}),
      counters: Object.assign({}, init.counters || {}),
      clues: (init.clues || []).slice(),
      deviations: {},
      visited: [],
      granted: {},
      startedAt: new Date().toISOString(),
    };
  },

  normalize(state) {
    state.flags = state.flags || {};
    state.counters = state.counters || {};
    state.clues = Array.isArray(state.clues) ? state.clues : [];
    state.deviations = state.deviations || {};
    state.visited = state.visited || [];
    state.granted = state.granted || {};
    return state;
  },

  showTitle() {
    const meta = Save.readMeta();
    const saved = Save.loadGame();
    const total = S.endings.endings.length;
    S.state = null;
    clearTimeout(S.timer);
    dom.root.dataset.scene = 's1';
    dom.title.textContent = titleOf(meta.playthrough);
    dom.act.textContent = '';
    dom.timerBar.classList.remove('on');
    Effects.code(dom.code, '—');
    dom.notePanel.classList.remove('open');
    dom.noteBtn.style.display = 'none';

    dom.stage.innerHTML = `
      <div class="title-card">
        <h1 class="big-title">${titleOf(meta.playthrough)}</h1>
        <p class="line dim">1997 夏 · 家用录像</p>
        <p class="line">一盘没有标签的带子。</p>
      </div>`;

    dom.choices.innerHTML = '';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = label;
      b.addEventListener('click', fn);
      dom.choices.appendChild(b);
    };

    mk('播放', () => Engine.start(false));
    if (saved) mk('继续播放', () => Engine.start(true));
    mk(`已播放：${meta.endings.length} / ${total}`, () => Engine.showCollection());

    if (meta.playthrough >= 1 && S.meta.meta_notes) {
      const p = document.createElement('p');
      p.className = 'line note-meta fx-blood';
      p.textContent = S.meta.meta_notes.unknown_handwriting;
      dom.stage.appendChild(p);
    }
  },

  start(resume) {
    const saved = resume ? Save.loadGame() : null;
    S.state = saved ? Engine.normalize(saved) : Engine.newState();

    const unlocks = (S.meta.unlocks || []).filter((u) => Save.playthrough() >= u.playthrough);
    unlocks.forEach((u) => {
      S.state.granted[u.flag] = true;
    });

    dom.noteBtn.style.display = 'flex';
    Engine.render(S.state.current);
  },

  /* ── 渲染一个节点 ── */
  async render(id) {
    clearTimeout(S.timer);
    dom.timerBar.classList.remove('on');

    // 特殊跳转：#title / #collection
    if (id === '#title') {
      Engine.showTitle();
      return;
    }
    if (id === '#collection') {
      Engine.showCollection();
      return;
    }

    const node = S.nodes[id];
    if (!node) {
      console.error('[engine] 找不到节点：', id);
      return;
    }

    // 1) 路由：先命中先跳，不渲染本节点
    if (Array.isArray(node.route)) {
      for (const r of node.route) {
        if (cond(r.when)) {
          Engine.render(r.next);
          return;
        }
      }
    }

    S.state.current = id;
    if (!S.state.visited.includes(id)) S.state.visited.push(id);

    // 2) 副作用
    (node.set || []).forEach((f) => {
      S.state.flags[f] = true;
    });
    if (Array.isArray(node.clue)) noteClue(node.clue);
    if (typeof node.tension === 'number') {
      S.state.counters.tension = Number(S.state.counters.tension || 0) + node.tension;
    }
    if (node.spend && typeof node.spend === 'object') {
      Object.keys(node.spend).forEach((k) => {
        S.state.counters[k] = Number(S.state.counters[k] || 0) + node.spend[k];
      });
    }
    Save.writeGame(S.state);

    S.busy = true;
    Effects.setSkip(false);
    dom.act.textContent = node.act || '';
    dom.title.textContent = titleOf(Save.playthrough());

    const fx = FX(node);
    await setScene(node.scene);
    if (fx.flash) {
      Effects.flash();
      await sleep(80);
    }
    Effects.code(dom.code, node.code || '—', { roll: fx.flash });

    dom.stage.innerHTML = '';
    dom.choices.innerHTML = '';

    const block = document.createElement('div');
    block.className = 'textblock';
    dom.stage.appendChild(block);

    if (node.speaker) {
      const sp = document.createElement('p');
      sp.className = 'speaker';
      sp.textContent = node.speaker;
      block.appendChild(sp);
    }

    for (const item of node.text || []) {
      // 段内换人：{ speaker: "阿磊", say: "..." }
      if (item && typeof item === 'object' && item.speaker) {
        if (item.if && !cond(item.if)) continue;
        const sp = document.createElement('p');
        sp.className = 'speaker';
        sp.textContent = item.speaker;
        block.appendChild(sp);
        const p = document.createElement('p');
        p.className = 'line';
        block.appendChild(p);
        await Effects.type(p, item.say || '', { speed: fx.type ? 30 : 20 });
        continue;
      }
      // 条件文本：{ if: [...], say: "..." }
      if (item && typeof item === 'object') {
        if (!cond(item.if)) continue;
        const p = document.createElement('p');
        p.className = 'line cond';
        block.appendChild(p);
        await Effects.type(p, item.say || '', { speed: 22 });
        continue;
      }
      const p = document.createElement('p');
      p.className = 'line';
      block.appendChild(p);
      await Effects.type(p, item, {
        speed: fx.type ? 30 : 20,
        dup: fx.shake ? 0.05 : 0,
      });
      if (fx.eaten) Effects.eat(p, 2);
    }

    // 跨周目变体（meta.json 的 variants，按节点与条件追加一句）
    (S.meta.variants || []).forEach((v) => {
      if (v.node !== id || !cond(v.if)) return;
      const p = document.createElement('p');
      p.className = 'line variant';
      p.textContent = v.text;
      block.appendChild(p);
    });

    if (fx.blood) Effects.blood(block);
    if (fx.shake) block.querySelectorAll('.line').forEach((l) => l.classList.add('fx-shake'));

    // 5) 结局节点
    if (node.ending) {
      await sleep(360);
      Effects.setSkip(false);
      const endP = document.createElement('p');
      endP.className = 'end-text';
      dom.stage.appendChild(endP);
      await Effects.type(endP, node.end_text || '', { speed: 72 });
      Effects.blood(endP);

      if (node.end_note) {
        const n = document.createElement('p');
        n.className = 'line small';
        n.textContent = node.end_note;
        dom.stage.appendChild(n);
      }

      const fresh = Save.unlockEnding(node.ending);
      Save.touchMeta({
        playthrough: Save.playthrough() + 1,
        flags_history: Object.keys(S.state.flags).filter((f) => S.state.flags[f]),
      });
      Save.clearGame();
      dom.title.textContent = titleOf(Save.playthrough());
      S.busy = false;
      Engine.endingCard(node, fresh);
      return;
    }

    // 4) 选项
    Engine.buildChoices(node);
    S.busy = false;
  },

  buildChoices(node) {
    const all = node.choices || [];
    const usable = [];

    all.forEach((c) => {
      const lockOk = !c.lock || S.state.flags[c.lock] || S.state.granted[c.lock];
      const reqOk = cond(c.requires);
      // lock 是"还没解锁的功能"，永远不显示；requires 允许用 grey 显示成灰
      if (!lockOk) return;
      const grey = c.grey && !reqOk;
      if (!reqOk && !grey) return;
      usable.push({ c, grey });
    });

    usable.forEach(({ c, grey }, i) => {
      const b = document.createElement('button');
      b.className = 'choice' + (grey ? ' choice-grey' : '');
      b.style.animationDelay = 0.25 + i * 0.12 + 's';
      const s = document.createElement('span');
      s.textContent = c.label;
      if (!grey && c.label_effect === 'blood') s.classList.add('fx-blood');
      if (!grey && c.label_effect === 'eaten') s.classList.add('fx-eaten');
      if (!grey && c.label_effect === 'shake') s.classList.add('fx-shake');
      b.appendChild(s);
      if (grey) {
        b.disabled = true;
      } else {
        b.addEventListener('click', () => Engine.choose(node, c));
      }
      dom.choices.appendChild(b);
    });

    // 紧张度 ≥ 6：选项轻微抖
    if (Number(S.state.counters.tension || 0) >= 6) {
      dom.choices.classList.add('tense');
    } else {
      dom.choices.classList.remove('tense');
    }

    // 限时选项
    if (node.time_limit && usable.some((u) => !u.grey)) {
      Engine.startTimer(node);
    }
  },

  startTimer(node) {
    const total = Number(node.time_limit) * 1000;
    dom.timerBar.classList.add('on');
    dom.timerBar.style.transition = 'none';
    dom.timerBar.style.width = '100%';
    void dom.timerBar.offsetWidth;
    dom.timerBar.style.transition = `width ${total}ms linear`;
    dom.timerBar.style.width = '0%';

    S.timer = setTimeout(() => {
      dom.timerBar.classList.remove('on');
      Engine.render(node.timeout || node.choices[0].next);
    }, total);
  },

  choose(node, choice) {
    if (S.busy) return;
    clearTimeout(S.timer);
    dom.timerBar.classList.remove('on');

    let next = choice.next;
    const dv = node.deviation;
    if (dv && dv.mode === 'swap' && choice.kind === 'action') {
      if (!dv.once || !S.state.deviations[node.id]) {
        S.state.deviations[node.id] = true;
        if (dv.target) next = dv.target;
      }
    }

    S.busy = true;
    Engine.render(next);
  },

  endingCard(node, fresh) {
    const info = S.endings.endings.find((e) => e.id === node.ending) || {};
    const meta = Save.readMeta();
    const total = S.endings.endings.length;

    const card = document.createElement('div');
    card.className = 'ending-card';
    card.innerHTML = `
      <p class="ending-kicker">— 结局 ${info.id || ''} · ${info.title || ''} —</p>
      <p class="line">第 ${meta.playthrough} 次播放结束${fresh ? '' : '（这一集你放过了）'}。</p>
      <p class="line dim">${S.endings.collection_ui.counter.replace('{n}', meta.endings.length)}</p>`;

    dom.choices.innerHTML = '';
    dom.noteBtn.style.display = 'none';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = label;
      b.addEventListener('click', fn);
      dom.choices.appendChild(b);
    };
    mk('再放一次', () => Engine.showTitle());
    mk('看已播放', () => Engine.showCollection());

    dom.stage.appendChild(card);
  },

  showCollection() {
    const list = S.endings.endings;
    const meta = Save.readMeta();
    const unlocked = new Set(meta.endings);

    dom.stage.innerHTML = `
      <div class="collection">
        <h2 class="collection-title">${S.endings.collection_ui.counter.replace('{n}', unlocked.size)}</h2>
        <ul class="collection-list" id="collList"></ul>
        <p class="line small dim">没有播放过的，只剩下一个位置。</p>
      </div>`;
    dom.choices.innerHTML = '';
    dom.noteBtn.style.display = 'none';
    dom.timerBar.classList.remove('on');

    const ul = $('collList');
    list.forEach((e) => {
      const li = document.createElement('li');
      const on = unlocked.has(e.id);
      li.className = 'collection-item' + (on ? '' : ' locked');
      const slot = document.createElement('span');
      slot.className = 'slot';
      slot.textContent = e.slot;
      const title = document.createElement('span');
      title.className = 'slot-title';
      if (on) {
        title.textContent = `《${e.title}》`;
      } else {
        title.className += ' fx-eaten';
        title.textContent = e.hint || '未播放';
      }
      li.appendChild(slot);
      li.appendChild(title);
      ul.appendChild(li);
    });

    const back = document.createElement('button');
    back.className = 'choice';
    back.textContent = '回到标题';
    back.addEventListener('click', () => Engine.showTitle());
    dom.choices.appendChild(back);
  },

  /* 调试用：在浏览器控制台里看当前状态 */
  debug() {
    return {
      current: S.state && S.state.current,
      flags: S.state && S.state.flags,
      counters: S.state && S.state.counters,
      clues: S.state && S.state.clues,
    };
  },
};

window.Engine = Engine;
