/* ============================================================
   微信小游戏平台适配层
   —— 把 wx 的能力包装成游戏核心本来就在用的浏览器 API
   （document / window / localStorage / navigator / requestAnimationFrame…）
   这样游戏核心一行都不用改就能跑在小游戏里。
   ============================================================ */
(function () {
  var sys = wx.getSystemInfoSync();
  var CANVAS = wx.createCanvas();          // 第一次 createCanvas 拿到的就是上屏 canvas

  /* ---------- 事件（visibilitychange / resize 等在核心里有注册） ---------- */
  var listeners = {};
  function on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
  function emit(type, e) { (listeners[type] || []).forEach(function (f) { try { f(e || {}); } catch (err) { } }); }

  /* ---------- 极简 DOM 元素 ---------- */
  function classes() {
    var set = {};
    return {
      add: function () { for (var i = 0; i < arguments.length; i++) set[arguments[i]] = 1; },
      remove: function () { for (var i = 0; i < arguments.length; i++) delete set[arguments[i]]; },
      toggle: function (c, v) { if (v === undefined) v = !set[c]; if (v) set[c] = 1; else delete set[c]; },
      contains: function (c) { return !!set[c]; }
    };
  }
  function makeEl(tag) {
    var el = {
      tagName: (tag || "div").toUpperCase(),
      style: {}, dataset: {}, classList: classes(),
      innerHTML: "", textContent: "", value: "", placeholder: "",
      width: 0, height: 0, checked: false, type: "",
      children: [], firstChild: null,
      addEventListener: function () { }, removeEventListener: function () { },
      appendChild: function (c) { this.children.push(c); this.firstChild = this.children[0]; return c; },
      removeChild: function () { }, remove: function () { },
      setAttribute: function () { }, getAttribute: function () { return null; },
      setPointerCapture: function () { }, focus: function () { }, blur: function () { },
      select: function () { }, setSelectionRange: function () { }, click: function () { },
      closest: function () { return null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 0, height: 0 }; },
      getContext: function () { return CANVAS.getContext("2d"); }
    };
    el.firstChild = null;
    return el;
  }

  /* ---------- 主画布代理：核心会设置 cv.width / style / getContext ---------- */
  var cvEl = makeEl("canvas");
  Object.defineProperty(cvEl, "width", {
    get: function () { return CANVAS.width; },
    set: function (v) { CANVAS.width = v; }
  });
  Object.defineProperty(cvEl, "height", {
    get: function () { return CANVAS.height; },
    set: function (v) { CANVAS.height = v; }
  });
  cvEl.getContext = function (t, o) { return CANVAS.getContext(t || "2d", o); };
  cvEl.getBoundingClientRect = function () { return { left: 0, top: 0, width: CANVAS.width, height: CANVAS.height }; };
  cvEl.setPointerCapture = function () { };

  var elementCache = { cv: cvEl };
  var overlayEl = makeEl("div");
  var toastEl = makeEl("div");
  elementCache.overlay = overlayEl;
  elementCache.toast = toastEl;

  /* ---------- 存储：映射到微信本地缓存 ---------- */
  var localStorage = {
    getItem: function (k) { try { var v = wx.getStorageSync(k); return (v === "" || v === undefined || v === null) ? null : v; } catch (e) { return null; } },
    setItem: function (k, v) { try { wx.setStorageSync(k, v); } catch (e) { } },
    removeItem: function (k) { try { wx.removeStorageSync(k); } catch (e) { } }
  };

  /* ---------- URLSearchParams 兜底（小游戏环境不一定有） ---------- */
  if (typeof URLSearchParams === "undefined") {
    globalThis.URLSearchParams = function (qs) {
      var map = {};
      String(qs || "").replace(/^\?/, "").split("&").forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf("=");
        var k = i < 0 ? kv : kv.slice(0, i);
        var v = i < 0 ? "" : kv.slice(i + 1);
        try { map[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) { map[k] = v; }
      });
      this.get = function (k) { return map[k] === undefined ? null : map[k]; };
      this.has = function (k) { return map[k] !== undefined; };
    };
  }

  /* ---------- 浏览器对象 ---------- */
  var win = {
    innerWidth: sys.windowWidth,
    innerHeight: sys.windowHeight,
    devicePixelRatio: Math.min(sys.pixelRatio || 2, 2),
    addEventListener: on,
    removeEventListener: function () { },
    visualViewport: { width: sys.windowWidth, height: sys.windowHeight, addEventListener: function () { } },
    location: null
  };

  var doc = {
    hidden: false,
    visibilityState: "visible",
    documentElement: makeEl("html"),
    body: makeEl("body"),
    fullscreenElement: null,
    addEventListener: on,
    removeEventListener: function () { },
    getElementById: function (id) { return elementCache[id] || (elementCache[id] = makeEl("div")); },
    createElement: function (tag) { return makeEl(tag); },
    exitFullscreen: function () { }
  };
  doc.documentElement.style = { setProperty: function () { } };

  var nav = {
    vibrate: function (ms) { try { wx.vibrateShort({ type: "light" }); } catch (e) { } },
    userAgent: "wechat-minigame",
    clipboard: {
      writeText: function (t) {
        try { wx.setClipboardData({ data: String(t) }); } catch (e) { }
        return { then: function (f) { if (f) f(); return { catch: function () { } }; }, catch: function () { } };
      }
    },
    share: null
  };

  var loc = {
    origin: "", pathname: "",
    href: "", search: "",
    replace: function () { }, reload: function () { }
  };

  globalThis.window = win;
  globalThis.document = doc;
  globalThis.localStorage = localStorage;
  globalThis.navigator = nav;
  globalThis.screen = { orientation: { lock: function () { return { catch: function () { } }; } } };
  globalThis.location = loc;
  globalThis.alert = function () { };
  globalThis.confirm = function () { return false; };
  globalThis.CustomEvent = globalThis.CustomEvent || function (t) { this.type = t; };
  if (typeof globalThis.performance === "undefined") globalThis.performance = { now: function () { return Date.now(); } };
  if (typeof globalThis.requestAnimationFrame === "undefined") {
    globalThis.requestAnimationFrame = function (fn) { return CANVAS.requestAnimationFrame ? CANVAS.requestAnimationFrame(fn) : setTimeout(function () { fn(Date.now()); }, 16); };
    globalThis.cancelAnimationFrame = function (id) { if (CANVAS.cancelAnimationFrame) CANVAS.cancelAnimationFrame(id); else clearTimeout(id); };
  }
  /* AudioContext：小游戏用 wx.createWebAudioContext（API 与浏览器一致） */
  if (typeof globalThis.AudioContext === "undefined" && typeof globalThis.webkitAudioContext === "undefined") {
    globalThis.AudioContext = function () { return wx.createWebAudioContext(); };
  }

  /* 生命周期桥接：切后台时让核心写存档 */
  wx.onHide(function () { doc.hidden = true; doc.visibilityState = "hidden"; emit("visibilitychange", {}); });
  wx.onShow(function () {
    doc.hidden = false; doc.visibilityState = "visible";
    var s = wx.getSystemInfoSync();
    win.innerWidth = s.windowWidth; win.innerHeight = s.windowHeight;
    emit("resize", {}); emit("visibilitychange", {});
  });

  globalThis.__WXGAME__ = {
    canvas: CANVAS, sys: sys, on: on, emit: emit,
    safeTop: (sys.safeArea && sys.safeArea.top) || 0,
    safeBottom: sys.screenHeight && sys.safeArea ? (sys.screenHeight - sys.safeArea.bottom) : 0
  };
})();
