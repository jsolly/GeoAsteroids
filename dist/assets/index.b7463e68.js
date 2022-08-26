var dt = Object.defineProperty;
var ut = (t, e, o) =>
  e in t
    ? dt(t, e, { enumerable: !0, configurable: !0, writable: !0, value: o })
    : (t[e] = o);
var c = (t, e, o) => (ut(t, typeof e != 'symbol' ? e + '' : e, o), o);
(function () {
  const e = document.createElement('link').relList;
  if (e && e.supports && e.supports('modulepreload')) return;
  for (const r of document.querySelectorAll('link[rel="modulepreload"]')) i(r);
  new MutationObserver((r) => {
    for (const a of r)
      if (a.type === 'childList')
        for (const g of a.addedNodes)
          g.tagName === 'LINK' && g.rel === 'modulepreload' && i(g);
  }).observe(document, { childList: !0, subtree: !0 });
  function o(r) {
    const a = {};
    return (
      r.integrity && (a.integrity = r.integrity),
      r.referrerpolicy && (a.referrerPolicy = r.referrerpolicy),
      r.crossorigin === 'use-credentials'
        ? (a.credentials = 'include')
        : r.crossorigin === 'anonymous'
        ? (a.credentials = 'omit')
        : (a.credentials = 'same-origin'),
      a
    );
  }
  function i(r) {
    if (r.ep) return;
    r.ep = !0;
    const a = o(r);
    fetch(r.href, a);
  }
})();
const d = 60,
  X = 0,
  j = 240,
  et = 0,
  nt = 3,
  K = 5,
  h = 30,
  ht = 0.3,
  ot = 3,
  E = 0.1,
  W = 300,
  ft = 10,
  gt = 0.6,
  mt = 0.1,
  it = 1,
  Y = 50,
  f = 50,
  F = 10,
  q = 0.5,
  St = 20,
  Mt = 50,
  wt = 100,
  lt = 0,
  R = 'highscore',
  p = 'musicOn',
  C = 'soundOn',
  H = 40,
  xt = 2.5,
  s = document.querySelector('canvas'),
  n = s.getContext('2d');
class V {
  constructor(e, o) {
    (this.x = e), (this.y = o);
  }
}
function B(t, e) {
  return Math.sqrt(Math.pow(e.x - t.x, 2) + Math.pow(e.y - t.y, 2));
}
let rt, L;
function st(t, e) {
  (rt = t), (L = e);
}
function yt() {
  return L;
}
function vt() {
  (n.fillStyle = 'black'), n.fillRect(0, 0, s.width, s.height);
}
function Tt() {
  (n.textAlign = 'center'),
    (n.textBaseline = 'middle'),
    (n.fillStyle = 'rgba(255,255,255, ' + String(L) + ')'),
    (n.font = 'small-caps ' + String(H) + 'px dejavu sans mono'),
    n.fillText(rt, s.width / 2, (s.height * 3) / 4),
    (L -= 1 / xt / d);
}
function It(t, e, o = 'white') {
  const i = h / 2,
    r = t.x,
    a = t.y;
  (n.strokeStyle = o),
    (n.lineWidth = h / 20),
    n.beginPath(),
    n.moveTo(r + (4 / 3) * i * Math.cos(e), a - (4 / 3) * i * Math.sin(e)),
    n.lineTo(
      r - i * ((2 / 3) * Math.cos(e) + Math.sin(e)),
      a + i * ((2 / 3) * Math.sin(e) - Math.cos(e)),
    ),
    n.lineTo(
      r - i * ((2 / 3) * Math.cos(e) - Math.sin(e)),
      a + i * ((2 / 3) * Math.sin(e) + Math.cos(e)),
    ),
    n.closePath(),
    n.stroke();
}
let x = lt,
  k = et;
