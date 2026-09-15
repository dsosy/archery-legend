/* ============================================================
   小游戏版 canvas 界面层（阶段 1）
   小游戏没有 DOM，所以 HUD / 菜单 / 升级选卡 / 暂停 / 结算 全部画在 canvas 上，
   并自己处理点击命中。它覆盖掉游戏核心里的网页版界面函数，逻辑一行不动。
   ============================================================ */
(function () {
  var CV = __WXGAME__.canvas;
  var CTX = CV.getContext("2d");
  var H = {
    screen: "menu", hits: [], toasts: [], t: 0,
    mode: "", cards: [], attrCards: [], p: null, result: null, bonus: 0,
    touchSticks: {}
  };
  var COL = {
    gold: "#ffd479", gold2: "#ffb02e", txt: "#e9f0ff", dim: "#93a4c4",
    line: "#2a3854", panel: "#101a2ccc", panel2: "#0a1120ee"
  };

  /* ---------------- 绘制小工具 ---------------- */
  function rr(x, y, w, h, r) {
    var rad = Math.min(r === undefined ? 10 : r, w / 2, h / 2);
    CTX.beginPath();
    CTX.moveTo(x + rad, y);
    CTX.arcTo(x + w, y, x + w, y + h, rad);
    CTX.arcTo(x + w, y + h, x, y + h, rad);
    CTX.arcTo(x, y + h, x, y, rad);
    CTX.arcTo(x, y, x + w, y, rad);
    CTX.closePath();
  }
  function tex(s, x, y, size, color, align, bold) {
    CTX.font = (bold ? "900 " : "700 ") + Math.round(size) + "px system-ui,'PingFang SC',sans-serif";
    CTX.fillStyle = color || COL.txt;
    CTX.textAlign = align || "left";
    CTX.textBaseline = "middle";
    CTX.fillText(s, x, y);
  }
  function wrapLines(str, size, maxW) {
    CTX.font = "700 " + Math.round(size) + "px system-ui,'PingFang SC',sans-serif";
    var out = [], line = "";
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (CTX.measureText(line + c).width > maxW && line) { out.push(line); line = c; }
      else line += c;
    }
    if (line) out.push(line);
    return out;
  }
  function panel(x, y, w, h, r) {
    rr(x, y, w, h, r);
    CTX.fillStyle = COL.panel2; CTX.fill();
    CTX.strokeStyle = "#2c3b5c"; CTX.lineWidth = 1.5; CTX.stroke();
  }
  function hit(x, y, w, h, fn, r) {
    H.hits.push({ x: x, y: y, w: w, h: h, r: r, fn: fn });
  }
  function button(label, x, y, w, h, opts) {
    opts = opts || {};
    var g = CTX.createLinearGradient(x, y, x, y + h);
    if (opts.kind === "primary") { g.addColorStop(0, "#ffca5c"); g.addColorStop(1, "#e08a12"); }
    else if (opts.kind === "danger") { g.addColorStop(0, "#7a2733"); g.addColorStop(1, "#4a1620"); }
    else { g.addColorStop(0, "#28395c"); g.addColorStop(1, "#161f34"); }
    rr(x, y, w, h, 14); CTX.fillStyle = g; CTX.fill();
    CTX.strokeStyle = opts.kind === "primary" ? "#ffd479aa" : "#3a4f78";
    CTX.lineWidth = 1.5; CTX.stroke();
    tex(label, x + w / 2, y + h / 2, opts.size || 15, opts.kind === "primary" ? "#20160a" : COL.txt, "center", true);
    if (opts.onPick) hit(x, y, w, h, opts.onPick, 14);
    return { x: x, y: y, w: w, h: h };
  }
  function bar(x, y, w, h, pct, c1, c2) {
    rr(x, y, w, h, h / 2);
    CTX.fillStyle = "#0d1424cc"; CTX.fill();
    CTX.strokeStyle = "#33507e"; CTX.lineWidth = 1.5; CTX.stroke();
    var pw = Math.max(0, Math.min(1, pct)) * (w - 3);
    if (pw > 1) {
      var g = CTX.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      rr(x + 1.5, y + 1.5, pw, h - 3, (h - 3) / 2);
      CTX.fillStyle = g; CTX.fill();
    }
  }
  function uiToast(msg, ms) {
    H.toasts.push({ msg: String(msg), t: (ms || 1400) / 1000 });
    if (H.toasts.length > 4) H.toasts.shift();
  }
  function fmtNum(n) { return n >= 10000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n)); }

  /* ---------------- HUD ---------------- */
  function drawHud() {
    var p = players[0];
    if (!p) return;
    var S = V.scale, top = (__WXGAME__.safeTop || 0) + 6 * S;
    var x = 10 * S, w = Math.min(V.w * 0.44, 230 * S);
    var hpPct = Math.max(0, p.hp / p.maxHp);
    bar(x, top, w, 16 * S, hpPct, "#ff8a9a", "#e0243f");
    if (p.shield > 0) {
      var sp = Math.min(1, p.shield / p.maxHp);
      rr(x + 1.5, top + 1.5, (w - 3) * sp, 16 * S - 3, 6 * S);
      CTX.fillStyle = "#7fd8ffcc"; CTX.fill();
    }
    tex(Math.ceil(p.hp) + " / " + p.maxHp + (p.shield > 0 ? "  🛡" + Math.ceil(p.shield) : ""),
      x + w / 2, top + 8 * S, 11 * S, "#ffffff", "center", true);
    var xpPct = ((p.exp || 0) / expNeed(p.level));
    bar(x, top + 19 * S, w, 9 * S, xpPct, "#8dffb0", "#22a85a");
    var tag = (G.twoP ? pName(p) : "P1") + " · Lv." + p.level;
    tex(tag, x, top + 36 * S, 11 * S, COL.gold, "left", true);
    // 三系属性
    var ax = x + CTX.measureText(tag).width + 6 * S;
    for (var i = 0; i < ATTR_ORDER.length; i++) {
      var k = ATTR_ORDER[i], a = ATTRS[k];
      tex(a.icon + attrLv(p, k), ax, top + 36 * S, 11 * S, a.color, "left", true);
      ax += CTX.measureText(a.icon + attrLv(p, k)).width + 8 * S;
    }
    // 中间：关卡 + 房间
    var mid = G.endless ? (G.challenge && G.challenge.daily ? "今日挑战 · 第 " + G.endlessWave + " 波" : "无尽 · 第 " + G.endlessWave + " 波")
      : chapterName(G.chapter) + " " + G.chapter + "-" + G.level;
    tex(mid, V.w / 2, top + 7 * S, 13 * S, COL.gold, "center", true);
    var left = 0;
    for (var ei = 0; ei < enemies.length; ei++) if (!enemies[ei].dead) left++;
    var rr2 = G.rooms[G.room] || {};
    tex("房间 " + (G.room + 1) + "/" + G.rooms.length + (G.roomClear ? " · ✅ 已清空" : (left ? " · 敌 " + left : "")) + (rr2.boss ? " · BOSS" : ""),
      V.w / 2, top + 24 * S, 10 * S, COL.dim, "center");
    // 右上：金币 + 暂停
    var coinTxt = "🪙 " + fmtNum(save.coins);
    CTX.font = "900 " + Math.round(12 * S) + "px system-ui,sans-serif";
    var cw = CTX.measureText(coinTxt).width + 16 * S;
    panel(V.w - cw - 44 * S, top, cw, 22 * S, 8 * S);
    tex(coinTxt, V.w - cw / 2 - 44 * S, top + 11 * S, 12 * S, COL.gold, "center", true);
    var pb = { x: V.w - 34 * S, y: top, w: 26 * S, h: 22 * S };
    rr(pb.x, pb.y, pb.w, pb.h, 8 * S); CTX.fillStyle = "#0d1424dd"; CTX.fill();
    CTX.strokeStyle = COL.line; CTX.lineWidth = 1.5; CTX.stroke();
    tex("⏸", pb.x + pb.w / 2, pb.y + pb.h / 2, 13 * S, COL.txt, "center");
    hit(pb.x, pb.y, pb.w, pb.h, function () { pauseGame(); }, 8 * S);

    // 技能栏
    drawSkillBar(p, 8 * S, V.h - 40 * S, "left");
    if (G.twoP && players[1]) drawSkillBar(players[1], V.w - 8 * S, V.h - 40 * S, "right");
    // 冲刺按钮
    if (p.st.dash > 0 && p.alive && !p.down) {
      var r = 36 * S, cx = V.w - r - 14 * S, cy = V.h - r - 18 * S;
      CTX.beginPath(); CTX.arc(cx, cy, r, 0, TAU);
      var g = CTX.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      g.addColorStop(0, p.dashCd > 0 ? "#2a3a4a" : "#3d8fd6");
      g.addColorStop(1, "#0d2233");
      CTX.fillStyle = g; CTX.fill();
      CTX.strokeStyle = "#6fd7ff88"; CTX.lineWidth = 2; CTX.stroke();
      tex("💨", cx, cy, 24 * S, "#dff3ff", "center");
      hit(cx - r, cy - r, r * 2, r * 2, function () { doDash(0); });
    }
    // 摇杆
    for (var si = 0; si < Input.sticks.length; si++) {
      var st = Input.sticks[si];
      if (!st || !st.active) continue;
      var R = st.maxR();
      CTX.beginPath(); CTX.arc(st.ox, st.oy, R, 0, TAU);
      CTX.fillStyle = "#ffffff12"; CTX.fill();
      CTX.strokeStyle = si === 1 ? "#8fd0ff55" : "#ffffff2e"; CTX.lineWidth = 2; CTX.stroke();
      CTX.beginPath();
      CTX.arc(st.ox + st.dx * R, st.oy + st.dy * R, 26 * S, 0, TAU);
      CTX.fillStyle = si === 1 ? "#4a9fdd99" : "#ffffff88"; CTX.fill();
      CTX.strokeStyle = "#ffffff55"; CTX.lineWidth = 2; CTX.stroke();
    }
    // P2 血条
    if (G.twoP && players[1]) {
      var q = players[1], qy = top + 52 * S;
      bar(x, qy, w, 13 * S, Math.max(0, q.hp / q.maxHp), "#8fd0ff", "#2b7fd8");
      tex(q.down ? "💀 倒下 · 通关房间后复活" : Math.ceil(q.hp) + " / " + q.maxHp, x + w / 2, qy + 6.5 * S, 10 * S, "#ffffff", "center", true);
      tex(pName(q) + " · Lv." + q.level, x, qy + 24 * S, 11 * S, "#8fd0ff", "left", true);
    }
  }
  function drawSkillBar(p, x, y, align) {
    var ids = Object.keys(p.skills);
    if (!ids.length) return;
    var S = V.scale, size = 28 * S, gap = 4 * S;
    var total = ids.length * (size + gap);
    var sx = align === "right" ? x - total : x;
    for (var i = 0; i < ids.length; i++) {
      var sk = SKILL_MAP[ids[i]]; if (!sk) continue;
      var bx = sx + i * (size + gap);
      rr(bx, y, size, size, 8 * S);
      CTX.fillStyle = "#0d1424e0"; CTX.fill();
      CTX.strokeStyle = (ATTRS[sk.attr] && ATTRS[sk.attr].color) || "#3a4f78";
      CTX.lineWidth = 1.5; CTX.stroke();
      tex(sk.icon, bx + size / 2, y + size / 2, size * 0.6, "#fff", "center");
      var n = p.skills[ids[i]];
      if (n > 1) {
        CTX.beginPath(); CTX.arc(bx + size - 5 * S, y + size - 5 * S, 8 * S, 0, TAU);
        CTX.fillStyle = COL.gold2; CTX.fill();
        tex("×" + n, bx + size - 5 * S, y + size - 4 * S, 9 * S, "#241704", "center", true);
      }
    }
  }

  /* ---------------- 主菜单 ---------------- */
  function drawMenu() {
    var S = V.scale, cx = V.w / 2;
    tex("音 帝 庙 大 冒 险", cx, V.h * 0.17, Math.min(40 * S, V.w * 0.11), COL.gold, "center", true);
    tex("YIN DI MIAO ADVENTURE", cx, V.h * 0.17 + 26 * S, 11 * S, COL.dim, "center");
    var bw = Math.min(300 * S, V.w * 0.8), bh = 46 * S, bx = cx - bw / 2, by = V.h * 0.30;
    var resume = (typeof pendingResume === "function") ? pendingResume() : null;
    if (resume) {
      button("⏸ 继续上次的对局  Lv." + resume.players[0].level, bx, by, bw, bh, {
        kind: "primary", onPick: function () { resumeRun(); }
      });
      by += bh + 10 * S;
    }
    button("▶ 继续闯关　" + chapterName(save.chapter) + " " + save.chapter + "-" + save.level, bx, by, bw, bh, {
      kind: resume ? "" : "primary", onPick: function () { startRun(save.chapter, save.level, false); }
    });
    by += bh + 10 * S;
    if (save.endlessUnlocked) {
      button("♾ 单人无尽　最高 " + (save.endlessBest || 0) + " 波", bx, by, bw, bh, {
        onPick: function () { startRun(1, 1, true, { twoP: false }); }
      });
      by += bh + 10 * S;
      button("📅 今日挑战", bx, by, bw, bh, { onPick: function () { startDaily(); } });
      by += bh + 10 * S;
    } else {
      button("♾ 无尽模式（通关第 2 章解锁）", bx, by, bw, bh, {});
      by += bh + 10 * S;
    }
    var rowY = by + 6 * S, sw = (bw - 10 * S) / 2;
    button("🎨 换皮肤", bx, rowY, sw, 38 * S, { size: 13 * S, onPick: function () { cycleSkinUI(); } });
    button(save.sound ? "🔊 音效开" : "🔇 音效关", bx + sw + 10 * S, rowY, sw, 38 * S, {
      size: 13 * S, onPick: function () { save.sound = !save.sound; persist(true); Sfx.resume(); Music._apply(); }
    });
    tex("皮肤：" + activeSkin().name, cx, rowY + 52 * S, 11 * S, COL.dim, "center");
    tex("成就 " + achievementCount() + "/" + ACHIEVEMENTS.length + "　·　版本 " + BUILD, cx, V.h - 14 * S, 10 * S, COL.dim, "center");
  }
  function cycleSkinUI() {
    var ids = Object.keys(allSkins());
    var i = ids.indexOf(save.skin || "classic");
    save.skin = ids[(i + 1) % ids.length];
    persist(true);
    toast("皮肤：" + activeSkin().name, 1200);
  }

  /* ---------------- 升级选卡 ---------------- */
  function cardLayout(n) {
    var portrait = V.h >= V.w;
    var S = V.scale;
    if (portrait) {
      var w = Math.min(V.w - 24 * S, 420 * S), h = Math.min(120 * S, (V.h * 0.66) / n), x = (V.w - w) / 2;
      return { w: w, h: h, x: x, y: V.h * 0.22, gap: 10 * S, vertical: true };
    }
    var w2 = Math.min((V.w - 40 * S) / n - 10 * S, 230 * S), h2 = Math.min(V.h * 0.62, 260 * S);
    return { w: w2, h: h2, x: (V.w - (w2 + 10 * S) * n + 10 * S) / 2, y: V.h * 0.2, gap: 10 * S, vertical: false };
  }
  function drawLevelUp() {
    var p = H.p || players[0];
    var S = V.scale, cx = V.w / 2;
    CTX.fillStyle = "#03060cd9"; CTX.fillRect(0, 0, V.w, V.h);
    tex((G.twoP ? pName(p) + " " : "") + "升 级 ！", cx, V.h * 0.1, 24 * S, COL.gold, "center", true);
    if (H.mode === "attr") {
      tex("先选属性（点数有限，集中才强）", cx, V.h * 0.1 + 24 * S, 12 * S, COL.dim, "center");
      var L = cardLayout(3), list = [];
      for (var i = 0; i < ATTR_ORDER.length; i++) list.push(ATTR_ORDER[i]);
      var pw = Math.min((V.w - 40 * S) / 3 - 8 * S, 150 * S);
      var ph = Math.min(V.h * 0.5, 200 * S);
      var px0 = (V.w - (pw + 8 * S) * 3 + 8 * S) / 2;
      for (var k = 0; k < list.length; k++) {
        (function (key, idx) {
          var a = ATTRS[key], cur = attrLv(p, key), full = cur >= ATTR_MAX;
          var bx = px0 + idx * (pw + 8 * S), by = V.h * 0.24;
          rr(bx, by, pw, ph, 14);
          CTX.fillStyle = full ? "#121826" : "#141f33"; CTX.fill();
          CTX.strokeStyle = full ? "#ffffff22" : a.color; CTX.lineWidth = 2; CTX.stroke();
          tex(a.icon, bx + pw / 2, by + 34 * S, 30 * S, "#fff", "center");
          tex(a.name, bx + pw / 2, by + 66 * S, 15 * S, full ? "#7f90ad" : a.color, "center", true);
          var lines = wrapLines(a.desc, 10 * S, pw - 16 * S);
          for (var li = 0; li < lines.length; li++) tex(lines[li], bx + 8 * S, by + 90 * S + li * 14 * S, 10 * S, COL.dim, "left");
          if (full) tex("已满级", bx + pw / 2, by + ph - 18 * S, 12 * S, "#8ea0c0", "center", true);
          else {
            tex("Lv." + cur + " → Lv." + (cur + 1), bx + pw / 2, by + ph - 30 * S, 12 * S, COL.txt, "center", true);
            tex("该系强度 ×" + attrDmgMul(p, key).toFixed(2) + " → ×" + (1 + a.dmgK * (cur + 1)).toFixed(2), bx + pw / 2, by + ph - 14 * S, 10 * S, a.color, "center");
            hit(bx, by, pw, ph, function () {
              if (!applyAttr(p, key)) return;
              Sfx.pick(); haptic(20);
              toast(ATTRS[key].icon + " " + ATTRS[key].name + " Lv." + p.attrs[key], 1200);
              H.mode = "skill"; H.cards = rollChoices(p, 3, key);
            }, 14);
          }
        })(list[k], k);
      }
      return;
    }
    var color = p.lastAttr || "red", a2 = ATTRS[color] || ATTRS.red;
    tex("获得技能 · " + a2.icon + " " + a2.name + " Lv." + attrLv(p, color) + "（×" + attrDmgMul(p, color).toFixed(2) + "）",
      cx, V.h * 0.1 + 24 * S, 12 * S, a2.color, "center");
    var lay = cardLayout(H.cards.length);
    for (var ci = 0; ci < H.cards.length; ci++) {
      (function (c, idx) {
        var cnt = p.skills[c.id] || 0;
        var cAttr = c.id === "heal" ? null : ATTRS[c.attr];
        var bx = lay.x + (lay.vertical ? 0 : idx * (lay.w + lay.gap));
        var by = lay.y + (lay.vertical ? idx * (lay.h + lay.gap) : 0);
        rr(bx, by, lay.w, lay.h, 14);
        CTX.fillStyle = "#141f33"; CTX.fill();
        CTX.strokeStyle = cAttr ? cAttr.color : "#5b7fb0"; CTX.lineWidth = 2; CTX.stroke();
        tex(c.icon, bx + 26 * S, by + lay.h * 0.28, 26 * S, "#fff", "center");
        tex(c.name + (cnt > 0 ? "  Lv." + (cnt + 1) : ""), bx + 50 * S, by + lay.h * 0.24, 15 * S, "#ffffff", "left", true);
        var eff = c.descOf ? c.descOf(cnt + 1) : c.desc;
        var lines = wrapLines(eff, 11 * S, lay.w - 60 * S);
        for (var li = 0; li < lines.length && li < 3; li++) tex(lines[li], bx + 50 * S, by + lay.h * 0.48 + li * 15 * S, 11 * S, "#b9c8e4", "left");
        tex(cnt > 0 ? "已拥有 ×" + cnt + " → 叠加为 ×" + (cnt + 1) : "获得新技能 ×1",
          bx + 14 * S, by + lay.h - 18 * S, 10.5 * S, COL.dim, "left");
        tex(c.id === "heal" ? "恢复" : (cAttr ? cAttr.icon + cAttr.name : "") + " · " + (c.r === 3 ? "传说" : c.r === 2 ? "稀有" : "普通"),
          bx + lay.w - 14 * S, by + lay.h - 18 * S, 10.5 * S, cAttr ? cAttr.color : COL.dim, "right", true);
        hit(bx, by, lay.w, lay.h, function () { pickCard(p, c); }, 14);
      })(H.cards[ci], ci);
    }
  }

  /* ---------------- 暂停 / 结算 ---------------- */
  function drawPause() {
    var S = V.scale, cx = V.w / 2;
    CTX.fillStyle = "#03060cd9"; CTX.fillRect(0, 0, V.w, V.h);
    tex("暂 停", cx, V.h * 0.18, 26 * S, COL.gold, "center", true);
    var p = players[0];
    var info = G.endless ? "无尽 第 " + G.endlessWave + " 波" : chapterName(G.chapter) + " " + G.chapter + "-" + G.level;
    tex(info + "　金币 " + G.runCoins + "　击杀 " + RUN.kills, cx, V.h * 0.18 + 28 * S, 12 * S, COL.dim, "center");
    if (p) {
      var st = p.st;
      var dps = atkOf(p) * aspdOf(p) * Math.min(st.arrows, 12) * (1 + st.crit * (st.critMul - 1));
      var lines = [
        "攻击 " + Math.round(atkOf(p)) + "　攻速 " + aspdOf(p).toFixed(2) + "　估算 DPS " + Math.round(dps),
        "每次 " + Math.min(st.arrows, 12) + " 支箭　暴击 " + Math.round(st.crit * 100) + "%　穿透 " + st.pierce,
        "武器 " + (WEAPONS[G.weapon] || WEAPONS.bow).name + " ×" + weaponMul(p).toFixed(2) + "　技能 " + Object.keys(p.skills).length + " 种"
      ];
      var pw = Math.min(V.w - 40 * S, 420 * S), phh = 20 * S * lines.length + 20 * S;
      panel(cx - pw / 2, V.h * 0.3, pw, phh, 14);
      for (var i = 0; i < lines.length; i++) tex(lines[i], cx, V.h * 0.3 + 22 * S + i * 20 * S, 12 * S, COL.txt, "center");
    }
    var bw = Math.min(300 * S, V.w * 0.8), bx = cx - bw / 2, by = V.h * 0.3 + 20 * S * 3 + 40 * S;
    button("▶ 继续", bx, by, bw, 46 * S, { kind: "primary", onPick: function () { resumeGame(); } });
    button("🔄 重开本关", bx, by + 54 * S, bw, 42 * S, { onPick: function () { startRun(G.chapter, G.level, G.endless, { twoP: G.twoP, challenge: G.challenge }); } });
    button("🏠 放弃并返回", bx, by + 104 * S, bw, 42 * S, { kind: "danger", onPick: function () { G.state = "menu"; hideOverlay(); showMenu(); } });
  }
  function drawResult() {
    var S = V.scale, cx = V.w / 2, win = H.result === "victory";
    CTX.fillStyle = "#03060ce6"; CTX.fillRect(0, 0, V.w, V.h);
    tex(win ? "通 关 ！" : "你 倒 下 了", cx, V.h * 0.16, 28 * S, win ? COL.gold : "#ff5c72", "center", true);
    var p = players[0] || {};
    var sub = G.endless ? ((G.challenge && G.challenge.daily ? "今日挑战 · " : "无尽模式 · ") + "第 " + G.endlessWave + " 波")
      : chapterName(G.chapter) + " " + G.chapter + "-" + G.level;
    tex(sub, cx, V.h * 0.16 + 28 * S, 13 * S, COL.dim, "center");
    var rows = win
      ? ["通关奖励　+" + H.bonus + " 🪙", "本局金币　+" + G.runCoins, "击杀 " + RUN.kills + "　技能 " + Object.keys(p.skills || {}).length + " 种", "用时 " + Math.floor(G.runTime) + " 秒"]
      : ["本局金币已保留　+" + G.runCoins + " 🪙", "击杀 " + RUN.kills + "　技能 " + Object.keys(p.skills || {}).length + " 种", "用时 " + Math.floor(G.runTime) + " 秒", G.endless ? "无尽最高 " + (G.twoP ? save.endlessBest2P : save.endlessBest) + " 波" : ""];
    var pw = Math.min(V.w - 40 * S, 420 * S);
    panel(cx - pw / 2, V.h * 0.28, pw, 24 * S * rows.length + 16 * S, 14);
    for (var i = 0; i < rows.length; i++) tex(rows[i], cx, V.h * 0.28 + 20 * S + i * 24 * S, 13 * S, COL.txt, "center");
    var bw = Math.min(300 * S, V.w * 0.8), bx = cx - bw / 2;
    var by = V.h * 0.28 + 24 * S * rows.length + 34 * S;
    if (win) {
      var nextLv = G.level + 1, hasNext = nextLv <= CHAPTER_MAX_LEVEL;
      button(hasNext ? "▶ 下一关 " + G.chapter + "-" + nextLv + "（继承技能）" : "▶ 进入下一章（继承技能）", bx, by, bw, 48 * S, {
        kind: "primary",
        onPick: function () {
          if (hasNext) startRun(G.chapter, nextLv, false, { twoP: G.twoP, keep: true });
          else startRun(Math.min(G.chapter + 1, CHAPTERS.length), 1, false, { twoP: G.twoP, keep: true });
        }
      });
      button("🏠 主菜单", bx, by + 56 * S, bw, 42 * S, { onPick: function () { G.state = "menu"; showMenu(); } });
    } else {
      button("🔄 再来一次", bx, by, bw, 48 * S, {
        kind: "primary",
        onPick: function () { startRun(G.chapter, G.level, G.endless, { twoP: G.twoP, challenge: G.challenge }); }
      });
      button("🏠 主菜单", bx, by + 56 * S, bw, 42 * S, { onPick: function () { G.state = "menu"; showMenu(); } });
    }
  }
  function drawTutorial() {
    var S = V.scale, cx = V.w / 2;
    CTX.fillStyle = "#03060ceb"; CTX.fillRect(0, 0, V.w, V.h);
    tex("3 秒上手", cx, V.h * 0.16, 24 * S, COL.gold, "center", true);
    var lines = [
      "1. 按住屏幕任意位置拖动 = 移动（不用点敌人）",
      "2. 角色会自动朝最近的敌人射箭，你只管走位",
      "3. 清空所有房间过关；升级时先选属性再选技能",
      "4. 阵亡只丢本局成长，金币永久保留",
      "5. 技能与属性会继承到下一关，越打越强"
    ];
    var pw = Math.min(V.w - 36 * S, 460 * S);
    panel(cx - pw / 2, V.h * 0.26, pw, 26 * S * lines.length + 20 * S, 14);
    for (var i = 0; i < lines.length; i++) {
      var ls = wrapLines(lines[i], 12 * S, pw - 28 * S);
      for (var j = 0; j < ls.length; j++) tex(ls[j], cx - pw / 2 + 14 * S, V.h * 0.26 + 22 * S + i * 26 * S + j * 15 * S, 12 * S, COL.txt, "left");
    }
    var bw = Math.min(280 * S, V.w * 0.7), bx = cx - bw / 2;
    button("👌 开始战斗", bx, V.h * 0.26 + 26 * S * lines.length + 40 * S, bw, 48 * S, {
      kind: "primary",
      onPick: function () { save.tutorialDone = true; persist(true); G.state = "playing"; H.screen = "playing"; lastT = performance.now(); hideOverlay(); }
    });
  }
  function drawToasts() {
    var S = V.scale, y = V.h * 0.22;
    for (var i = 0; i < H.toasts.length; i++) {
      var t = H.toasts[i], a = Math.min(1, t.t * 3);
      CTX.globalAlpha = a;
      CTX.font = "900 " + Math.round(13 * S) + "px system-ui,sans-serif";
      var w = CTX.measureText(t.msg).width + 26 * S;
      rr(V.w / 2 - w / 2, y + i * 34 * S, w, 28 * S, 12);
      CTX.fillStyle = "#0d1424e6"; CTX.fill();
      CTX.strokeStyle = "#ffd47966"; CTX.lineWidth = 1.5; CTX.stroke();
      tex(t.msg, V.w / 2, y + i * 34 * S + 14 * S, 13 * S, "#ffe9bd", "center", true);
      CTX.globalAlpha = 1;
    }
  }

  /* ---------------- 总绘制 ---------------- */
  function drawUI() {
    H.hits = [];
    if (H.toasts.length) {
      for (var i = H.toasts.length - 1; i >= 0; i--) {
        H.toasts[i].t -= G.dt || 0.016;
        if (H.toasts[i].t <= 0) H.toasts.splice(i, 1);
      }
    }
    if (H.screen === "playing") drawHud();
    else if (H.screen === "menu") drawMenu();
    else if (H.screen === "levelup") { drawHud(); drawLevelUp(); }
    else if (H.screen === "paused") { drawHud(); drawPause(); }
    else if (H.screen === "victory" || H.screen === "defeat") { drawResult(); }
    else if (H.screen === "tutorial") drawTutorial();
    drawToasts();
  }

  /* ---------------- 覆盖核心里的网页版界面 ---------------- */
  var _render = render;
  render = function () { _render(); drawUI(); };
  showOverlay = function () { };
  hideOverlay = function () { };
  updateHud = function () { };
  layoutSkillBar = function () { };
  layoutHud = function () { };
  toast = uiToast;   // 覆盖核心的 toast，让游戏内提示也显示在 canvas 上

  showMenu = function () { G.state = "menu"; H.screen = "menu"; };
  showPause = function () { H.screen = "paused"; };
  showVictory = function (bonus) { H.screen = "victory"; H.result = "victory"; H.bonus = bonus || 0; };
  showDefeat = function () { H.screen = "defeat"; H.result = "defeat"; };
  showTutorial = function () { G.state = "tutorial"; Input.endAll(); H.screen = "tutorial"; };

  openLevelUp = function () {
    var p = nextPendingPlayer();
    if (!p) { G.state = "playing"; H.screen = "playing"; lastT = performance.now(); hideOverlay(); return; }
    G.state = "levelup"; H.screen = "levelup"; Input.endAll(); G.lvP = p; H.p = p;
    var forced = p.pendingAttr === true;
    var wantAttr = forced || (p.attrTicks || 0) >= ATTR_EVERY || !p.lastAttr;
    if (wantAttr && anyAttrLeft(p)) { H.mode = "attr"; H.attrCards = ATTR_ORDER.slice(); }
    else { H.mode = "skill"; H.cards = rollChoices(p, 3, p.lastAttr || "red"); }
  };
  // 选完技能后核心会调用 openLevelUp 继续处理下一个玩家，这里补上状态同步
  var _pickCard = pickCard;
  pickCard = function (p, c) {
    _pickCard(p, c);
    H.mode = ""; H.cards = [];
    if (G.state === "playing") H.screen = "playing";
  };
  // 开局 / 继续时同步界面状态
  var _startRun = startRun;
  startRun = function (chapter, level, endless, opts) {
    _startRun(chapter, level, endless, opts);
    H.screen = (G.state === "tutorial") ? "tutorial" : "playing";
    H.result = null; H.mode = ""; H.cards = []; H.toasts = [];
  };
  var _resumeGame = resumeGame;
  resumeGame = function () { _resumeGame(); H.screen = "playing"; };

  /* ---------------- 触摸 ---------------- */
  function pointOf(t) { return { id: t.identifier, x: t.clientX, y: t.clientY }; }
  function hitTest(x, y) {
    for (var i = H.hits.length - 1; i >= 0; i--) {
      var h = H.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }
  function stickIndexFor(x) { return (G.twoP && x >= V.w * 0.5) ? 1 : 0; }

  wx.onTouchStart(function (e) {
    Sfx.resume(); Music._apply();
    var list = e.touches || [];
    for (var i = 0; i < list.length; i++) {
      var pt = pointOf(list[i]);
      var h = hitTest(pt.x, pt.y);
      if (h) { H.touchSticks[pt.id] = { ui: h }; continue; }
      if (G.state === "playing") {
        var idx = stickIndexFor(pt.x);
        var st = Input.sticks[idx];
        if (st && !st.active) { st.start(pt.id, pt.x, pt.y); H.touchSticks[pt.id] = { stick: idx }; }
      }
    }
  });
  wx.onTouchMove(function (e) {
    var list = e.touches || [];
    for (var i = 0; i < list.length; i++) {
      var pt = pointOf(list[i]);
      var rec = H.touchSticks[pt.id];
      if (rec && rec.stick !== undefined) {
        var st = Input.sticks[rec.stick];
        if (st && st.active) st.update(pt.x, pt.y);
      }
    }
  });
  function endTouches(e) {
    var list = (e.changedTouches && e.changedTouches.length) ? e.changedTouches : (e.touches || []);
    for (var i = 0; i < list.length; i++) {
      var pt = pointOf(list[i]);
      var rec = H.touchSticks[pt.id];
      if (!rec) continue;
      delete H.touchSticks[pt.id];
      if (rec.stick !== undefined) {
        var st = Input.sticks[rec.stick];
        if (st) st.end(pt.id);
      } else if (rec.ui && rec.ui.fn) {
        try { rec.ui.fn(); } catch (err) { console.error("UI 点击出错", err); }
      }
    }
  }
  wx.onTouchEnd(endTouches);
  wx.onTouchCancel(endTouches);

  /* ---------------- 尺寸 / 安全区 ---------------- */
  var _resize = resize;
  resize = function () {
    _resize();
    V.safeTop = __WXGAME__.safeTop || 0;
  };
  resize();

  /* 首次进入：教程优先，否则回主菜单 */
  H.screen = "menu";
  Music.set("menu");
  globalThis.__UI__ = H;   // 便于自测/调试
  console.log("[小游戏版] 界面层已就绪，版本 " + BUILD);
})();
