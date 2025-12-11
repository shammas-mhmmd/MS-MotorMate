
const Cloud = {
    app: null,
    auth: null,
    db: null,
    user: null,

    // Initialize Firebase
    init: function () {
        const storedConfig = localStorage.getItem("firebaseConfig");

        if (storedConfig) {
            try {
                const config = JSON.parse(storedConfig);
                if (!firebase.apps.length) {
                    this.app = firebase.initializeApp(config);
                    this.auth = firebase.auth();
                    this.db = firebase.firestore();

                    this.setupAuthListener();
                }
            } catch (e) {
                console.error("Firebase Init Error:", e);
                this.updateStatus("Error", "error");
            }
        } else {
            this.updateStatus("Setup Needed", "offline");
        }

        // Setup UI Listeners
        this.setupUI();

        // Force Check on Load
        this.refreshModalState();
    },

    refreshModalState: function () {
        const modal = document.getElementById("cloudModal");
        const closeBtn = modal.querySelector(".close-modal-btn");
        const appContent = document.querySelector("main"); // Optional: blur background

        if (!localStorage.getItem("firebaseConfig")) {
            // CASE 1: No Config -> Force Setup
            this.showSection("setup");
            modal.classList.add("show");
            if (closeBtn) closeBtn.style.display = "none";

        } else if (!this.user) {
            // CASE 2: Config Exists, No User -> Force Login
            this.showSection("auth");
            modal.classList.add("show");
            if (closeBtn) closeBtn.style.display = "none";

        } else {
            // CASE 3: Logged In -> Allow Access
            this.showSection("dashboard");
            if (closeBtn) closeBtn.style.display = "block";

            // Auto-close modal if we just logged in (and it was forced open)
            // We check if the close button was previously hidden to know if it was forced
            // Or simply strict rule: if logged in, do not force open.
            // But if the user opened it manually (to sync), we keep it open.
            // We can detect "manual open" vs "forced open", but for now, let's just NOT force it.
            // If it is open and we are logged in, we let the user close it.
            // BUT, if we just transitioned from "Forced Auth" -> "Login Success", we should close it for convenience.

            // Simple heuristic: If we are in Dashboard section, let user control it.
            // If the user IS logged in, we don't force 'show'.
        }
    },

    setupAuthListener: function () {
        this.auth.onAuthStateChanged(user => {
            this.user = user;
            if (user) {
                this.updateStatus("Online", "online");
                document.getElementById("currentUserEmail").innerText = user.email;

                // If we were blocked, now we unblock
                const modal = document.getElementById("cloudModal");
                if (modal.classList.contains("show")) {
                    // Only auto-close if we were likely in the auth flow
                    // We'll just close it to be safe and let them re-open if they want to sync manually
                    this.refreshModalState(); // Update buttons first
                    setTimeout(() => closeCloudModal(), 500);
                }
            } else {
                this.updateStatus("Logged Out", "offline");
                this.refreshModalState(); // Will force open
            }
        });
    },

    // UI State Management
    setupUI: function () {
        const btn = document.getElementById("cloudBtn");
        const modal = document.getElementById("cloudModal");

        if (btn) {
            btn.addEventListener("click", () => {
                modal.classList.add("show");
                this.refreshModalState();
            });
        }
    },

    showSection: function (sectionName) {
        ['cloudSetupSection', 'cloudAuthSection', 'cloudDashboardSection'].forEach(id => {
            document.getElementById(id).style.display = "none";
        });

        if (sectionName === 'setup') document.getElementById("cloudSetupSection").style.display = "block";
        if (sectionName === 'auth') document.getElementById("cloudAuthSection").style.display = "block";
        if (sectionName === 'dashboard') document.getElementById("cloudDashboardSection").style.display = "block";
    },

    updateStatus: function (text, type) {
        const badge = document.getElementById("cloudStatusBadge");
        if (badge) {
            badge.innerText = text;
            badge.className = `status-badge ${type}`;
        }
    },

    // ACTIONS
    saveConfig: function () {
        const input = document.getElementById("firebaseConfigInput").value;
        const config = {};

        // Robust extraction for specific Firebase keys
        // Matches key: "value" or key: 'value'
        const keys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId"];

        let foundAny = false;
        keys.forEach(key => {
            const regex = new RegExp(key + '\\s*:\\s*["\']([^"\']+)["\']');
            const match = input.match(regex);
            if (match) {
                config[key] = match[1];
                foundAny = true;
            }
        });

        if (foundAny && config.apiKey) {
            localStorage.setItem("firebaseConfig", JSON.stringify(config));
            alert("Configuration saved! Reloading...");
            location.reload();
        } else {
            console.error("Parsed Input:", input);
            alert("Could not detect a valid configuration.\n\nPlease make sure you copied the text that looks like:\napiKey: \"...\",\nauthDomain: \"...\"");
        }
    },

    switchAuth: function (mode) {
        document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
        event.target.classList.add("active");

        const btn = document.getElementById("authBtn");
        btn.innerText = mode === 'login' ? "Login" : "Register";
        btn.onclick = mode === 'login' ? () => this.login() : () => this.register();
    },

    login: function () {
        const email = document.getElementById("authEmail").value;
        const pass = document.getElementById("authPass").value;

        this.auth.signInWithEmailAndPassword(email, pass)
            .catch(e => alert(e.message));
    },

    register: function () {
        const email = document.getElementById("authEmail").value;
        const pass = document.getElementById("authPass").value;

        this.auth.createUserWithEmailAndPassword(email, pass)
            .then(() => alert("Account created!"))
            .catch(e => alert(e.message));
    },

    logout: function () {
        this.auth.signOut();
    },

    // DATA SYNC
    syncUp: async function () {
        if (!this.user) return;
        this.msg("Syncing up...");

        try {
            const data = {
                vehicles: JSON.parse(localStorage.getItem("vehicles") || "[]"),
                activeVehicleIndex: localStorage.getItem("activeVehicleIndex") || 0,
                lastUpdated: new Date().toISOString()
            };

            await this.db.collection("users").doc(this.user.uid).set(data);
            this.msg("✅ Upload Successful!");
        } catch (e) {
            this.msg("❌ Upload Failed: " + e.message);
        }
    },

    syncDown: async function () {
        if (!this.user) return;
        this.msg("Syncing down...");

        try {
            const doc = await this.db.collection("users").doc(this.user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.vehicles) {
                    localStorage.setItem("vehicles", JSON.stringify(data.vehicles));
                    localStorage.setItem("activeVehicleIndex", data.activeVehicleIndex);

                    // Reload internal state by calling global function from script.js
                    // We need to reload page to be safe or call init functions
                    if (typeof loadActiveVehicle === 'function') {
                        loadActiveVehicle();
                        refreshVehicleSelect();
                        fullRefreshUI();
                    }
                    this.msg("✅ Download Successful!");
                }
            } else {
                this.msg("⚠️ No data fonud in cloud.");
            }
        } catch (e) {
            this.msg("❌ Download Failed: " + e.message);
        }
    },

    msg: function (text) {
        const el = document.getElementById("syncMsg");
        if (el) el.innerText = text;
        setTimeout(() => { if (el) el.innerText = ""; }, 3000);
    }
};

// Global Closer
function closeCloudModal() {
    document.getElementById("cloudModal").classList.remove("show");
}

// Auto Init
window.addEventListener('DOMContentLoaded', () => {
    Cloud.init();
});
