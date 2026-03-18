// --- CONSTANTS ---
const CONTRACT_ADDRESS = "0xd9145CCE52D386f254917e481eB44e9943F39138";
const CONTRACT_ABI = [
    "function postQuest(string memory _desc) public payable",
    "function postQuestERC20(string memory _desc, address _token, uint _amount) public",
    "function payoutMercenary(uint _id, address _mercenary) public",
    "function getActiveQuests() public view returns (tuple(uint id, address poster, string description, uint reward, address token, bool isCompleted, address winner)[])",
    "function getReputation(address _user) public view returns (uint)",
    "event QuestPosted(uint indexed id, address indexed poster, uint reward, address token)",
    "event QuestCompleted(uint indexed id, address indexed winner, uint reward, address token, uint xpGained)"
];
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) public view returns (uint256)",
    "function decimals() public view returns (uint8)",
    "function symbol() public view returns (string)"
];

const MONAD_CHAIN_ID = 10143; // Placeholder for Monad Testnet
const MONAD_NETWORK_PARAMS = {
    chainId: '0x279F', // Hex for 10143
    chainName: 'Monad Testnet',
    nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: ['https://rpc-devnet.monadinfra.com/rpc/3fe540e310bbb6ed397097d64308a5f6'], // Example RPC
    blockExplorerUrls: ['https://explorer.monad.xyz/']
};

// --- STATE ---
let provider, signer, contract;
let userAddress = null;
let userXP = 0;
let isConnected = false;
let allQuests = [];
let currentFilter = 'all';

// --- MOCK DATA ---
// Pre-fill some tasks to look good immediately
const MOCK_QUESTS = [
    { id: 104, poster: "0x123...456", description: "Design a new logo for 'Ghost Protocol'", reward: "500.0", isCompleted: false, winner: "0x000" },
    { id: 103, poster: "0xabc...def", description: "Fix re-entrancy bug in Vault.sol", reward: "1250.0", isCompleted: true, winner: "0x789...012" },
    { id: 102, poster: "0x555...777", description: "Deploy Uniswap V3 on Monad Testnet", reward: "200.0", isCompleted: false, winner: "0x000" }
];

// --- INIT ---
window.addEventListener('load', async () => {
    // Start Loop
    // If Contract Address is default, usage MOCK loop
    if (CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE") {
        console.log("Starting Mock Loop");

        // Load Persisted Data
        const savedData = localStorage.getItem('mockQuests');
        if (savedData) {
            allQuests = JSON.parse(savedData);
        } else {
            allQuests = MOCK_QUESTS;
        }

        renderQuests();
        updateStats();
        setInterval(() => {
            document.getElementById('lastUpdated').innerText = `LIVE: ${new Date().toLocaleTimeString()}`;
        }, 3000);
    } else {
        if (window.ethereum) {
            provider = new ethers.providers.Web3Provider(window.ethereum);

            // Init Read-Only Contract first (so we can see data without connecting)
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

            const accounts = await provider.listAccounts();
            if (accounts.length > 0) handleAccountsChanged(accounts);

            // Listen for Chain Changes
            window.ethereum.on('chainChanged', () => window.location.reload());

            loadQuests();
            // Optional: Keep polling as backup, but events will handle most things
            setInterval(loadQuests, 15000);
        } else {
            // Fallback for non-web3 browsers: FORCE MOCK DATA
            console.warn("No Web3 Provider. Forcing Mock Mode.");
            allQuests = MOCK_QUESTS;
            renderQuests();
            updateStats();
            document.getElementById('networkStatus').classList.add('hidden'); // Hide network warning in mock mode
            setInterval(() => {
                document.getElementById('lastUpdated').innerText = `SIM: ${new Date().toLocaleTimeString()}`;
            }, 3000);
        }
    }


});



// --- FILTERS & STATS ---
function setFilter(filter) {
    currentFilter = filter;

    // Update UI Tabs
    ['all', 'open', 'mine'].forEach(f => {
        const btn = document.getElementById(`filter-${f}`);
        if (f === filter) {
            btn.classList.add('text-monad-accent', 'border-b');
            btn.classList.remove('text-gray-500');
        } else {
            btn.classList.remove('text-monad-accent', 'border-b');
            btn.classList.add('text-gray-500');
        }
    });

    renderQuests();
}

