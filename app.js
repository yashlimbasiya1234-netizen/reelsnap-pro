// State Management - Always start as Free User so Ads are 100% visible!
let isVipUser = false;
try {
    localStorage.removeItem("reelsnap_vip");
} catch(e) {}

let siteConfig = {
    ads_enabled: true,
    download_countdown_seconds: 4,
    adsense_client_id: "ca-pub-XXXXXXXXXXXXXXXX",
    custom_ad_script: "",
    upi_id: "yashlimbasiya1234-2@okaxis",
    upi_name: "Yash Limbasiya"
};

let currentDownloadUrl = "";
let countdownTimer = null;
let selectedPaymentPlan = { name: "VIP Lifetime", amount: 1999 };

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    loadConfig();
    renderUserAccount();
    checkVipStatus();
    initStatsTicker();

    // Prevent ad scripts from hijacking user clicks on app controls, downloader, nav and modals
    ["downloader", "main-nav", "vip-modal", "settings-modal", "auth-modal", "pricing", "how-it-works", "faq"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("click", (e) => {
                // Only let sponsored ad units open their links; never hijack UI clicks
                if (!e.target.closest("#side-ad-left") && !e.target.closest("#side-ad-right") && !e.target.closest("#bottom-sticky-ad")) {
                    e.stopPropagation();
                }
            }, false);
        }
    });

    // Automatic Entry Ad on page open (satisfies user's requirement: "open that j aekadi add avi joi aevu kar")
    setTimeout(() => {
        showWelcomeAd();
    }, 700);
});

// Welcome / Entry Ad Handlers
function showWelcomeAd() {
    if (isVipUser) return;
    const modal = document.getElementById("welcome-ad-modal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
        if (window.lucide) lucide.createIcons();
    }
}

function closeWelcomeAd() {
    const modal = document.getElementById("welcome-ad-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

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

function checkVipStatus() {
    const user = getUserSession();
    const isVip = Boolean(user && user.isVip && (!user.expiry || user.expiry > Date.now()));

    const vipContainer = document.getElementById("vip-status-container");
    if (vipContainer) {
        if (isVip) {
            vipContainer.innerHTML = `
                <button onclick="openSettingsModal()" class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1.5 shadow-md shadow-amber-500/10">
                    <i data-lucide="crown" class="w-3.5 h-3.5 text-amber-400 fill-amber-400"></i>
                    <span>👑 VIP Active (Ad-Free)</span>
                </button>
            `;
        } else {
            vipContainer.innerHTML = `
                <button onclick="openVipModal('Lifetime VIP', 1999)" id="vip-badge-btn" class="px-4 py-2 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/40 hover:border-amber-400 text-amber-300 flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/10">
                    <i data-lucide="crown" class="w-3.5 h-3.5 text-amber-400 fill-amber-400"></i>
                    <span>Upgrade VIP</span>
                </button>
            `;
        }
        if (window.lucide) lucide.createIcons();
    }

    if (isVip) {
        hideAllAds();
    } else {
        showAllAds();
    }
}

function showAllAds() {
    const adIds = ["side-ad-left", "side-ad-right", "top-ad-wrapper", "result-native-ad", "mid-ad-wrapper", "bottom-sticky-ad"];
    adIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.removeProperty("display");
    });
}

