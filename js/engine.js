/* engine.js —— 通用引擎
 *
 * 接口：
 *   Engine.boot()          取三份 JSON，画标题页
 *   Engine.load()
 *   Engine.showTitle()     标题页（标题随 playthrough 变化）
 *   Engine.start(resume)   开一轮 / 续上一轮
 *   Engine.render(nodeId)  渲染节点：切场景、打正文、挂特效、出选项
 *   Engine.choose(node,c)  处理点击：lock / deviation / silent / set
 *
 * 判定顺序（务必按这个顺序，否则失控感会失控）：
 *   1) 选项 lock 未满足 → 不显示（例：第二周目的"先把电视关掉"）
 *   2) 命中 deviation（仅 kind=action 可命中，branch 永不命中）
 *   3) silent → 无反应，停在原地（剧本里目前只用在"问猫叫什么"）
 *   4) 正常跳转
 *   5) 节点带 ending → 收尾、解锁、playthrough +1、清 game_save
 *
 * 场景切换（css/scenes.css 实现动画，这里只管时序）：
 *   0ms 加 is-wiping → 260ms 换 data-scene → 560ms 移除 class。
 *   擦除跑到一半才换调子，看起来才像"剪切"，不像"渐变"。
 */

import { Save } from './save.js';
import { Effects, sleep } from './effects.js';

const SCENE_NAMES = {
  s0: '楼道',
  s1: '客厅',
  s2: '带子画面',
  s3: '厨房',
  s4: '空客厅',
  s5: '结局客厅',
  s6: '白屏',
};

