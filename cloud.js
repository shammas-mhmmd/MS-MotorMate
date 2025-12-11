
const Cloud = {
    app: null,
    auth: null,
    db: null,
    user: null,

    // Hardcoded Config for Public App
    config: {
        apiKey: "AIzaSyD_q5kf3ALaE8hi06xZEzvcbMhkEjxCFGU",
        authDomain: "motormate-one.firebaseapp.com",
        projectId: "motormate-one",
        storageBucket: "motormate-one.firebasestorage.app",
        messagingSenderId: "193216239840",
        appId: "1:193216239840:web:49c5e92237b6bd79eb5885",
        measurementId: "G-YTBE6WKGNF"
    },

    // Initialize Firebase
    init: function () {
        if (!firebase.apps.length) {
            try {
                this.app = firebase.initializeApp(this.config);
                this.auth = firebase.auth();
                this.db = firebase.firestore();
                this.setupAuthListener();
            } catch (e) {
                console.error("Firebase Init Error:", e);
                this.updateStatus("Error", "error");
            }
        }

        this.setupUI();
        this.refreshModalState();
    },

    setupAuthListener: function () {
        this.auth.onAuthStateChanged(user => {
            this.user = user;
            if (user) {
                this.updateStatus("Online", "online");
                document.getElementById("currentUserEmail").innerText = user.email;

                // If logged in, close modal if it's open
                const modal = document.getElementById("cloudModal");
                if (modal.classList.contains("show")) {
                    setTimeout(() => closeCloudModal(), 500);
                }
                this.refreshModalState();
            } else {
                this.updateStatus("Logged Out", "offline");
                this.refreshModalState(); // Force login
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

    refreshModalState: function () {
        const modal = document.getElementById("cloudModal");
        const closeBtn = modal.querySelector(".close-modal-btn");

        if (!this.user) {
            // Not Logged In -> Force Auth Section
            this.showSection("auth");
            modal.classList.add("show");
            if (closeBtn) closeBtn.style.display = "none";
        } else {
            // Logged In -> Show Dashboard
            this.showSection("dashboard");
            if (closeBtn) closeBtn.style.display = "block";
        }
    },

    showSection: function (sectionName) {
        ['cloudSetupSection', 'cloudAuthSection', 'cloudDashboardSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        if (sectionName === 'setup') { /* Dead path */ }
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
        this.auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
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

                    if (typeof loadActiveVehicle === 'function') {
                        loadActiveVehicle();
                        refreshVehicleSelect();
                        fullRefreshUI();
                    }
                    this.msg("✅ Download Successful!");
                }
            } else {
                this.msg("⚠️ No data found in cloud.");
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
