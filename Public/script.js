const API = window.location.port === "5500" ? "http://localhost:8080" : "";
const $ = (id) => document.getElementById(id);
let allEvents = [];

/* ---------- helpers ---------- */
const esc = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
const pad = (n) => String(n).padStart(2, "0");
const fmt24 = (m) => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
function fmt12(m) {                               // 885 -> "2:45 PM"
  const h = Math.floor(m / 60), mm = m % 60;
  return (h % 12 === 0 ? 12 : h % 12) + ":" + pad(mm) + " " + (h >= 12 ? "PM" : "AM");
}
const toMin = (t) => { const p = t.split(":"); return +p[0] * 60 + +p[1]; };
const to12 = (t) => fmt12(toMin(t));
const hourLong = (h) => (h % 12 === 0 ? 12 : h % 12) + " " + (h >= 12 ? "PM" : "AM");
const hourShort = (h) => (h % 12 === 0 ? 12 : h % 12) + (h >= 12 ? "PM" : "AM");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateStr = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
const parseDate = (s) => new Date(s + "T00:00:00");
const pretty = (s, opts) => { const d = parseDate(s); return isNaN(d) ? "" : d.toLocaleDateString("en-IN", opts); };
function clubHue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
const clean = (v) => v.trim().replace(/["\\]/g, "'").replace(/\|/g, "/");

/* ---------- alarm-style scroll wheel ---------- */
const H = 40;   // height of one row, must match .it height in the CSS

class Wheel {
  constructor(root, items, index, onChange) {
    this.root = root;
    this.onChange = onChange || (() => {});
    this.idx = 0;
    this.moved = false;
    root.classList.add("wheel");
    root.tabIndex = 0;
    this.setItems(items, index || 0);

    root.addEventListener("scroll", () => {
      const i = Math.max(0, Math.min(this.items.length - 1, Math.round(root.scrollTop / H)));
      if (i !== this.idx) { this.idx = i; this.mark(); }
      clearTimeout(this.t);
      this.t = setTimeout(() => this.onChange(this.value), 90);
    });

    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); this.go(this.idx + 1); }
      if (e.key === "ArrowUp")   { e.preventDefault(); this.go(this.idx - 1); }
    });

    // mouse dragging (touch screens scroll natively)
    let drag = null;
    root.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      drag = { y: e.clientY, top: root.scrollTop };
      this.moved = false;
      root.style.scrollSnapType = "none";
      root.classList.add("drag");
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (Math.abs(dy) > 4) this.moved = true;
      root.scrollTop = drag.top - dy;
    });
    window.addEventListener("pointerup", () => {
      if (!drag) return;
      drag = null;
      root.style.scrollSnapType = "";
      root.classList.remove("drag");
      this.go(Math.round(root.scrollTop / H));
    });
  }

  setItems(items, index) {
    this.items = items;
    this.root.innerHTML = '<div class="sp"></div>' +
      items.map((it) => '<div class="it">' + it.label + "</div>").join("") +
      '<div class="sp"></div>';
    this.els = this.root.querySelectorAll(".it");
    this.els.forEach((el, i) => {
      el.onclick = () => {
        if (this.moved) { this.moved = false; return; }
        this.go(i);
      };
    });
    this.idx = Math.max(0, Math.min(items.length - 1, index));
    this.root.scrollTop = this.idx * H;
    this.mark();
  }

  mark() { this.els.forEach((el, i) => el.classList.toggle("sel", i === this.idx)); }
  go(i) {
    i = Math.max(0, Math.min(this.items.length - 1, i));
    this.root.scrollTo({ top: i * H, behavior: "smooth" });
  }
  refresh() { this.root.scrollTop = this.idx * H; this.mark(); }   // used when a hidden panel opens
  get value() { return this.items[this.idx].value; }
  setValue(v) {
    const i = this.items.findIndex((x) => x.value === v);
    if (i < 0) return;
    this.idx = i;
    this.root.scrollTop = i * H;
    this.mark();
  }
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const items = (arr, fn) => arr.map((v) => ({ value: v, label: fn ? fn(v) : String(v) }));
const daysIn = (y, m) => new Date(y, m, 0).getDate();      // m = 1..12

/* ---------- date wheels ---------- */
const now = new Date();
const thisYear = now.getFullYear();

const wDay = new Wheel($("wDay"), items(range(1, daysIn(thisYear, now.getMonth() + 1))), now.getDate() - 1, updateSummary);
const wMonth = new Wheel($("wMonth"), items(range(1, 12), (m) => MONTHS[m - 1]), now.getMonth(), rebuildDays);
const wYear = new Wheel($("wYear"), items(range(thisYear, thisYear + 4)), 0, rebuildDays);