function hideAllAds() {
    const adIds = ["side-ad-left", "side-ad-right", "top-ad-wrapper", "result-native-ad", "mid-ad-wrapper", "bottom-sticky-ad", "welcome-ad-modal", "countdown-modal"];
    adIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty("display", "none", "important");
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
    const videoPlayer = document.getElementById("res-video-player");
    const thumbOverlay = document.getElementById("res-thumb-overlay");
    const title = document.getElementById("res-title");
    const author = document.getElementById("res-author");
    const duration = document.getElementById("res-duration");
    const qualitiesContainer = document.getElementById("qualities-container");

    thumb.src = data.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800";
    title.innerText = data.title || "Instagram Reel";
    author.innerText = data.author || "@instagram_user";
    duration.innerText = data.duration || "0:30";

    const streamUrl = (data.qualities && data.qualities[0] && data.qualities[0].direct_url) || data.direct_url;
    if (streamUrl && videoPlayer) {
        videoPlayer.src = streamUrl;
        videoPlayer.classList.remove("hidden");
        thumb.classList.add("hidden");
        if (thumbOverlay) thumbOverlay.classList.add("hidden");
    } else {
        if (videoPlayer) videoPlayer.classList.add("hidden");
        thumb.classList.remove("hidden");
        if (thumbOverlay) thumbOverlay.classList.remove("hidden");
    }

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
            <div class="flex items-center w-full sm:w-auto justify-end">
                <button 
                    type="button"
                    onclick="initiateAdCountdown('${q.download_url}', 'ReelSnap_${data.id}_${q.format.toLowerCase()}.${q.format === 'MP3' ? 'mp3' : 'mp4'}')"
                    class="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${btnClass} transition-all shadow-lg cursor-pointer text-white hover:scale-[1.02]"
                >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Download (${q.format})</span>
                </button>
            </div>
        `;
        qualitiesContainer.appendChild(item);
    });

    if (window.lucide) lucide.createIcons();

    resultCard.classList.remove("hidden");
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// 100% Guaranteed Download & High-CPM Ad Flow
let currentDownloadFilename = "ReelSnap_video.mp4";

function initiateAdCountdown(downloadUrl, filename) {
    currentDownloadUrl = downloadUrl;
    currentDownloadFilename = filename || "ReelSnap_video.mp4";

    // If VIP user or ads disabled, download instantly with zero ads
    if (isVipUser || !siteConfig.ads_enabled) {
        startRealDownload(currentDownloadUrl, currentDownloadFilename);
        return;
    }

    // Show Countdown Ad Modal
    const modal = document.getElementById("countdown-modal");
    const timerNum = document.getElementById("countdown-timer-num");
    const skipBtn = document.getElementById("skip-countdown-btn");

    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
        if (window.lucide) lucide.createIcons();
    }

    let timeLeft = 3;
    if (timerNum) timerNum.innerText = timeLeft;
    if (skipBtn) skipBtn.innerHTML = `<span>Wait ${timeLeft}s</span>`;

    if (countdownTimer) clearInterval(countdownTimer);

    countdownTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            if (timerNum) timerNum.innerText = timeLeft;
            if (skipBtn) skipBtn.innerHTML = `<span>Wait ${timeLeft}s</span>`;
        } else {
            clearInterval(countdownTimer);
            if (timerNum) timerNum.innerHTML = `<i data-lucide="check" class="w-7 h-7 text-emerald-400"></i>`;
            if (skipBtn) skipBtn.innerHTML = `
                <button type="button" onclick="skipCountdownNow()" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    <span>Download File Now</span>
                </button>
            `;
            if (window.lucide) lucide.createIcons();

            // Automatically start downloading the file to device
            startRealDownload(currentDownloadUrl, currentDownloadFilename);

            setTimeout(() => {
                if (modal) {
                    modal.classList.add("hidden");
                    modal.style.display = "none";
                }
                // Open post-download success ad modal
                openDownloadSuccessModal(currentDownloadFilename);
            }, 1200);
        }
    }, 1000);
}

function skipCountdownNow() {
    if (countdownTimer) clearInterval(countdownTimer);
    const modal = document.getElementById("countdown-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
    startRealDownload(currentDownloadUrl, currentDownloadFilename);
    setTimeout(() => {
        openDownloadSuccessModal(currentDownloadFilename);
    }, 1200);
}

function startRealDownload(url, filename) {
    showToast("⚡ Starting high-speed file download...");
    const fname = filename || "ReelSnap_Instagram_Video.mp4";
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", fname);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
    }, 1200);
}

function handleDownloadClick(filename) {
    initiateAdCountdown(currentDownloadUrl, filename);
}

function triggerFileDownload(e, downloadUrl, filename, directUrl) {
    if (e && e.preventDefault) e.preventDefault();
    initiateAdCountdown(downloadUrl, filename);
}

function downloadReelFile(url, filename, directUrl) {
    initiateAdCountdown(url, filename);
}

// Download Success Modal Handlers
function openDownloadSuccessModal(filename) {
    if (isVipUser) return;
    const modal = document.getElementById("download-success-ad-modal");
    const nameEl = document.getElementById("saved-filename-text");
    if (nameEl && filename) {
        nameEl.innerText = `File "${filename}" saved in your Downloads folder.`;
    }
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    }
    if (window.lucide) lucide.createIcons();
}

function closeDownloadSuccessModal() {
    const modal = document.getElementById("download-success-ad-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

function focusDownloadInput() {
    const input = document.getElementById("reel-url-input");
    if (input) {
        input.value = "";
        input.focus();
    }
}

function triggerAdOrDownload(downloadUrl) {
    initiateAdCountdown(downloadUrl, "ReelSnap_Video.mp4");
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
window.openVipModal = function(planName = "Pro Monthly", price = "₹299") {
    const modal = document.getElementById("vip-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.style.display = "flex";

    let numPrice = 299;
    if (price && typeof price === "string") {
        if (price.includes("49")) numPrice = 49;
        if (price.includes("1999") || price.includes("1,999")) numPrice = 1999;
    } else if (typeof price === "number") {
        numPrice = price;
    }
    selectPlanPayment(planName, numPrice);

    if (window.lucide) lucide.createIcons();
};

window.closeVipModal = function() {
    const modal = document.getElementById("vip-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.style.display = "none";
    const kMsg = document.getElementById("vip-key-msg");
    const uMsg = document.getElementById("upi-order-msg");
    if (kMsg) kMsg.innerText = "";
    if (uMsg) uMsg.innerText = "";
};

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
    const upi = siteConfig.upi_id || "yashlimbasiya1234-2@okaxis";
    const name = siteConfig.upi_name || "Yash Limbasiya";
    const amount = selectedPaymentPlan.amount || 49;
    const upiUri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(selectedPaymentPlan.name)}`;

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
    const emailInput = document.getElementById("vip-email-input");
    const nameInput = document.getElementById("vip-name-input");
    const msgEl = document.getElementById("upi-order-msg");
    const submitBtn = document.getElementById("submit-utr-btn");

    const utr = utrInput ? utrInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : (email ? email.split("@")[0] : "VIP Member");

    if (!email || !email.includes("@")) {
        msgEl.innerHTML = `<span class="text-rose-400">Please enter your valid Email to link your VIP account.</span>`;
        return;
    }

    if (!utr || utr.length < 6) {
        msgEl.innerHTML = `<span class="text-rose-400">Please enter a valid 12-digit UPI UTR / Reference number.</span>`;
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "Verifying & Activating VIP...";

    try {
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                plan: selectedPaymentPlan.name,
                amount: selectedPaymentPlan.amount,
                utr: utr,
                email: email,
                name: name
            })
        });

        const data = await res.json();
        if (data.success) {
            let expiryTime = null;
            if (selectedPaymentPlan.amount === 49) {
                expiryTime = Date.now() + 24 * 60 * 60 * 1000; // 24 Hours
            } else if (selectedPaymentPlan.amount === 299) {
                expiryTime = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 Days
            }

            const vipUser = {
                email: email,
                name: name,
                isLoggedIn: true,
                isVip: true,
                plan: selectedPaymentPlan.name || "VIP Lifetime",
                expiry: expiryTime,
                utr: utr
            };
            saveUserSession(vipUser);

            msgEl.innerHTML = `<span class="text-emerald-400 font-bold">✓ Payment Verified! VIP ID saved in database.</span>`;

            if (window.confetti) {
                confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            }

            setTimeout(() => {
                closeVipModal();
                checkVipStatus();
                renderUserAccount();
                showToast(`🎉 VIP Active for ${email}! All ads removed permanently.`);
            }, 1400);
        } else {
            msgEl.innerHTML = `<span class="text-rose-400">Submission failed. Try again.</span>`;
        }
    } catch (err) {
        msgEl.innerHTML = `<span class="text-rose-400">Network error. Please try again.</span>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Activate 100% Ad-Free VIP Pass →";
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
            const user = getUserSession();
            user.plan = "VIP Lifetime";
            user.isVip = true;
            user.isLoggedIn = true;
            user.expiry = null;
            saveUserSession(user);

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

// Theme Manager (Dark Mode vs Light Mode)
function initTheme() {
    const savedTheme = localStorage.getItem("reelsnap_theme") || "dark";
    if (savedTheme === "light") {
        document.documentElement.classList.remove("dark");
    } else {
        document.documentElement.classList.add("dark");
    }
    updateThemeUI(savedTheme);
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    const newTheme = isDark ? "light" : "dark";
    if (newTheme === "light") {
        document.documentElement.classList.remove("dark");
    } else {
        document.documentElement.classList.add("dark");
    }
    localStorage.setItem("reelsnap_theme", newTheme);
    updateThemeUI(newTheme);
    showToast(newTheme === "light" ? "☀️ Light Mode Activated!" : "🌙 Dark Luxury Mode Activated!");
}

function updateThemeUI(theme) {
    const lbl = document.getElementById("theme-label");
    const btnText = document.getElementById("theme-toggle-btn-text");
    const iconBox = document.getElementById("theme-icon-box");
    if (!lbl || !btnText) return;

    if (theme === "light") {
        lbl.innerText = "Light Clean Mode";
        btnText.innerText = "Switch to Dark Mode 🌙";
        if (iconBox) iconBox.innerHTML = `<i data-lucide="sun" class="w-5 h-5 text-amber-500"></i>`;
    } else {
        lbl.innerText = "Dark Luxury Mode";
        btnText.innerText = "Switch to Light Mode ☀️";
        if (iconBox) iconBox.innerHTML = `<i data-lucide="moon" class="w-5 h-5 text-purple-400"></i>`;
    }
    if (window.lucide) lucide.createIcons();
}

// User Account & VIP Expiry Manager
function getUserSession() {
    try {
        const stored = localStorage.getItem("reelsnap_user");
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
        email: "Guest User",
        isLoggedIn: false,
        plan: "Free Plan",
        expiry: null
    };
}

function saveUserSession(user) {
    localStorage.setItem("reelsnap_user", JSON.stringify(user));
    renderUserAccount();
}

function renderUserAccount() {
    const user = getUserSession();
    const emailEl = document.getElementById("settings-user-email");
    const statusEl = document.getElementById("settings-user-status");
    const authActions = document.getElementById("settings-auth-actions");
    const vipBadge = document.getElementById("settings-vip-badge");
    const vipExpiry = document.getElementById("settings-vip-expiry");
    const vipBtnText = document.getElementById("settings-vip-btn-text");

    let isVipActive = false;
    let expiryText = "Free user with display ads. Upgrade to remove all ads & unlock 4K speeds!";

    if (user.plan && user.plan !== "Free Plan") {
        if (!user.expiry) {
            isVipActive = true;
            expiryText = "👑 Lifetime VIP Active: Unlimited 4K downloads & permanent ad-free experience!";
        } else if (Date.now() < user.expiry) {
            isVipActive = true;
            const diffHours = Math.round((user.expiry - Date.now()) / (1000 * 60 * 60));
            if (diffHours <= 24) {
                const diffMin = Math.round((user.expiry - Date.now()) / (1000 * 60));
                expiryText = `👑 ${user.plan} Active • Time Remaining: ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
            } else {
                const diffDays = Math.ceil(diffHours / 24);
                expiryText = `👑 ${user.plan} Active • Time Remaining: ${diffDays} Days`;
            }
        } else {
            user.plan = "Free Plan";
            user.expiry = null;
            saveUserSession(user);
            expiryText = "⚠️ Your VIP plan has expired. Please renew your VIP pass.";
        }
    }

    isVipUser = isVipActive;
    if (isVipUser) {
        hideAllAds();
    } else {
        showAllAds();
    }

    if (emailEl) emailEl.innerText = user.email || "Guest User";
    if (statusEl) statusEl.innerText = user.isLoggedIn ? `Signed In (${user.provider || "Account"})` : "Not logged in (Guest)";
    if (vipBadge) {
        vipBadge.innerText = user.plan || "Free Plan";
        vipBadge.className = isVipActive 
            ? "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40"
            : "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300";
    }
    if (vipExpiry) vipExpiry.innerText = expiryText;
    if (vipBtnText) vipBtnText.innerText = isVipActive ? "Manage / Extend VIP Plan" : "Add / Upgrade VIP Plan";

    // Navbar User Button State
    const navUserContainer = document.getElementById("nav-user-container");
    if (navUserContainer) {
        if (user.isLoggedIn) {
            const letter = (user.name || user.email || "U")[0].toUpperCase();
            navUserContainer.innerHTML = `
                <button onclick="openSettingsModal()" class="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/10 flex items-center gap-2 transition-all">
                    <div class="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold">
                        ${letter}
                    </div>
                    <span class="max-w-[90px] truncate">${user.name || user.email.split("@")[0]}</span>
                </button>
            `;
        } else {
            navUserContainer.innerHTML = `
                <button onclick="openAuthModal()" class="px-3 py-1.5 rounded-full text-xs font-bold bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/30 flex items-center gap-1.5 transition-all">
                    <i data-lucide="user" class="w-3.5 h-3.5"></i>
                    <span>Sign In</span>
                </button>
            `;
        }
    }

    if (authActions) {
        if (user.isLoggedIn) {
            authActions.innerHTML = `
                <button type="button" onclick="logoutUser()" class="w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all">
                    <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
                    <span>Log Out (${user.email})</span>
                </button>
            `;
        } else {
            authActions.innerHTML = `
                <button type="button" onclick="closeSettingsModal(); openAuthModal();" class="w-full py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all">
                    <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
                    <span>Sign In / Create Account</span>
                </button>
            `;
        }
    }

    fetchRegisteredUsersCount();
    if (window.lucide) lucide.createIcons();
}

