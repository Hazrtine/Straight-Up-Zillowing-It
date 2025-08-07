const usStates = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY",
    "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH",
    "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"
];

const addressRegex = new RegExp(
    String.raw`\b\d{1,6}[A-Z0-9\s,]*?(?:${usStates.join("|")})[\s,]*\d{5}\b`,
    "gi"
);

// THROTTLE FUNCTION
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

// THE MAIN FUNCTION
function injectZillowButtons() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = walker.nextNode())) {
        if (!node.nodeValue || !node.parentNode) continue;

        // Skip if already processed
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

            const img = document.createElement("img");
            img.src = "https://www.zillow.com/favicon.ico";
            img.alt = "Zillow";
            img.style.width = "24px";
            img.style.height = "24px";
            img.style.verticalAlign = "middle";

            btn.appendChild(img);

            btn.onclick = () => {
                const urlAddress = encodeURIComponent(address.replace(/\s+/g, " ").trim());
                window.open(`https://www.zillow.com/homes/${urlAddress}_rb`, "_blank");
            };

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