function Pt() {
  (x = lt), (k = et);
}
function G() {
  return k;
}
function bt(t) {
  x += t;
}
function Et(t) {
  let e;
  for (let o = 0; o < t.lives; o++) {
    e = Lt(t, o);
    const i = new V(h + o * h * 1.2, h);
    It(i, 0.5 * Math.PI, e);
  }
}
function Lt(t, e) {
  return t.exploding && e == t.lives - 1 ? 'red' : 'white';
}
function kt() {
  (n.textAlign = 'right'),
    (n.textBaseline = 'middle'),
    (n.fillStyle = 'white'),
    (n.font = String(H) + 'px dejavu sans mono'),
    n.fillText(String(x), s.width - 15, 30),
    (n.textAlign = 'center'),
    (n.textBaseline = 'middle'),
    (n.fillStyle = 'white'),
    (n.font = String(H * 0.75) + 'px dejavu sans mono'),
    n.fillText('BEST ' + String(At()), s.width / 2, 30);
}
let Z, $;
function _t() {
  (Z = 'Level ' + String(k + 1)), ($ = 1), k++, st(Z, $);
}
function At() {
  const t = localStorage.getItem(R);
  if (t == null) return localStorage.setItem(R, '0'), 0;
  let e = Number(t);
  return x > e && ((e = x), localStorage.setItem(R, String(e))), e;
}
class Ot {
  constructor(e, o, i, r, a, g, y, v) {
    (this.centroid = e),
      (this.t = o),
      (this.xv = i),
      (this.yv = r),
      (this.a = a),
      (this.r = g),
      (this.vertices = y),
      (this.offsets = v);
    for (let O = 0; O < y; O++) v.push(Math.random() * q * 2 + 1 - q);
  }
}
class Rt {
  constructor(e) {
    c(this, 'roids', []);
    c(this, 'currentLevel', G());
    for (let o = 0; o < it + this.currentLevel; o++) {
      let i;
      do {
        const r = Math.floor(Math.random() * s.width),
          a = Math.floor(Math.random() * s.height);
        i = new V(r, a);
      } while (B(e.centroid, i) < f * 2 + e.r);
      this.roids.push(w(i, Math.ceil(f / 2)));
    }
  }
}
function w(t, e) {
  const o = G(),
    i = 1 + 0.1 * o,
    r = ((Math.random() * Y * i) / d) * (Math.random() < 0.5 ? 1 : -1),
    a = ((Math.random() * Y * i) / d) * (Math.random() < 0.5 ? 1 : -1),
    g = Math.random() * Math.PI * 2,
    y = [],
    v = Math.floor(Math.random() * (F + 1) + F / 2);
  return new Ot(t, 0, r, a, g, e, v, y);
}
function J(t, e) {
  const o = e[t].r;
  let i = 0;
  o == Math.ceil(f / 2)
    ? (e.push(w(e[t].centroid, Math.ceil(f / 4))),
      e.push(w(e[t].centroid, Math.ceil(f / 4))),
      (i += St))
    : o == Math.ceil(f / 4)
    ? (e.push(w(e[t].centroid, Math.ceil(f / 8))),
      e.push(w(e[t].centroid, Math.ceil(f / 8))),
      (i += Mt))
    : (i += wt),
    bt(i),
    e.splice(t, 1);
}
let N, D, m, S, T, M;
function Nt(t, e) {
  for (const o of e) {
    (n.strokeStyle = 'slategrey'),
      (n.lineWidth = 1.5),
      (N = s.width / 2 - t.centroid.x + o.centroid.x),
      (D = s.height / 2 - t.centroid.y + o.centroid.y),
      (m = o.r),
      (S = o.a),
      (T = o.vertices),
      (M = o.offsets),
      n.beginPath(),
      n.moveTo(N + m * M[0] * Math.cos(S), D + m * M[0] * Math.sin(S));
    for (let i = 1; i < T; i++)
      n.lineTo(
        N + m * M[i] * Math.cos(S + (i * Math.PI * 2) / T),
        D + m * M[i] * Math.sin(S + (i * Math.PI * 2) / T),
      );
    n.closePath(), n.stroke();
  }
}
function Dt(t) {
  for (const e of t) (e.centroid.x += e.xv), (e.centroid.y += e.yv);
}
const pt = document.getElementById('toggle-music'),
  Ct = document.getElementById('toggle-sound');
