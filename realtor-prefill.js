(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillRaw = params.get("prefill");
    if (!prefillRaw) return;

    const prefill = decodeURIComponent(prefillRaw).trim();

    const waitFor = (fn, timeoutMs = 6000, intervalMs = 80) =>
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

    const setReactInputValue = (input, value) => {
        const proto = Object.getPrototypeOf(input);
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        desc?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const pressEnter = el => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup",   { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    };

    const norm = s => s.toLowerCase()
        .replace(/[,#]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const digits = s => (s.match(/\d+/g) || []);
    const findZip = s => {
        const m = s.match(/\b\d{5}(?:-\d{4})?\b/);
        return m ? m[0] : null;
    };

    const SIG_SKIP = new Set(["st","rd","ave","blvd","ln","ct","dr","hwy","pkwy","trl","cir","cv","way","nw","ne","sw","se","n","s","e","w","tx","us","usa"]);
    const sigTokens = s => norm(s).split(" ")
        .filter(t => t.length >= 3 && !SIG_SKIP.has(t));

    const addressDigits = digits(prefill);
    const streetNumber = addressDigits[0] || null;
    const zip = findZip(prefill);
    const addressSig = sigTokens(prefill);

    const suggestionSelector = [
        '#search-bar-listbox [role="option"]',
        '[data-testid="typeahead-option"]',
        '[data-testid="search-suggestion"]',
        '[role="listbox"] [role="option"]',
        'ul[role="listbox"] li'
    ].join(", ");

    const getSuggestions = () =>
        Array.from(document.querySelectorAll(suggestionSelector))
            .map(el => ({ el, text: norm(el.textContent || "") }))
            .filter(s => s.text); // keep non-empty

    const matchesAddress = (sText) => {
        if (streetNumber && !sText.includes(streetNumber)) return false;

        if (zip && sText.includes(zip)) return true;

        let hits = 0;
        for (const tok of addressSig) {
            if (sText.includes(tok)) hits++;
            if (hits >= 2) return true;
        }
        return false;
    };

    (async () => {
        const input = await waitFor(() => document.querySelector('#search-bar, [data-testid="input-element"]'));
        if (!input) return;

        input.focus();

        setReactInputValue(input, prefill);

        await delay(200);

        let chosen = null;
        const start = Date.now();
        while (!chosen && Date.now() - start < 2500) {
            const suggestions = getSuggestions();
            chosen = suggestions.find(s => matchesAddress(s.text)) || null;
            if (!chosen) await delay(120);
        }

        if (chosen) {
            chosen.el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            chosen.el.click();
        } else {
            pressEnter(input);
        }
    })();
})();
