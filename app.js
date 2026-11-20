// State Management - By default start as Free User so Ads are visible!
let isVipUser = localStorage.getItem("reelsnap_vip") === "true" ? false : false; // Default to Free Mode so owner sees Ads!
let siteConfig = {
    ads_enabled: true,
    download_countdown_seconds: 4,
    adsense_client_id: "ca-pub-XXXXXXXXXXXXXXXX",
    custom_ad_script: "",
    upi_id: "yourname@upi",
    upi_name: "ReelSnap Pro"
};

let currentDownloadUrl = "";
let countdownTimer = null;
let selectedPaymentPlan = { name: "Pro Monthly", amount: 299 };

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
    loadConfig();
    showAllAds();
    checkVipStatus();
    initStatsTicker();
});

// Load config from backend
async function loadConfig() {
    try {
        const res = await fetch("/api/config");
        if (res.ok) {
            siteConfig = await res.json();
            applyConfig();
        }
    } catch (e) {
        console.warn("Could not load backend config, using defaults:", e);
    }
}

function applyConfig() {
    const adsToggle = document.getElementById("cfg-ads-enabled");
    const countdownSelect = document.getElementById("cfg-countdown");
    const adsenseId = document.getElementById("cfg-adsense-id");
    const customAd = document.getElementById("cfg-custom-ad");
    const upiId = document.getElementById("cfg-upi-id");

    if (adsToggle) adsToggle.checked = siteConfig.ads_enabled;
    if (countdownSelect) countdownSelect.value = siteConfig.download_countdown_seconds !== undefined ? siteConfig.download_countdown_seconds : 4;
    if (adsenseId) adsenseId.value = siteConfig.adsense_client_id || "";
    if (customAd) customAd.value = siteConfig.custom_ad_script || "";
    if (upiId) upiId.value = siteConfig.upi_id || "";

    updatePaymentQr();

    if (!siteConfig.ads_enabled || isVipUser) {
        hideAllAds();
    } else {
        showAllAds();
    }
}

// Toggle between Free Mode (With Ads) and VIP Mode (No Ads)
function toggleUserMode() {
    isVipUser = !isVipUser;
    localStorage.setItem("reelsnap_vip", isVipUser ? "true" : "false");
    checkVipStatus();
    if (isVipUser) {
        hideAllAds();
        showToast("👑 VIP Mode Active: All ads are hidden!");
    } else {
        showAllAds();
        showToast("👁️ Free Mode Active: All Ads & Countdown are visible!");
    }
}

