#!/usr/bin/env python3
"""Iran war dashboard: pull RSS → filter → render static HTML.

Zero external deps. Stdlib only. Re-run to refresh data.json and index.html.
"""
from __future__ import annotations

import html
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

HERE = Path(__file__).parent

FEEDS = [
    ("BBC Middle East",  "http://feeds.bbci.co.uk/news/world/middle_east/rss.xml"),
    ("Al Jazeera",       "https://www.aljazeera.com/xml/rss/all.xml"),
    ("Guardian · Iran",  "https://www.theguardian.com/world/iran/rss"),
    ("Guardian · M.East","https://www.theguardian.com/world/middleeast/rss"),
    ("NPR World",        "https://feeds.npr.org/1004/rss.xml"),
]

KEYWORDS = re.compile(
    r"\b(iran|iranian|tehran|hormuz|houthi|yemen|hezbollah|ayatollah|khamenei|"
    r"irgc|revolutionary guard|persian gulf|strait|bab[- ]?el[- ]?mandeb|"
    r"tehran|isfahan|natanz|fordow|fordo|red sea|bandar|qassem)\b",
    re.IGNORECASE,
)

# lightweight topical tagging: first match wins, in priority order
TOPIC_RULES = [
    ("NUCLEAR",   r"\b(nuclear|enrichment|uranium|centrifuge|iaea|natanz|fordow|fordo)\b"),
    ("NAVAL",     r"\b(strait|hormuz|bab[- ]?el[- ]?mandeb|navy|naval|blockade|tanker|warship|destroyer|frigate|carrier)\b"),
    ("PROXY",     r"\b(houthi|hezbollah|yemen|iraqi militia|hamas|proxies)\b"),
    ("DIPLOMACY", r"\b(talks?|negotiation|ceasefire|truce|diplomat|envoy|vance|witkoff|araghchi|islamabad)\b"),
    ("MARKETS",   r"\b(oil|brent|wti|market|shares|equities|barrel|opec|energy prices?)\b"),
    ("STRIKE",    r"\b(strike|missile|drone|airstrike|bombing|killed|dead|casualties?|hit|attack)\b"),
    ("POLITICS",  r"\b(sanction|statement|trump|netanyahu|pezeshkian|mojtaba|supreme leader|parliament)\b"),
]

UA = {"User-Agent": "iran-war-live-bot/1.0 (+local static dashboard)"}
TIMEOUT = 12
TOP_N = 60     # max items embedded in the page
PAGE_SIZE = 10 # client-side pagination


def fetch(url: str) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.read()
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        print(f"  ! {url} — {e}", file=sys.stderr)
        return None


def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s or "")
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def parse_when(s: str) -> datetime | None:
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def parse_feed(source: str, xml_bytes: bytes) -> list[dict]:
    out: list[dict] = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        print(f"  ! parse error from {source}: {e}", file=sys.stderr)
        return out

    # RSS 2.0: <rss><channel><item>
    items = root.findall(".//item")
    atom_ns = "{http://www.w3.org/2005/Atom}"
    if not items:
        items = root.findall(f".//{atom_ns}entry")

    for it in items:
        def txt(tag: str) -> str:
            el = it.find(tag)
            if el is None:
                el = it.find(f"{atom_ns}{tag}")
            return (el.text or "") if el is not None else ""

        title = strip_tags(txt("title"))
        link = txt("link")
        if not link:
            link_el = it.find(f"{atom_ns}link")
            if link_el is not None:
                link = link_el.get("href", "")
        desc = strip_tags(txt("description") or txt("summary"))
        pub = txt("pubDate") or txt("published") or txt("updated")

        if not (title and link):
            continue
        out.append({
            "source": source,
            "title": title,
            "link": link.strip(),
            "desc": desc[:400],
            "when": parse_when(pub),
        })
    return out


def tag_for(title: str, desc: str) -> str:
    blob = f"{title} {desc}"
    for tag, pat in TOPIC_RULES:
        if re.search(pat, blob, re.IGNORECASE):
            return tag
    return "UPDATE"