function rebuildDays() {
  const n = daysIn(wYear.value, wMonth.value);
  if (wDay.items.length !== n) wDay.setItems(items(range(1, n)), Math.min(wDay.idx, n - 1));
  updateSummary();
}

/* ---------- time wheels ---------- */
function timeWheels(h, m, a, onChange) {
  return {
    h: new Wheel($(h), items(range(1, 12)), 9, onChange),            // 10
    m: new Wheel($(m), items(range(0, 59), pad), 0, onChange),
    a: new Wheel($(a), items(["AM", "PM"]), 0, onChange),
  };
}
const S = timeWheels("sH", "sM", "sA", onStartChange);
const E = timeWheels("eH", "eM", "eA", updateSummary);
E.h.setValue(11);                                                    // default 10:00 to 11:00 AM

const getMin = (g) => (g.h.value % 12 + (g.a.value === "PM" ? 12 : 0)) * 60 + g.m.value;
function setMin(g, m) {
  const h24 = Math.floor(m / 60);
  g.h.setValue(h24 % 12 || 12);
  g.m.setValue(m % 60);
  g.a.setValue(h24 >= 12 ? "PM" : "AM");
}

function onStartChange() {
  const s = getMin(S);
  if (getMin(E) <= s) setMin(E, Math.min(s + 60, 1439));            // keep end after start
  updateSummary();
}

function currentDate() { return dateStr(wYear.value, wMonth.value, wDay.value); }

function updateSummary() {
  const s = getMin(S), e = getMin(E);
  $("vDate").textContent = wDay.value + " " + MONTHS[wMonth.value - 1] + " " + wYear.value;
  $("vStart").textContent = fmt12(s);
  $("vEnd").textContent = fmt12(e);
  const el = $("summary");
  if (e <= s) {
    el.className = "summary warn";
    el.textContent = "End time must be after the start time.";
    return;
  }
  const dur = e - s;
  const txt = (dur >= 60 ? Math.floor(dur / 60) + " h " : "") + (dur % 60 ? (dur % 60) + " min" : "");
  el.className = "summary";
  el.textContent = pretty(currentDate(), { weekday: "long", day: "numeric", month: "long" }) +
                   " · " + fmt12(s) + " – " + fmt12(e) + " (" + txt.trim() + ")";
}

/* ---------- chips that open each wheel panel ---------- */
const panels = { date: "p-date", start: "p-start", end: "p-end" };
const wheelsOf = { date: [wDay, wMonth, wYear], start: [S.h, S.m, S.a], end: [E.h, E.m, E.a] };
document.querySelectorAll(".seg").forEach((btn) => {
  btn.onclick = () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".seg").forEach((x) => x.classList.toggle("active", x === btn));
    for (const k in panels) $(panels[k]).hidden = k !== tab;
    wheelsOf[tab].forEach((w) => w.refresh());
  };
});

updateSummary();

/* ---------- server status ---------- */
function setStatus(ok) {
  $("status").className = "status " + (ok ? "on" : "off");
  $("status").querySelector("b").textContent = ok ? "Server connected" : "Server offline";
}

/* ---------- registered events ---------- */
function renderList() {
  $("count").textContent = allEvents.length;
  if (allEvents.length === 0) {
    $("list").innerHTML = '<div class="list-empty">No events registered yet.</div>';
    return;
  }
  const sorted = [...allEvents].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  $("list").innerHTML = sorted.map((e) => {
    const hue = clubHue(e.club);
    return '<div class="ev">' +
      '<div class="ev-date"><b>' + pretty(e.date, { day: "numeric" }) + "</b><span>" +
        pretty(e.date, { month: "short" }).toUpperCase() + "</span></div>" +
      '<div class="ev-main"><b>' + esc(e.name) + "</b><div class=\"ev-sub\">" +
        '<span class="tag" style="background:hsl(' + hue + ",75%,94%);color:hsl(" + hue + ',55%,32%)">' + esc(e.club) + "</span>" +
        "<span>" + esc(e.venue) + "</span></div></div>" +
      '<div class="ev-time"><b>' + fmt12(e.start) + "</b>to " + fmt12(e.end) + "</div></div>";
  }).join("");
}