function updateStats() {
    if (!allQuests.length) return;

    const totalVol = allQuests.reduce((acc, q) => acc + parseFloat(q.reward), 0);
    const openCount = allQuests.filter(q => !q.isCompleted).length;
    const completedCount = allQuests.filter(q => q.isCompleted).length;
    const avgReward = totalVol / allQuests.length;

    // Animate Numbers (Simple text replace for now)
    document.getElementById('stat-volume').innerText = totalVol.toFixed(1);
    document.getElementById('stat-open').innerText = openCount;
    document.getElementById('stat-completed').innerText = completedCount;
    document.getElementById('stat-avg').innerText = avgReward.toFixed(1);
}

// --- REPUTATION LOGIC MOVED TO utils.js ---

// --- WALLET FUNCTIONS ---
async function updateReputation(addr) {
    if (!addr) return;
    
    // MOCK MODE
    if (CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE" || !contract || addr.startsWith("0xMock")) {
        const completed = allQuests.filter(q => q.isCompleted && q.winner.toLowerCase() === addr.toLowerCase()).length;
        userXP = completed * 10;
    } else {
        try {
            const xp = await contract.getReputation(addr);
            userXP = xp.toNumber();
        } catch (e) {
            console.error("XP Fetch Error", e);
        }
    }

    const rank = getRank(userXP);
    const rankEl = document.getElementById('userRank');
    rankEl.innerText = rank.label;
    rankEl.className = `text-[10px] font-mono tracking-wider ${rank.color}`;
}

async function updateBalance(addr) {
    if (!addr || !provider || addr.startsWith("0xMock")) {
        if (addr && addr.startsWith("0xMock")) {
             document.getElementById('userBalance').innerText = `100.00 MON`;
             updateReputation(addr);
        }
        return;
    }
    try {
        const bal = await provider.getBalance(addr);
        const eth = parseFloat(ethers.utils.formatEther(bal));
        document.getElementById('userBalance').innerText = `${eth.toFixed(4)} MON`;
        
        // Also update reputation
        updateReputation(addr);
    } catch (e) {
        console.error("Balance Fetch Error", e);
    }
}

function connectWallet() {
    // Show Modal
    const modal = document.getElementById('walletModal');
    modal.classList.remove('hidden');
    // Small timeout for fade-in
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
}

function closeWalletModal() {
    const modal = document.getElementById('walletModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

async function selectWallet(type) {
    closeWalletModal();

    if (type === 'mock') {
        // Force Mock Mode
        console.warn("User selected Dev Simulator.");
        userAddress = "0xMockUser...1337";
        isConnected = true;
        updateWalletUI(userAddress);
        showToast("DEV SIMULATOR ACTIVE", "success");
        return;
    }

    // Browser Wallet
    if (!window.ethereum) {
        if (window.location.protocol === 'file:') {
            return showToast("PLEASE USE A LOCAL SERVER", "error");
        }
        return showToast("NO WALLET FOUND", "error");
    }

    try {
        // Initialize provider if missing (important if injected late)
        if (!provider) {
            provider = new ethers.providers.Web3Provider(window.ethereum);
        }

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        await handleAccountsChanged(accounts);
        showToast("SECURE CONNECTION ESTABLISHED", "success");
    } catch (error) {
        console.error(error);
        showToast("CONNECTION DENIED", "error");
    }
}

async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        userAddress = null;
        isConnected = false;

        // Reset Button State
        const btn = document.getElementById('connectBtn');
        btn.innerHTML = `
            <span class="relative flex h-2 w-2 mr-2">
                <span id="conn-dot-ping" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-monad-blue opacity-75 hidden"></span>
                <span id="conn-dot-static" class="relative inline-flex rounded-full h-2 w-2 bg-gray-600"></span>
            </span>
            <span id="walletAddress">CONNECT WALLET</span>
        `;
        btn.classList.remove('border-monad-accent', 'text-white', 'bg-monad-accent/10');
        btn.classList.add('text-gray-300');
    } else {
        userAddress = accounts[0].toLowerCase(); // Normalize
        isConnected = true;

        // Ensure provider and signer are ready
        if (!provider) provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();

        if (CONTRACT_ADDRESS !== "YOUR_CONTRACT_ADDRESS_HERE") {
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            setupEventListeners();
        }
        updateWalletUI(userAddress);
        updateBalance(userAddress);
        checkNetwork();
    }
}