function checkVipStatus() {
    const vipContainer = document.getElementById("vip-status-container");
    const modeLabel = document.getElementById("user-mode-label");
    const modeBtn = document.getElementById("user-mode-btn");

    if (isVipUser) {
        hideAllAds();
        if (modeLabel) modeLabel.innerText = "Mode: VIP (Ads Hidden)";
        if (modeBtn) modeBtn.className = "px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-center gap-1.5 transition-all";
        if (vipContainer) {
            vipContainer.innerHTML = `
                <div class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/50 text-amber-300 flex items-center gap-1.5 shadow-lg shadow-amber-500/10">
                    <i data-lucide="crown" class="w-4 h-4 fill-amber-400 text-amber-400"></i>
                    <span>VIP Active</span>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
    } else {
        showAllAds();
        if (modeLabel) modeLabel.innerText = "Mode: Free (Ads Visible)";
        if (modeBtn) modeBtn.className = "px-3 py-1.5 rounded-full text-xs font-bold bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-1.5 transition-all";
        if (vipContainer) {
            vipContainer.innerHTML = `
                <button onclick="openVipModal()" id="vip-badge-btn" class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 hover:border-amber-500 text-amber-300 flex items-center gap-1.5 transition-all">
                    <i data-lucide="crown" class="w-3.5 h-3.5 text-amber-400 fill-amber-400"></i>
                    <span>Upgrade VIP</span>
                </button>
            `;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function showAllAds() {
    const adIds = ["top-ad-wrapper", "result-native-ad", "mid-ad-wrapper", "bottom-sticky-ad"];
    adIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "";
    });
}

function hideAllAds() {
    const adIds = ["top-ad-wrapper", "result-native-ad", "mid-ad-wrapper", "bottom-sticky-ad"];
    adIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
}

function closeAd(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = "none";
}

// Clipboard Paste
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            document.getElementById("reel-url-input").value = text;
            showToast("Pasted link from clipboard!");
        }
    } catch (err) {
        const input = document.getElementById("reel-url-input");
        input.focus();
        showToast("Please press Ctrl+V to paste your link.");
    }
}

// Load sample reel link
function loadSampleLink() {
    const input = document.getElementById("reel-url-input");
    input.value = "https://www.instagram.com/reel/C8q1_g-sQj3/";
    showToast("Sample link loaded! Click Download.");
}

// Download form submission
async function handleDownloadSubmit(e) {
    e.preventDefault();
    const input = document.getElementById("reel-url-input");
    const url = input.value.trim();

    if (!url) {
        alert("Please paste an Instagram Reel or Video URL.");
        return;
    }

    const loadingCard = document.getElementById("loading-card");
    const resultCard = document.getElementById("result-card");
    const submitBtn = document.getElementById("submit-btn");

    resultCard.classList.add("hidden");
    loadingCard.classList.remove("hidden");
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-60");

    try {
        const response = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            renderResult(data);
        } else {
            alert(data.detail || "Unable to extract video. Please verify the URL is a public Instagram Reel.");
        }
    } catch (err) {
        console.error(err);
        alert("Network error: Could not reach the server. Please check your connection.");
    } finally {
        loadingCard.classList.add("hidden");
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-60");
    }
}

// Render video result
function renderResult(data) {
    const resultCard = document.getElementById("result-card");
    const thumb = document.getElementById("res-thumbnail");
    const title = document.getElementById("res-title");
    const author = document.getElementById("res-author");
    const duration = document.getElementById("res-duration");
    const qualitiesContainer = document.getElementById("qualities-container");

    thumb.src = data.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800";
    title.innerText = data.title || "Instagram Reel";
    author.innerText = data.author || "@instagram_user";
    duration.innerText = data.duration || "0:30";

    qualitiesContainer.innerHTML = "";
    data.qualities.forEach((q, idx) => {
        const isPrimary = idx === 0;
        const btnClass = isPrimary 
            ? "glow-btn text-white" 
            : "bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10";

        const item = document.createElement("div");
        item.className = "flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-3";
        item.innerHTML = `
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg ${isPrimary ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700/40 text-slate-400'} flex items-center justify-center shrink-0">
                    <i data-lucide="${q.format === 'MP3' ? 'music' : 'video'}" class="w-4 h-4"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-white">${q.label}</span>
                        ${q.badge ? `<span class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${isPrimary ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-700 text-slate-300'}">${q.badge}</span>` : ''}
                    </div>
                    <span class="text-[10px] text-slate-400">${q.format} File • Direct Stream</span>
                </div>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button 
                    type="button"
                    onclick="triggerAdOrDownload('${q.download_url}')"
                    class="px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${btnClass} transition-all grow sm:grow-0"
                >
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    <span>Download</span>
                </button>
                ${q.direct_url ? `
                <a 
                    href="${q.direct_url}" 
                    target="_blank" 
                    rel="noreferrer"
                    title="Alternative Direct Server Link"
                    class="p-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
                >
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                </a>
                ` : ''}
            </div>
        `;
        qualitiesContainer.appendChild(item);
    });

    if (window.lucide) lucide.createIcons();

    resultCard.classList.remove("hidden");
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Download Trigger with Interstitial Ad & Countdown
function triggerAdOrDownload(downloadUrl) {
    currentDownloadUrl = downloadUrl;

    // If user is VIP or Ads are disabled or countdown is 0, download immediately!
    const countdownSec = siteConfig.download_countdown_seconds !== undefined ? siteConfig.download_countdown_seconds : 4;
    if (isVipUser || !siteConfig.ads_enabled || countdownSec === 0) {
        startRealDownload(downloadUrl);
        return;
    }

    // Show Countdown Ad Modal
    const modal = document.getElementById("countdown-modal");
    const timerNum = document.getElementById("countdown-timer-num");
    const skipBtn = document.getElementById("skip-countdown-btn");

    modal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();

    let timeLeft = countdownSec;
    timerNum.innerText = timeLeft;
    skipBtn.innerHTML = `<span>Wait ${timeLeft}s</span>`;

    if (countdownTimer) clearInterval(countdownTimer);

    countdownTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            timerNum.innerText = timeLeft;
            skipBtn.innerHTML = `<span>Wait ${timeLeft}s</span>`;
        } else {
            clearInterval(countdownTimer);
            modal.classList.add("hidden");
            startRealDownload(currentDownloadUrl);
        }
    }, 1000);
}

function skipCountdownNow() {
    if (countdownTimer) clearInterval(countdownTimer);
    document.getElementById("countdown-modal").classList.add("hidden");
    startRealDownload(currentDownloadUrl);
}

function startRealDownload(url) {
    showToast("⚡ Starting high-speed file download...");
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// Reset Downloader
function resetDownloader() {
    document.getElementById("reel-url-input").value = "";
    document.getElementById("result-card").classList.add("hidden");
    document.getElementById("reel-url-input").focus();
}

// FAQ Accordion
function toggleFaq(num) {
    const ans = document.getElementById(`faq-answer-${num}`);
    const icon = document.getElementById(`faq-icon-${num}`);
    if (ans.classList.contains("hidden")) {
        ans.classList.remove("hidden");
        icon.classList.add("rotate-180");
    } else {
        ans.classList.add("hidden");
        icon.classList.remove("rotate-180");
    }
}

// VIP Modal Handlers
function openVipModal(planName = "Pro Monthly", price = "₹299") {
    const modal = document.getElementById("vip-modal");
    modal.classList.remove("hidden");

    let numPrice = 299;
    if (price.includes("49")) numPrice = 49;
    if (price.includes("1999") || price.includes("1,999")) numPrice = 1999;
    selectPlanPayment(planName, numPrice);

    if (window.lucide) lucide.createIcons();
}

function closeVipModal() {
    document.getElementById("vip-modal").classList.add("hidden");
    document.getElementById("vip-key-msg").innerText = "";
    document.getElementById("upi-order-msg").innerText = "";
}

function switchVipTab(tab) {
    const btnKey = document.getElementById("tab-btn-key");
    const btnPay = document.getElementById("tab-btn-pay");
    const panelKey = document.getElementById("panel-vip-key");
    const panelPay = document.getElementById("panel-vip-pay");

    if (tab === "key") {
        btnKey.className = "flex-1 pb-2 border-b-2 border-amber-400 text-amber-400";
        btnPay.className = "flex-1 pb-2 text-slate-400 border-b-2 border-transparent";
        panelKey.classList.remove("hidden");
        panelPay.classList.add("hidden");
    } else {
        btnPay.className = "flex-1 pb-2 border-b-2 border-amber-400 text-amber-400";
        btnKey.className = "flex-1 pb-2 text-slate-400 border-b-2 border-transparent";
        panelPay.classList.remove("hidden");
        panelKey.classList.add("hidden");
    }
}

// Select Plan in VIP Modal
function selectPlanPayment(planName, amount) {
    selectedPaymentPlan = { name: planName, amount: amount };

    [49, 299, 1999].forEach(amt => {
        const btn = document.getElementById(`plan-opt-${amt}`);
        if (btn) {
            if (amt === amount) {
                btn.className = "p-2 rounded-xl text-center border-2 border-amber-400 bg-amber-400/10 transition-all";
            } else {
                btn.className = "p-2 rounded-xl text-center border border-white/10 bg-white/5 hover:border-amber-400 transition-all";
            }
        }
    });

    const amtDisplay = document.getElementById("pay-amount-display");
    if (amtDisplay) amtDisplay.innerText = `₹${amount}`;

    updatePaymentQr();
}

function updatePaymentQr() {
    const upi = siteConfig.upi_id || "yourname@upi";
    const amount = selectedPaymentPlan.amount || 99;
    const upiUri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=ReelSnap&am=${amount}&cu=INR&tn=${encodeURIComponent(selectedPaymentPlan.name)}`;

    const qrImg = document.getElementById("dynamic-upi-qr");
    const modalUpi = document.getElementById("modal-upi-id");
    const directLink = document.getElementById("direct-upi-link");

    if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUri)}`;
    }
    if (modalUpi) modalUpi.innerText = upi;
    if (directLink) directLink.href = upiUri;
}

// Handle UPI Payment Proof Submission (Customer Payment)
async function handleUpiProofSubmit(e) {
    e.preventDefault();
    const utrInput = document.getElementById("upi-utr-input");
    const utr = utrInput.value.trim();
    const msgEl = document.getElementById("upi-order-msg");
    const submitBtn = document.getElementById("submit-utr-btn");

    if (!utr || utr.length < 6) {
        msgEl.innerHTML = `<span class="text-rose-400">Please enter a valid 12-digit UPI UTR / Reference number.</span>`;
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "Verifying...";

    try {
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                plan: selectedPaymentPlan.name,
                amount: selectedPaymentPlan.amount,
                utr: utr,
                name: "Customer",
                contact: ""
            })
        });

        const data = await res.json();
        if (data.success) {
            localStorage.setItem("reelsnap_vip", "true");
            isVipUser = true;

            msgEl.innerHTML = `<span class="text-emerald-400 font-bold">✓ Payment Received! VIP Activated.</span>`;

            if (window.confetti) {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }

            setTimeout(() => {
                closeVipModal();
                checkVipStatus();
                showToast("🎉 VIP Activated! Enjoy 100% ad-free 4K downloads!");
            }, 1600);
        } else {
            msgEl.innerHTML = `<span class="text-rose-400">Submission failed. Try again.</span>`;
        }
    } catch (err) {
        msgEl.innerHTML = `<span class="text-rose-400">Network error. Please try again.</span>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit & Activate";
    }
}

