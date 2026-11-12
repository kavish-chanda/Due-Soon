(function () {
    var RO = false;
    var KEY = "duesoon.items", items = [], editId = null;
    try { items = JSON.parse(localStorage.getItem(KEY) || "[]"); if (!Array.isArray(items)) items = []; } catch (e) { items = []; }
    (function () {
        var m = location.hash.match(/^#share=(.+)$/); if (!m) return;
        try { items = JSON.parse(decodeURIComponent(escape(atob(m[1])))).map(function (i, n) { i.id = n + 1; i.done = false; return i; }); RO = true; document.documentElement.className = "ro"; document.querySelector(".sub").textContent = "Shared list (read only)"; } catch (e) { }
    })();
    function save() { if (RO) return; try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { } }

    function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function diff(s) { return Math.round((parse(s) - today()) / 86400000); }
    function fmt(s) { return parse(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function esc(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
    function link(t) { return esc(t).replace(/https?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>'; }); }
    function hue(s) { var h = 0; s = s.toLowerCase(); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
    function color(s) { return s ? "hsl(" + hue(s) + " 62% 46%)" : "var(--line)"; }

    var f = document.getElementById("f"), list = document.getElementById("list"), banner = document.getElementById("banner"), prog = document.getElementById("prog");
    var title = document.getElementById("title"), subj = document.getElementById("subj"), due = document.getElementById("due"),
        pri = document.getElementById("pri"), rep = document.getElementById("rep"), go = document.getElementById("go"), cancel = document.getElementById("cancel"),
        mins = document.getElementById("mins"), notes = document.getElementById("notes"), tst = document.getElementById("tst");

    function resetForm() {
        editId = null; f.reset();
        due.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        go.textContent = "Add assignment"; cancel.hidden = true;
    }
    resetForm();

    f.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = { title: title.value.trim(), subj: subj.value.trim(), due: due.value, pri: pri.checked, rep: rep.value, mins: +mins.value || 0, notes: notes.value.trim(), test: tst.checked };
        if (editId) { items.forEach(function (i) { if (i.id === editId) { for (var k in data) i[k] = data[k]; } }); }
        else { data.id = Date.now(); data.done = false; items.push(data); }
        save(); resetForm(); render(); title.focus();
    });
    cancel.addEventListener("click", resetForm);

    list.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-a]"); if (!b) return;
        var id = +b.dataset.id, a = b.dataset.a;
        if (a === "plan") { showPlan(id); return; }
        if (a === "del") { items = items.filter(function (i) { return i.id !== id; }); }
        else if (a === "edit") {
            var i = items.filter(function (x) { return x.id === id; })[0]; if (!i) return;
            editId = id; title.value = i.title; subj.value = i.subj || ""; due.value = i.due; pri.checked = !!i.pri; rep.value = i.rep || "none"; mins.value = i.mins || ""; notes.value = i.notes || ""; tst.checked = !!i.test;
            go.textContent = "Save changes"; cancel.hidden = false; f.scrollIntoView({ behavior: "smooth" }); title.focus(); return;
        }
        else {
            items.forEach(function (i) {
                if (i.id !== id) return;
                i.done = !i.done; i.doneAt = i.done ? Date.now() : 0;
                if (i.done && i.rep && i.rep !== "none" && !i.spawned) {
                    i.spawned = true;
                    items.push({ id: Date.now() + 1, title: i.title, subj: i.subj, due: addDays(i.due, i.rep === "daily" ? 1 : 7), pri: i.pri, rep: i.rep, done: false });
                }
            });
        }
        save(); render();
        if (a === "done" && items.length && !items.some(function (i) { return !i.done; })) confetti();
    });

    function row(i) {
        var n = diff(i.due), cls = i.done ? "done" : n < 0 ? "late" : n === 0 ? "today" : "";
        var num = i.done ? "✓" : Math.abs(n), lab = i.done ? "done" : n < 0 ? "days late" : n === 0 ? "today" : n === 1 ? "day left" : "days left";
        if (!i.done && n === 0) num = "!";
        var rp = i.rep && i.rep !== "none" ? " · repeats " + i.rep : "";
        return '<li class="' + cls + '" style="--c:' + color(i.subj) + '"><div class="days">' + num + '<small>' + lab + '</small></div>' +
            '<div><div class="t">' + (i.pri ? '<span class="star" title="High priority">★</span>' : '') + esc(i.title) + '</div>' +
            '<div class="m">' + (i.subj ? '<span class="chip">' + esc(i.subj) + '</span>' : '') + fmt(i.due) + rp + (i.mins ? " · " + i.mins + " min" : "") + '</div>' + (i.notes ? '<div class="m">' + link(i.notes) + '</div>' : '') + '</div>' +
            '<div class="acts"><button data-a="done" data-id="' + i.id + '">' + (i.done ? "Undo" : "Mark done") + '</button>' +
            (i.test && !i.done ? '<button data-a="plan" data-id="' + i.id + '">Study plan</button>' : '') + '<button data-a="edit" data-id="' + i.id + '">Edit</button>' +
            '<button data-a="del" data-id="' + i.id + '" aria-label="Delete ' + esc(i.title) + '">Delete</button></div></li>';
    }

    function section(name, arr) {
        if (!arr.length) return "";
        return '<h2>' + name + ' <span>' + arr.length + '</span></h2><ul>' + arr.map(row).join("") + '</ul>';
    }

    function count(arr, fn) { return arr.filter(fn).length; }

    function render() {
        drawTools();
        var qv = qEl.value.trim().toLowerCase(), fv = flt.value;
        var vis = items.filter(function (i) { return (!fv || i.subj === fv) && (!qv || (i.title + " " + (i.subj || "") + " " + (i.notes || "")).toLowerCase().indexOf(qv) > -1); });
        var ao = items.filter(function (i) { return !i.done; });
        var open = vis.filter(function (i) { return !i.done; }).sort(function (a, b) {
            if (a.due !== b.due) return a.due < b.due ? -1 : 1;
            return (b.pri ? 1 : 0) - (a.pri ? 1 : 0);
        });
        var done = vis.filter(function (i) { return i.done; });

        var subs = []; items.forEach(function (i) { if (i.subj && subs.indexOf(i.subj) < 0) subs.push(i.subj); }); subs.sort();
        flt.innerHTML = '<option value="">All subjects</option>' + subs.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join(""); flt.value = subs.indexOf(fv) > -1 ? fv : "";
        var tm0 = ao.reduce(function (n, i) { return n + (i.mins || 0); }, 0);
        totalEl.textContent = tm0 ? "About " + (tm0 >= 60 ? Math.floor(tm0 / 60) + " h " : "") + (tm0 % 60 ? tm0 % 60 + " min " : "") + "of work left" : "";
        var late = count(ao, function (i) { return diff(i.due) < 0; }), td = count(ao, function (i) { return diff(i.due) === 0; }), tm = count(ao, function (i) { return diff(i.due) === 1; });
        var msg = []; if (late) msg.push(late + " overdue"); if (td) msg.push(td + " due today"); if (tm) msg.push(tm + " due tomorrow");
        banner.hidden = !msg.length; banner.textContent = msg.join(", "); banner.className = "banner" + (late ? " late" : "");

        var wk = items.filter(function (i) { return diff(i.due) <= 7; }), wd = count(wk, function (i) { return i.done; });
        prog.hidden = !wk.length;
        prog.innerHTML = '<div class="bar"><i style="width:' + Math.round(wd / (wk.length || 1) * 100) + '%"></i></div><span>' + wd + ' of ' + wk.length + ' done this week</span>';

        if (!items.length) { list.innerHTML = '<div class="empty">Nothing due. Add your first assignment above.</div>'; return; }
        list.innerHTML =
            section("Overdue", open.filter(function (i) { return diff(i.due) < 0; })) +
            section("Due today", open.filter(function (i) { return diff(i.due) === 0; })) +
            section("This week", open.filter(function (i) { var n = diff(i.due); return n > 0 && n <= 7; })) +
            section("Later", open.filter(function (i) { return diff(i.due) > 7; })) +
            section("Done", done);
    }
    // Study helper: searches Simple English Wikipedia, Wikipedia, Wikibooks and Wikiversity (free, no key)
    var hf = document.getElementById("hf"), hq = document.getElementById("hq"), hr = document.getElementById("hr");
    var SOURCES = [["simple.wikipedia.org", "Simple explanation"], ["en.wikipedia.org", "Wikipedia"], ["en.wikibooks.org", "Wikibooks textbooks"], ["en.wikiversity.org", "Wikiversity lessons"]];
    function plain(s) { var x = document.createElement("div"); x.innerHTML = s; return x.textContent; }
    function search(site, label, q) {
        var url = "https://" + site + "/w/api.php?action=query&list=search&srlimit=5&srenablerewrites=1&srinfo=suggestion&format=json&origin=*&srsearch=" + encodeURIComponent(q);
        return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
            var qq = d.query || {};
            return {
                label: label, sug: (qq.searchinfo && qq.searchinfo.suggestion) || "", hits: (qq.search || []).map(function (x) {
                    return { t: x.title, s: plain(x.snippet), u: "https://" + site + "/wiki/" + encodeURIComponent(x.title.replace(/ /g, "_")) };
                })
            };
        }).catch(function () { return { label: label, sug: "", hits: [] }; });
    }
    function runAll(q) { return Promise.all(SOURCES.map(function (s) { return search(s[0], s[1], q); })); }
    function total(res) { return res.reduce(function (n, r) { return n + r.hits.length; }, 0); }
    function summary(title) {
        function get(site) {
            return fetch("https://" + site + "/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_"))).then(function (r) {
                if (!r.ok) throw new Error("no"); return r.json();
            }).then(function (d) { if (!d.extract || d.type === "disambiguation") throw new Error("no"); return d; });
        }
        return get("simple.wikipedia.org").catch(function () { return get("en.wikipedia.org"); }).catch(function () { return null; });
    }
    function show(q, shown, res, sum) {
        var out = "";
        if (shown !== q) out += '<p class="m">Showing results for <b>' + esc(shown) + '</b></p>';
        if (sum) {
            out += '<div class="quick">' + (sum.thumbnail ? '<img src="' + sum.thumbnail.source + '" alt="" loading="lazy">' : '') +
                '<div><h3>' + esc(sum.title) + '</h3><p>' + esc(sum.extract) + '</p>' +
                '<a href="' + sum.content_urls.desktop.page + '" target="_blank" rel="noopener">Read the full article</a></div></div>';
        }
        var e = encodeURIComponent(shown);
        out += '<div class="src">' +
            '<a href="https://www.wolframalpha.com/input?i=' + e + '" target="_blank" rel="noopener">Wolfram Alpha (math)</a>' +
            '<a href="https://www.youtube.com/results?search_query=' + e + '+explained" target="_blank" rel="noopener">YouTube videos</a>' +
            '<a href="https://www.khanacademy.org/search?page_search_query=' + e + '" target="_blank" rel="noopener">Khan Academy</a>' +
            '<a href="https://openstax.org/subjects" target="_blank" rel="noopener">OpenStax textbooks</a></div>';
        out += '<p class="m">Attach links to: <select id="att">' + items.filter(function (i) { return !i.done; }).map(function (i) { return '<option value="' + i.id + '">' + esc(i.title) + '</option>'; }).join("") + '</select></p>';
        var seen = {};
        res.forEach(function (r) {
            var hits = r.hits.filter(function (h) { if (seen[h.u]) return false; seen[h.u] = 1; return true; });
            if (!hits.length) return;
            out += '<h2>' + esc(r.label) + '</h2>' + hits.map(function (h) {
                return '<div class="hit"><h3><a href="' + h.u + '" target="_blank" rel="noopener">' + esc(h.t) + '</a></h3><div>' + esc(h.s) + '...</div><button type="button" class="ghost" data-att="' + h.u + '">Attach to assignment</button></div>';
            }).join("");
        });
        if (!sum && !total(res)) out += '<div class="empty">No results. Try different words, like the main term only.</div>';
        hr.innerHTML = out;
    }
    hf.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = hq.value.trim(); if (!q) return;
        hr.innerHTML = '<p class="m">Searching...</p>';
        runAll(q).then(function (res) {
            var sug = "";
            res.forEach(function (r) { if (!sug && r.sug) sug = r.sug; });
            if (total(res) < 2 && sug) { return runAll(sug).then(function (r2) { return [sug, r2]; }); }
            return [q, res];
        }).then(function (p) {
            var shown = p[0], res = p[1];
            var top = (res[1].hits[0] || res[0].hits[0] || {}).t;
            return (top ? summary(top) : Promise.resolve(null)).then(function (sum) { show(q, shown, res, sum); });
        }).catch(function () {
            hr.innerHTML = '<div class="empty">Search could not load. Check your internet connection, or open the site from your own hosting.</div>';
        });
    });

    // controls
    var qEl = document.getElementById("q"), flt = document.getElementById("flt"), totalEl = document.getElementById("total");
    qEl.addEventListener("input", render); flt.addEventListener("change", render);

    function store(k, v) { if (RO && v !== undefined) return null; try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; }

    // themes
    var root = document.documentElement, themeSel = document.getElementById("themeSel"), savedT = store("duesoon.theme");
    if (savedT && savedT !== "auto") root.setAttribute("data-theme", savedT);
    themeSel.value = savedT || "auto";
    themeSel.addEventListener("change", function () {
        if (themeSel.value === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", themeSel.value);
        store("duesoon.theme", themeSel.value);
    });

    // export / import
    document.getElementById("exp").addEventListener("click", function () {
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(items, null, 2)], { type: "application/json" }));
        a.download = "due-soon-backup.json"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    document.getElementById("imp").addEventListener("change", function (e) {
        var file = e.target.files[0]; if (!file) return; var r = new FileReader();
        r.onload = function () {
            try {
                var d = JSON.parse(r.result);
                if (!Array.isArray(d) || !d.every(function (i) { return i && typeof i.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.due); })) throw new Error("bad");
                if (confirm("Replace your current list with " + d.length + " assignments from this file?")) { items = d.map(function (i, n) { i.id = i.id || Date.now() + n; return i; }); save(); render(); }
            } catch (err) { alert("That file is not a Due Soon backup."); }
            e.target.value = "";
        };
        r.readAsText(file);
    });

    // confetti
    function confetti() {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        var c = document.getElementById("cf"), x = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
        var cols = ["#ffe14d", "#2f6bff", "#d9482b", "#27ae60", "#ff8fb1"], p = [];
        for (var n = 0; n < 140; n++) p.push({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .4, vx: Math.random() * 4 - 2, vy: 2 + Math.random() * 4, s: 5 + Math.random() * 6, c: cols[n % 5] });
        var t0 = Date.now();
        (function frame() {
            x.clearRect(0, 0, c.width, c.height);
            p.forEach(function (q) { q.x += q.vx; q.y += q.vy; x.fillStyle = q.c; x.fillRect(q.x, q.y, q.s, q.s * .6); });
            if (Date.now() - t0 < 2800) requestAnimationFrame(frame); else x.clearRect(0, 0, c.width, c.height);
        })();
    }

    // streak: days in a row with nothing overdue
    (function () {
        var ts = addDays(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), 0), S = { d: "", n: 0 };
        try { S = JSON.parse(store("duesoon.streak") || "{}") || S; } catch (e) { }
        var overdue = items.some(function (i) { return !i.done && diff(i.due) < 0; });
        if (overdue) S = { d: ts, n: 0 };
        else if (S.d !== ts) S = { d: ts, n: S.d === addDays(ts, -1) ? (S.n || 0) + 1 : 1 };
        store("duesoon.streak", JSON.stringify(S));
        document.getElementById("streak").textContent = S.n > 0 ? "🔥 " + S.n + "-day streak with nothing overdue" : "";
    })();

    // alerts: beep and vibrate on open if something is due today or overdue
    var alertBtn = document.getElementById("alert");
    function alertLabel() { alertBtn.textContent = "Alerts: " + (store("duesoon.alert") === "1" ? "on" : "off"); }
    alertLabel();
    alertBtn.addEventListener("click", function () { store("duesoon.alert", store("duesoon.alert") === "1" ? "0" : "1"); alertLabel(); });
    if (store("duesoon.alert") === "1" && items.some(function (i) { return !i.done && diff(i.due) <= 0; })) {
        try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
        try { var ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(); o.connect(ac.destination); o.frequency.value = 660; o.start(); o.stop(ac.currentTime + .25); } catch (e) { }
    }

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () { });

    // more tools
    function load(k, d) { try { return JSON.parse(store(k) || "") || d; } catch (e) { return d; } }
    function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function beep() { try { var ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(); o.connect(ac.destination); o.frequency.value = 660; o.start(); o.stop(ac.currentTime + .4); navigator.vibrate && navigator.vibrate(300); } catch (e) { } }
    var calM = new Date(); calM.setDate(1);
    var cards = load("duesoon.cards", []), ci = 0, flip = false, grades = load("duesoon.grades", []);
    var tsub = document.getElementById("tsub"), tdisp = document.getElementById("tdisp"), tgo = document.getElementById("tgo"), timer = null, tend = 0;

    function drawCal() {
        var y = calM.getFullYear(), m = calM.getMonth(), first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), ts = iso(today());
        var o = '<div class="calh"><button type="button" class="ghost" data-c="-1" aria-label="Previous month">‹</button><b>' + calM.toLocaleDateString(undefined, { month: "long", year: "numeric" }) + '</b><button type="button" class="ghost" data-c="1" aria-label="Next month">›</button></div><div class="cal">';
        "SMTWTFS".split("").forEach(function (d) { o += "<b>" + d + "</b>"; });
        for (var b = 0; b < first; b++) o += "<div></div>";
        for (var d = 1; d <= n; d++) {
            var ds = y + "-" + pad(m + 1) + "-" + pad(d), l = items.filter(function (i) { return i.due === ds && !i.done; });
            o += '<div class="cd' + (ds === ts ? " tdy" : "") + '"><span>' + d + '</span>' + l.slice(0, 2).map(function (i) { return '<i style="background:' + color(i.subj) + '">' + esc(i.title) + '</i>'; }).join("") + (l.length > 2 ? "<em>+" + (l.length - 2) + "</em>" : "") + "</div>";
        }
        document.getElementById("cal").innerHTML = o + "</div>";
    }
    document.getElementById("cal").addEventListener("click", function (e) { var b = e.target.closest("[data-c]"); if (!b) return; calM.setMonth(calM.getMonth() + +b.dataset.c); drawCal(); });

    function drawSummary() {
        var w = items.filter(function (i) { return i.done && i.doneAt && Date.now() - i.doneAt < 6048e5; }), by = {}, mn = 0;
        w.forEach(function (i) { var s = i.subj || "No subject"; by[s] = (by[s] || 0) + 1; mn += i.mins || 0; });
        document.getElementById("sum").textContent = w.length ? "Finished " + w.length + " in the last 7 days" + (mn ? " (about " + mn + " min of work)" : "") + ": " + Object.keys(by).map(function (s) { return s + " " + by[s]; }).join(", ") : "Nothing finished in the last 7 days yet.";
    }

    function drawLog() {
        var subs = []; items.forEach(function (i) { if (i.subj && subs.indexOf(i.subj) < 0) subs.push(i.subj); });
        var cur = tsub.value; tsub.innerHTML = "<option>General</option>" + subs.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join(""); if (cur) tsub.value = cur;
        var lg = load("duesoon.log", {}), k = Object.keys(lg);
        document.getElementById("tlog").textContent = k.length ? "Studied: " + k.map(function (s) { return s + " " + lg[s] + " min"; }).join(", ") : "No study time logged yet.";
    }
    function tick() {
        var s = Math.max(0, Math.round((tend - Date.now()) / 1000)); tdisp.textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60);
        if (s > 0) return;
        clearInterval(timer); timer = null; tgo.textContent = "Start"; beep();
        var lg = load("duesoon.log", {}), m = +document.getElementById("tmin").value || 25; lg[tsub.value] = (lg[tsub.value] || 0) + m; store("duesoon.log", JSON.stringify(lg)); drawLog();
    }
    tgo.addEventListener("click", function () {
        if (timer) { clearInterval(timer); timer = null; tgo.textContent = "Start"; tdisp.textContent = pad(+document.getElementById("tmin").value || 25) + ":00"; return; }
        tend = Date.now() + (+document.getElementById("tmin").value || 25) * 60000; tgo.textContent = "Stop"; tick(); timer = setInterval(tick, 500);
    });

    function drawGrades() {
        var by = {}; grades.forEach(function (g) { (by[g.c] = by[g.c] || []).push(g.s); });
        var k = Object.keys(by);
        document.getElementById("gl").innerHTML = k.length ? k.map(function (c) {
            var a = by[c].reduce(function (x, y) { return x + y; }, 0) / by[c].length;
            return '<p class="trow"><b>' + esc(c) + '</b> average ' + a.toFixed(1) + '% (' + by[c].length + ' scores) <button class="ghost" data-g="' + esc(c) + '">Clear</button></p>';
        }).join("") : '<p class="m">No grades yet.</p>';
    }
    document.getElementById("gf").addEventListener("submit", function (e) {
        e.preventDefault();
        grades.push({ c: document.getElementById("gc").value.trim(), s: +document.getElementById("gs").value }); store("duesoon.grades", JSON.stringify(grades)); e.target.reset(); drawGrades();
    });
    document.getElementById("gl").addEventListener("click", function (e) {
        var b = e.target.closest("[data-g]"); if (!b) return;
        grades = grades.filter(function (g) { return g.c !== b.dataset.g; }); store("duesoon.grades", JSON.stringify(grades)); drawGrades();
    });

    function drawCards() {
        var kc = document.getElementById("kc");
        if (!cards.length) { kc.innerHTML = '<p class="m">Add a card above.</p>'; return; }
        ci = Math.min(ci, cards.length - 1);
        kc.innerHTML = '<div class="card" data-k="flip">' + esc(flip ? cards[ci].a : cards[ci].q) + '</div><div class="trow"><button class="ghost" data-k="prev">Prev</button><button class="ghost" data-k="next">Next</button><button class="ghost" data-k="del">Delete</button><span class="m">Card ' + (ci + 1) + " of " + cards.length + ". Tap the card to flip.</span></div>";
    }
    document.getElementById("kf").addEventListener("submit", function (e) {
        e.preventDefault();
        cards.push({ q: document.getElementById("kq").value.trim(), a: document.getElementById("ka").value.trim() }); store("duesoon.cards", JSON.stringify(cards)); e.target.reset(); ci = cards.length - 1; flip = false; drawCards();
    });
    document.getElementById("kc").addEventListener("click", function (e) {
        var b = e.target.closest("[data-k]"); if (!b) return; var k = b.dataset.k;
        if (k === "flip") flip = !flip; else { flip = false; if (k === "next") ci = (ci + 1) % cards.length; if (k === "prev") ci = (ci - 1 + cards.length) % cards.length; if (k === "del") { cards.splice(ci, 1); store("duesoon.cards", JSON.stringify(cards)); } }
        drawCards();
    });

    function showPlan(id) {
        var t = items.filter(function (i) { return i.id === id; })[0]; if (!t) return;
        var tp = (t.notes || "").split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean), days = Math.max(1, diff(t.due)), o = "";
        if (!tp.length) { document.getElementById("plan").textContent = "Add topics to the Notes of this test, separated by commas, then try again."; }
        else {
            var per = Math.ceil(tp.length / days), d = 0;
            for (var n = 0; n < tp.length; n += per) { var day = new Date(today()); day.setDate(day.getDate() + d); o += "<li><b>" + day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ":</b> " + esc(tp.slice(n, n + per).join(", ")) + "</li>"; d++; }
            document.getElementById("plan").innerHTML = "<p><b>" + esc(t.title) + "</b> is " + fmt(t.due) + ". Study plan:</p><ul>" + o + "</ul>";
        }
        var pd = document.getElementById("pd"); pd.open = true; pd.scrollIntoView({ behavior: "smooth" });
    }
    function drawTools() { drawCal(); drawSummary(); drawLog(); drawGrades(); drawCards(); }

    hr.addEventListener("click", function (e) {
        var b = e.target.closest("[data-att]"); if (!b) return;
        var sel = document.getElementById("att"); if (!sel || !sel.value) { alert("Add an assignment first, then attach links to it."); return; }
        items.forEach(function (i) { if (i.id === +sel.value) i.notes = ((i.notes ? i.notes + " " : "") + b.dataset.att).slice(0, 400); });
        save(); render(); document.getElementById("hq").dispatchEvent(new Event("change")); b.textContent = "Attached";
    });

    document.getElementById("shr").addEventListener("click", function () {
        var s = items.filter(function (i) { return !i.done; }).map(function (i) { return { title: i.title, subj: i.subj, due: i.due, pri: i.pri, mins: i.mins, notes: i.notes }; });
        var url = location.href.split("#")[0] + "#share=" + btoa(unescape(encodeURIComponent(JSON.stringify(s)))), btn = this;
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { btn.textContent = "Copied!"; setTimeout(function () { btn.textContent = "Share link"; }, 1500); }).catch(function () { prompt("Copy this link:", url); });
    });

    // tabs
    var tabs = document.querySelectorAll("[data-tab]"), panels = document.querySelectorAll("[data-p]");
    function goTab(n) {
        tabs.forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === n); });
        panels.forEach(function (p) { p.hidden = p.dataset.p !== n; });
        store("duesoon.tab", n);
    }
    tabs.forEach(function (b) { b.addEventListener("click", function () { goTab(b.dataset.tab); }); });
    document.querySelectorAll("#tools details").forEach(function (section) {
        section.addEventListener("click", function (e) {
            var target = e.target;
            if (target.closest("summary, button, input, select, textarea, a, form, label, [data-k]")) return;
            section.open = !section.open;
        });
    });
    goTab(RO ? "tasks" : (store("duesoon.tab") || "tasks"));

    // toast
    var toastEl = document.getElementById("toast"), tt;
    function toast(m) { toastEl.textContent = m; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(function () { toastEl.hidden = true; }, 4000); }

    // pick for me, clear completed
    document.getElementById("pick").addEventListener("click", function () {
        var o = items.filter(function (i) { return !i.done; }).sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : (b.pri ? 1 : 0) - (a.pri ? 1 : 0); });
        toast(o.length ? "Start with: " + o[0].title + (o[0].subj ? " (" + o[0].subj + ")" : "") + ", due " + fmt(o[0].due) : "Nothing left to do. Nice work!");
    });
    document.getElementById("clr").addEventListener("click", function () {
        var n = items.filter(function (i) { return i.done; }).length;
        if (n && confirm("Remove " + n + " completed assignments?")) { items = items.filter(function (i) { return !i.done; }); save(); render(); toast("Cleared " + n); }
    });

    // animated star background
    var bg = document.getElementById("bg"), bx = bg.getContext("2d"), stars = [], animOn = store("duesoon.anim") !== "0",
        calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches, animBox = document.getElementById("anim");
    animBox.checked = animOn;
    function sizeBg() {
        bg.width = innerWidth; bg.height = innerHeight; stars = [];
        for (var n = 0; n < 70; n++) stars.push({ x: Math.random() * bg.width, y: Math.random() * bg.height, r: Math.random() * 1.6 + .4, p: Math.random() * 6.28, v: .4 + Math.random() * 1.2 });
    }
    function drawBg(t) {
        bx.clearRect(0, 0, bg.width, bg.height);
        if (animOn) {
            bx.fillStyle = getComputedStyle(root).getPropertyValue("--ink").trim() || "#888";
            stars.forEach(function (s) { bx.globalAlpha = .08 + .22 * (.5 + .5 * Math.sin(t / 1000 * s.v + s.p)); bx.beginPath(); bx.arc(s.x, s.y, s.r, 0, 6.283); bx.fill(); });
        }
        if (!calm) requestAnimationFrame(drawBg);
    }
    sizeBg(); drawBg(0); window.addEventListener("resize", sizeBg);
    animBox.addEventListener("change", function () { animOn = animBox.checked; store("duesoon.anim", animOn ? "1" : "0"); if (calm) drawBg(0); });

    // keyboard shortcuts
    document.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target.tagName; if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
        var k = e.key.toLowerCase(), m = { "1": "tasks", "2": "study", "3": "tools", "4": "settings" };
        if (m[k]) goTab(m[k]);
        else if (k === "n") { e.preventDefault(); goTab("tasks"); title.focus(); }
        else if (k === "/") { e.preventDefault(); goTab("tasks"); qEl.focus(); }
        else if (k === "s") { e.preventDefault(); goTab("study"); hq.focus(); }
        else if (k === "p") { goTab("tasks"); document.getElementById("pick").click(); }
    });

    render();
})();