// --- NETWORK LOGIC ---
async function checkNetwork() {
    if (!window.ethereum || !provider) return;
    try {
        const network = await provider.getNetwork();
        const btn = document.getElementById('networkStatus');

        if (network.chainId !== MONAD_CHAIN_ID) {
            btn.classList.remove('hidden');
            btn.classList.add('flex');
            btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>WRONG NETWORK</span>`;
            btn.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-mono tracking-wider cursor-pointer hover:bg-red-500/20 transition-colors";
        } else {
            btn.classList.remove('hidden');
            btn.classList.add('flex');
            btn.innerHTML = `<i class="fa-solid fa-circle-nodes"></i> <span>MONAD TESTNET</span>`;
            btn.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-monad-success/10 border border-monad-success/20 text-monad-success text-[10px] font-mono tracking-wider";
        }
    } catch (e) {
        console.error("Network Check Error", e);
    }
}

async function switchNetwork() {
    if (!window.ethereum) return;
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MONAD_NETWORK_PARAMS.chainId }],
        });
    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [MONAD_NETWORK_PARAMS],
                });
            } catch (addError) {
                console.error(addError);
            }
        }
        console.error(switchError);
    }
}

function setupEventListeners() {
    if (!contract) return;

    contract.on("QuestPosted", (id, poster, reward, token) => {
        showToast("NEW BOUNTY SIGNAL RECEIVED", "success");
        loadQuests(); // Refresh
    });

    contract.on("QuestCompleted", (id, winner, reward, xpGained) => {
        showToast(`MISSION #${id} COMPLETED | +${xpGained} XP`, "success");
        loadQuests(); // Refresh
        if (userAddress && winner.toLowerCase() === userAddress.toLowerCase()) {
            updateReputation(userAddress);
        }
    });
}

function updateWalletUI(addr) {
    const shortAddr = addr.slice(0, 6) + "..." + addr.slice(-4);
    document.getElementById('walletAddress').innerText = shortAddr;

    // Visual indicators of connection
    document.getElementById('connectBtn').classList.add('border-monad-accent', 'text-white', 'bg-monad-accent/10');
    document.getElementById('conn-dot-static').classList.remove('bg-gray-500');
    document.getElementById('conn-dot-static').classList.add('bg-monad-success');
    document.getElementById('conn-dot-ping').classList.remove('hidden');
    document.getElementById('conn-dot-ping').classList.add('bg-monad-success');
}


// --- CONTRACT INTERACTIONS ---
async function postQuest() {
    // Auto-connect if not connected
    if (!isConnected) {
        showToast("CONNECTING WALLET...", "info");
        await connectWallet();
        if (!isConnected) return; // User rejected or failed
    }

    const desc = document.getElementById('questDesc').value;
    const reward = document.getElementById('questReward').value;
    const tokenType = document.getElementById('tokenSelect').value;
    
    if (!desc || !reward) return showToast("INPUT MISSING", "error");

    // Mock ERC20 address for demo
    const MOCK_ERC20 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC Example

    // --- MOCK MODE (Explicit or Fallback) ---
    if (CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE" || !contract || (userAddress && userAddress.startsWith("0xMock"))) {
        showToast("SIGNING TRANSACTION...", "info");
        setTimeout(() => {
            const newId = allQuests.length > 0 ? Math.max(...allQuests.map(q => q.id)) + 1 : 100;
            allQuests.unshift({
                id: newId,
                poster: userAddress || "0xMockUser...1337",
                description: desc,
                reward: reward,
                token: tokenType === 'native' ? '0x0000000000000000000000000000000000000000' : MOCK_ERC20,
                isCompleted: false,
                winner: "0x000"
            });
            document.getElementById('questDesc').value = "";
            document.getElementById('questReward').value = "";

            // PERSIST MOCK DATA
            localStorage.setItem('mockQuests', JSON.stringify(allQuests));

            renderQuests();
            updateStats();
            showToast(`BOUNTY DEPLOYED [MOCK ${tokenType.toUpperCase()}]`, "success");
        }, 1500);
        return;
    }

    // --- REAL MODE ---
    try {
        const rewardWei = ethers.utils.parseEther(reward.toString());
        if (rewardWei.lte(0)) return showToast("REWARD MUST BE > 0", "error");

        if (tokenType === 'native') {
            showToast("INITIATING MON TRANSACTION...", "info");
            const tx = await contract.postQuest(desc, {
                value: rewardWei,
                gasLimit: 300000
            });
            showToast("TRANSACTION SENT...", "info");
            await tx.wait();
        } else {
            // ERC20 Flow (Example with hardcoded token for hackathon)
            const tokenAddr = prompt("ENTER TOKEN ADDRESS (OR LEAVE BLANK FOR DEMO USDC):", MOCK_ERC20);
            if (!tokenAddr) return;
            
            const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
            
            showToast("APPROVING TOKEN...", "info");
            const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, rewardWei);
            await approveTx.wait();
            
            showToast("INITIATING ERC20 TRANSACTION...", "info");
            const tx = await contract.postQuestERC20(desc, tokenAddr, rewardWei, {
                gasLimit: 500000
            });
            showToast("TRANSACTION SENT...", "info");
            await tx.wait();
        }

        showToast("BOUNTY DEPLOYED ON-CHAIN", "success");
        document.getElementById('questDesc').value = "";
        document.getElementById('questReward').value = "";
        setTimeout(loadQuests, 2000);
    } catch (err) {
        console.error("Deploy Error:", err);
        let msg = "TX REVERTED";
        if (err.reason) msg = `ERR: ${err.reason}`;
        else if (err.data && err.data.message) msg = err.data.message;
        else if (err.message) msg = err.message.slice(0, 50) + "...";
        showToast(msg.toUpperCase(), "error");
    }
}