// Submit VIP key verification
async function submitVipKey() {
    const keyInput = document.getElementById("vip-key-input");
    const key = keyInput.value.trim();
    const msgEl = document.getElementById("vip-key-msg");

    if (!key) {
        msgEl.innerHTML = `<span class="text-rose-400">Please enter an activation code.</span>`;
        return;
    }

    try {
        const res = await fetch("/api/premium/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key })
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem("reelsnap_vip", "true");
            isVipUser = true;
            msgEl.innerHTML = `<span class="text-emerald-400 font-bold">${data.message}</span>`;
            
            if (window.confetti) {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }

            setTimeout(() => {
                closeVipModal();
                checkVipStatus();
                showToast("🎉 VIP Activated! All ads are now permanently removed.");
            }, 1500);
        } else {
            msgEl.innerHTML = `<span class="text-rose-400">${data.message}</span>`;
        }
    } catch (e) {
        msgEl.innerHTML = `<span class="text-rose-400">Network error verifying key.</span>`;
    }
}

// Settings Modal
function openSettingsModal() {
    document.getElementById("settings-modal").classList.remove("hidden");
    fetchOrders();
    if (window.lucide) lucide.createIcons();
}

function closeSettingsModal() {
    document.getElementById("settings-modal").classList.add("hidden");
}