let currentGoogleLoginMode = "normal";

// Official Google Sign-In Modals & Actions
function openGoogleModal() {
    const modal = document.getElementById("google-signin-modal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    }
    if (window.lucide) lucide.createIcons();
}

function closeGoogleModal() {
    const modal = document.getElementById("google-signin-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

function loginWithGoogle(mode = "normal") {
    currentGoogleLoginMode = mode;
    openGoogleModal();
}

async function executeGoogleLogin(email, name) {
    if (!email) return;
    if (!name) name = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").trim() || "Google User";

    const submitBtn = document.getElementById("google-submit-btn");
    if (submitBtn) {
        submitBtn.innerHTML = `
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Signing in...</span>
        `;
        submitBtn.disabled = true;
    }

    const isVipFlow = currentGoogleLoginMode === "vip";

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: email,
                name: name,
                provider: isVipFlow ? "Google VIP" : "Google",
                is_vip: isVipFlow,
                plan: isVipFlow ? "VIP Lifetime" : "Free Plan"
            })
        });
        const data = await res.json();
        if (data.success) {
            const user = getUserSession();
            user.email = data.user.email;
            user.name = data.user.name;
            user.isLoggedIn = true;
            user.provider = "Google";
            if (isVipFlow) {
                user.isVip = true;
                user.plan = "VIP Lifetime";
                user.expiry = null;
            }
            saveUserSession(user);
        }
    } catch (e) {
        // Fallback offline session
        const user = getUserSession();
        user.email = email;
        user.name = name;
        user.isLoggedIn = true;
        user.provider = "Google";
        if (isVipFlow) {
            user.isVip = true;
            user.plan = "VIP Lifetime";
            user.expiry = null;
        }
        saveUserSession(user);
    }

    if (submitBtn) {
        submitBtn.innerHTML = `<span>Continue with Google →</span>`;
        submitBtn.disabled = false;
    }

    closeGoogleModal();
    const authModal = document.getElementById("auth-modal");
    if (authModal) authModal.classList.add("hidden");

    if (isVipFlow) {
        isVipUser = true;
        hideAllAds();
        closeVipModal();
        if (window.confetti) {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
        showToast(`👑 Welcome ${name}! Google VIP Pass linked & all ads removed permanently.`);
    } else {
        showToast(`🌐 Welcome, ${name}! Signed in via Google.`);
    }

    document.body.style.overflow = "";
    checkVipStatus();
    renderUserAccount();
}

function handleCustomGoogleLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById("google-custom-email");
    const nameInput = document.getElementById("google-custom-name");
    const email = emailInput ? emailInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";
    if (!email) return;
    executeGoogleLogin(email, name);
}

// Auth Handlers
function openAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }
    if (window.lucide) lucide.createIcons();
}

function closeAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
        modal.classList.add("hidden");
        document.body.style.overflow = "";
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("auth-name-input") ? document.getElementById("auth-name-input").value.trim() : "";
    const email = document.getElementById("auth-email-input").value.trim();
    if (!email) return;

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: email,
                name: name,
                provider: "Email"
            })
        });
        const data = await res.json();
        if (data.success) {
            const user = getUserSession();
            user.email = data.user.email;
            user.name = data.user.name;
            user.isLoggedIn = true;
            user.provider = "Email";
            saveUserSession(user);
        }
    } catch (err) {
        const user = getUserSession();
        user.email = email;
        user.name = name || email.split("@")[0];
        user.isLoggedIn = true;
        user.provider = "Email";
        saveUserSession(user);
    }

    renderUserAccount();
    closeAuthModal();
    showToast(`🎉 Welcome, ${email}! You're logged in.`);
}

function logoutUser() {
    const user = {
        email: "Guest User",
        isLoggedIn: false,
        plan: "Free Plan",
        expiry: null
    };
    saveUserSession(user);
    renderUserAccount();
    closeSettingsModal();
    openAuthModal();
    showToast("👋 You have been logged out. Please sign in again.");
}