def iran_related(item: dict) -> bool:
    blob = f"{item['title']} {item['desc']}"
    return bool(KEYWORDS.search(blob))


def dedupe(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for it in items:
        k = it["link"].split("#")[0].split("?")[0]
        if k in seen:
            continue
        seen.add(k)
        out.append(it)
    return out


def human_ago(dt: datetime | None, now: datetime) -> str:
    if not dt:
        return "—"
    delta = now - dt
    secs = int(delta.total_seconds())
    if secs < 0:
        return "just now"
    if secs < 60:
        return f"{secs}s ago"
    if secs < 3600:
        return f"{secs // 60}m ago"
    if secs < 86400:
        return f"{secs // 3600}h ago"
    return f"{secs // 86400}d ago"


# ───────────────────────────────── TEMPLATE ─────────────────────────────────

HTML_TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="refresh" content="60" />
<title>Iran War — Live Feed · auto-pulled</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<script>
  (function(){
    const s = sessionStorage.getItem('__scroll');
    if (s !== null) window.addEventListener('DOMContentLoaded', () => window.scrollTo(0, parseInt(s, 10)));
    window.addEventListener('beforeunload', () => sessionStorage.setItem('__scroll', String(window.scrollY)));
    const t = localStorage.getItem('__theme') || 'midnight';
    document.documentElement.dataset.theme = t;
  })();
</script>
<style>
  :root[data-theme="midnight"] {
    --bg:#0a0a0a; --bg-2:#111; --bg-3:#1a1a1a;
    --ink:#f2f0ea; --ink-mute:#8b8680; --ink-dim:#4a4741;
    --accent:#ff3d00; --warn:#ffb000; --safe:#4ade80;
    --line:rgba(242,240,234,0.08); --line-strong:rgba(242,240,234,0.16);
    --hero-font:'Instrument Serif',serif; --hero-weight:400; --hero-italic-style:italic; --grain-opacity:0.035;
  }
  :root[data-theme="newsprint"] {
    --bg:#f1ebdd; --bg-2:#e8e0cb; --bg-3:#ddd2b6;
    --ink:#1a1612; --ink-mute:#5c564a; --ink-dim:#8a8273;
    --accent:#c1272d; --warn:#8a6a1f; --safe:#3e7a3a;
    --line:rgba(26,22,18,0.12); --line-strong:rgba(26,22,18,0.22);
    --hero-font:'Playfair Display',serif; --hero-weight:700; --hero-italic-style:italic; --grain-opacity:0.08;
  }
  :root[data-theme="tactical"] {
    --bg:#030806; --bg-2:#081410; --bg-3:#0e1f19;
    --ink:#b7f7c6; --ink-mute:#5d9c76; --ink-dim:#2d5740;
    --accent:#00ff88; --warn:#ffd60a; --safe:#00ff88;
    --line:rgba(0,255,136,0.12); --line-strong:rgba(0,255,136,0.24);
    --hero-font:'JetBrains Mono',monospace; --hero-weight:700; --hero-italic-style:normal; --grain-opacity:0.05;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body {
    background:var(--bg); color:var(--ink);
    font-family:'Inter',system-ui,sans-serif; font-weight:400;
    -webkit-font-smoothing:antialiased;
    transition:background 0.4s ease, color 0.4s ease;
  }
  :root[data-theme="tactical"] body { font-family:'JetBrains Mono',monospace; }
  body { overflow-x:hidden; }
  .mono { font-family:'JetBrains Mono',ui-monospace,monospace; font-variant-ligatures:none; }

  .shell { max-width:1440px; margin:0 auto; padding:32px 48px 120px; }
  @media (max-width:720px) { .shell { padding:20px; } }

  .rail {
    display:flex; align-items:center; justify-content:space-between; gap:16px;
    padding-bottom:18px; margin-bottom:28px;
    border-bottom:1px solid var(--line);
    font-size:11px; letter-spacing:0.14em; text-transform:uppercase;
    color:var(--ink-mute); flex-wrap:wrap;
  }
  .rail .brand { color:var(--ink); font-weight:700; }
  .rail .brand span { color:var(--accent); }
  .rail .center { flex:1; text-align:center; min-width:180px; }
  .rail .live { display:inline-flex; align-items:center; gap:8px; color:var(--ink); }
  .pulse {
    width:8px; height:8px; border-radius:50%; background:var(--accent);
    box-shadow:0 0 0 0 rgba(255,61,0,0.7); animation:pulse 1.6s infinite;
  }
  @keyframes pulse {
    0% { box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 55%,transparent); }
    70% { box-shadow:0 0 0 12px rgba(255,61,0,0); }
    100% { box-shadow:0 0 0 0 rgba(255,61,0,0); }
  }
  .themer { display:inline-flex; gap:4px; padding:4px; border:1px solid var(--line-strong); background:var(--bg-2); }
  .themer button {
    font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.08em;
    padding:5px 10px; background:transparent; color:var(--ink-mute);
    border:0; cursor:pointer; text-transform:uppercase; transition:all 0.2s;
  }
  .themer button:hover { color:var(--ink); }
  .themer button.active { background:var(--accent); color:var(--bg); }
  .countdown {
    font-family:'JetBrains Mono',monospace; font-size:10px;
    color:var(--ink-mute); padding:4px 8px; border:1px dashed var(--line-strong);
  }

  .hero { display:grid; grid-template-columns:1.6fr 1fr; gap:48px; margin:24px 0 56px; align-items:end; }
  @media (max-width:960px) { .hero { grid-template-columns:1fr; gap:32px; } }
  .hero h1 {
    font-family:var(--hero-font); font-weight:var(--hero-weight);
    font-size:clamp(54px,7vw,112px); line-height:0.95; letter-spacing:-0.02em; color:var(--ink);
  }
  .hero h1 em { font-style:var(--hero-italic-style); color:var(--accent); }
  .hero .sub {
    color:var(--ink-mute); font-size:15px; line-height:1.55; max-width:440px;
    padding-top:28px; border-top:1px solid var(--line);
  }
  .hero .sub strong { color:var(--ink); font-weight:500; }
  .day-counter { margin-bottom:14px; }
  .day-counter .tag {
    display:inline-block; padding:5px 10px; background:var(--accent); color:var(--bg);
    font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
  }

  .section-head { display:flex; align-items:baseline; justify-content:space-between; margin:56px 0 24px; gap:16px; }
  .section-head h2 {
    font-family:var(--hero-font); font-weight:var(--hero-weight); font-style:var(--hero-italic-style);
    font-size:40px; letter-spacing:-0.01em;
  }
  :root[data-theme="newsprint"] .section-head h2 { font-style:italic; font-weight:400; }
  .section-head .num { font-family:'JetBrains Mono',monospace; color:var(--ink-dim); font-size:12px; letter-spacing:0.1em; }

  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--line-strong); border:1px solid var(--line-strong); }
  @media (max-width:800px) { .stats { grid-template-columns:repeat(2,1fr); } }
  .stat { padding:28px 24px; background:var(--bg); min-height:160px; position:relative; }
  .stat .label { font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-mute); margin-bottom:16px; }
  .stat .val { font-family:var(--hero-font); font-size:64px; line-height:1; font-weight:var(--hero-weight); color:var(--ink); }
  :root[data-theme="tactical"] .stat .val { font-size:52px; }
  .stat .unit { font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--ink-mute); margin-top:10px; }
  .stat.accent .val { color:var(--accent); }
  .stat.warn .val { color:var(--warn); }
  .stat .trend { position:absolute; top:20px; right:20px; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--ink-mute); }

  .content { display:grid; grid-template-columns:1.3fr 1fr; gap:48px; margin-top:16px; }
  @media (max-width:960px) { .content { grid-template-columns:1fr; } }

  .feed { display:flex; flex-direction:column; gap:0; border:1px solid var(--line-strong); }
  .headline {
    display:block; padding:20px 22px; border-bottom:1px solid var(--line); text-decoration:none; color:var(--ink);
    transition:background 0.15s ease;
  }
  .headline:last-child { border-bottom:0; }
  .headline:hover { background:var(--bg-2); }
  .headline .meta { display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap; }
  .headline .tag-chip {
    font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.08em; font-weight:700;
    padding:2px 7px; background:var(--accent); color:var(--bg);
  }
  .headline .source-chip { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--ink-mute); letter-spacing:0.06em; text-transform:uppercase; }
  .headline .when { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--ink-dim); margin-left:auto; }
  .headline .title {
    font-family:var(--hero-font); font-weight:var(--hero-weight); font-size:22px; line-height:1.2;
    letter-spacing:-0.005em; margin-bottom:6px;
  }
  .headline .desc { color:var(--ink-mute); font-size:13px; line-height:1.55; }

  .pager {
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    margin-top:20px; padding:14px 18px;
    border:1px solid var(--line-strong); background:var(--bg-2);
  }
  .pager button {
    font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.1em; font-weight:700;
    padding:8px 16px; background:transparent; color:var(--ink);
    border:1px solid var(--line-strong); cursor:pointer; text-transform:uppercase; transition:all 0.15s;
  }
  .pager button:hover:not(:disabled) { background:var(--accent); color:var(--bg); border-color:var(--accent); }
  .pager button:disabled { color:var(--ink-dim); cursor:not-allowed; opacity:0.4; }
  .pager .info { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--ink-mute); letter-spacing:0.08em; text-transform:uppercase; }
  .pager .info b { color:var(--accent); font-weight:700; margin:0 4px; }
  .pager .pages { display:flex; gap:4px; flex-wrap:wrap; justify-content:center; }
  .pager .pages button { padding:6px 10px; min-width:34px; font-size:10px; }
  .pager .pages button.active { background:var(--accent); color:var(--bg); border-color:var(--accent); }
  @media (max-width:640px) {
    .pager { flex-direction:column; }
    .pager .pages { order:3; }
  }

  .side { display:flex; flex-direction:column; gap:24px; }
  .card { background:var(--bg-2); border:1px solid var(--line); padding:24px; }
  .card .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid var(--line); }
  .card .head h3 { font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink); font-weight:600; }
  .card .head .dot { width:6px; height:6px; border-radius:50%; background:var(--accent); }
  .card .stat-row { display:flex; justify-content:space-between; align-items:baseline; padding:10px 0; border-bottom:1px dashed var(--line); font-size:13px; }
  .card .stat-row:last-child { border:0; }
  .card .stat-row .k { color:var(--ink-mute); }
  .card .stat-row .v { font-family:'JetBrains Mono',monospace; color:var(--ink); font-weight:500; }
  .card .stat-row .v.hot { color:var(--accent); }
  .card .tag-cloud { display:flex; flex-wrap:wrap; gap:6px; }
  .card .tag-cloud .chip {
    font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.08em; font-weight:700;
    padding:4px 8px; background:var(--bg); border:1px solid var(--line-strong); color:var(--ink-mute);
  }
  .card .tag-cloud .chip em { color:var(--accent); font-style:normal; margin-left:6px; }

  footer {
    margin-top:80px; padding-top:28px; border-top:1px solid var(--line);
    display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;
    font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--ink-mute); letter-spacing:0.06em;
  }
  footer em { color:var(--accent); font-style:normal; }

  .grain {
    position:fixed; inset:0; pointer-events:none; z-index:1; opacity:var(--grain-opacity);
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
  }

  @keyframes fade-in { from { opacity:0.72; } to { opacity:1; } }
  .shell { animation:fade-in 0.6s ease; }