function switchAdminTab(tab) {
    const btnSettings = document.getElementById("admin-tab-settings");
    const btnOrders = document.getElementById("admin-tab-orders");
    const panelSettings = document.getElementById("admin-panel-settings");
    const panelOrders = document.getElementById("admin-panel-orders");

    if (tab === "orders") {
        btnOrders.className = "flex-1 pb-2 border-b-2 border-purple-500 text-purple-400";
        btnSettings.className = "flex-1 pb-2 text-slate-400 border-b-2 border-transparent";
        panelOrders.classList.remove("hidden");
        panelSettings.classList.add("hidden");
        fetchOrders();
    } else {
        btnSettings.className = "flex-1 pb-2 border-b-2 border-purple-500 text-purple-400";
        btnOrders.className = "flex-1 pb-2 text-slate-400 border-b-2 border-transparent";
        panelSettings.classList.remove("hidden");
        panelOrders.classList.add("hidden");
    }
}

async function fetchOrders() {
    try {
        const res = await fetch("/api/orders");
        if (res.ok) {
            const data = await res.json();
            const orders = data.orders || [];
            document.getElementById("orders-count-badge").innerText = orders.length;

            const container = document.getElementById("orders-list-container");
            if (orders.length === 0) {
                container.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">No payments received yet. When users pay via UPI, their UTR details appear here!</p>`;
                return;
            }

            container.innerHTML = orders.map(ord => `
                <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-white">${ord.plan}</span>
                            <span class="font-mono text-emerald-400 font-bold">₹${ord.amount}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-0.5">
                            UTR: <span class="text-amber-400 font-mono font-bold">${ord.utr}</span> • ${ord.time}
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Paid</span>
                </div>
            `).join("");
        }
    } catch (e) {
        console.warn("Could not fetch orders:", e);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const adsToggle = document.getElementById("cfg-ads-enabled").checked;
    const countdownVal = document.getElementById("cfg-countdown").value;
    const adsenseId = document.getElementById("cfg-adsense-id").value.trim();
    const customAd = document.getElementById("cfg-custom-ad").value.trim();
    const upiId = document.getElementById("cfg-upi-id").value.trim();

    try {
        const res = await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ads_enabled: adsToggle,
                download_countdown_seconds: parseInt(countdownVal),
                adsense_client_id: adsenseId,
                custom_ad_script: customAd,
                upi_id: upiId
            })
        });

        if (res.ok) {
            siteConfig.ads_enabled = adsToggle;
            siteConfig.download_countdown_seconds = parseInt(countdownVal);
            siteConfig.adsense_client_id = adsenseId;
            siteConfig.custom_ad_script = customAd;
            siteConfig.upi_id = upiId;
            applyConfig();
            closeSettingsModal();
            showToast("Settings & UPI successfully saved!");
        }
    } catch (err) {
        alert("Failed to save settings.");
    }
}