Ct.addEventListener('click', Xt);
pt.addEventListener('click', jt);
class A {
  constructor(e, o = 1, i = 0.05) {
    c(this, 'streamNum', 0);
    c(this, 'streams', []);
    for (let r = 0; r < o; r++)
      this.streams.push(new Audio(e)), (this.streams[r].volume = i);
  }
  play() {
    P &&
      ((this.streamNum = (this.streamNum + 1) % this.streams.length),
      this.streams[this.streamNum].play());
  }
  stop() {
    this.streams[this.streamNum].pause(),
      (this.streams[this.streamNum].currentTime = 0);
  }
}
class Ht {
  constructor(e, o) {
    c(this, 'srcLow');
    c(this, 'soundLow');
    c(this, 'srcHigh');
    c(this, 'soundHigh');
    c(this, 'low', !0);
    c(this, 'tempo', 1);
    c(this, 'beatTime', 0);
    (this.srcLow = e),
      (this.soundLow = new Audio(e)),
      (this.srcHigh = o),
      (this.soundHigh = new Audio(o));
  }
  play() {
    this.low ? this.soundLow.play() : this.soundHigh.play(),
      (this.low = !this.low);
  }
  setAsteroidRatio(e) {
    const o = G(),
      i = (it + o) * 7,
      r = e.length == 0 ? 1 : e.length / i;
    this.tempo = 1 - 0.75 * (1 - r);
  }
  tick() {
    this.beatTime == 0
      ? (this.play(), (this.beatTime = Math.ceil(this.tempo * d)))
      : this.beatTime--;
  }
}
const z = new A('sounds/thrust.m4a'),
  at = 5,
  Bt = new A('sounds/laser.m4a', at),
  Q = new A('sounds/hit.m4a', at),
  Ut = new A('sounds/explode.m4a'),
  I = new Ht('sounds/music-low.m4a', 'sounds/music-high.m4a');
let P = Vt(),
  b = Gt();