async function payoutMercenary(questId) {
    if (!isConnected) return showToast("CONNECT WALLET", "error");

    const mercenaryAddr = prompt("ENTER MERCENARY WALLET ADDRESS (e.g. 0x123...):");
    if (!mercenaryAddr) return;

    // Validate Address
    if (!ethers.utils.isAddress(mercenaryAddr)) {
        return showToast("INVALID ETH ADDRESS", "error");
    }

    // --- MOCK MODE (Explicit or Fallback) ---
    if (CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE" || !contract || (userAddress && userAddress.startsWith("0xMock"))) {
        showToast("VERIFYING WORK...", "info");
        setTimeout(() => {
            const quest = allQuests.find(q => q.id === questId);
            if (quest) {
                quest.isCompleted = true;
                quest.winner = mercenaryAddr;

                // PERSIST MOCK DATA
                localStorage.setItem('mockQuests', JSON.stringify(allQuests));

                renderQuests();
                updateStats();
                showToast("FUNDS RELEASED [MOCK]", "success");
            }
        }, 1000);
        return;
    }

    // --- REAL MODE ---
    try {
        const tx = await contract.payoutMercenary(questId, mercenaryAddr);
        showToast("RELEASING FUNDS...", "info");
        await tx.wait();
        showToast("TRANSACTION CONFIRMED", "success");
        loadQuests();
    } catch (err) {
        console.error(err);
        showToast("PAYOUT FAILED", "error");
    }
}

async function loadQuests() {
    if (CONTRACT_ADDRESS === "YOUR_CONTRACT_ADDRESS_HERE") return; // Handled by Mock loop logic
    if (!contract) return;
    // ... (Same fetching logic as before) ...
    try {
        const quests = await contract.getActiveQuests();
        const formattedQuests = quests.map(q => ({
            id: q.id.toNumber(),
            poster: q.poster,
            description: q.description,
            reward: ethers.utils.formatEther(q.reward), // Simplification: assuming 18 decimals for now
            token: q.token,
            isCompleted: q.isCompleted,
            winner: q.winner
        }));
        formattedQuests.sort((a, b) => b.id - a.id);

        // Update State
        allQuests = formattedQuests;
        renderQuests();
        updateStats();

        document.getElementById('lastUpdated').innerText = `LIVE: ${new Date().toLocaleTimeString()}`;
        document.getElementById('lastUpdated').innerText = `LIVE: ${new Date().toLocaleTimeString()}`;
    } catch (e) {
        console.error(e);
        // Show Error in Grid
        document.getElementById('questGrid').innerHTML = `
            <div class="col-span-1 md:col-span-3 text-center text-monad-accent font-mono py-12 border border-monad-accent/20 rounded-xl bg-monad-accent/5 dashed-border">
                <i class="fa-solid fa-triangle-exclamation text-4xl mb-4 animate-pulse"></i><br>
                <h3 class="text-xl font-bold">SIGNAL LOST</h3>
                <p class="text-xs text-monad-accent mt-2 opacity-80">FAILED TO SYNC WITH CONTRACT</p>
                <p class="text-[10px] text-gray-500 mt-1 uppercase">${e.code || e.message || "CHECK NETWORK CONNECTION"}</p>
            </div>`;
        document.getElementById('lastUpdated').innerText = "CONNECTION ERROR";
        document.getElementById('lastUpdated').classList.add('text-monad-accent');
    }
}

