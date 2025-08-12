const usStates = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY",
    "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH",
    "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"
];

const iconStylesheet = document.createElement("link");
iconStylesheet.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded";
iconStylesheet.rel = "stylesheet";
document.head.appendChild(iconStylesheet);

const addressRegex = new RegExp(
    String.raw`\b\d{1,6}[A-Z0-9\s,]*?(?:${usStates.join("|")})[\s,]*\d{5}\b`,
    "gi"
);

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

        if (
            node.parentNode.nodeType === Node.ELEMENT_NODE &&
            node.parentNode.hasAttribute("data-zillow-injected")
        ) {
            continue;
        }

        const text = node.nodeValue;
        const matches = [...text.matchAll(addressRegex)];
        if (matches.length === 0) continue;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;

        matches.forEach(match => {
            const address = match[0];
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
            icon.style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";

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
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "4px",
                    });

                    const logo = document.createElement("img");
                    Object.assign(logo, { src: logoUrl, alt: "" });
                    Object.assign(logo.style, {
                        width: "16px",
                        height: "16px",
                        marginRight: "6px",
                    });

                    const link = document.createElement("a");
                    Object.assign(link, { href: linkUrl, textContent: label, target: "_blank" });
                    Object.assign(link.style, {
                        color: "#0073e6",
                        textDecoration: "none",
                    });

                    row.appendChild(logo);
                    row.appendChild(link);
                    return row;
                };

                container.appendChild(makeRow(
                    "https://www.zillow.com/favicon.ico",
                    "Zillow",
                    `https://www.zillow.com/homes/${encodeURIComponent(address)}`
                ));
                container.appendChild(makeRow(
                    "https://www.har.com/favicon.ico",
                    "HAR",
                    `https://www.har.com/?prefill=${encodeURIComponent(address)}`
                ));
                container.appendChild(makeRow(
                    "https://www.realtor.com/favicon.ico",
                    "Realtor.com",
                    `https://www.realtor.com/realestateforsale?prefill=${encodeURIComponent(address)}`
                ));


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
    childList: true,
    subtree: true
});
