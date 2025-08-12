const usStates = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY",
    "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH",
    "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"
];

function normalizeAddress(input) {
    try {
        if (!input) return "";
        let s = String(input).trim();

        // 1) Split run-on boundaries
        s = s
            .replace(/(\d)([A-Za-z])/g, "$1 $2")    // 710K -> 710 K
            .replace(/([A-Za-z])(\d)/g, "$1 $2")    // Ct77079 -> Ct 77079
            .replace(/([a-z])([A-Z])/g, "$1 $2")    // KahldenCt -> Kahlden Ct
            .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
            .replace(/\s+/g, " ")
            .trim();

        // 2) Strip unit/suite tags if present
        s = s.replace(/\b(?:apt|apartment|unit|ste|suite|#)\s*[\w\-]+/gi, "").replace(/\s{2,}/g, " ").trim();

        // 3) Normalize any existing commas
        s = s.replace(/，/g, ",").replace(/\s*,\s*/g, ", ").replace(/\s{2,}/g, " ").trim();

        // If commas already present, just ensure state is uppercased before ZIP and return.
        if (s.includes(",")) {
            return s.replace(/,\s*([a-z]{2})\s+(\d{5}(?:-\d{4})?)/i, (_, st, zip) => `, ${st.toUpperCase()} ${zip}`).trim();
        }

        // 4) No commas: try to build "<street>, <city>, <ST> <ZIP>"
        const tokens = s.split(" ");
        if (tokens.length < 4) return s;

        const zipRe = /^\d{5}(?:-\d{4})?$/;
        const stateRe = /^[A-Za-z]{2}$/;

        const zip = tokens[tokens.length - 1];
        const state = tokens[tokens.length - 2];
        if (!zipRe.test(zip) || !stateRe.test(state)) {
            return s; // can't confidently structure
        }

        const rest = tokens.slice(0, -2); // street + city part
        if (!/^\d/.test(rest[0])) return s; // expect house number first

        // Street suffixes to detect street end
        const SUF = new Set([
            "st","street","rd","road","dr","drive","ln","lane","ct","court","cir","circle",
            "ave","avenue","blvd","boulevard","pkwy","parkway","trl","trail","way","cv","cove",
            "hwy","highway","ter","terrace","pl","place","sq","square","loop","bend"
        ]);
        const DIR = new Set(["N","S","E","W","NE","NW","SE","SW"]);

        // Find the index of the street suffix
        let sufIdx = -1;
        for (let i = 1; i < rest.length; i++) {
            const tokNorm = rest[i].toLowerCase().replace(/\./g, "");
            if (SUF.has(tokNorm)) { sufIdx = i; break; }
        }

        let street, city;

        if (sufIdx !== -1) {
            // Include trailing number or direction after suffix (e.g., "Hwy 6", "St W")
            let end = sufIdx;
            while (end + 1 < rest.length && (/^\d+$/.test(rest[end + 1]) || DIR.has(rest[end + 1].toUpperCase()))) {
                end++;
            }
            street = rest.slice(0, end + 1).join(" ");
            city   = rest.slice(end + 1).join(" ");
        } else {
            // Fallback: assume street is "number + two tokens", rest = city
            if (rest.length >= 4) {
                street = rest.slice(0, 3).join(" ");
                city   = rest.slice(3).join(" ");
            } else {
                return s; // too ambiguous
            }
        }

        if (!city) return s;

        return `${street}, ${city}, ${state.toUpperCase()} ${zip}`.trim();
    } catch {
        return String(input);
    }
}


const iconStylesheet = document.createElement("link");
iconStylesheet.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded";
iconStylesheet.rel = "stylesheet";
document.head.appendChild(iconStylesheet);

const addressRegex = new RegExp(String.raw`\b\d{1,6}[A-Z0-9\s,]*?(?:${usStates.join("|")})[\s,]*\d{5}\b`, "gi");

function throttle(fn, delay) {
    let timeout = null;
    return function () {
        if (!timeout) {
            timeout = setTimeout(() => {
                fn();
                timeout = null;
            }, delay);
        }
    };
}

function injectZillowButtons() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = walker.nextNode())) {
        if (!node.nodeValue || !node.parentNode) continue;

        if (node.parentNode.nodeType === Node.ELEMENT_NODE && node.parentNode.hasAttribute("data-zillow-injected") //this... works, right?
        ) {
            continue;
        }

        const text = node.nodeValue;
        const matches = [...text.matchAll(addressRegex)];
        if (matches.length === 0) continue;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;

        matches.forEach(match => {
            const rawAddress = match[0];
            const address = normalizeAddress(rawAddress);
            console.log(address);
            const start = match.index;
            const end = start + address.length;

            if (start > lastIndex) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
            }

            const wrapper = document.createElement("span");
            wrapper.setAttribute("data-zillow-injected", "true");

            const addressText = document.createTextNode(address + " ");
            const btn = document.createElement("button");
            btn.className = "zillow-btn";
            btn.style.border = "none";
            btn.style.background = "transparent";
            btn.style.cursor = "pointer";
            btn.style.padding = "4px";

            const icon = document.createElement("span");
            icon.className = "material-symbols-rounded";
            icon.textContent = "home";
            icon.style.fontSize = "24px";
            icon.style.verticalAlign = "middle";

            btn.appendChild(icon);

            let overButton = false;
            let overMenu = false;
            let hideTimeout = null;

            function scheduleHide() {
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(() => {
                    if (!overButton && !overMenu) {
                        document.getElementById("plugin-main-container")?.remove();
                    }
                }, 150);
            }

            btn.addEventListener("mouseenter", () => {
                overButton = true;
                clearTimeout(hideTimeout);

                document.getElementById("plugin-main-container")?.remove();

                const container = document.createElement("div");
                container.id = "plugin-main-container";
                Object.assign(container.style, {
                    position: "absolute",
                    background: "#fff",
                    border: "1px solid #ccc",
                    padding: "8px",
                    borderRadius: "6px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    zIndex: "9999",
                });

                const makeRow = (logoUrl, label, linkUrl) => {
                    const row = document.createElement("div");
                    Object.assign(row.style, {
                        display: "flex", alignItems: "center", marginBottom: "4px",
                    });

                    const logo = document.createElement("img");
                    Object.assign(logo, {src: logoUrl, alt: ""});
                    Object.assign(logo.style, {
                        width: "16px", height: "16px", marginRight: "6px",
                    });

                    const link = document.createElement("a");
                    Object.assign(link, {href: linkUrl, textContent: label, target: "_blank"});
                    Object.assign(link.style, {
                        color: "#0073e6", textDecoration: "none",
                    });

                    row.appendChild(logo);
                    row.appendChild(link);
                    return row;
                };

                container.appendChild(makeRow("https://www.zillow.com/favicon.ico", "Zillow", `https://www.zillow.com/homes/${encodeURIComponent(address)}`));
                container.appendChild(makeRow("https://www.har.com/favicon.ico", "HAR", `https://www.har.com/?prefill=${encodeURIComponent(address)}`));
                container.appendChild(makeRow("https://www.realtor.com/favicon.ico", "Realtor.com", `https://www.realtor.com/realestateforsale?prefill=${encodeURIComponent(address)}`));


                const rect = btn.getBoundingClientRect();
                container.style.top = `${rect.bottom + window.scrollY}px`;
                container.style.left = `${rect.left + window.scrollX}px`;

                container.addEventListener("mouseenter", () => {
                    overMenu = true;
                    clearTimeout(hideTimeout);
                });
                container.addEventListener("mouseleave", () => {
                    overMenu = false;
                    scheduleHide();
                });

                document.body.appendChild(container);
            });

            btn.addEventListener("mouseleave", () => {
                overButton = false;
                scheduleHide();
            });

            wrapper.appendChild(addressText);
            wrapper.appendChild(btn);
            frag.appendChild(wrapper);

            lastIndex = end;
        });

        if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        node.parentNode.replaceChild(frag, node);
    }
}

const throttledInject = throttle(injectZillowButtons, 100);

window.addEventListener("load", throttledInject);

const observer = new MutationObserver(() => {
    throttledInject();
});

observer.observe(document.body, {
    childList: true, subtree: true
});