</style>
</head>
<body>
<div class="grain"></div>
<div class="shell">

  <nav class="rail">
    <div class="brand">OBSERVATORY<span>.</span>LIVE</div>
    <div class="center mono">AUTO-FEED · PERSIAN GULF THEATRE · {SOURCE_COUNT} SOURCES · {PULLED_AT_UTC}</div>
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <span class="countdown">NEXT REFRESH <span id="cd">60</span>s</span>
      <div class="themer">
        <button data-theme="midnight">MIDNIGHT</button>
        <button data-theme="newsprint">NEWSPRINT</button>
        <button data-theme="tactical">TACTICAL</button>
      </div>
      <span class="live"><span class="pulse"></span>LIVE</span>
    </div>
  </nav>

  <section class="hero">
    <div>
      <div class="day-counter"><span class="tag mono">{TOP_TAG}</span></div>
      <h1>{LATEST_HEADLINE_HTML}</h1>
    </div>
    <p class="sub">
      <strong>Auto-pulled feed.</strong> {TOTAL_ITEMS} Iran-related headlines extracted from {SOURCE_COUNT} public RSS feeds in the past {WINDOW_HOURS}h. This page is generated by <code>update.py</code> — no editorial layer. Filter keywords: <em>iran, hormuz, houthi, tehran, irgc, hezbollah, bab-el-mandeb</em>. Last pulled <strong>{PULLED_AT_HUMAN}</strong>.
    </p>
  </section>

  <div class="section-head">
    <h2>Signal count</h2>
    <span class="num">01 / STATS</span>
  </div>

  <div class="stats">
    <div class="stat accent"><div class="trend">FILTERED</div><div class="label">Iran-related headlines</div><div class="val">{TOTAL_ITEMS}</div><div class="unit">past {WINDOW_HOURS}h window</div></div>
    <div class="stat"><div class="trend">UPSTREAM</div><div class="label">RSS feeds polled</div><div class="val">{SOURCE_COUNT}</div><div class="unit">public · stdlib only</div></div>
    <div class="stat warn"><div class="trend">LEAD TOPIC</div><div class="label">Dominant tag</div><div class="val">{LEAD_TAG_COUNT}</div><div class="unit">{LEAD_TAG}</div></div>
    <div class="stat"><div class="trend">FRESH</div><div class="label">Most recent item</div><div class="val">{FRESHEST}</div><div class="unit">{FRESHEST_SOURCE}</div></div>
  </div>

  <div class="section-head">
    <h2>The <em>feed</em></h2>
    <span class="num">02 / HEADLINES</span>
  </div>

  <div class="content">
    <div>
      <div class="feed" id="feed">
        {HEADLINES_HTML}
      </div>
      <nav class="pager" id="pager" aria-label="Feed pagination">
        <button type="button" data-nav="prev">‹ PREV</button>
        <div class="pages" id="pages"></div>
        <span class="info">PAGE <b id="pnum">1</b>/ <span id="ptot">1</span> · <b id="prange">0</b></span>
        <button type="button" data-nav="next">NEXT ›</button>
      </nav>
    </div>

    <aside class="side">
      <div class="card">
        <div class="head"><h3>Topic mix</h3><span class="dot"></span></div>
        <div class="tag-cloud">{TAG_CLOUD_HTML}</div>
      </div>

      <div class="card">
        <div class="head"><h3>Feeds polled</h3><span class="dot"></span></div>
        {FEED_STATUS_HTML}
      </div>

      <div class="card">
        <div class="head"><h3>Run info</h3><span class="dot"></span></div>
        <div class="stat-row"><span class="k">Pulled at (UTC)</span><span class="v">{PULLED_AT_UTC}</span></div>
        <div class="stat-row"><span class="k">Total fetched</span><span class="v">{RAW_ITEMS}</span></div>
        <div class="stat-row"><span class="k">Passed keyword filter</span><span class="v hot">{TOTAL_ITEMS}</span></div>
        <div class="stat-row"><span class="k">Generator</span><span class="v">update.py · stdlib</span></div>
        <div class="stat-row"><span class="k">Page refresh</span><span class="v">meta · 60s</span></div>
      </div>
    </aside>
  </div>

  <footer>
    <div>AUTO-PULL · <em>{PULLED_AT_UTC}</em></div>
    <div>OBSERVATORY.LIVE · Public RSS aggregation · Not an operational feed</div>
    <div>CLOCK <span id="ts">—</span></div>
  </footer>

