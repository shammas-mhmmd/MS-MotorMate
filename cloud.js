
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

                // Update Profile Icon
                this.updateProfileUI(user);

                // If logged in, close modal if it's open (and not manually opened)
                const modal = document.getElementById("cloudModal");
                if (modal.classList.contains("show")) {
                    setTimeout(() => closeCloudModal(), 500);
                }
                this.refreshModalState();
            } else {
                this.updateStatus("", "offline"); // Clear status
                this.updateProfileUI(null); // Reset Icon
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

                // Also update UI just in case
                if (this.user) this.updateProfileUI(this.user);
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

        // Show/Hide Mobile Number based on mode
        const mobileGroup = document.getElementById("mobileGroup");
        if (mobileGroup) {
            mobileGroup.style.display = mode === 'register' ? 'block' : 'none';
        }
    },

    // TOAST NOTIFICATIONS
    showToast: function (msg, type = 'success') {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = `${type === 'success' ? '✅' : '⚠️'} ${msg}`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    login: function () {
        const email = document.getElementById("authEmail").value;
        const pass = document.getElementById("authPass").value;

        if (!email || !pass) {
            this.showToast("Please enter email and password", "error");
            return;
        }

        this.auth.signInWithEmailAndPassword(email, pass)
            .then(() => {
                this.showToast("Login Successful! Welcome back.");
            })
            .catch(e => this.showToast(e.message, "error"));
    },

    register: function () {
        const email = document.getElementById("authEmail").value;
        const pass = document.getElementById("authPass").value;

        if (!email || !pass) {
            this.showToast("Please fill all fields", "error");
            return;
        }

        this.auth.createUserWithEmailAndPassword(email, pass)
            .then((cred) => {
                this.showToast("Registration Successful!");
                // Optionally save mobile number to firestore profile here if needed
            })
            .catch(e => this.showToast(e.message, "error"));
    },

    forgotPassword: function () {
        const email = document.getElementById("authEmail").value;
        if (!email) {
            this.showToast("Please enter your email first", "error");
            return;
        }
        this.auth.sendPasswordResetEmail(email)
            .then(() => this.showToast("Reset link sent to " + email))
            .catch(e => this.showToast(e.message, "error"));
    },

    // UI Updates
    updateProfileUI: function (user) {
        const btn = document.getElementById("cloudBtn");
        if (btn) {
            if (user && user.photoURL) {
                btn.innerHTML = `<img src="${user.photoURL}" alt="User">`;
            } else if (user) {
                // Generate Initials or standard Icon
                const initial = user.email ? user.email[0].toUpperCase() : "U";
                btn.innerHTML = `<span style="font-weight:600; color:#cbd5e1;">${initial}</span>`;
            } else {
                btn.innerHTML = "☁️"; // Or generic icon
            }
        }
    },

    logout: function () {
        this.auth.signOut().then(() => this.showToast("Logged out successfully"));
    },

    // DATA SYNC
    syncUp: async function () {
        if (!this.user) return;
        this.showToast("Syncing data to cloud...");

        try {
            const data = {
                vehicles: JSON.parse(localStorage.getItem("vehicles") || "[]"),
                activeVehicleIndex: localStorage.getItem("activeVehicleIndex") || 0,
                lastUpdated: new Date().toISOString()
            };

            await this.db.collection("users").doc(this.user.uid).set(data);
            this.showToast("Data pushed to cloud!");
        } catch (e) {
            this.showToast("Upload Failed: " + e.message, "error");
        }
    },

    syncDown: async function () {
        if (!this.user) return;
        this.showToast("Fetching data...");

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
                    this.showToast("Cloud data restored!");
                }
            } else {
                this.showToast("No data found in cloud.", "error");
            }
        } catch (e) {
            this.showToast("Download Failed: " + e.message, "error");
        }
    },

    msg: function (text) {
        // Legacy support redirected to toast
        // document.getElementById("syncMsg").innerText = text;
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