/**
 * @file utils.js
 * @description Helper functions for MONAD MERCENARY
 */

// --- TAG LOGIC ---
const TAG_RULES = {
    '#SECURITY': ['audit', 'bug', 'exploit', 'security', 'hack'],
    '#DESIGN': ['design', 'logo', 'ui', 'ux', 'svg', 'art'],
    '#DEV': ['contract', 'solidity', 'web3', 'react', 'frontend', 'backend', 'api'],
    '#DEFI': ['swap', 'liquidity', 'token', 'yield', 'staking']
};

function getTags(text) {
    if (!text) return ['#GENERAL'];
    text = text.toLowerCase();
    let tags = [];
    for (const [tag, keywords] of Object.entries(TAG_RULES)) {
        if (keywords.some(k => text.includes(k))) tags.push(tag);
    }
    if (tags.length === 0) tags.push('#GENERAL');
    return tags.slice(0, 3); // Max 3 tags
}

// --- RANK LOGIC ---
function getRank(xp) {
    // XP based ranks
    if (xp >= 100) return { label: "COMMANDER", color: "text-red-500", icon: "fa-crown" };
    if (xp >= 50) return { label: "WARLORD", color: "text-orange-500", icon: "fa-skull" };
    if (xp >= 20) return { label: "MERCENARY", color: "text-monad-accent", icon: "fa-sword" };
    if (xp >= 10) return { label: "SOLDIER", color: "text-monad-blue", icon: "fa-shield" };
    return { label: "NOVICE", color: "text-gray-500", icon: "fa-user-ninja" };
}

// --- AVATAR (Blockies) ---
function generateAvatar(seed) {
    if (typeof blockies === 'undefined') return '';
    try {
        const icon = blockies.create({
            seed: seed.toLowerCase(),
            size: 8,
            scale: 4,
            color: '#825CFF', // Monad Accent
            bgcolor: '#1a1a1a',
            spotcolor: '#00A3FF'
        });
        return `<img src="${icon.toDataURL()}" class="w-full h-full object-cover">`;
    } catch (e) {
        return '';
    }
}

// --- TOAST NOTIFICATIONS ---
function showToast(msg, type = "info") {
    if (typeof Toastify === 'undefined') {
        console.log(`[TOAST]: ${msg}`);
        return;
    }
    
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "bottom",
        position: "right",
        style: {
            background: "#0A0A0A",
            border: "2px solid #825CFF",
            color: type === "error" ? "#ff5f6d" : (type === "success" ? "#00ff00" : "#00A3FF"),
            fontWeight: "bold",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
        },
    }).showToast();
}

/**
 * Normalizes an address for comparison
 */
function normalizeAddr(addr) {
    return addr ? addr.toLowerCase() : "";
}

/**
 * Formats a short address
 */
function shortAddr(addr) {
    if (!addr) return "0x00...000";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}