const S = {
  script: null,
  endings: null,
  meta: null,
  nodes: Object.create(null),
  state: null,
  busy: false,
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

/* ── 标题按 playthrough 变化 ─────────────── */
function titleOf(n) {
  const stages = (S.meta && S.meta.title_stages) || [];
  let out = '倒带';
  stages.forEach((st) => {
    if (n >= st.playthrough) out = st.title;
  });
  if (n >= 2) out = `已倒带 ${n} 次`;
  return out;
}

/* ── 特效名归一 ─────────────────────────── */
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

/* ── 变体条件：条件之间是"且" ──────────────── */
function conditions(list) {
  return (list || []).every((cond) => {
    const num = cond.match(/^([a-z_]+)>=(\d+)$/i);
    if (num) {
      const key = num[1];
      const v = key === 'playthrough' ? Save.playthrough() : Number(S.state.counters[key] || 0);
      return v >= Number(num[2]);
    }
    if (cond.includes(':')) {
      const [k, v] = cond.split(':');
      return S.state.flags[k] === v;
    }
    return !!S.state.flags[cond];
  });
}

export const Engine = {
  async boot() {
    dom.root = document.documentElement;
    dom.title = $('title');
    dom.act = $('act');
    dom.code = $('timecode');
    dom.stage = $('stage');
    dom.choices = $('choices');
    dom.wipeLabel = $('wipeLabel');

    // 点屏幕 = 把这段字直接铺完（打字机太长会烦，这个必须有）
    dom.stage.addEventListener('click', () => {
      if (S.busy) Effects.setSkip(true);
    });

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

    const [script, endings, meta] = await Promise.all([
      grab('data/script.json'),
      grab('data/endings.json'),
      grab('data/meta.json'),
    ]);

    S.script = script;
    S.endings = endings;
    S.meta = meta;
    S.nodes = Object.create(null);
    (script.nodes || []).forEach((n) => {
      S.nodes[n.id] = n;
    });
    console.info(
      `[engine] 剧本 ${script.nodes.length} 节点 · 起始 ${script.start} · 结局 ${endings.endings.length} 个`
    );
  },

  error(err) {
    dom.stage.innerHTML = `
      <div class="error-card">
        <p class="line">读取剧本失败：${err.message}</p>
        <p class="line dim">如果你是把 index.html 直接双击打开的（file://），浏览器会拦截本地 JSON——这是预期行为。</p>
        <p class="line dim">请改用本地服务器：</p>
        <pre class="log">python -m http.server 8000
http://localhost:8000/</pre>
      </div>`;
    dom.choices.innerHTML = '';
    dom.code.textContent = '—';
  },

  showTitle() {
    const meta = Save.readMeta();
    const saved = Save.loadGame();
    const stage = S.endings.endings.length;
    S.state = null;
    dom.root.dataset.scene = 's1';
    dom.title.textContent = titleOf(meta.playthrough);
    dom.act.textContent = '';
    Effects.code(dom.code, '00:00:00');

    dom.stage.innerHTML = `
      <div class="title-card">
        <h1 class="big-title">${titleOf(meta.playthrough)}</h1>
        <p class="line dim">1997 夏 · 家用录像</p>
        <p class="line">一盘没有标签的带子。</p>
      </div>`;

    dom.choices.innerHTML = '';
    const mk = (label, fn, fx) => {
      const b = document.createElement('button');
      b.className = 'choice';
      const s = document.createElement('span');
      s.textContent = label;
      if (fx) s.className = 'fx-' + fx;
      b.appendChild(s);
      b.addEventListener('click', fn);
      dom.choices.appendChild(b);
    };

    mk('播放', () => Engine.start(false));
    if (saved) mk('继续播放', () => Engine.start(true));
    mk(`已播放：${meta.endings.length} / ${stage}`, () => Engine.showCollection());

    if (meta.playthrough >= 1 && S.meta.meta_notes) {
      const p = document.createElement('p');
      p.className = 'line note-meta fx-blood';
      p.textContent = S.meta.meta_notes.unknown_handwriting;
      dom.stage.appendChild(p);
    }
  },

  start(resume) {
    const saved = resume ? Save.loadGame() : null;
    S.state = saved || {
      current: S.script.start,
      flags: {},
      deviations: {},
      visited: [],
      counters: {},
      granted: {},
      startedAt: new Date().toISOString(),
    };
    if (!S.state.counters) S.state.counters = {};
    if (!S.state.granted) S.state.granted = {};

    // 第二周目解锁：playthrough ≥1 时，"先把电视关掉"这个选项才存在。
    // 这些 flag 只代表"选项存在"，不写进 flags_history（否则历史会被污染）
    S.state.granted = S.state.granted || {};
    const unlocks = (S.meta.unlocks || []).filter((u) => Save.playthrough() >= u.playthrough);
    unlocks.forEach((u) => {
      S.state.granted[u.flag] = true;
    });

    Engine.render(S.state.current);
  },

  async render(id) {
    const node = S.nodes[id];
    if (!node) {
      console.error('[engine] 找不到节点：', id);
      return;
    }

    if (S.phase !== 'playing') S.phase = 'playing';
    S.state.current = id;
    if (!S.state.visited.includes(id)) S.state.visited.push(id);
    (node.set || []).forEach((f) => {
      S.state.flags[f] = true;
    });
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
    Effects.code(dom.code, node.code || '00:00:00', { roll: fx.flash });

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

    const lines = node.text || [];
    for (const t of lines) {
      const p = document.createElement('p');
      p.className = 'line';
      block.appendChild(p);
      await Effects.type(p, t, {
        speed: fx.type ? 30 : 20,
        dup: fx.shake ? 0.05 : 0,
      });
      if (fx.eaten) Effects.eat(p, 2);
    }

    // 跨周目变体：同一节点，第二轮多一句只有"被录进去过的人"才看到的话
    (S.meta.variants || []).forEach((v) => {
      if (v.node !== id || !conditions(v.if)) return;
      const p = document.createElement('p');
      p.className = 'line variant';
      p.textContent = v.text;
      block.appendChild(p);
    });

    if (fx.blood) Effects.blood(block);
    if (fx.shake) block.querySelectorAll('.line').forEach((l) => l.classList.add('fx-shake'));

    // ── 结局节点：收尾句 → 解锁 → 清档 → 收尾卡 ──
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
      // 标题在这一刻就该变了：第一轮结束时，屏幕顶端从"倒带"变成"请勿倒带"
      dom.title.textContent = titleOf(Save.playthrough());
      S.busy = false;
      Engine.endingCard(node, fresh);
      return;
    }

    // ── 选项 ──
    const usable = (node.choices || []).filter(
      (c) => !c.lock || S.state.flags[c.lock] || (S.state.granted && S.state.granted[c.lock])
    );
    usable.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.style.animationDelay = i * 45 + 'ms';
      const s = document.createElement('span');
      s.textContent = c.label;
      if (c.label_effect === 'blood') s.classList.add('fx-blood');
      if (c.label_effect === 'eaten') s.classList.add('fx-eaten');
      if (c.label_effect === 'shake') s.classList.add('fx-shake');
      b.appendChild(s);
      b.addEventListener('click', () => Engine.choose(node, c));
      dom.choices.appendChild(b);
    });

    S.busy = false;
  },

  choose(node, choice) {
    if (S.busy) return;

    // deviation：只有 action 会被错位，branch 永不被改写（设计纪律第一条）
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
    const stage = S.endings.endings.length;

    const card = document.createElement('div');
    card.className = 'ending-card';
    card.innerHTML = `
      <p class="ending-kicker">— 结局 ${info.id || ''} · ${info.title || ''} —</p>
      <p class="line">第 ${meta.playthrough} 次播放结束${fresh ? '' : '（这一集你放过了）'}。</p>
      <p class="line dim">${S.endings.collection_ui.counter.replace('{n}', meta.endings.length)}</p>`;

    dom.choices.innerHTML = '';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = label;
      b.addEventListener('click', fn);
      dom.choices.appendChild(b);
    };
    mk('再放一次', () => {
      Engine.showTitle();
    });
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

    dom.choices.innerHTML = '';
    const back = document.createElement('button');
    back.className = 'choice';
    back.textContent = '回到标题';
    back.addEventListener('click', () => Engine.showTitle());
    dom.choices.appendChild(back);
  },
};

window.Engine = Engine;