function Vt() {
  const t = localStorage.getItem(p);
  return t == null ? (localStorage.setItem(p, 'false'), !1) : t === 'true';
}
function Gt() {
  const t = localStorage.getItem(C);
  return t == null ? (localStorage.setItem(C, 'false'), !1) : t === 'true';
}
function Xt() {
  (P = !P),
    localStorage.setItem(p, String(P)),
    document.getElementById('toggle-sound').blur();
}
function jt() {
  (b = !b),
    localStorage.setItem(C, String(b)),
    document.getElementById('toggle-music').blur();
}
function Kt() {
  return b;
}
class ct {
  constructor(e = nt, o = !1) {
    c(this, 'centroid', new V(s.width, s.height));
    c(this, 't', 0);
    c(this, 'xv', 0);
    c(this, 'yv', 0);
    c(this, 'r', h / 2);
    c(this, 'a', (90 / 180) * Math.PI);
    c(this, 'blinkCount', Math.ceil(ot / E));
    c(this, 'blinkTime', Math.ceil(E * d));
    c(this, 'canShoot', !0);
    c(this, 'dead', !1);
    c(this, 'exploding', !1);
    c(this, 'lasers', []);
    c(this, 'explodeTime', 0);
    c(this, 'rot', 0);
    c(this, 'thrusting', !1);
    (this.lives = e), (this.blinkOn = o);
  }
}
function Wt(t = nt, e = !1) {
  return new ct(t, e);
}
function Yt(t) {
  t.dead = !0;
}
function Ft(t) {
  t.blinkOn = t.blinkCount % 2 == 0;
}
function qt(t) {
  t.exploding = t.explodeTime > 0;
}
function Zt(t) {
  (t.explodeTime = Math.ceil(ht * d)),
    (t.blinkCount = Math.ceil(ot / E)),
    Ut.play();
}
function $t(t) {
  t.thrusting && !t.dead
    ? ((t.xv -= (K * Math.cos(t.a)) / d),
      (t.yv -= (K * Math.sin(t.a)) / d),
      z.play(),
      zt(t))
    : ((t.xv -= (X * t.xv) / d), (t.yv -= (X * t.yv) / d), z.stop());
}
function Jt(t) {
  (t.a += t.rot), (t.centroid.x += t.xv), (t.centroid.y += t.yv);
}
function zt(t) {
  !t.exploding &&
    t.blinkOn &&
    ((n.fillStyle = 'red'),
    (n.strokeStyle = 'yellow'),
    (n.lineWidth = h / 10),
    n.beginPath(),
    n.moveTo(
      s.width / 2 + t.r * ((2 / 3) * Math.cos(t.a) + 0.5 * Math.sin(t.a)),
      s.height / 2 + t.r * ((2 / 3) * Math.sin(t.a) - 0.5 * Math.cos(t.a)),
    ),
    n.lineTo(
      s.width / 2 + ((t.r * 5) / 3) * Math.cos(t.a),
      s.height / 2 + ((t.r * 5) / 3) * Math.sin(t.a),
    ),
    n.lineTo(
      s.width / 2 + t.r * ((2 / 3) * Math.cos(t.a) - 0.5 * Math.sin(t.a)),
      s.height / 2 + t.r * ((2 / 3) * Math.sin(t.a) + 0.5 * Math.cos(t.a)),
    ),
    n.closePath(),
    n.fill(),
    n.stroke());
}
function Qt(t) {
  const e = t.a;
  (n.strokeStyle = 'white'),
    (n.lineWidth = h / 20),
    n.beginPath(),
    n.moveTo(
      s.width / 2 + (4 / 3) * t.r * Math.cos(e + 1.06),
      s.height / 2 + (4 / 3) * t.r * Math.sin(e + 1.06),
    ),
    n.lineTo(
      s.width / 2 + t.r * ((-1 / 3) * Math.cos(e + 1.06) + Math.sin(e + 1.06)),
      s.height / 2 + t.r * ((-1 / 3) * Math.sin(e + 1.06) - Math.cos(e + 1.06)),
    ),
    n.lineTo(
      s.width / 2 + t.r * ((-1 / 3) * Math.cos(e + 1.06) - Math.sin(e + 1.06)),
      s.height / 2 + t.r * ((-1 / 3) * Math.sin(e + 1.06) + Math.cos(e + 1.06)),
    ),
    n.closePath(),
    n.stroke();
}
function te(t) {
  const e = t.centroid.x,
    o = t.centroid.y;
  (n.fillStyle = 'darkred'),
    n.beginPath(),
    n.arc(e, o, t.r * 1.7, 0, Math.PI * 2, !1),
    n.fill(),
    (n.fillStyle = 'red'),
    n.beginPath(),
    n.arc(e, o, t.r * 1.4, 0, Math.PI * 2, !1),
    n.fill(),
    (n.fillStyle = 'Orange'),
    n.beginPath(),
    n.arc(e, o, t.r * 1.1, 0, Math.PI * 2, !1),
    n.fill(),
    (n.fillStyle = 'Yellow'),
    n.beginPath(),
    n.arc(e, o, t.r * 0.8, 0, Math.PI * 2, !1),
    n.fill(),
    (n.fillStyle = 'White'),
    n.beginPath(),
    n.arc(e, o, t.r * 0.5, 0, Math.PI * 2, !1),
    n.fill();
}
class ee {
  constructor(e, o, i, r, a) {
    (this.centroid = e),
      (this.xv = o),
      (this.yv = i),
      (this.distTraveled = r),
      (this.explodeTime = a);
  }
}
function ne(t) {
  function e(o) {
    return !!(o.canShoot && o.lasers.length < ft);
  }
  if (e) {
    const o = (-W * Math.cos(-t.a)) / d + t.xv,
      i = (W * Math.sin(-t.a)) / d + t.yv,
      r = new ee(t.centroid, o, i, 0, 0);
    t.lasers.push(r), Bt.play();
  }
  t.canShoot = !1;
}
function oe(t) {
  for (const e of t.lasers) {
    const o = e.centroid.y,
      i = e.centroid.x,
      r = t.centroid.x,
      a = t.centroid.y;
    e.explodeTime == 0
      ? ((n.fillStyle = 'salmon'),
        n.beginPath(),
        n.arc(
          i - r + s.width / 2,
          o - a + s.height / 2,
          h / 15,
          0,
          Math.PI * 2,
          !1,
        ),
        n.fill())
      : ((n.fillStyle = 'orangered'),
        n.beginPath(),
        n.arc(
          i - r + s.width / 2,
          o - a + s.height / 2,
          t.r * 0.75,
          0,
          Math.PI * 2,
          !1,
        ),
        n.fill(),
        (n.fillStyle = 'salmon'),
        n.beginPath(),
        n.arc(
          i - (r - s.width),
          o - (a - s.height),
          t.r * 0.5,
          0,
          Math.PI * 2,
          !1,
        ),
        n.fill(),
        (n.fillStyle = 'pink'),
        n.beginPath(),
        n.arc(
          i - (r - s.width),
          o - (a - s.height),
          t.r * 0.25,
          0,
          Math.PI * 2,
          !1,
        ),
        n.fill());
  }
}
function ie(t) {
  for (let e = t.lasers.length - 1; e >= 0; e--) {
    const o = t.lasers[e];
    if (o.distTraveled > gt * s.width) {
      t.lasers.splice(e, 1);
      continue;
    }
    if (o.explodeTime > 0) {
      if ((o.explodeTime--, o.explodeTime == 0)) {
        t.lasers.splice(e, 1);
        continue;
      }
    } else
      (o.centroid.x += o.xv), (o.centroid.y += o.yv), (o.distTraveled += 0.5);
  }
}
function le(t, e) {
  if (!t.dead)
    switch (e.code) {
      case 'Space':
        ne(t);
        break;
      case 'ArrowLeft':
        t.rot = ((-j / 180) * Math.PI) / d;
        break;
      case 'ArrowUp':
        t.thrusting = !0;
        break;
      case 'ArrowRight':
        t.rot = ((j / 180) * Math.PI) / d;
        break;
    }
}
function re(t, e) {
  if (!t.dead)
    switch (e.code) {
      case 'Space':
        t.canShoot = !0;
        break;
      case 'ArrowLeft':
        t.rot = 0;
        break;
      case 'ArrowUp':
        t.thrusting = !1;
        break;
      case 'ArrowRight':
        t.rot = 0;
        break;
    }
}
let l, u;
document.addEventListener('keydown', (t) => le(l, t));
document.addEventListener('keyup', (t) => re(l, t));
function tt() {
  Pt(), (l = new ct()), U();
}
function U() {
  _t(), (u = new Rt(l).roids);
}
function se() {
  Yt(l), st('Game Over', 1), (I.tempo = 1), _();
}
setInterval(_, 1e3 / d);
function _() {
  l || tt(),
    Ft(l),
    qt(l),
    vt(),
    Nt(l, u),
    kt(),
    Et(l),
    yt() >= 0 ? Tt() : l.dead && tt(),
    Kt() && I.tick(),
    l.exploding
      ? te(l)
      : (l.blinkOn && !l.dead && Qt(l),
        l.blinkCount > 0 &&
          (l.blinkTime--,
          l.blinkTime == 0 &&
            ((l.blinkTime = Math.ceil(E * d)), l.blinkCount--))),
    oe(l);
  for (let e = u.length - 1; e >= 0; e--)
    for (let o = l.lasers.length - 1; o >= 0; o--)
      t(l.lasers[o], u[e]) &&
        (J(e, u),
        Q.play(),
        u.length == 0 && U(),
        (l.lasers[o].explodeTime = Math.ceil(mt * d)),
        I.setAsteroidRatio(u));
  function t(e, o) {
    return e.explodeTime == 0 && B(o.centroid, e.centroid) < o.r, !0;
  }
  if (l.exploding)
    l.explodeTime--,
      l.explodeTime == 0 &&
        (l.lives--, l.lives == 0 ? se() : (Wt(l.lives, l.blinkOn), _()));
  else if (l.blinkCount == 0 && !l.dead)
    for (let e = 0; e < u.length; e++)
      B(l.centroid, u[e].centroid) < l.r + u[e].r &&
        (Zt(l),
        J(e, u),
        Q.play(),
        u.length == 0 && U(),
        I.setAsteroidRatio(u),
        _());
  $t(l), l.exploding || Jt(l), ie(l), Dt(u);
}
