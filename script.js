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
    function attr(t) { return esc(t).replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
    function link(t) { return esc(t).replace(/https?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>'; }); }
    function hue(s) { var h = 0; s = s.toLowerCase(); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
    function color(s) { return s ? "hsl(" + hue(s) + " 62% 46%)" : "var(--line)"; }

    var f = document.getElementById("f"), list = document.getElementById("list"), banner = document.getElementById("banner"), prog = document.getElementById("prog"),
        studyTests = document.getElementById("studyTests"), lessonEl = document.getElementById("lessonContent"),
        lessonOverlay = document.getElementById("lessonOverlay"), studyProgress = load("duesoon.studyProgress", {}),
        lessonSession = null, lessonRequest = 0, lessonTimer = null;
    if (!studyProgress || typeof studyProgress !== "object" || Array.isArray(studyProgress)) studyProgress = {};
    var title = document.getElementById("title"), subj = document.getElementById("subj"), due = document.getElementById("due"),
        pri = document.getElementById("pri"), rep = document.getElementById("rep"), go = document.getElementById("go"), cancel = document.getElementById("cancel"),
        mins = document.getElementById("mins"), notes = document.getElementById("notes"), steps = document.getElementById("steps"),
        tst = document.getElementById("tst");

    function resetForm() {
        editId = null; f.reset();
        due.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        go.textContent = "Add assignment"; cancel.hidden = true;
    }
    resetForm();

    document.querySelectorAll("[data-date-offset]").forEach(function (button) {
        button.addEventListener("click", function () {
            due.value = addDays(iso(today()), +button.dataset.dateOffset);
        });
    });

    function parseSteps(value, previous) {
        var old = Array.isArray(previous) ? previous : [];
        return value.split(/\r?\n/).map(function (text) { return text.trim().slice(0, 120); }).filter(Boolean).slice(0, 20)
            .map(function (text) {
                var match = -1;
                for (var n = 0; n < old.length; n++) {
                    if (old[n] && !old[n]._used && old[n].text === text) { match = n; break; }
                }
                if (match < 0) return { text: text, done: false };
                old[match]._used = true;
                return { text: text, done: !!old[match].done };
            });
    }
    steps.addEventListener("input", function () {
        var lines = steps.value.split(/\r?\n/).map(function (text) { return text.trim(); }).filter(Boolean);
        steps.setCustomValidity(lines.length > 20 ? "A task can have up to 20 steps." :
            lines.some(function (text) { return text.length > 120; }) ? "Each step must be 120 characters or fewer." : "");
    });

    f.addEventListener("submit", function (e) {
        e.preventDefault();
        var existing = editId && items.filter(function (i) { return i.id === editId; })[0];
        var previousSteps = existing && Array.isArray(existing.steps) ? existing.steps.map(function (step) {
            return { text: step.text, done: !!step.done };
        }) : [];
        var data = { title: title.value.trim(), subj: subj.value.trim(), due: due.value, pri: pri.checked, rep: rep.value, mins: +mins.value || 0, notes: notes.value.trim(), steps: parseSteps(steps.value, previousSteps), test: tst.checked };
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
            editId = id; title.value = i.title; subj.value = i.subj || ""; due.value = i.due; pri.checked = !!i.pri; rep.value = i.rep || "none"; mins.value = i.mins || ""; notes.value = i.notes || ""; steps.value = Array.isArray(i.steps) ? i.steps.map(function (step) { return step.text; }).join("\n") : ""; tst.checked = !!i.test;
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
    list.addEventListener("change", function (e) {
        var checkbox = e.target.closest('input[data-a="step"]');
        if (!checkbox) return;
        var task = items.filter(function (i) { return i.id === +checkbox.dataset.id; })[0];
        var step = task && task.steps && task.steps[+checkbox.dataset.step];
        if (!step) return;
        step.done = checkbox.checked;
        save();
        render();
    });

    function row(i) {
        var n = diff(i.due), cls = i.done ? "done" : n < 0 ? "late" : n === 0 ? "today" : "";
        var num = i.done ? "✓" : Math.abs(n), lab = i.done ? "done" : n < 0 ? "days late" : n === 0 ? "today" : n === 1 ? "day left" : "days left";
        if (!i.done && n === 0) num = "!";
        var rp = i.rep && i.rep !== "none" ? " · repeats " + i.rep : "";
        var taskSteps = Array.isArray(i.steps) ? i.steps : [], doneSteps = taskSteps.filter(function (step) { return step.done; }).length;
        var checklist = taskSteps.length ? '<div class="task-steps"><div class="task-steps-heading"><b>Steps</b><span class="m">' +
            doneSteps + ' of ' + taskSteps.length + ' done</span></div><div class="task-steps-bar"><i style="width:' +
            Math.round(doneSteps / taskSteps.length * 100) + '%"></i></div><ul>' + taskSteps.map(function (step, index) {
                return '<li><label class="task-step' + (step.done ? ' is-done' : '') + '"><input type="checkbox" data-a="step" data-id="' +
                    i.id + '" data-step="' + index + '"' + (step.done ? ' checked' : '') + ' aria-label="Mark step complete: ' +
                    attr(step.text) + '"><span>' + esc(step.text) + '</span></label></li>';
            }).join("") + '</ul></div>' : '';
        return '<li class="' + cls + (taskSteps.length ? ' has-steps' : '') + '" style="--c:' + color(i.subj) + '"><div class="days">' + num + '<small>' + lab + '</small></div>' +
            '<div><div class="t">' + (i.pri ? '<span class="star" title="High priority">★</span>' : '') + esc(i.title) + '</div>' +
            '<div class="m">' + (i.subj ? '<span class="chip">' + esc(i.subj) + '</span>' : '') + fmt(i.due) + rp + (i.mins ? " · " + i.mins + " min" : "") + '</div>' + (i.notes ? '<div class="m">' + link(i.notes) + '</div>' : '') + '</div>' +
            checklist +
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
        var qv = qEl.value.trim().toLowerCase(), fv = flt.value, tv = ftype.value;
        var vis = items.filter(function (i) {
            var typeMatch = !tv || tv === "priority" && i.pri || tv === "tests" && i.test || tv === "completed" && i.done;
            return (!fv || i.subj === fv) && typeMatch && (!qv || (i.title + " " + (i.subj || "") + " " + (i.notes || "")).toLowerCase().indexOf(qv) > -1);
        });
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
    function articleExtract(title, preferredSite) {
        function get(site) {
            var url = "https://" + site + "/w/api.php?action=query&prop=extracts&explaintext=1&exchars=25000&format=json&origin=*&redirects=1&titles=" + encodeURIComponent(title);
            return fetch(url).then(function (r) {
                if (!r.ok) throw new Error("no");
                return r.json();
            }).then(function (data) {
                var pages = data.query && data.query.pages, page = pages && pages[Object.keys(pages)[0]];
                if (!page || !page.extract) throw new Error("no");
                return { text: page.extract, site: site };
            });
        }
        var sites = [preferredSite, "simple.wikipedia.org", "en.wikipedia.org", "en.wikibooks.org", "en.wikiversity.org"]
            .filter(function (site, index, list) { return site && list.indexOf(site) === index; });
        function trySite(index) {
            if (index >= sites.length) return Promise.reject(new Error("No readable article extract was found."));
            return get(sites[index]).catch(function () { return trySite(index + 1); });
        }
        return trySite(0);
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
    function searchStudyTopic(q, context) {
        if (context && context.type === "exam") {
            hr.innerHTML = '<div class="study-context-prompt"><p class="eyebrow">TEST ARCHIVE</p><h3>' +
                esc(q.replace(/\b(?:19|20)\d{2}\b/g, "").trim() + " · " + context.year) +
                '</h3><p>Year-specific papers and solutions are not copied into this app. Use the archive search for the selected edition, or build a sourced lesson for a particular skill.</p>' +
                contextSearchNotice(q, context) + '</div>';
            return;
        }
        var searchQuery = context && context.type === "scioly" ? "Science Olympiad " + context.event :
            context ? q.replace(/\b(?:19|20)\d{2}\b/g, "").trim() + " " + context.year : q;
        hr.innerHTML = '<p class="m">Searching...</p>';
        runAll(searchQuery).then(function (res) {
            var sug = "";
            res.forEach(function (r) { if (!sug && r.sug) sug = r.sug; });
            if (total(res) < 2 && sug) { return runAll(sug).then(function (r2) { return [sug, r2]; }); }
            return [searchQuery, res];
        }).then(function (p) {
            var shown = p[0], res = p[1];
            var top = (res[1].hits[0] || res[0].hits[0] || {}).t;
            return (top ? summary(top) : Promise.resolve(null)).then(function (sum) {
                show(q, shown, res, sum);
                if (context) hr.insertAdjacentHTML("afterbegin", contextSearchNotice(q, context));
            });
        }).catch(function () {
            hr.innerHTML = '<div class="empty">Search could not load. Check your internet connection, or open the site from your own hosting.</div>';
        });
    }
    hf.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = hq.value.trim(); if (!q) return;
        var context = testContextFromTopic(q);
        if (context && (!context.year || context.type === "scioly" && !context.event)) {
            contextPrompt(hr, q, context, "search");
            return;
        }
        searchStudyTopic(q, context);
    });

    // controls
    var qEl = document.getElementById("q"), flt = document.getElementById("flt"), ftype = document.getElementById("ftype"), totalEl = document.getElementById("total");
    qEl.addEventListener("input", render); flt.addEventListener("change", render); ftype.addEventListener("change", render);

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
    var cards = load("duesoon.cards", []), ci = 0, flip = false, grades = load("duesoon.grades", []),
        practiceMode = false, practiceOrder = [], practiceResults = [], practiceIndex = 0;
    var tsub = document.getElementById("tsub"), tdisp = document.getElementById("tdisp"), tgo = document.getElementById("tgo"), timer = null, tend = 0;
    var quickNotes = document.getElementById("quickNotes"), quickNotesStatus = document.getElementById("quickNotesStatus");
    quickNotes.value = load("duesoon.quickNotes", "");
    quickNotes.disabled = RO;
    quickNotesStatus.textContent = RO ? "Quick notes are unavailable in shared read-only lists." : "Saved on this device.";
    quickNotes.addEventListener("input", function () {
        store("duesoon.quickNotes", quickNotes.value);
        quickNotesStatus.textContent = "Saved on this device · " + quickNotes.value.length + " / 5000 characters";
    });
    function calculate(expression) {
        var tokens = [], index = 0, match;
        while (index < expression.length) {
            if (/^\s+$/.test(expression.slice(index))) break;
            match = expression.slice(index).match(/^\s*(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/^%])/);
            if (!match) throw new Error("Use numbers, parentheses, and +, −, ×, ÷, or ^ only.");
            tokens.push(match[0].trim());
            index += match[0].length;
        }
        var position = 0;
        function peek() { return tokens[position]; }
        function take() { return tokens[position++]; }
        function expressionValue() {
            var value = term();
            while (peek() === "+" || peek() === "-") {
                var operator = take(), right = term();
                value = operator === "+" ? value + right : value - right;
            }
            return value;
        }
        function term() {
            var value = unary();
            while (peek() === "*" || peek() === "/") {
                var operator = take(), right = unary();
                if (operator === "/" && right === 0) throw new Error("You can’t divide by zero.");
                value = operator === "*" ? value * right : value / right;
            }
            return value;
        }
        function unary() {
            if (peek() === "+") { take(); return unary(); }
            if (peek() === "-") { take(); return -unary(); }
            return power();
        }
        function power() {
            var value = primary();
            if (peek() === "^") { take(); value = Math.pow(value, unary()); }
            return value;
        }
        function primary() {
            if (peek() === "(") {
                take();
                var value = expressionValue();
                if (take() !== ")") throw new Error("Check that your parentheses are balanced.");
                return value;
            }
            var token = take();
            if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) {
                throw new Error("Check the expression and try again.");
            }
            var value = Number(token);
            while (peek() === "%") { take(); value /= 100; }
            return value;
        }
        if (!expression.trim()) throw new Error("Enter an expression first.");
        var answer = expressionValue();
        if (position !== tokens.length) throw new Error("Check the expression and try again.");
        if (!isFinite(answer)) throw new Error("That expression is outside the calculator’s supported range.");
        return answer;
    }
    document.getElementById("calculatorForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var input = document.getElementById("calculatorInput"), result = document.getElementById("calculatorResult");
        try {
            var value = calculate(input.value);
            var answer = String(Number(value.toPrecision(12)));
            result.textContent = answer;
            result.dataset.answer = answer;
            result.disabled = false;
            result.className = "tool-result calculator-answer";
            result.setAttribute("aria-label", "Answer " + answer + ". Click to copy.");
        } catch (error) {
            result.textContent = error.message;
            result.dataset.answer = "";
            result.disabled = true;
            result.className = "tool-result calculator-answer tool-error";
            result.setAttribute("aria-label", error.message);
        }
    });
    document.getElementById("calculatorKeys").addEventListener("click", function (e) {
        var key = e.target.closest("[data-calc]");
        if (!key) return;
        var input = document.getElementById("calculatorInput"), action = key.dataset.calc;
        if (action === "clear") input.value = "";
        else if (action === "backspace") input.value = input.value.slice(0, -1);
        else if (input.value.length < 100) input.value += action;
        var result = document.getElementById("calculatorResult");
        result.textContent = "Answer · Calculate an expression first";
        result.dataset.answer = "";
        result.disabled = true;
        result.className = "tool-result calculator-answer";
        result.setAttribute("aria-label", "Calculator answer. Calculate an expression first.");
        if (action !== "clear") input.focus();
    });
    document.getElementById("calculatorResult").addEventListener("click", function () {
        var result = this, answer = result.dataset.answer;
        if (!answer) return;
        function copied() {
            result.textContent = answer + " · Copied";
            setTimeout(function () { if (result.dataset.answer === answer) result.textContent = answer; }, 1200);
        }
        function fallbackCopy() {
            var copyField = document.createElement("textarea");
            copyField.value = answer;
            copyField.style.position = "fixed";
            copyField.style.opacity = "0";
            document.body.appendChild(copyField);
            copyField.select();
            var success = document.execCommand("copy");
            copyField.remove();
            if (success) copied();
            else toast("Could not copy the answer. Select it and copy manually.");
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(answer).then(copied).catch(fallbackCopy);
        } else fallbackCopy();
    });

    var writingInput = document.getElementById("writingInput"), writingCount = document.getElementById("writingCount"),
        writingResults = document.getElementById("writingResults");
    function updateWritingCount() {
        var text = writingInput.value.trim(), words = text ? text.split(/\s+/).length : 0;
        writingCount.textContent = words + " " + (words === 1 ? "word" : "words") + " · " + writingInput.value.length + " characters";
    }
    writingInput.addEventListener("input", updateWritingCount);
    document.getElementById("writingForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var text = writingInput.value, corrected = text, changes = [], reviews = [];
        function applyFix(label, pattern, replacement) {
            corrected = corrected.replace(pattern, function () {
                var match = arguments[0], args = arguments, next = typeof replacement === "function" ?
                    replacement.apply(null, args) : match.replace(pattern, replacement);
                if (match !== next) changes.push({ label: label, before: match, after: next });
                return next;
            });
        }
        function preserveCase(match, replacement) {
            if (match === match.toUpperCase()) return replacement.toUpperCase();
            if (match.charAt(0) === match.charAt(0).toUpperCase()) {
                return replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }
            return replacement;
        }
        applyFix("Repeated word", /\b([A-Za-z][A-Za-z']*)\s+\1\b/gi, function (match, word) { return word; });
        applyFix("Punctuation spacing", /[ \t]+([,.;!?])/g, "$1");
        applyFix("Extra spaces", / {2,}/g, " ");
        var spelling = {
            teh: "the", adn: "and", becuase: "because", definately: "definitely",
            seperate: "separate", recieve: "receive", wierd: "weird", untill: "until",
            occured: "occurred", wich: "which", thier: "their", alot: "a lot"
        };
        applyFix("Common typo", /\b(teh|adn|becuase|definately|seperate|recieve|wierd|untill|occured|wich|thier|alot)\b/gi,
            function (match) { return preserveCase(match, spelling[match.toLowerCase()]); });
        applyFix("Sentence capitalization", /(^|[.!?]\s+)([a-z])/g, function (match, prefix, letter) { return prefix + letter.toUpperCase(); });
        applyFix("Pronoun capitalization", /\bi\b/g, "I");
        [
            { pattern: /\byour(?=\s+(?:welcome|right|wrong|going|coming|being|doing|having|trying|looking|making|getting|taking|giving|working|learning|reading|writing|playing|studying|eating|running|talking|asking|using|feeling|thinking|saying|waiting|leaving|helping|planning)\b)/gi, replacement: "you're", label: "your → you're" },
            { pattern: /\bits(?=\s+(?:a|an)\b)/gi, replacement: "it's", label: "its → it's" },
            { pattern: /\b(their)(?=\s+(?:is|was|are|were)\b)/gi, replacement: "there", label: "their → there" },
            { pattern: /\b(could|would|should|might|must) of\b/gi, replacement: function (match, modal) { return modal + " have"; }, label: "of → have" }
        ].forEach(function (rule) {
            corrected = corrected.replace(rule.pattern, function (match) {
                var next = typeof rule.replacement === "function" ? rule.replacement.apply(null, arguments) : preserveCase(match, rule.replacement);
                changes.push({ label: rule.label, before: match, after: next });
                return next;
            });
        });
        text.split(/(?<=[.!?])\s+/).forEach(function (sentence) {
            var words = sentence.trim().match(/\b[\w'-]+\b/g);
            if (words && words.length > 35) {
                reviews.push({
                    title: "Long sentence",
                    quote: sentence.trim().slice(0, 120) + (sentence.trim().length > 120 ? "…" : ""),
                    detail: "This sentence has " + words.length + " words. Consider splitting it where one complete idea ends and another begins."
                });
            }
        });
        var wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        var sentenceCount = (text.match(/[.!?]+(?=\s|$)/g) || []).length;
        var output = '<div class="writing-stats"><b>' + wordCount + '</b> words <span>·</span> <b>' + text.length + '</b> characters <span>·</span> <b>' + sentenceCount + '</b> sentences</div>';
        output += '<section class="corrected-draft"><h3>Corrected draft</h3><p class="m">' +
            (changes.length ? "Made " + changes.length + " specific edit" + (changes.length === 1 ? "" : "s") + ". Check the changes and review the draft." : "No high-confidence spelling or mechanics fixes found.") +
            '</p><textarea id="correctedDraft" rows="8" aria-label="Corrected writing draft">' + esc(corrected) + '</textarea>' +
            '<div class="trow corrected-draft-actions"><button type="button" class="ghost" data-writing-action="copy">Copy corrected draft</button>' +
            '<button type="button" class="ghost" data-writing-action="replace">Replace my text</button></div></section>';
        if (changes.length) {
            output += '<h3 class="writing-issue-heading">Edits made</h3><ul class="writing-issues">' +
                changes.slice(0, 30).map(function (change) {
                    var before = change.label === "Punctuation spacing" ? "space before " + change.after : change.before;
                    return '<li><b>' + esc(change.label) + '</b><p><del>' + esc(before) + '</del> <span aria-hidden="true">→</span> <ins>' + esc(change.after) + '</ins></p></li>';
                }).join("") + '</ul>' +
                (changes.length > 30 ? '<p class="m">Showing the first 30 edits.</p>' : '');
        }
        if (reviews.length) {
            output += '<h3 class="writing-issue-heading">Review these yourself</h3><ul class="writing-issues">' +
                reviews.map(function (issue) {
                    return '<li><b>' + esc(issue.title) + '</b> <span class="writing-quote">“' + esc(issue.quote) + '”</span><p>' + esc(issue.detail) + '</p></li>';
                }).join("") + '</ul>';
        } else if (!changes.length) {
            output += '<p class="writing-clear">No obvious mechanical issues were found. This quick local checker cannot judge clarity, argument, or context, so read the draft aloud and check that each paragraph supports your main point.</p>';
        }
        writingResults.innerHTML = output;
    });
    writingResults.addEventListener("click", function (e) {
        var button = e.target.closest("[data-writing-action]");
        if (!button) return;
        var draft = document.getElementById("correctedDraft");
        if (!draft) return;
        if (button.dataset.writingAction === "replace") {
            writingInput.value = draft.value;
            updateWritingCount();
            writingInput.focus();
            button.textContent = "Text replaced";
            return;
        }
        function copiedDraft() { button.textContent = "Copied!"; setTimeout(function () { button.textContent = "Copy corrected draft"; }, 1200); }
        function fallbackCopyDraft() {
            draft.focus();
            draft.select();
            if (document.execCommand("copy")) copiedDraft();
            else toast("Could not copy the draft. Select it and copy manually.");
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(draft.value).then(copiedDraft).catch(fallbackCopyDraft);
        else fallbackCopyDraft();
    });

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
        if (practiceMode) {
            practiceIndex = practiceResults.indexOf(null);
            if (practiceIndex < 0) {
                var known = practiceResults.filter(function (result) { return result; }).length;
                kc.innerHTML = '<div class="practice-result"><h3>Practice complete</h3><p class="m">You knew ' + known + ' of ' + practiceResults.length +
                    ' cards. Cards marked for review are ready to try again.</p><div class="trow"><button class="ghost" data-k="restart-practice">Practice again</button><button class="ghost" data-k="exit-practice">Back to cards</button></div></div>';
                return;
            }
            var practiceCard = practiceOrder[practiceIndex];
            kc.innerHTML = '<div class="card" data-k="flip" role="button" tabindex="0" aria-label="Flashcard. Tap to reveal the answer">' +
                esc(flip ? practiceCard.a : practiceCard.q) + '</div>' +
                '<p class="m practice-progress">Card ' + (practiceIndex + 1) + ' of ' + practiceOrder.length + (flip ? ' · Choose how well you knew it.' : ' · Tap to reveal the answer.') + '</p>' +
                '<div class="trow practice-actions"><button class="ghost" data-k="practice-review"' + (flip ? "" : " hidden") + '>Review again</button>' +
                '<button class="ghost" data-k="practice-known"' + (flip ? "" : " hidden") + '>I knew it</button>' +
                '<button class="ghost" data-k="exit-practice">Exit practice</button></div>';
            return;
        }
        ci = Math.min(ci, cards.length - 1);
        kc.innerHTML = '<div class="card" data-k="flip" role="button" tabindex="0" aria-label="Flashcard. Tap to flip">' + esc(flip ? cards[ci].a : cards[ci].q) +
            '</div><div class="trow"><button class="ghost" data-k="prev">Prev</button><button class="ghost" data-k="next">Next</button>' +
            '<button class="ghost" data-k="start-practice">Practice cards</button><button class="ghost" data-k="del">Delete</button>' +
            '<span class="m">Card ' + (ci + 1) + " of " + cards.length + ". Tap the card to flip.</span></div>";
    }
    document.getElementById("kf").addEventListener("submit", function (e) {
        e.preventDefault();
        practiceMode = false;
        cards.push({ q: document.getElementById("kq").value.trim(), a: document.getElementById("ka").value.trim() }); store("duesoon.cards", JSON.stringify(cards)); e.target.reset(); ci = cards.length - 1; flip = false; drawCards();
    });
    document.getElementById("kc").addEventListener("click", function (e) {
        e.stopPropagation();
        var b = e.target.closest("[data-k]"); if (!b) return; var k = b.dataset.k;
        if (k === "flip") flip = !flip;
        else if (k === "start-practice" || k === "restart-practice") {
            practiceMode = true;
            practiceOrder = cards.slice().sort(function () { return Math.random() - .5; });
            practiceResults = practiceOrder.map(function () { return null; });
            flip = false;
        } else if (k === "exit-practice") { practiceMode = false; flip = false; }
        else if (k === "practice-known" || k === "practice-review") {
            practiceResults[practiceIndex] = k === "practice-known";
            flip = false;
        } else {
            flip = false;
            if (k === "next") ci = (ci + 1) % cards.length;
            if (k === "prev") ci = (ci - 1 + cards.length) % cards.length;
            if (k === "del") { cards.splice(ci, 1); store("duesoon.cards", JSON.stringify(cards)); }
        }
        drawCards();
    });
    document.getElementById("kc").addEventListener("keydown", function (e) {
        e.stopPropagation();
        var card = e.target.closest('.card[data-k="flip"]');
        if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); card.click(); }
    });

    function showPlan(id) {
        var t = items.filter(function (i) { return i.id === id; })[0]; if (!t) return;
        var tp = (t.notes || "").split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean), days = Math.max(1, diff(t.due)), o = "";
        var target = document.getElementById("plan");
        if (!tp.length) { target.textContent = "Add topics to the Notes of this test, separated by commas, then try again."; }
        else {
            var per = Math.ceil(tp.length / days), d = 0;
            for (var n = 0; n < tp.length; n += per) { var day = new Date(today()); day.setDate(day.getDate() + d); o += "<li><b>" + day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ":</b> " + esc(tp.slice(n, n + per).join(", ")) + "</li>"; d++; }
            target.innerHTML = "<p><b>" + esc(t.title) + "</b> is " + fmt(t.due) + ". Study plan:</p><ul class=\"study-plan-list\">" + o + "</ul>";
        }
        var pd = document.getElementById("pd"); pd.open = true; pd.scrollIntoView({ behavior: "smooth" });
    }
    function drawStudyTests() {
        var tests = items.filter(function (i) { return i.test && !i.done; }).sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
        if (!tests.length) {
            studyTests.innerHTML = '<div class="empty">No upcoming tests yet. Add a task and mark it as a test to build a study plan here.</div>';
            return;
        }
        var topics = [];
        tests.forEach(function (test) {
            var remaining = diff(test.due), dueLabel = remaining < 0 ? Math.abs(remaining) + " days overdue" : remaining === 0 ? "Due today" : remaining === 1 ? "Due tomorrow" : "Due in " + remaining + " days";
            var testTopics = (test.notes || "").split(/[,;\n]/).map(function (topic) { return topic.trim(); }).filter(Boolean);
            if (!testTopics.length) testTopics = [test.title];
            testTopics.forEach(function (topic) {
                var key = topic.toLowerCase(), progress = studyProgress[key];
                topics.push('<article class="study-test"><div><h3>' + esc(topic) + '</h3><p class="m">' +
                    esc(test.title) + (test.subj ? " · " + esc(test.subj) : "") + " · " + dueLabel +
                    (progress && progress.studied ? " · Mastered (" + progress.best + "%)" : progress ? " · Best: " + progress.best + "%" : "") +
                    '</p></div><button class="ghost" type="button" data-study-topic="' + attr(topic) + '">' +
                    (progress && progress.studied ? "Review lesson" : "Start lesson") + '</button></article>');
            });
        });
        studyTests.innerHTML = topics.join("");
    }
    function drawTools() { drawCal(); drawSummary(); drawLog(); drawGrades(); drawCards(); drawStudyTests(); }

    var pendingLessonTopic = "";
    var pendingLessonContext = null;
    var lessonMaxQuestions = 50;
    var lessonMaxMinutes = 180;
    var lessonStopWords = ("about academy after again against also algebraic american among another because been before being between both called could does doing down during each further geometric have having here fundamental including into itself journal made make makes mathematics more most named other over picture president produce produces same should some statement such than that their them then there these they thing this those through under university very what when where which while with would your angle angles area areas always ancient called considered degree degrees derived equation example examples formula formulas greek line lines mathematics measure measurement never number numbers often picture problem problems produce produced produces right right-angled romanized same side sides square squares state states statement theorem theorems thing triangle triangles usually was were worked").split(" ");
    function cleanLessonText(text) {
        return plain(text)
            .replace(/\{\\[a-z]+\s*[^.]*\}\s*\.\s*/gi, " ")
            .replace(/\\(?:displaystyle|textstyle|mathrm|mathbf)\b/g, " ")
            .replace(/a2\+b2=c2/gi, "a² + b² = c²")
            .replace(/\b([a-z])2\s*\+\s*([a-z])2\s*=\s*([a-z])2\b/gi, "$1² + $2² = $3²")
            .replace(/\[\d+\]/g, "")
            .replace(/\{\{[^}]*\}\}/g, "")
            .replace(/[{}]/g, "")
            .replace(/\s+/g, " ").trim();
    }
    function parseLessonSections(raw, title) {
        var sections = [], current = { title: title, text: "" };
        (raw || "").split(/\r?\n/).forEach(function (line) {
            var heading = line.match(/^={2,}\s*(.*?)\s*={2,}$/);
            if (heading) {
                if (current.text.trim()) sections.push(current);
                current = { title: plain(heading[1]).replace(/[\[\]]/g, "").trim(), text: "" };
            } else if (line.trim() && !/^\s*\{\{/.test(line)) current.text += " " + line.trim();
        });
        if (current.text.trim()) sections.push(current);
        sections = sections.map(function (section) {
            section.text = cleanLessonText(section.text);
            return section;
        }).filter(function (section) { return section.text.length > 100; });
        if (sections.length < 2) {
            var text = cleanLessonText(raw || "").replace(/={2,}[^\n=]+={2,}/g, " ").replace(/\s+/g, " ").trim();
            var sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [], chunks = [];
            for (var i = 0; i < sentences.length; i += 3) {
                var part = sentences.slice(i, i + 3).join(" ").trim();
                if (part.length > 70) chunks.push({ title: "Introduction · part " + (chunks.length + 1), text: part });
            }
            if (chunks.length) sections = chunks;
        }
        var slides = [];
        sections.forEach(function (section) {
            if (section.text.length <= 1000) {
                slides.push(section);
                return;
            }
            var sentences = section.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [], part = [], length = 0;
            sentences.forEach(function (sentence) {
                if (length && length + sentence.length > 850) {
                    slides.push({ title: section.title, text: part.join(" ").trim() });
                    part = [];
                    length = 0;
                }
                part.push(sentence.trim());
                length += sentence.length;
            });
            if (part.length) slides.push({ title: section.title, text: part.join(" ").trim() });
        });
        return slides.filter(function (section) { return section.text.length > 100; }).slice(0, 20);
    }
    function lessonCandidates(text, topic) {
        var sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [], topicWords = (topic.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []), candidates = [];
        sentences.forEach(function (sentence) {
            sentence = sentence.trim();
            if (sentence.length < 55 || sentence.length > 320 || !/[.!?]$/.test(sentence) || /https?:|\\displaystyle|[{}=]|^\W*\d/.test(sentence)) return;
            var words = sentence.match(/\b[A-Za-z][A-Za-z'-]{5,}\b/g) || [], answer = "";
            for (var i = 0; i < words.length; i++) {
                var word = words[i], lower = word.toLowerCase();
                var occurrences = sentence.match(new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi")) || [];
                var before = sentence.slice(0, sentence.indexOf(word)).trim();
                var likelyAdjective = /(?:ous|ive|ical|ic|ful|less|able|ible|ary|ory|ish|ent|ant|ean|ian|ing|al)$/i.test(word);
                var predicatePosition = /\b(?:is|are|was|were|be|been|being)\s+(?:the\s+)?$/i.test(before);
                if (topicWords.indexOf(lower) < 0 && lessonStopWords.indexOf(lower) < 0 && occurrences.length === 1 &&
                    !likelyAdjective && !predicatePosition) { answer = word; break; }
            }
            if (answer) candidates.push({ sentence: sentence, answer: answer });
        });
        return candidates;
    }
    function makeLessonQuestion(candidate, pool, difficulty, seed, topic) {
        var choices = [candidate.answer], desired = difficulty === "hard" ? 5 : difficulty === "medium" ? 4 : 3;
        var sentence = candidate.sentence || candidate.prompt.replace("_____", candidate.answer);
        var sentenceWords = (sentence.match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) || []).map(function (word) { return word.toLowerCase(); });
        var topicWords = (topic || "").toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
        var properName = sentence.indexOf(candidate.answer) > 0 && /^[A-Z]/.test(candidate.answer);
        var possessiveName = /['’]s$/i.test(candidate.answer);
        function addChoice(word, matchKind, sourceSentence) {
            var lower = word.toLowerCase();
            var sourceIsProper = sourceSentence && sourceSentence.indexOf(word) > 0 && /^[A-Z]/.test(word);
            if (matchKind && properName !== !!sourceIsProper) return;
            if (properName && (!sourceIsProper || matchKind && possessiveName !== /['’]s$/i.test(word)) || !properName && /^[A-Z]/.test(word)) return;
            if (choices.length < desired && sentenceWords.indexOf(lower) < 0 && topicWords.indexOf(lower) < 0 && lessonStopWords.indexOf(lower) < 0 &&
                !choices.some(function (choice) { return choice.toLowerCase() === lower; })) choices.push(word);
        }
        for (var n = 0; n < pool.length && choices.length < desired; n++) {
            var nameCandidate = pool[(seed + n * 7) % pool.length];
            addChoice(nameCandidate.answer, true, nameCandidate.sentence);
        }
        for (var a = 0; a < pool.length && choices.length < desired; a++) {
            var fallbackCandidate = pool[(seed + a * 7) % pool.length];
            addChoice(fallbackCandidate.answer, false, fallbackCandidate.sentence);
        }
        for (var p = 0; !properName && p < pool.length && choices.length < desired; p++) {
            var source = pool[(seed + p * 7) % pool.length];
            var sourceText = source.sentence || source.prompt.replace("_____", source.answer);
            (sourceText.match(/\b[A-Za-z][A-Za-z'-]{4,}\b/g) || []).forEach(function (word) { addChoice(word, false); });
        }
        if (choices.length < 2) {
            var backupWords = sentence.match(/\b[A-Za-z][A-Za-z'-]{5,}\b/g) || [];
            for (var b = 0; b < backupWords.length && choices.length < 2; b++) {
                var backup = backupWords[b];
                if (backup.toLowerCase() !== candidate.answer.toLowerCase() && topicWords.indexOf(backup.toLowerCase()) < 0 &&
                    lessonStopWords.indexOf(backup.toLowerCase()) < 0 &&
                    !choices.some(function (choice) { return choice.toLowerCase() === backup.toLowerCase(); })) choices.push(backup);
            }
        }
        if (choices.length < 2) return null;
        var rng = seed + 17;
        for (var i = choices.length - 1; i > 0; i--) {
            rng = (rng * 9301 + 49297) % 233280;
            var j = Math.floor(rng / 233280 * (i + 1)), swap = choices[i];
            choices[i] = choices[j]; choices[j] = swap;
        }
        return { prompt: sentence.replace(candidate.answer, "_____"), answer: candidate.answer, choices: choices };
    }
    function testContextType(topic) {
        if (/\b(?:science olympiad|sci[\s-]?oly)\b/i.test(topic)) return "scioly";
        if (/\b(?:amc\s*(?:8|10|12)|aime|usamo|usajmo|mathcounts|national science bowl|science bowl|apush|ap(?:\s+[a-z][a-z -]*)?|sat|act|spelling bee|usaco|usabo|usnco|usapho)\b/i.test(topic)) return "exam";
        return "";
    }
    function testContextFromTopic(topic) {
        var type = testContextType(topic);
        if (!type) return null;
        var year = topic.match(/\b(?:19|20)\d{2}\b/), context = { type: type, year: year ? +year[0] : 0, event: "" };
        if (type === "scioly") {
            context.event = topic.replace(/\b(?:science olympiad|sci[\s-]?oly)\b/ig, "")
                .replace(/\b(?:19|20)\d{2}\b/g, "")
                .replace(/\b(?:test|tests|topic|topics|study|practice|event|events|resources|season|rules|for|in|about|the|current)\b/ig, " ")
                .replace(/[,:;-]/g, " ").replace(/\s+/g, " ").trim();
        }
        return context;
    }
    function archiveSearchUrl(topic, context) {
        var exam = topic.replace(new RegExp("\\b" + context.year + "\\b"), "").trim();
        var query = context.type === "scioly"
            ? "Science Olympiad " + context.year + " " + context.event + " event rules study resources"
            : exam + " " + context.year + " past questions solutions";
        return "https://www.google.com/search?q=" + encodeURIComponent(query.trim());
    }
    function contextPrompt(container, topic, context, action) {
        var isScioly = context.type === "scioly", yearLabel = isScioly ? "Season year" : "Test year";
        var event = isScioly ? '<label>Science Olympiad event<input id="studyEvent" required maxlength="80" value="' + attr(context.event) + '" placeholder="Astronomy, Codebusters, Ecology…"></label>' : "";
        var focus = !isScioly ? '<label>Lesson topic or skill<input id="studyFocus"' + (action === "build" ? " required" : "") +
            ' maxlength="80" placeholder="Geometry, counting, photosynthesis…"></label>' : "";
        var yearValue = context.year || new Date().getFullYear();
        container.innerHTML = '<div class="study-context-prompt"><p class="eyebrow">CHOOSE THE RIGHT EDITION</p><h3>' +
            (isScioly ? "Which season and event?" : action === "build" ? "Which year and topic?" : "Which year?") + '</h3><p class="m">' +
            (isScioly ? "Science Olympiad topics and rules change by season and event." : "Past-test material is year-specific. For a useful interactive lesson, choose a skill instead of the exam name.") +
            '</p><form class="study-context-form" data-topic="' + attr(topic) + '" data-action="' + action + '">' +
            '<label>' + yearLabel + '<input id="studyYear" type="number" min="1980" max="' + (new Date().getFullYear() + 1) +
            '" required value="' + yearValue + '"></label>' + event + focus +
            '<div class="lesson-controls"><button class="add" type="submit">' + (action === "search" ? "Search this edition" : "Build lesson") +
            '</button>' + (action === "search" ? '<button class="ghost" type="button" data-context-build>Build a lesson</button>' : "") + '</div></form></div>';
    }
    function readTestContext(form) {
        var yearInput = form.querySelector("#studyYear"), eventInput = form.querySelector("#studyEvent");
        if (!form.reportValidity()) return null;
        return {
            type: testContextType(form.dataset.topic),
            year: +yearInput.value,
            event: eventInput ? eventInput.value.trim() : "",
            focus: form.querySelector("#studyFocus") ? form.querySelector("#studyFocus").value.trim() : ""
        };
    }
    function contextSearchNotice(topic, context) {
        var exam = topic.replace(new RegExp("\\b" + context.year + "\\b"), "").trim();
        var text = context.type === "scioly"
            ? "Find " + context.year + " Science Olympiad " + context.event + " rules and resources"
            : "Find " + exam + " " + context.year + " past questions and solutions";
        return '<p class="study-context-link"><a href="' + attr(archiveSearchUrl(topic, context)) +
            '" target="_blank" rel="noopener">' + esc(text) + '</a></p>';
    }
    function saveStudyNotes() {
        var notes = load("duesoon.studyNotes", {});
        if (!notes || typeof notes !== "object" || Array.isArray(notes)) notes = {};
        notes[lessonSession.topic + ":" + lessonSession.slide] = document.getElementById("slideNotes").value;
        store("duesoon.studyNotes", JSON.stringify(notes));
    }
    function renderLesson() {
        var session = lessonSession, html = "", progress = studyProgress[session.topic];
        document.getElementById("lessonTitle").textContent = session.title;
        var bar = document.getElementById("lessonProgressBar");
        if (session.stage === "slides") {
            var section = session.sections[session.slide], question = session.slideQuestions[session.slide], notes = load("duesoon.studyNotes", {}) || {};
            var canContinue = !question || session.checkedSlides[session.slide];
            bar.style.width = Math.round((session.slide + 1) / session.sections.length * 100) + "%";
            html = '<p class="eyebrow">LESSON ' + (session.slide + 1) + ' OF ' + session.sections.length + '</p><h2>' + esc(section.title) + '</h2>' +
                '<article class="slide-reading">' + esc(section.text) + '</article>' +
                '<p class="m">From <a href="' + attr(section.source || session.source) + '" target="_blank" rel="noopener">the lesson source</a>.</p>' +
                (session.context ? '<p class="study-context-note">Edition: ' + esc(session.context.type === "scioly" ? session.context.year + " Science Olympiad · " + session.context.event : session.contextTopic + " · " + session.context.year) +
                    '. This is a background lesson, not the archived test paper.</p>' + contextSearchNotice(session.contextTopic, session.context) : '') +
                '<label class="notes-label" for="slideNotes">Your notes <span>Saved automatically</span></label>' +
                '<textarea id="slideNotes" rows="3" placeholder="Write a note or example to remember…">' + esc(notes[session.topic + ":" + session.slide] || "") + '</textarea>';
            if (question) {
                html += '<form class="slide-check"><fieldset><legend>Quick check</legend><p>' + esc(question.prompt) + '</p>' +
                    question.choices.map(function (choice, index) {
                        return '<label class="lesson-option"><input type="radio" name="slideAnswer" value="' + index + '" required><span>' + esc(choice) + '</span></label>';
                    }).join("") + '</fieldset><p class="slide-feedback" hidden></p><button class="add" type="submit">Check answer</button></form>';
            } else html += '<p class="m">Read this section and add a note if useful, then continue.</p>';
            html += '<div class="lesson-controls"><button class="ghost" type="button" data-lesson-action="prev-slide"' + (session.slide === 0 ? " disabled" : "") + '>Back</button>' +
                '<button class="add" type="button" data-lesson-action="next-slide"' + (canContinue ? "" : " disabled") + '>' + (session.slide === session.sections.length - 1 ? "Quiz preferences" : "Continue") + '</button></div>';
        } else if (session.stage === "setup") {
            bar.style.width = "100%";
            var selectedCount = Math.min(10, session.questions.length);
            html = '<p class="eyebrow">READY FOR A CHECK?</p><h2>Set up your quiz</h2><p>Questions come from different parts of your lesson. Choose your pace.</p>' +
                '<div class="quiz-preferences"><label>Difficulty<select id="quizDifficulty"><option value="easy">Easy · up to 3 choices</option><option value="medium" selected>Medium · up to 4 choices</option><option value="hard">Hard · up to 5 choices</option></select></label>' +
                '<label>Number of questions <span>(max ' + lessonMaxQuestions + ')</span><input id="quizCount" type="number" min="1" max="' + lessonMaxQuestions + '" value="' + selectedCount + '" required></label>' +
                '<label>Time limit in minutes <span>(0 = no timer; max ' + lessonMaxMinutes + ')</span><input id="quizTime" type="number" min="0" max="' + lessonMaxMinutes + '" value="20" required></label></div>' +
                '<p class="m">' + session.questions.length + ' distinct questions are available from the lesson sources. You can request up to ' + lessonMaxQuestions +
                '; a quiz cannot exceed the number of unique questions the source supports. Pass with 90% or higher.</p>' +
                '<div class="lesson-controls"><button class="ghost" type="button" data-lesson-action="back-slides">Review lesson</button><button class="add" type="button" data-lesson-action="begin-quiz">Start quiz</button></div>';
        } else if (session.stage === "quiz") {
            bar.style.width = "100%";
            html = '<p class="eyebrow">FINAL QUIZ · ' + (session.quizIndex + 1) + ' OF ' + session.quizQuestions.length + '</p><h2>' + esc(session.title) + '</h2>' +
                (session.secondsLeft !== null ? '<p class="quiz-clock" id="quizClock">' + formatClock(session.secondsLeft) + ' remaining</p>' : "") +
                '<form class="lesson-quiz"><fieldset class="lesson-question"><legend>' + esc(session.quizQuestion.prompt) + '</legend>' +
                session.quizQuestion.choices.map(function (choice, index) {
                    return '<label class="lesson-option"><input type="radio" name="quizAnswer" value="' + index + '" required><span>' + esc(choice) + '</span></label>';
                }).join("") + '</fieldset><button class="add" type="submit">' + (session.quizIndex === session.quizQuestions.length - 1 ? "Finish quiz" : "Next question") + '</button></form>';
        } else {
            bar.style.width = "100%";
            var result = session.result;
            html = '<p class="eyebrow">QUIZ COMPLETE</p><h2>' + (result.passed ? "Topic mastered!" : "Keep learning") + '</h2>' +
                '<p class="quiz-score">' + result.score + '%</p><p>You got ' + result.correct + ' of ' + result.total + ' questions right. ' +
                (result.passed ? "You passed and this topic is marked as studied." : "You need 90% to pass. Review the lesson sections and try a fresh set of questions.") + '</p>';
            if (!result.passed) html += '<button class="add" type="button" data-lesson-action="retry">Review and try again</button>';
            else html += '<a class="ghost" href="' + attr(session.source) + '" target="_blank" rel="noopener">Read the full source</a>';
        }
        lessonEl.innerHTML = html;
    }
    function formatClock(seconds) {
        return Math.floor(seconds / 60) + ":" + (seconds % 60 < 10 ? "0" : "") + seconds % 60;
    }
    function stopLessonTimer() {
        if (lessonTimer) clearInterval(lessonTimer);
        lessonTimer = null;
    }
    function beginLessonQuiz() {
        var session = lessonSession, difficulty = document.getElementById("quizDifficulty").value;
        var countInput = document.getElementById("quizCount"), timeInput = document.getElementById("quizTime");
        if (!countInput.reportValidity()) return;
        if (!timeInput.reportValidity()) return;
        var limit = +countInput.value, minutes = +timeInput.value;
        var unique = {}, pool = session.questions.filter(function (question) {
            var key = question.answer.toLowerCase() + "|" + question.prompt;
            if (unique[key]) return false;
            unique[key] = true;
            return true;
        });
        for (var i = pool.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1)), value = pool[i];
            pool[i] = pool[j]; pool[j] = value;
        }
        session.difficulty = difficulty;
        session.quizQuestions = pool.slice(0, Math.min(limit, pool.length)).map(function (question, index) {
            return makeLessonQuestion({
                sentence: question.prompt.replace("_____", question.answer),
                answer: question.answer
            }, session.questions, difficulty, index + session.round * 13 + Math.floor(Math.random() * session.questions.length), session.topic);
        }).filter(Boolean);
        if (!session.quizQuestions.length) {
            lessonEl.innerHTML = '<div class="empty">There are not enough clear, distinct questions in this source. Try a more specific topic.</div>';
            return;
        }
        session.answers = [];
        session.quizIndex = 0;
        session.quizQuestion = session.quizQuestions[0];
        session.secondsLeft = minutes ? minutes * 60 : null;
        session.stage = "quiz";
        renderLesson();
        stopLessonTimer();
        if (session.secondsLeft !== null) lessonTimer = setInterval(function () {
            session.secondsLeft--;
            var clock = document.getElementById("quizClock");
            if (clock) clock.textContent = formatClock(session.secondsLeft) + " remaining";
            if (session.secondsLeft <= 0) finishLessonQuiz();
        }, 1000);
    }
    function finishLessonQuiz() {
        stopLessonTimer();
        var session = lessonSession, correct = 0;
        session.quizQuestions.forEach(function (question, index) {
            if (session.answers[index] === question.answer) correct++;
        });
        var score = Math.round(correct / session.quizQuestions.length * 100), passed = score >= 90;
        session.result = { score: score, correct: correct, total: session.quizQuestions.length, passed: passed };
        session.stage = "result";
        var previous = studyProgress[session.topic] || { best: 0, studied: false };
        studyProgress[session.topic] = { best: Math.max(previous.best || 0, score), studied: !!previous.studied || passed };
        store("duesoon.studyProgress", JSON.stringify(studyProgress));
        drawStudyTests();
        renderLesson();
    }
    function startLesson(topic, context) {
        topic = (topic || "").trim();
        if (!topic) return;
        if (!context && testContextType(topic)) {
            context = testContextFromTopic(topic);
            if (!context.year || context.type === "scioly" && !context.event || context.type === "exam" && !context.focus) {
                stopLessonTimer();
                lessonOverlay.hidden = false;
                document.body.classList.add("lesson-open");
                contextPrompt(lessonEl, topic, context, "build");
                return;
            }
        }
        loadLesson(topic, context);
    }
    function loadLesson(topic, context) {
        pendingLessonTopic = topic;
        pendingLessonContext = context || null;
        stopLessonTimer();
        var request = ++lessonRequest;
        lessonOverlay.hidden = false;
        document.body.classList.add("lesson-open");
        lessonEl.innerHTML = '<p class="m">Finding a clear, sourced lesson for <b>' + esc(topic) + '</b>…</p>';
        var lessonTopic = context && context.focus ? context.focus : context && context.type === "scioly" ? context.event :
            topic.replace(/\b(?:19|20)\d{2}\b/g, "").trim();
        var searchTopic = context && context.type === "scioly" ? "Science Olympiad " + context.event : lessonTopic;
        runAll(searchTopic).then(function (results) {
            var articleHits = [], seen = {};
            var titleTerms = (lessonTopic.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter(function (word) {
                return ["the", "and", "for", "from", "with", "into", "about"].indexOf(word) < 0;
            });
            var normalizedTopic = lessonTopic.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            function titleScore(title) {
                var normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
                var matched = titleTerms.filter(function (word) { return normalizedTitle.split(" ").indexOf(word) >= 0; }).length;
                return matched * 20 - Math.max(0, normalizedTitle.split(" ").length - titleTerms.length) * 2 +
                    (normalizedTitle === normalizedTopic ? 100 : normalizedTitle.indexOf(normalizedTopic) >= 0 ? 50 : 0);
            }
            results.forEach(function (result) {
                result.hits.map(function (hit) { return { hit: hit, score: titleScore(hit.t) }; })
                    .sort(function (a, b) { return b.score - a.score; }).slice(0, 2).forEach(function (match) {
                        var hit = match.hit, key = hit.t.toLowerCase();
                        if (match.score > 0 && !seen[key] && articleHits.length < 6) {
                            seen[key] = true;
                            articleHits.push({ title: hit.t, url: hit.u, site: new URL(hit.u).hostname, score: match.score });
                        }
                    });
            });
            if (!articleHits.length) articleHits.push({
                title: lessonTopic,
                url: "https://simple.wikipedia.org/wiki/" + encodeURIComponent(lessonTopic.replace(/ /g, "_")),
                site: "simple.wikipedia.org"
            });
            articleHits.sort(function (a, b) {
                return b.score - a.score || (a.site === "en.wikipedia.org" ? -1 : 0) - (b.site === "en.wikipedia.org" ? -1 : 0);
            });
            var titles = articleHits.map(function (hit) { return hit.title; });
            function findSummary(index) {
                if (index >= Math.min(titles.length, 8)) return Promise.resolve(null);
                return summary(titles[index]).then(function (data) { return data || findSummary(index + 1); });
            }
            return findSummary(0).then(function (data) {
                var primaryTitle = data && data.title || articleHits[0].title;
                return articleExtract(primaryTitle, "en.wikipedia.org").then(function (extract) {
                    return {
                        data: data || { title: primaryTitle },
                        article: {
                            title: primaryTitle,
                            site: extract.site,
                            source: "https://" + extract.site + "/wiki/" + encodeURIComponent(primaryTitle.replace(/ /g, "_")),
                            text: extract.text
                        }
                    };
                }).catch(function (error) {
                    if (!data || !data.extract) throw error;
                    return {
                        data: data,
                        article: {
                            title: primaryTitle,
                            source: data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page || "",
                            text: data.extract
                        }
                    };
                });
            });
        }).then(function (lessonData) {
            if (request !== lessonRequest) return;
            var data = lessonData.data, article = lessonData.article;
            var sections = parseLessonSections(article.text, article.title).slice(0, 20);
            sections.forEach(function (section) { section.source = article.source; });
            if (!sections.length) throw new Error("This topic did not return enough readable source material. Try a more specific search.");
            var questions = [];
            var allText = sections.map(function (s) { return s.text; }).join(" ");
            var allCandidates = lessonCandidates(allText, lessonTopic);
            sections.forEach(function (section, sectionIndex) {
                var candidates = lessonCandidates(section.text, lessonTopic);
                section.question = candidates.length ? makeLessonQuestion(candidates[0], allCandidates, "medium", sectionIndex * 3 + 1, lessonTopic) : null;
                candidates.forEach(function (candidate) {
                    var question = makeLessonQuestion(candidate, allCandidates, "medium", questions.length + 2, lessonTopic);
                    if (question) questions.push(question);
                });
            });
            var uniqueQuestions = {}, pool = questions.filter(function (question) {
                var key = question.prompt.toLowerCase();
                if (uniqueQuestions[key]) return false;
                uniqueQuestions[key] = true;
                return true;
            });
            if (pool.length < 3) throw new Error("This source did not contain three clear, distinct facts for a useful quiz. Try a more specific topic.");
            lessonSession = {
                topic: lessonTopic.toLowerCase(), contextTopic: topic, context: context || null,
                title: data.title || article.title || lessonTopic,
                source: data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page ||
                    article.source || "https://en.wikipedia.org/wiki/" + encodeURIComponent(lessonTopic.replace(/ /g, "_")),
                sections: sections, slideQuestions: sections.map(function (section) { return section.question; }),
                questions: pool.slice(0, lessonMaxQuestions), slide: 0, stage: "slides", round: 0,
                checkedSlides: sections.map(function () { return false; })
            };
            renderLesson();
            document.getElementById("closeLesson").focus();
        }).catch(function (error) {
            if (request !== lessonRequest) return;
            lessonEl.innerHTML = '<div class="empty">' + esc(error.message || "The lesson could not be loaded. Check your connection and try again.") +
                '<p><button type="button" class="ghost" data-lesson-action="retry-load">Try again</button></p></div>';
        });
    }
    function closeLesson() {
        stopLessonTimer();
        lessonOverlay.hidden = true;
        document.body.classList.remove("lesson-open");
        lessonSession = null;
    }
    hr.addEventListener("submit", function (e) {
        var form = e.target.closest(".study-context-form");
        if (!form) return;
        e.preventDefault();
        var context = readTestContext(form);
        if (context) searchStudyTopic(form.dataset.topic, context);
    });
    hr.addEventListener("click", function (e) {
        var button = e.target.closest("[data-context-build]");
        if (!button) return;
        var form = button.closest(".study-context-form"), focus = form.querySelector("#studyFocus");
        if (focus) focus.required = true;
        var context = readTestContext(form);
        if (context) startLesson(form.dataset.topic, context);
    });
    studyTests.addEventListener("click", function (e) {
        var button = e.target.closest("[data-study-topic]");
        if (button) startLesson(button.dataset.studyTopic);
    });
    document.getElementById("startLesson").addEventListener("click", function () {
        if (!hq.value.trim()) { hq.focus(); hq.reportValidity(); return; }
        startLesson(hq.value);
    });
    document.getElementById("closeLesson").addEventListener("click", closeLesson);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lessonOverlay.hidden) closeLesson(); });
    lessonEl.addEventListener("input", function (e) { if (e.target.id === "slideNotes") saveStudyNotes(); });
    lessonEl.addEventListener("click", function (e) {
        var contextButton = e.target.closest("[data-context-build]");
        if (contextButton) {
            var contextForm = contextButton.closest(".study-context-form"), focus = contextForm.querySelector("#studyFocus");
            if (focus) focus.required = true;
            var context = readTestContext(contextForm);
            if (context) loadLesson(contextForm.dataset.topic, context);
            return;
        }
        var button = e.target.closest("[data-lesson-action]");
        if (!button || !lessonSession) return;
        var session = lessonSession, action = button.dataset.lessonAction;
        if (action === "retry-load") { loadLesson(pendingLessonTopic, pendingLessonContext); return; }
        if (action === "next-slide") {
            if (session.slide < session.sections.length - 1) session.slide++;
            else session.stage = "setup";
        } else if (action === "prev-slide") session.slide = Math.max(0, session.slide - 1);
        else if (action === "back-slides") session.stage = "slides";
        else if (action === "begin-quiz") { beginLessonQuiz(); return; }
        else if (action === "retry") {
            session.round++;
            session.stage = "slides";
            session.slide = 0;
            session.result = null;
        }
        renderLesson();
    });
    lessonEl.addEventListener("submit", function (e) {
        var form = e.target.closest("form");
        if (!form) return;
        e.preventDefault();
        if (form.classList.contains("study-context-form")) {
            var context = readTestContext(form);
            if (context) loadLesson(form.dataset.topic, context);
            return;
        }
        if (!lessonSession) return;
        var session = lessonSession, selected = form.querySelector("input[type=radio]:checked");
        if (form.classList.contains("slide-check")) {
            var question = session.slideQuestions[session.slide], feedback = form.querySelector(".slide-feedback");
            feedback.hidden = false;
            if (question.choices[+selected.value] === question.answer) {
                feedback.textContent = "Correct. Take a moment to note what you learned, then continue.";
                feedback.className = "slide-feedback correct";
                form.querySelector("button[type=submit]").disabled = true;
                session.checkedSlides[session.slide] = true;
                lessonEl.querySelector('[data-lesson-action="next-slide"]').disabled = false;
            } else {
                feedback.textContent = "Not quite. Review this section and try again.";
                feedback.className = "slide-feedback incorrect";
                form.reset();
            }
            return;
        }
        session.answers[session.quizIndex] = selected ? session.quizQuestion.choices[+selected.value] : null;
        if (session.quizIndex + 1 >= session.quizQuestions.length) finishLessonQuiz();
        else {
            session.quizIndex++;
            session.quizQuestion = session.quizQuestions[session.quizIndex];
            renderLesson();
        }
    });

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