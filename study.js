/* Study Lab: search any topic, learn it in cards, drill key terms, take a scored quiz. */
(function () {
    "use strict";
    var root = document.getElementById("lab");
    if (!root) return;

    /* ---------- helpers ---------- */
    function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
    function at(t) { return esc(t).replace(/"/g, "&quot;"); }
    function jget(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
    function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function hue(s) { var h = 0; s = String(s).toLowerCase(); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
    function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
    var STOP = new Set(("about after again also because been before being between both could does during each from have into more most other over same should some such than that their them then there these they this those through under very what when where which while with would your were was are and the for not but can will has had its his her who how any may use used using one two first many often called known make made like new every within without along around certain given however together another since later early large small part parts include includes including various several different example examples").split(" "));
    var BAD = /^(see also|references|external links|notes|further reading|sources|bibliography|citations|footnotes|gallery|other websites|related pages)$/i;

    /* ---------- fetching (timeout, retry, cache) ---------- */
    function wf(params) {
        var url = "https://en.wikipedia.org/w/api.php?format=json&origin=*&" + Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
        function attempt(n) {
            var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
            return fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (r) {
                clearTimeout(timer); if (!r.ok) throw new Error("http"); return r.json();
            }).catch(function (e) { clearTimeout(timer); if (n < 1) return attempt(n + 1); throw e; });
        }
        return attempt(0);
    }
    function findArticle(topic) {
        return wf({ action: "query", list: "search", srsearch: topic, srlimit: 4, srenablerewrites: 1, srinfo: "suggestion" }).then(function (d) {
            var q = d.query || {}, hits = (q.search || []).map(function (h) { return h.title; });
            if (!hits.length && q.searchinfo && q.searchinfo.suggestion) {
                return wf({ action: "query", list: "search", srsearch: q.searchinfo.suggestion, srlimit: 4 }).then(function (d2) { return ((d2.query || {}).search || []).map(function (h) { return h.title; }); });
            }
            return hits;
        }).then(function (hits) {
            function next(i) {
                if (i >= hits.length) throw new Error("nofound");
                return wf({ action: "query", prop: "extracts", explaintext: 1, exlimit: 1, redirects: 1, titles: hits[i] }).then(function (e) {
                    var pages = (e.query || {}).pages, p = pages && pages[Object.keys(pages)[0]];
                    if (p && p.extract && p.extract.length > 800 && !/may (also )?refer to/.test(p.extract.slice(0, 300))) return { title: p.title, text: p.extract.slice(0, 30000) };
                    return next(i + 1);
                });
            }
            return next(0);
        });
    }
    function loadArticle(topic) {
        var key = "duesoon.lab.cache." + topic.toLowerCase().trim();
        return findArticle(topic).then(function (a) {
            jset(key, a);
            var rec = jget("duesoon.lab.recent", []).filter(function (r) { return r.t !== topic; });
            rec.unshift({ t: topic, k: key }); rec.slice(6).forEach(function (r) { try { localStorage.removeItem(r.k); } catch (e) { } });
            jset("duesoon.lab.recent", rec.slice(0, 6));
            return a;
        }).catch(function (err) {
            var c = jget(key, null);
            if (c) return c;
            throw err;
        });
    }

    /* ---------- building the lesson ---------- */
    function sentences(b) {
        return b.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z])/).map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length >= 40 && s.length <= 260 && s.indexOf("=") < 0 && !/\bISBN\b|\bdoi\b|retrieved/i.test(s); });
    }
    function buildLesson(a) {
        var parts = a.text.split(/\n={2,}\s*(.+?)\s*={2,}\n/), secs = [];
        function add(h, b) { var s = sentences(b); if (s.length) secs.push({ h: h, s: s }); }
        add("Overview", parts[0]);
        for (var i = 1; i < parts.length; i += 2) if (!BAD.test(parts[i])) add(parts[i], parts[i + 1] || "");
        var count = {}, all = secs.map(function (s) { return s.s.join(" "); }).join(" ");
        (all.match(/\b[A-Za-z][A-Za-z-]{4,}\b/g) || []).forEach(function (w) { var k = w.toLowerCase(); if (!STOP.has(k)) count[k] = (count[k] || 0) + 1; });
        var terms = Object.keys(count).filter(function (k) { return count[k] >= 2; }).sort(function (x, y) { return count[y] - count[x]; }).slice(0, 60);
        var cards = [], seen = {};
        terms.slice(0, 24).forEach(function (t) {
            var re = new RegExp("\\b" + t + "\\b", "i"), best = null;
            secs.forEach(function (s) { s.s.forEach(function (x) { if (re.test(x) && (!best || x.length < best.length)) best = x; }); });
            if (best && !seen[best] && cards.length < 12) { seen[best] = 1; cards.push({ term: cap(t), def: best }); }
        });
        return { title: a.title, secs: secs, terms: terms, cards: cards };
    }
    function count1(re, x) { return (x.match(new RegExp(re.source, "gi")) || []).length; }
    function makeQuiz(L, n) {
        var qs = [], used = {}, pool = [];
        L.secs.forEach(function (s, si) { s.s.forEach(function (x) { pool.push({ x: x, si: si }); }); });
        shuffle(pool).forEach(function (p) {
            if (qs.length >= n || used[p.x]) return;
            var found = L.terms.filter(function (t) { return new RegExp("\\b" + t + "\\b", "i").test(p.x); });
            if (L.secs.length >= 4 && Math.random() < 0.3) {
                var others = shuffle(L.secs.map(function (s) { return s.h; }).filter(function (h) { return h !== L.secs[p.si].h; })).slice(0, 3);
                if (others.length < 3) return;
                var opts = shuffle(others.concat(L.secs[p.si].h));
                used[p.x] = 1; qs.push({ prompt: "Which section is this from?", quote: p.x, opts: opts, ans: opts.indexOf(L.secs[p.si].h), why: "It comes from the section \u201C" + L.secs[p.si].h + "\u201D." });
            } else if (found.length === 1 && count1(new RegExp("\\b" + found[0] + "\\b"), p.x) === 1) {
                var t = found[0], re = new RegExp("\\b" + t + "\\b", "i"), m = p.x.match(re)[0], isCap = m.charAt(0) === m.charAt(0).toUpperCase();
                var ds = L.terms.filter(function (d) { return d !== t && !new RegExp("\\b" + d + "\\b", "i").test(p.x); })
                    .sort(function (x, y) { return Math.abs(x.length - t.length) - Math.abs(y.length - t.length); }).slice(0, 8);
                ds = shuffle(ds).slice(0, 3);
                if (ds.length < 3) return;
                var fix = function (w) { return isCap ? cap(w) : w; }, o2 = shuffle(ds.map(fix).concat(m));
                used[p.x] = 1; qs.push({ prompt: "Fill in the blank.", quote: p.x.replace(re, "_____"), opts: o2, ans: o2.indexOf(m), why: p.x });
            }
        });
        return qs;
    }

    /* ---------- state + rendering ---------- */
    var S = { view: "home", topic: "", L: null, tab: "learn", i: 0, flip: false, known: {}, quiz: null, err: "" };
    var SUGGEST = ["AMC", "Science Olympiad", "SAT", "Photosynthesis", "Pythagorean theorem", "World War I"];

    function testTopics() {
        var items = jget("duesoon.items", []), out = [];
        items.forEach(function (it) {
            if (!it.test || it.done) return;
            var ts = (it.notes || "").split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
            (ts.length ? ts : [it.title]).slice(0, 4).forEach(function (t) { out.push({ t: t, from: it.title }); });
        });
        return out.slice(0, 8);
    }
    function chips(list, label) {
        if (!list.length) return "";
        return '<p class="lab-label">' + label + '</p><div class="lab-chips">' + list.map(function (c) {
            return '<button type="button" class="lab-chip" data-act="go" data-topic="' + at(c.t) + '">' + esc(c.t) + (c.from ? '<small>' + esc(c.from) + '</small>' : "") + '</button>';
        }).join("") + '</div>';
    }
    function home() {
        var best = jget("duesoon.lab", { best: {} }).best, done = Object.keys(best).filter(function (k) { return best[k] >= 80; }).length;
        return '<div class="lab-hero"><p class="lab-eyebrow">STUDY LAB</p><h2>What are you studying?</h2>' +
            '<p class="lab-sub">Type a topic like photosynthesis for a lesson and quiz. Type a test like AMC or Science Olympiad and I will ask which year and event, then build your study kit.</p>' +
            '<form id="labf" class="lab-search"><input id="labq" required maxlength="80" placeholder="AMC, Science Olympiad, photosynthesis, SAT…" aria-label="Topic" autocomplete="off"><button class="lab-go" type="submit">Start</button></form>' +
            (S.err ? '<div class="lab-err" role="alert">' + esc(S.err) + '</div>' : "") + '</div>' +
            chips(testTopics(), "From your upcoming tests") +
            chips(jget("duesoon.lab.recent", []).map(function (r) { return { t: r.t }; }), "Recent") +
            chips(SUGGEST.map(function (t) { return { t: t }; }), "Try one") +
            (done ? '<p class="lab-label">\u2605 ' + done + ' topic' + (done > 1 ? "s" : "") + ' mastered</p>' : "");
    }
    function loading() { return '<div class="lab-load"><div class="lab-spin"></div><p>Finding a lesson on <b>' + esc(S.topic) + '</b>\u2026</p></div>'; }

    function header() {
        var L = S.L, best = (jget("duesoon.lab", { best: {} }).best[L.title]), e = encodeURIComponent(L.title);
        var tabs = [["learn", "Learn", L.secs.length + " cards"], ["terms", "Terms", L.cards.length + " cards"], ["quiz", "Quiz", "check yourself"]];
        return '<div class="lab-top"><button type="button" class="lab-back" data-act="home">\u2190 Topics</button>' +
            '<h2 class="lab-title">' + esc(L.title) + (best >= 80 ? ' <span class="lab-star" title="Mastered">\u2605</span>' : "") + '</h2></div>' +
            '<div class="lab-path" role="tablist">' + tabs.map(function (t, n) {
                return '<button type="button" role="tab" aria-selected="' + (S.tab === t[0]) + '" data-act="tab" data-tab="' + t[0] + '"><b>' + (n + 1) + '</b><span>' + t[1] + '<small>' + t[2] + '</small></span></button>';
            }).join("") + '</div>' +
            '<div class="lab-links"><a href="https://en.wikipedia.org/wiki/' + e.replace(/%20/g, "_") + '" target="_blank" rel="noopener">Full article</a>' +
            '<a href="https://www.khanacademy.org/search?page_search_query=' + e + '" target="_blank" rel="noopener">Khan Academy</a>' +
            '<a href="https://www.youtube.com/results?search_query=' + e + '+explained" target="_blank" rel="noopener">Videos</a>' +
            '<a href="https://www.wolframalpha.com/input?i=' + e + '" target="_blank" rel="noopener">Wolfram Alpha</a></div>';
    }
    function nav(n, total, act) {
        return '<div class="lab-nav"><button type="button" class="lab-btn" data-act="prev"' + (n === 0 ? " disabled" : "") + '>Back</button><span>' + (n + 1) + ' / ' + total + '</span>' +
            '<button type="button" class="lab-btn lab-main" data-act="next">' + (n === total - 1 ? act : "Next") + '</button></div>';
    }
    function learn() {
        var s = S.L.secs[S.i];
        return '<article class="lab-card"><p class="lab-eyebrow">Card ' + (S.i + 1) + ' of ' + S.L.secs.length + '</p><h3>' + esc(s.h) + '</h3>' +
            '<p class="lab-key">' + esc(s.s[0]) + '</p>' + s.s.slice(1, 4).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join("") + '</article>' + nav(S.i, S.L.secs.length, "Go to terms");
    }
    function terms() {
        if (!S.L.cards.length) return '<div class="lab-err">Not enough repeated terms in this article for cards. Try a broader topic.</div>';
        var c = S.L.cards[S.i], known = Object.keys(S.known).length;
        var def = esc(c.def).replace(new RegExp("\\b" + c.term + "\\b", "i"), function (m) { return "<mark>" + m + "</mark>"; });
        return '<p class="lab-label">Known ' + known + ' of ' + S.L.cards.length + '. Tap the card to flip.</p>' +
            '<button type="button" class="lab-flip' + (S.flip ? " on" : "") + '" data-act="flip">' + (S.flip ? '<span class="lab-def">' + def + '</span>' : '<span class="lab-term">' + esc(c.term) + '</span>') + '</button>' +
            '<div class="lab-nav"><button type="button" class="lab-btn" data-act="prev"' + (S.i === 0 ? " disabled" : "") + '>Back</button>' +
            '<button type="button" class="lab-btn' + (S.known[S.i] ? " lab-on" : "") + '" data-act="know">' + (S.known[S.i] ? "Known \u2713" : "I know this") + '</button>' +
            '<button type="button" class="lab-btn lab-main" data-act="next"' + (S.i === S.L.cards.length - 1 ? " disabled" : "") + '>Next</button></div>';
    }
    function quiz() {
        var q = S.quiz;
        if (!q) {
            return '<article class="lab-card"><p class="lab-eyebrow">QUIZ</p><h3>Ready to check yourself?</h3><p>Questions are built from this article. Pass with 80% to mark the topic mastered.</p>' +
                '<p class="lab-label">How many questions?</p><div class="lab-chips">' + [5, 10, 15].map(function (n) { return '<button type="button" class="lab-chip" data-act="start" data-n="' + n + '">' + n + '</button>'; }).join("") + '</div></article>';
        }
        if (q.done) {
            var pct = Math.round(q.score / q.qs.length * 100), pass = pct >= 80, missed = q.qs.filter(function (x) { return x.pick !== x.ans; });
            return '<article class="lab-card lab-result ' + (pass ? "pass" : "") + '"><div class="lab-ring" style="--p:' + pct + '"><b>' + pct + '%</b></div><h3>' + (pass ? "Mastered! \u2605" : "Keep going") + '</h3>' +
                '<p>' + q.score + ' of ' + q.qs.length + ' correct. ' + (pass ? "This topic is marked as mastered." : "Review the cards, then try a fresh set.") + '</p>' +
                (missed.length ? '<p class="lab-label">Review</p>' + missed.map(function (x) { return '<div class="lab-miss"><p>' + esc(x.quote) + '</p><p><b>Answer: ' + esc(x.opts[x.ans]) + '</b></p></div>'; }).join("") : "") +
                '<div class="lab-nav"><button type="button" class="lab-btn" data-act="tab" data-tab="learn">Review cards</button><button type="button" class="lab-btn lab-main" data-act="redo">New quiz</button></div></article>';
        }
        var c = q.qs[q.n], ans = c.pick != null;
        return '<div class="lab-bar"><i style="width:' + Math.round(q.n / q.qs.length * 100) + '%"></i></div><article class="lab-card"><p class="lab-eyebrow">Question ' + (q.n + 1) + ' of ' + q.qs.length + '</p><h3>' + esc(c.prompt) + '</h3><p class="lab-key">' + esc(c.quote) + '</p>' +
            '<div class="lab-opts">' + c.opts.map(function (o, k) {
                var cls = ans ? (k === c.ans ? " right" : k === c.pick ? " wrong" : "") : "";
                return '<button type="button" class="lab-opt' + cls + '" data-act="pick" data-k="' + k + '"' + (ans ? " disabled" : "") + '>' + esc(o) + '</button>';
            }).join("") + '</div>' +
            (ans ? '<p class="lab-why"><b>' + (c.pick === c.ans ? "Correct." : "Not quite.") + '</b> ' + esc(c.why) + '</p><button type="button" class="lab-btn lab-main" data-act="after">' + (q.n === q.qs.length - 1 ? "See results" : "Next question") + '</button>' : "") + '</article>';
    }
    function render() {
        root.style.setProperty("--h", S.L ? hue(S.L.title) : 220);
        if (S.view === "home") root.innerHTML = home();
        else if (S.view === "loading") root.innerHTML = loading();
        else if (S.view === "guide") root.innerHTML = guideHtml();
        else root.innerHTML = header() + '<div class="lab-stage">' + (S.tab === "learn" ? learn() : S.tab === "terms" ? terms() : quiz()) + '</div>';
    }

    /* ---------- guided test finder: asks follow-up questions, then builds a study kit ---------- */
    var YEARS = ["2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "Older"];
    var SO_EVENTS = ["Anatomy and Physiology", "Astronomy", "Botany", "Circuit Lab", "Codebusters", "Disease Detectives", "Dynamic Planet", "Entomology", "Experimental Design", "Forensics", "Fossils", "Remote Sensing", "Scrambler", "Water Quality"];
    function slug(t) { return encodeURIComponent(t.replace(/ /g, "_")); }
    function gsearch(q) { return "https://www.google.com/search?q=" + encodeURIComponent(q); }
    var AOPS = "https://artofproblemsolving.com/wiki/index.php/";
    var PATHS = [
        {
            re: /\b(amc|aime)\b/i, name: "AMC / AIME", steps: [
                { key: "c", q: "Which contest are you preparing for?", opts: ["AMC 8", "AMC 10A", "AMC 10B", "AMC 12A", "AMC 12B", "AIME I", "AIME II"] },
                { key: "y", q: "Which year's test do you want?", opts: YEARS }],
            kit: function (a) {
                var f = a.c.replace(/ /g, "_"), fam = a.c.indexOf("AMC 8") === 0 ? "AMC_8" : a.c.indexOf("AMC 10") === 0 ? "AMC_10" : a.c.indexOf("AMC 12") === 0 ? "AMC_12" : "AIME", cards = [];
                if (a.y === "Older") cards.push({ t: "Browse every past " + fam.replace("_", " ") + " test", d: "All years, with problems and solutions.", href: AOPS + fam + "_Problems_and_Solutions" });
                else cards.push({ t: a.y + " " + a.c + " problems", d: "Open the test. In your browser use Print, then Save as PDF to keep a copy.", href: AOPS + a.y + "_" + f + "_Problems" },
                    { t: "Answer key", d: "Check your answers after you finish.", href: AOPS + a.y + "_" + f + "_Answer_Key" });
                cards.push({ t: "Official competition info", d: "Dates, registration, and rules from the MAA.", href: "https://maa.org/math-competitions" });
                var time = fam === "AMC_8" ? "25 questions in 40 minutes" : fam === "AIME" ? "15 questions in 3 hours" : "25 questions in 75 minutes";
                return { cards: cards, tip: "Real format: " + time + ". Try it timed, then review every miss.", topics: ["Number theory", "Combinatorics", "Geometry", "Algebra", "Probability"] };
            }
        },
        {
            re: /science olympiad|scioly/i, name: "Science Olympiad", steps: [
                { key: "y", q: "Which season?", opts: ["2026\u201327", "2025\u201326", "2024\u201325", "2023\u201324", "Older"] },
                { key: "d", q: "Which division?", opts: ["Division B (middle school)", "Division C (high school)"] },
                { key: "e", q: "Which event?", opts: SO_EVENTS, free: "Other event" }],
            kit: function (a) {
                return {
                    cards: [
                        { t: a.e + " on the Scioly wiki", d: "Event overview, study resources, and tips.", href: "https://scioly.org/wiki/index.php/" + slug(a.e) },
                        { t: "Test Exchange", d: "Past tests and keys. Filter by event, then pick the " + a.y + " season or the closest one.", href: "https://scioly.org/tests/" },
                        { t: "Official rules", d: "Rules manuals are on the Science Olympiad site. Events and rules change each season.", href: "https://www.soinc.org/" }],
                    tip: "Events differ between " + a.d.split(" (")[0] + " and the other division, so check that this event is on your division's list.", lesson: a.e
                };
            }
        },
        {
            re: /^(the )?sat( test| prep| practice)?$/i, name: "SAT", steps: [{ key: "s", q: "What do you want to practice?", opts: ["Math", "Reading and Writing", "Full practice test"] }],
            kit: function (a) {
                return {
                    cards: [
                        { t: "Official SAT practice", d: "Free practice from College Board.", href: "https://satsuite.collegeboard.org/" },
                        { t: "Khan Academy SAT", d: "Free lessons and practice sorted by skill.", href: "https://www.khanacademy.org/test-prep/sat" },
                        { t: "Search: SAT " + a.s + " practice PDFs", d: "Printable practice from the web.", href: gsearch("SAT " + a.s + " practice test pdf") }],
                    tip: "Take full tests timed, then study every miss.", topics: a.s === "Math" ? ["Algebra", "Geometry", "Trigonometry"] : ["Grammar", "Reading comprehension"]
                };
            }
        },
        {
            re: /^(the )?act( test| prep| practice)?$/i, name: "ACT", steps: [{ key: "s", q: "Which section?", opts: ["English", "Math", "Reading", "Science", "Full practice test"] }],
            kit: function (a) {
                return {
                    cards: [
                        { t: "Official ACT site", d: "Test info and official preparation.", href: "https://www.act.org/" },
                        { t: "Search: ACT " + a.s + " practice PDFs", d: "Printable practice from the web.", href: gsearch("ACT " + a.s + " practice test pdf") }],
                    tip: "Practice under the real time limit, then review every miss."
                };
            }
        },
        {
            re: /^ap\b|\bap (exam|test)\b/i, name: "AP exam", steps: [
                { key: "s", q: "Which AP subject?", opts: ["Calculus AB", "Biology", "Chemistry", "Physics 1", "US History", "Computer Science A"], free: "Other AP subject" },
                { key: "y", q: "Which year's questions?", opts: ["2025", "2024", "2023", "2022", "Older"] }],
            kit: function (a) {
                return {
                    cards: [
                        { t: "AP Central", d: "Course descriptions and exam info from College Board.", href: "https://apcentral.collegeboard.org/" },
                        { t: "Search: AP " + a.s + " " + a.y + " free-response PDFs", d: "Past free-response questions and scoring guides.", href: gsearch("AP " + a.s + " " + (a.y === "Older" ? "" : a.y + " ") + "free response questions pdf") }],
                    tip: "Do the free-response questions timed, then grade yourself with the scoring guide.", lesson: a.s
                };
            }
        }
    ];
    function matchPath(t) { for (var i = 0; i < PATHS.length; i++) if (PATHS[i].re.test(t.trim())) return PATHS[i]; return null; }
    function startGuide(p, topic) {
        S.view = "guide"; S.L = null; S.G = { p: p, a: {}, n: 0 };
        var low = topic.toLowerCase();
        while (S.G.n < p.steps.length) {
            var st = p.steps[S.G.n], hit = st.opts.filter(function (o) { return low.indexOf(o.toLowerCase()) > -1; }).sort(function (x, y) { return y.length - x.length; })[0];
            if (!hit) break; S.G.a[st.key] = hit; S.G.n++;
        }
        render();
    }
    function gpick(v) { var G = S.G; if (!v || G.n >= G.p.steps.length) return; G.a[G.p.steps[G.n].key] = v; G.n++; render(); }
    function bub(t) { return '<div class="lab-bub">' + esc(t) + '</div>'; }
    function guideHtml() {
        var G = S.G, p = G.p, h = '<div class="lab-top"><button type="button" class="lab-back" data-act="home">\u2190 Topics</button><h2 class="lab-title">' + esc(p.name) + '</h2></div><div class="lab-chat">';
        p.steps.forEach(function (s, i) {
            if (i > G.n) return;
            h += bub(s.q);
            if (i < G.n) h += '<button type="button" class="lab-me" data-act="gback" data-n="' + i + '">' + esc(G.a[s.key]) + ' <small>change</small></button>';
            else {
                h += '<div class="lab-chips">' + s.opts.map(function (o) { return '<button type="button" class="lab-chip" data-act="gpick" data-v="' + at(o) + '">' + esc(o) + '</button>'; }).join("") + '</div>';
                if (s.free) h += '<form class="lab-free" data-gfree><input id="gfree" maxlength="60" placeholder="' + at(s.free) + '" required><button class="lab-btn" type="submit">Use this</button></form>';
            }
        });
        if (G.n >= p.steps.length) h += kitHtml(p.kit(G.a));
        return h + "</div>";
    }
    function kitHtml(k) {
        var h = bub("Here is your study kit.") + '<div class="lab-kit">' + k.cards.map(function (c) {
            return '<a class="lab-kc" href="' + at(c.href) + '" target="_blank" rel="noopener"><b>' + esc(c.t) + '</b><span>' + esc(c.d) + '</span><i>Open \u2197</i></a>';
        }).join("") + '</div>';
        if (k.tip) h += '<p class="lab-tip">' + esc(k.tip) + '</p>';
        if (k.lesson || k.topics) {
            h += '<p class="lab-label">Learn it here first</p>';
            if (k.lesson) h += '<form class="lab-free" data-glesson><input id="glesson" value="' + at(k.lesson) + '" maxlength="80" aria-label="Lesson topic"><button class="lab-main" type="submit">Build lesson</button></form>';
            if (k.topics) h += '<div class="lab-chips">' + k.topics.map(function (t) { return '<button type="button" class="lab-chip" data-act="go" data-topic="' + at(t) + '">' + esc(t) + '</button>'; }).join("") + '</div>';
        }
        return h;
    }

    /* ---------- actions ---------- */
    var req = 0;
    function go(topic, force) {
        topic = topic.trim(); if (!topic) return;
        var gp = force ? null : matchPath(topic); if (gp) { startGuide(gp, topic); return; }
        var my = ++req; S.view = "loading"; S.topic = topic; S.err = ""; render();
        loadArticle(topic).then(function (a) {
            if (my !== req) return;
            var L = buildLesson(a);
            if (L.secs.length < 1) throw new Error("thin");
            S.L = L; S.view = "lesson"; S.tab = "learn"; S.i = 0; S.flip = false; S.known = {}; S.quiz = null; render();
        }).catch(function (e) {
            if (my !== req) return;
            S.view = "home"; S.L = null;
            S.err = e && e.message === "nofound" ? "No clear article found for \u201C" + topic + "\u201D. Try the main term only, like \u201Cphotosynthesis\u201D." :
                e && e.message === "thin" ? "That article is too short to build a lesson. Try a broader topic." : "Could not load. Check your connection and try again.";
            render();
        });
    }
    function setTab(t) { S.tab = t; S.i = 0; S.flip = false; render(); }
    function startQuiz(n) {
        var qs = makeQuiz(S.L, n);
        if (qs.length < 3) { root.querySelector(".lab-stage").insertAdjacentHTML("afterbegin", '<div class="lab-err">This article does not have enough material for a quiz. Try a longer topic.</div>'); return; }
        S.quiz = { qs: qs, n: 0, score: 0, done: false }; render();
    }
    function finish() {
        var q = S.quiz; q.done = true;
        var d = jget("duesoon.lab", { best: {} }), pct = Math.round(q.score / q.qs.length * 100);
        d.best[S.L.title] = Math.max(d.best[S.L.title] || 0, pct); jset("duesoon.lab", d);
    }

    root.addEventListener("submit", function (e) {
        if (e.target.id === "labf") { e.preventDefault(); go(document.getElementById("labq").value); }
        else if (e.target.hasAttribute("data-gfree")) { e.preventDefault(); gpick(document.getElementById("gfree").value.trim()); }
        else if (e.target.hasAttribute("data-glesson")) { e.preventDefault(); go(document.getElementById("glesson").value, true); }
    });
    root.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var a = b.dataset.act, L = S.L;
        if (a === "go") go(b.dataset.topic);
        else if (a === "gpick") gpick(b.dataset.v);
        else if (a === "gback") { S.G.n = +b.dataset.n; render(); }
        else if (a === "home") { req++; S.view = "home"; S.L = null; S.err = ""; render(); }
        else if (a === "tab") setTab(b.dataset.tab);
        else if (a === "prev") { S.i = Math.max(0, S.i - 1); S.flip = false; render(); }
        else if (a === "next") {
            var max = S.tab === "learn" ? L.secs.length : L.cards.length;
            if (S.tab === "learn" && S.i === max - 1) setTab("terms"); else { S.i = Math.min(max - 1, S.i + 1); S.flip = false; render(); }
        }
        else if (a === "flip") { S.flip = !S.flip; render(); }
        else if (a === "know") { if (S.known[S.i]) delete S.known[S.i]; else S.known[S.i] = 1; render(); }
        else if (a === "start") startQuiz(+b.dataset.n);
        else if (a === "redo") { S.quiz = null; render(); }
        else if (a === "pick") { var c = S.quiz.qs[S.quiz.n]; c.pick = +b.dataset.k; if (c.pick === c.ans) S.quiz.score++; render(); }
        else if (a === "after") { if (S.quiz.n === S.quiz.qs.length - 1) finish(); else S.quiz.n++; render(); }
    });
    document.addEventListener("keydown", function (e) {
        if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
            setTimeout(function () { var i = document.getElementById("labq"); if (i) i.focus(); }, 50);
        }
    });
    window.__lab = { buildLesson: buildLesson, makeQuiz: makeQuiz };
    render();
})();