// --- RENDERING ---
function renderQuests() {
    const grid = document.getElementById('questGrid');
    grid.innerHTML = "";

    const searchText = document.getElementById('searchInput').value.toLowerCase();

    // Filter Logic
    let displayQuests = allQuests;

    // 1. Tab Filter
    if (currentFilter === 'open') displayQuests = allQuests.filter(q => !q.isCompleted);
    if (currentFilter === 'mine') {
        if (!userAddress) displayQuests = [];
        else displayQuests = allQuests.filter(q => q.poster.toLowerCase() === userAddress.toLowerCase());
    }

    // 2. Search Filter
    if (searchText) {
        displayQuests = displayQuests.filter(q =>
            q.description.toLowerCase().includes(searchText) ||
            q.poster.toLowerCase().includes(searchText)
        );
    }

    if (displayQuests.length === 0) {
        grid.innerHTML = `<div class="col-span-1 md:col-span-3 text-center text-gray-600 font-mono py-12">
            <i class="fa-solid fa-ghost text-4xl mb-4 opacity-20"></i><br>
            NO SIGNALS FOUND IN SECTOR
        </div>`;
        return;
    }

    displayQuests.forEach(q => {
        const isMine = userAddress && q.poster.toLowerCase() === userAddress.toLowerCase();
        const tags = getTags(q.description);
        const tokenSymbol = (q.token && q.token !== '0x0000000000000000000000000000000000000000') ? 'USDC' : 'MON';

        // Styles based on state
        let cardBorder = q.isCompleted
            ? 'border-gray-800 bg-black/40'
            : 'border-white/10 bg-monad-card/50 hover:bg-monad-card/80';

        let badgeClass = q.isCompleted
            ? 'bg-gray-800 text-gray-500'
            : 'bg-monad-success/10 text-monad-success border border-monad-success/20';

        let actionArea = "";

        if (!q.isCompleted && isMine) {
            actionArea = `
                <button onclick="payoutMercenary(${q.id})" class="w-full mt-4 py-2 rounded border border-monad-accent/50 text-monad-accent hover:bg-monad-accent hover:text-white font-mono text-xs font-bold transition-all">
                    PAY OUT REWARD
                </button>
            `;
        } else if (q.isCompleted) {
            actionArea = `
                <div class="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-gray-500 text-xs font-mono">
                    <i class="fa-solid fa-check-circle"></i>
                    <span>COMPLETED: ${q.winner.slice(0, 6)}...</span>
                </div>
            `;
        } else {
            actionArea = `
                <div class="mt-4 py-2 text-center text-xs font-mono text-gray-600 border border-white/5 rounded select-none cursor-not-allowed">
                    AWAITING SUBMISSION
                </div>
            `;
        }

        let tagsHtml = tags.map(t => `<span class="text-[9px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">${t}</span>`).join('');

        const html = `
            <div class="glass-panel p-6 rounded-xl flex flex-col justify-between card-hoverable ${cardBorder} relative overflow-hidden group">
                ${q.isCompleted ? '' : '<div class="absolute top-0 right-0 w-20 h-20 bg-monad-success/5 blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none group-hover:bg-monad-success/10 transition-all"></div>'}
                
                <div>
                    <div class="flex justify-between items-start mb-4">
                        <span class="status-badge ${badgeClass}">${q.isCompleted ? 'CLOSED' : 'OPEN'}</span>
                        <span class="text-[10px] font-mono text-gray-600">ID::${q.id.toString().padStart(3, '0')}</span>
                    </div>
                    
                    <h3 class="text-white font-sans text-lg font-medium leading-snug mb-2">${q.description}</h3>
                    <div class="flex gap-2 mb-4">${tagsHtml}</div>
                    
                    <div class="flex items-center gap-2 mb-6">
                        <div class="w-5 h-5 rounded-full overflow-hidden border border-white/20">
                            ${generateAvatar(q.poster)}
                        </div>
                        <span class="text-xs font-mono text-gray-400">${q.poster.slice(0, 6)}...${q.poster.slice(-4)}</span>
                        
                        <a href="https://explorer.monad.xyz/address/${q.poster}" target="_blank" class="text-gray-600 hover:text-monad-accent transition-colors">
                            <i class="fa-solid fa-external-link-alt text-[10px]"></i>
                        </a>
                    </div>
                </div>

                <div>
                    <div class="flex items-end justify-between">
                        <span class="text-xs text-gray-500 font-mono mb-1">REWARD POOL</span>
                        <div class="text-xl font-bold font-mono ${q.isCompleted ? 'text-gray-600' : 'text-monad-success'}">
                            ${q.reward} <span class="text-xs">${tokenSymbol}</span>
                        </div>
                    </div>
                    ${actionArea}
                </div>
            </div>
        `;
        grid.innerHTML += html;
    });
}

// --- TOAST/HELPERS MOVED TO utils.js ---
