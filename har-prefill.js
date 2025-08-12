(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillRaw = params.get("prefill");
    if (!prefillRaw) return;

    const prefill = decodeURIComponent(prefillRaw).trim();

    const waitFor = (fn, timeoutMs = 7000, intervalMs = 80) =>
        new Promise(resolve => {
            const start = Date.now();
            const timer = setInterval(() => {
                const v = fn();
                if (v || Date.now() - start > timeoutMs) {
                    clearInterval(timer);
                    resolve(v || null);
                }
            }, intervalMs);
        });

    const delay = ms => new Promise(r => setTimeout(r, ms));

    const setFrameworkInputValue = (input, value) => {
        const proto = Object.getPrototypeOf(input);
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        desc?.set?.call(input, value);
        input.dispatchEvent(new Event("input",  { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const pressKey = (el, key) => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup",   { key, code: key, bubbles: true }));
    };

    const pressEnter = el => pressKey(el, "Enter");

    const norm = s => s.toLowerCase().replace(/[,#]/g, " ").replace(/\s+/g, " ").trim();
    const digits = s => (s.match(/\d+/g) || []);
    const findZip = s => {
        const m = s.match(/\b\d{5}(?:-\d{4})?\b/);
        return m ? m[0] : null;
    };
    const SIG_SKIP = new Set(["st","rd","ave","blvd","ln","ct","dr","hwy","pkwy","trl","cir","cv","way","nw","ne","sw","se","n","s","e","w","tx","us","usa"]);
    const sigTokens = s => norm(s).split(" ").filter(t => t.length >= 3 && !SIG_SKIP.has(t));

    const streetNumber = digits(prefill)[0] || null;
    const zip = findZip(prefill);
    const addressSig = sigTokens(prefill);

    const matchesAddress = (sTextNorm) => {
        if (streetNumber && !sTextNorm.includes(streetNumber)) return false;
        if (zip && sTextNorm.includes(zip)) return true;
        let hits = 0;
        for (const tok of addressSig) {
            if (sTextNorm.includes(tok)) hits++;
            if (hits >= 2) return true;
        }
        return false;
    };

    (async () => {
        const input = await waitFor(() =>
            document.querySelector(
                'input#search, input#keyword, input[name="q"], input[aria-label*="Search"], ' +
                'input[placeholder*="Address"], input[placeholder*="City"], ' +
                'input[type="search"], input[type="text"].search, input[type="text"].search-input'
            )
        );
        if (!input) return;

        input.focus();
        setFrameworkInputValue(input, prefill);

        await delay(200);

        pressKey(input, "ArrowDown");

        const getSuggestions = () =>
            Array.from(document.querySelectorAll(
                '#mainsearch_listbox .tt-suggestion.tt-selectable, ' + //utter woke HAR nonsense
                '[role="listbox"] .tt-suggestion.tt-selectable, ' +
                '[role="listbox"] [role="option"]'
            )).map(el => ({ el, text: norm(el.textContent || "") }))
                .filter(s => s.text);

        let chosen = null;
        const start = Date.now();
        while (!chosen && Date.now() - start < 2500) {
            const suggestions = getSuggestions();
            chosen = suggestions.find(s => matchesAddress(s.text)) || null;
            if (!chosen) await delay(120);
        }

        if (chosen) {
            await delay(120);
            chosen.el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            chosen.el.click();
        } else {
            const btn = document.querySelector('button[aria-label="Search"], button[type="submit"], .search-button, .btn-search');
            if (btn) btn.click(); else pressEnter(input);
        }
    })();
})();