</div>
<script>
  const applyTheme = (n) => {
    document.documentElement.dataset.theme = n;
    localStorage.setItem('__theme', n);
    document.querySelectorAll('.themer button').forEach(b => b.classList.toggle('active', b.dataset.theme===n));
  };
  document.querySelectorAll('.themer button').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
  applyTheme(document.documentElement.dataset.theme);

  const tsEl = document.getElementById('ts');
  const cdEl = document.getElementById('cd');
  const start = Date.now();
  const REFRESH = 60;
  const tick = () => {
    const d = new Date();
    tsEl.textContent = d.toISOString().replace('T',' ').slice(11,19) + ' UTC';
    cdEl.textContent = String(Math.max(0, Math.ceil(REFRESH - (Date.now()-start)/1000))).padStart(2,'0');
  };
  tick(); setInterval(tick, 1000);

  // client-side pagination
  (function(){
    const PAGE_SIZE = __PAGE_SIZE__;
    const items = Array.from(document.querySelectorAll('#feed .headline'));
    const total = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    let page = parseInt(sessionStorage.getItem('__page') || '1', 10);
    if (isNaN(page) || page < 1 || page > total) page = 1;

    const pnum = document.getElementById('pnum');
    const ptot = document.getElementById('ptot');
    const prange = document.getElementById('prange');
    const pages = document.getElementById('pages');
    const prev = document.querySelector('[data-nav="prev"]');
    const next = document.querySelector('[data-nav="next"]');

    const buildPageButtons = () => {
      pages.innerHTML = '';
      for (let i = 1; i <= total; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = i;
        if (i === page) b.classList.add('active');
        b.addEventListener('click', () => { page = i; render(); });
        pages.appendChild(b);
      }
    };

    const render = () => {
      items.forEach((el, i) => {
        el.style.display = (Math.floor(i / PAGE_SIZE) + 1 === page) ? '' : 'none';
      });
      pnum.textContent = page;
      ptot.textContent = total;
      const from = (page - 1) * PAGE_SIZE + 1;
      const to = Math.min(page * PAGE_SIZE, items.length);
      prange.textContent = items.length ? `${from}–${to} OF ${items.length}` : '0';
      prev.disabled = page === 1;
      next.disabled = page === total;
      buildPageButtons();
      sessionStorage.setItem('__page', String(page));
    };

    prev.addEventListener('click', () => { if (page > 1) { page--; render(); window.scrollTo({top: document.getElementById('feed').offsetTop - 40, behavior:'smooth'}); } });
    next.addEventListener('click', () => { if (page < total) { page++; render(); window.scrollTo({top: document.getElementById('feed').offsetTop - 40, behavior:'smooth'}); } });

    if (items.length === 0) {
      document.getElementById('pager').style.display = 'none';
    } else {
      render();
    }
  })();