// Live stats ticker
function initStatsTicker() {
    let count = 24890;
    setInterval(() => {
        count += Math.floor(Math.random() * 3) + 1;
        const el = document.getElementById("stat-downloads");
        if (el) el.innerText = count.toLocaleString() + "+";
    }, 4000);
}

// Toast notification helper
function showToast(message) {
    const existing = document.getElementById("reelsnap-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "reelsnap-toast";
    toast.className = "fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-purple-500/40 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce";
    toast.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

// WhatsApp Viral Sharing
function shareOnWhatsapp() {
    const siteUrl = window.location.href;
    const shareText = `🔥 Check out this awesome free tool! I just downloaded Instagram Reels in 4K Ultra HD without watermark: ${siteUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, "_blank");
}

// Copy Share Link
function copyShareLink() {
    const siteUrl = window.location.href;
    navigator.clipboard.writeText(siteUrl).then(() => {
        showToast("Website link copied! Share with friends on WhatsApp & Social Media.");
    }).catch(() => {
        showToast("Link: " + siteUrl);
    });
}

// Legal Modals (AdSense & Adsterra Compliance)
const LEGAL_DOCS = {
    privacy: {
        title: "Privacy Policy",
        content: `
            <p class="font-bold text-white text-sm">Effective Date: 2026</p>
            <p>Welcome to ReelSnap Pro. We highly respect user privacy and do not collect, store, or sell any personal data or Instagram login credentials.</p>
            <h4 class="font-bold text-white mt-2">1. Media Downloads</h4>
            <p>ReelSnap Pro operates as a free tool to download publicly accessible Instagram media for personal, fair-use purposes. We do not host copyrighted files on our servers.</p>
            <h4 class="font-bold text-white mt-2">2. Cookies & Advertising</h4>
            <p>Third-party vendors, including Google AdSense, use cookies to serve ads based on prior visits to this website. You may opt out of personalized advertising by visiting Google Ad Settings.</p>
            <h4 class="font-bold text-white mt-2">3. Security</h4>
            <p>All communication is processed securely over standard SSL/TLS encryption.</p>
        `
    },
    terms: {
        title: "Terms of Service",
        content: `
            <p class="font-bold text-white text-sm">Terms and Conditions</p>
            <p>By using ReelSnap Pro, you agree to comply with all applicable local and international copyright laws.</p>
            <h4 class="font-bold text-white mt-2">1. Personal & Fair Use Only</h4>
            <p>Users must only download content that they own or have explicit permission from the copyright owner to use for personal archival or educational purposes.</p>
            <h4 class="font-bold text-white mt-2">2. Disclaimer of Affiliation</h4>
            <p>ReelSnap Pro is an independent web utility and is not affiliated with, sponsored by, or endorsed by Instagram™, Meta Platforms, Inc., or Facebook.</p>
        `
    },
    dmca: {
        title: "DMCA & Copyright Disclaimer",
        content: `
            <p class="font-bold text-white text-sm">DMCA Notice & Fair Use Policy</p>
            <p>ReelSnap Pro respects intellectual property rights. We do not store or host any videos on our servers; all video files are streamed directly from Instagram CDN servers to the user's browser.</p>
            <h4 class="font-bold text-white mt-2">Takedown Request</h4>
            <p>If you are a copyright owner and wish to block your media or report content, please contact our administrative team. Takedown requests are honored within 24-48 business hours.</p>
        `
    }
};

function openLegalModal(type = "privacy") {
    const modal = document.getElementById("legal-modal");
    const title = document.getElementById("legal-modal-title");
    const body = document.getElementById("legal-modal-body");

    const doc = LEGAL_DOCS[type] || LEGAL_DOCS.privacy;
    if (title) title.innerText = doc.title;
    if (body) body.innerHTML = doc.content;

    modal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
}

function closeLegalModal() {
    document.getElementById("legal-modal").classList.add("hidden");
}