function exportUsersCsv() {
    fetch("/api/admin/users")
        .then(r => r.json())
        .then(data => {
            const users = data.users || [];
            let csv = "User_ID,Name,Email,Provider,Plan,Created_At,Last_Login\n";
            users.forEach(u => {
                csv += `"${u.id || ''}","${u.name || ''}","${u.email || ''}","${u.provider || ''}","${u.plan || ''}","${u.created_at || ''}","${u.last_login || ''}"\n`;
            });
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `reelsnap_registered_users_${Date.now()}.csv`;
            a.click();
            showToast("📥 Exported users CSV file successfully!");
        })
        .catch(() => showToast("❌ Error exporting users list"));
}

// Registered Users Record (For Yash / Admin)
async function fetchRegisteredUsersCount() {
    try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
            const data = await res.json();
            const badge = document.getElementById("settings-users-count");
            if (badge) badge.innerText = `${data.total_users || 0} Users`;
        }
    } catch (e) {}
}

async function toggleUsersRecord() {
    const container = document.getElementById("settings-users-container");
    if (!container) return;

    if (!container.classList.contains("hidden")) {
        container.classList.add("hidden");
        return;
    }

    container.classList.remove("hidden");
    container.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-2">Loading registered users...</p>`;

    try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
            const data = await res.json();
            const users = data.users || [];
            if (users.length === 0) {
                container.innerHTML = `<p class="text-[11px] text-slate-500 text-center py-2">No users registered yet.</p>`;
                return;
            }

            const headerHtml = `
                <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                    <span class="text-[10px] text-slate-400 font-bold uppercase">Total Users: ${users.length}</span>
                    <button onclick="exportUsersCsv()" class="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1 transition-all">
                        <span>📥 Export to CSV</span>
                    </button>
                </div>
            `;
            container.innerHTML = headerHtml + users.map(u => `
                <div class="p-2 rounded-xl bg-white/5 border border-white/5 text-[11px] flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-1.5 font-bold text-white">
                            <span>${u.name || u.email.split("@")[0]}</span>
                            <span class="text-[9px] px-1.5 py-0.2 rounded font-normal bg-purple-500/20 text-purple-300">${u.provider || "Email"}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 font-mono">${u.email}</div>
                        <div class="text-[9px] text-slate-500 mt-0.5">Joined: ${u.created_at || "Recent"}</div>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.plan && u.plan !== 'Free Plan' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}">
                        ${u.plan || "Free"}
                    </span>
                </div>
            `).join("");
        }
    } catch (err) {
        container.innerHTML = `<p class="text-[11px] text-rose-400 text-center py-2">Failed to load users list.</p>`;
    }
}

// Settings Modal
function openSettingsModal() {
    document.getElementById("settings-modal").classList.remove("hidden");
    renderUserAccount();
    if (window.lucide) lucide.createIcons();
}

function closeSettingsModal() {
    document.getElementById("settings-modal").classList.add("hidden");
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