</script>
</body>
</html>
"""


def render_headline(item: dict, now: datetime) -> str:
    tag = tag_for(item["title"], item["desc"])
    when = human_ago(item["when"], now)
    desc = html.escape(item["desc"][:260])
    title = html.escape(item["title"])
    source = html.escape(item["source"])
    url = html.escape(item["link"], quote=True)
    return f"""<a class="headline" href="{url}" target="_blank" rel="noopener">
      <div class="meta">
        <span class="tag-chip">{tag}</span>
        <span class="source-chip">{source}</span>
        <span class="when">{when}</span>
      </div>
      <div class="title">{title}</div>
      {f'<div class="desc">{desc}</div>' if desc else ''}
    </a>"""


def main() -> int:
    print("→ pulling feeds…")
    now = datetime.now(timezone.utc)
    all_items: list[dict] = []
    feed_stats: list[tuple[str, int, bool]] = []
    raw_count = 0

    for name, url in FEEDS:
        print(f"  · {name}")
        data = fetch(url)
        if data is None:
            feed_stats.append((name, 0, False))
            continue
        parsed = parse_feed(name, data)
        raw_count += len(parsed)
        kept = [x for x in parsed if iran_related(x)]
        feed_stats.append((name, len(kept), True))
        all_items.extend(kept)

    all_items = dedupe(all_items)
    all_items.sort(key=lambda x: x["when"] or now.replace(year=1970), reverse=True)

    top = all_items[:TOP_N]
    if not top:
        print("! nothing matched keyword filter — check network?", file=sys.stderr)

    # stats
    tag_counts: dict[str, int] = {}
    for it in top:
        t = tag_for(it["title"], it["desc"])
        tag_counts[t] = tag_counts.get(t, 0) + 1
    lead_tag, lead_count = (max(tag_counts.items(), key=lambda kv: kv[1]) if tag_counts else ("—", 0))

    freshest = top[0]["when"] if top else None
    freshest_source = top[0]["source"] if top else "—"

    # compute window: from oldest kept to now
    window_hours = 24
    if top:
        oldest = min((it["when"] for it in top if it["when"]), default=None)
        if oldest:
            window_hours = max(1, int((now - oldest).total_seconds() / 3600))

    # tag cloud html
    tag_cloud_html = "".join(
        f'<span class="chip">{html.escape(t)}<em>{c}</em></span>'
        for t, c in sorted(tag_counts.items(), key=lambda kv: kv[1], reverse=True)
    ) or '<span class="chip">NO DATA</span>'

    # feed status
    feed_status_html = "".join(
        f'<div class="stat-row"><span class="k">{html.escape(n)}</span>'
        f'<span class="v {"hot" if not ok else ""}">{c if ok else "FAIL"}</span></div>'
        for n, c, ok in feed_stats
    )

    # top headline for the hero
    if top:
        first = top[0]
        top_tag = f"LATEST · {tag_for(first['title'], first['desc'])} · {human_ago(first['when'], now)}".upper()
        title_text = first["title"]
        # insert italic accent on the last word for flourish
        words = title_text.rsplit(" ", 1)
        if len(words) == 2:
            headline_html = f"{html.escape(words[0])}<br/><em>{html.escape(words[1])}</em>"
        else:
            headline_html = f"<em>{html.escape(title_text)}</em>"
    else:
        top_tag = "NO DATA · NETWORK?"
        headline_html = "No <em>signal.</em>"

    headlines_html = "\n".join(render_headline(it, now) for it in top) or \
        '<div class="headline"><div class="title">No items matched.</div><div class="desc">Check network or adjust keyword filter.</div></div>'

    subs = {
        "PULLED_AT_UTC":   now.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "PULLED_AT_HUMAN": now.strftime("%d %b %Y · %H:%M UTC"),
        "SOURCE_COUNT":    str(len(FEEDS)),
        "TOTAL_ITEMS":     str(len(top)),
        "RAW_ITEMS":       str(raw_count),
        "WINDOW_HOURS":    str(window_hours),
        "TOP_TAG":         top_tag,
        "LATEST_HEADLINE_HTML": headline_html,
        "LEAD_TAG":        lead_tag,
        "LEAD_TAG_COUNT":  str(lead_count),
        "FRESHEST":        human_ago(freshest, now),
        "FRESHEST_SOURCE": freshest_source,
        "HEADLINES_HTML":  headlines_html,
        "TAG_CLOUD_HTML":  tag_cloud_html,
        "FEED_STATUS_HTML": feed_status_html,
    }

    out = HTML_TEMPLATE.replace("__PAGE_SIZE__", str(PAGE_SIZE))
    for k, v in subs.items():
        out = out.replace("{" + k + "}", v)

    (HERE / "index.html").write_text(out, encoding="utf-8")
    (HERE / "data.json").write_text(json.dumps({
        "generated_at": subs["PULLED_AT_UTC"],
        "total_items": len(top),
        "raw_items": raw_count,
        "tag_counts": tag_counts,
        "items": [
            {
                "source": it["source"],
                "title": it["title"],
                "link": it["link"],
                "desc": it["desc"],
                "when": it["when"].isoformat() if it["when"] else None,
                "tag": tag_for(it["title"], it["desc"]),
            }
            for it in top
        ],
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"✓ {len(top)} items written · {raw_count} raw fetched · lead tag {lead_tag} ({lead_count})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