/* ---------- analytics ---------- */
function renderStats(s) {
  const hrs = s.hours.slice(7, 23);                                 // 7 AM .. 10 PM
  const peak = Math.max(0, ...hrs);
  const peakAll = Math.max(0, ...s.hours);
  const busiest = peakAll > 0 ? fmt12(s.hours.indexOf(peakAll) * 60) : "–";
  const venues = new Set(allEvents.map((e) => e.venue.toLowerCase())).size;

  $("tiles").innerHTML =
    '<div class="tile"><b>' + s.added + "</b><span>Events</span></div>" +
    '<div class="tile"><b>' + s.clashes + "</b><span>Clashes caught</span></div>" +
    '<div class="tile"><b>' + busiest + "</b><span>Busiest hour</span></div>" +
    '<div class="tile"><b>' + venues + "</b><span>Venues in use</span></div>";

  let chart = '<div class="chart">';
  hrs.forEach((c, i) => {
    const pct = peak ? Math.max((c / peak) * 100, 4) : 4;
    const top = c === peak && c > 0 ? " top" : "";
    chart += '<div class="col"><div class="bar-wrap">' +
      (c ? '<span class="val" style="bottom:calc(' + pct + '% + 3px)">' + c + "</span>" : "") +
      '<div class="bar' + top + '" style="height:' + pct + '%" title="' + hourLong(i + 7) + ": " + c + ' events"></div>' +
      '</div><span class="lbl">' + hourShort(i + 7) + "</span></div>";
  });
  $("chart").innerHTML = chart + "</div>";

  $("clubs").innerHTML = s.clubs.length === 0
    ? '<p class="muted">No clashes yet. Great scheduling!</p>'
    : s.clubs.map((c) => '<div class="club-line"><span>' + esc(c.club) + '</span><span class="count">' + c.count + "</span></div>").join("");
}

async function refresh() {
  try {
    const [ev, st] = await Promise.all([
      fetch(API + "/events").then((r) => r.json()),
      fetch(API + "/stats").then((r) => r.json()),
    ]);
    allEvents = ev;
    setStatus(true);
    renderList();
    renderStats(st);
  } catch (err) {
    setStatus(false);
  }
}

/* ---------- result message ---------- */
const times12 = (str) => str.replace(/(\d{2}):(\d{2})/g, (m, h, mi) => fmt12(+h * 60 + +mi));

function box(kind, icon, html) {
  $("result").innerHTML = '<div class="result ' + kind + '"><div class="r-ico">' + icon +
                          '</div><div class="r-body">' + html + "</div></div>";
}

function showResult(data) {
  if (data.added) {
    box("ok", "&#10003;", '<p class="r-title">Event added</p><p>No clashes found. It is now on the schedule.</p>');
    return;
  }
  if (data.error) { box("bad", "!", "<p>" + esc(data.error) + "</p>"); return; }

  let html = '<p class="r-title">Clash detected</p><p>' + esc(times12(data.explanation)) + "</p>";
  if (data.suggestions.length > 0) {
    html += "<p>Try one of these instead:</p><div class='chips'>";
    data.suggestions.forEach((s) => {
      html += '<div class="chip" data-start="' + s.start + '" data-end="' + s.end + '">' +
              "<b>" + to12(s.start) + " – " + to12(s.end) + "</b><span>" + esc(s.reason) + "</span></div>";
    });
    html += "</div>";
  } else {
    html += "<p>No free slot found on this day.</p>";
  }
  box("bad", "!", html);

  // clicking a suggestion moves the wheels to that time
  document.querySelectorAll(".chip").forEach((c) => {
    c.onclick = () => {
      setMin(S, toMin(c.dataset.start));
      setMin(E, toMin(c.dataset.end));
      updateSummary();
    };
  });
}

/* ---------- add button ---------- */
$("add").onclick = async () => {
  for (const f of ["name", "club", "venue"]) {
    if (!$(f).value.trim()) {
      box("bad", "!", "<p>Please fill in the event name, club and venue.</p>");
      return;
    }
  }
  const s = getMin(S), e = getMin(E);
  if (e <= s) { box("bad", "!", "<p>End time must be after the start time.</p>"); return; }

  const p = {
    name: clean($("name").value),
    club: clean($("club").value),
    venue: clean($("venue").value),
    date: currentDate(),
    start: fmt24(s),
    end: fmt24(e),
  };
  const q = Object.keys(p).map((k) => k + "=" + encodeURIComponent(p[k])).join("&");

  $("add").disabled = true;
  try {
    const res = await fetch(API + "/add?" + q);
    const data = await res.json();
    showResult(data);
    if (data.added) $("name").value = "";
    await refresh();
  } catch (err) {
    setStatus(false);
    box("bad", "!", "<p>Cannot reach the server. Is server.exe running?</p>");
  }
  $("add").disabled = false;
};

refresh();