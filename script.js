// ===============================
// STATE: Local Storage
// ===============================
let fuelLogs = JSON.parse(localStorage.getItem("fuelLogs") || "[]");
let serviceLogs = JSON.parse(localStorage.getItem("serviceLogs") || "[]");

// Charts
let mileageChart = null;
let costChart = null;

// Vehicle profile (single-vehicle legacy)
let vehicleProfile = JSON.parse(localStorage.getItem("vehicleProfile") || "{}");

// Care reminders (single-vehicle legacy)
let careData = JSON.parse(localStorage.getItem("careData") || "{}");

// Multi-vehicle state
let vehicles = JSON.parse(localStorage.getItem("vehicles") || "[]");
let activeVehicleIndex = Number(localStorage.getItem("activeVehicleIndex") || 0);

// ===============================
// MULTI-VEHICLE HELPERS
// ===============================
function ensureVehiclesInitialized() {
    if (!Array.isArray(vehicles)) {
        vehicles = [];
    }

    // First time: migrate existing single-vehicle data into vehicles[]
    if (vehicles.length === 0) {
        const initialVehicle = {
            id: Date.now(),
            name: (vehicleProfile && vehicleProfile.name) || "My Vehicle",
            profile: vehicleProfile || {},
            fuelLogs: fuelLogs || [],
            serviceLogs: serviceLogs || [],
            careData: careData || {}
        };
        vehicles.push(initialVehicle);
        activeVehicleIndex = 0;
        localStorage.setItem("vehicles", JSON.stringify(vehicles));
        localStorage.setItem("activeVehicleIndex", "0");
    } else {
        if (activeVehicleIndex < 0 || activeVehicleIndex >= vehicles.length) {
            activeVehicleIndex = 0;
            localStorage.setItem("activeVehicleIndex", "0");
        }
    }
}

function loadActiveVehicle() {
    ensureVehiclesInitialized();
    const v = vehicles[activeVehicleIndex];

    vehicleProfile = v.profile || {};
    fuelLogs = v.fuelLogs || [];
    serviceLogs = v.serviceLogs || [];
    careData = v.careData || {};

    // keep legacy keys loosely in sync (optional)
    localStorage.setItem("fuelLogs", JSON.stringify(fuelLogs));
    localStorage.setItem("serviceLogs", JSON.stringify(serviceLogs));
    localStorage.setItem("vehicleProfile", JSON.stringify(vehicleProfile));
    localStorage.setItem("careData", JSON.stringify(careData));
}

function saveActiveVehicle() {
    ensureVehiclesInitialized();
    const old = vehicles[activeVehicleIndex] || {};
    vehicles[activeVehicleIndex] = {
        ...old,
        profile: vehicleProfile,
        name: vehicleProfile.name || old.name || `Vehicle ${activeVehicleIndex + 1}`,
        fuelLogs,
        serviceLogs,
        careData
    };

    localStorage.setItem("vehicles", JSON.stringify(vehicles));
    localStorage.setItem("activeVehicleIndex", String(activeVehicleIndex));

    // optional sync for legacy keys
    localStorage.setItem("fuelLogs", JSON.stringify(fuelLogs));
    localStorage.setItem("serviceLogs", JSON.stringify(serviceLogs));
    localStorage.setItem("vehicleProfile", JSON.stringify(vehicleProfile));
    localStorage.setItem("careData", JSON.stringify(careData));

    // Cloud Auto-Sync
    if (typeof Cloud !== 'undefined' && Cloud.user) {
        Cloud.syncUp();
    }
}

function refreshVehicleSelect() {
    const select = document.getElementById("vehicleSelect");
    if (!select) return;

    select.innerHTML = "";
    vehicles.forEach((v, index) => {
        const opt = document.createElement("option");
        const name = (v.profile && v.profile.name) || v.name || `Vehicle ${index + 1}`;
        opt.value = index;
        opt.textContent = name;
        if (index === activeVehicleIndex) opt.selected = true;
        select.appendChild(opt);
    });
}

function setupVehicleSwitcherListeners() {
    const select = document.getElementById("vehicleSelect");
    const addBtn = document.querySelector(".vehicle-add-btn");

    if (select) {
        select.addEventListener("change", () => {
            activeVehicleIndex = Number(select.value) || 0;
            localStorage.setItem("activeVehicleIndex", String(activeVehicleIndex));
            loadActiveVehicle();
            fullRefreshUI();
        });
    }

    if (addBtn) {
        addBtn.addEventListener("click", () => {
            const name = prompt("Enter vehicle name (e.g., Baleno, Activa):") || "";
            const profile = {
                name: name || `Vehicle ${vehicles.length + 1}`,
                fuel: "Petrol"
            };
            const newVehicle = {
                id: Date.now(),
                name: profile.name,
                profile,
                fuelLogs: [],
                serviceLogs: [],
                careData: {}
            };
            vehicles.push(newVehicle);
            activeVehicleIndex = vehicles.length - 1;
            localStorage.setItem("vehicles", JSON.stringify(vehicles));
            localStorage.setItem("activeVehicleIndex", String(activeVehicleIndex));

            loadActiveVehicle();
            refreshVehicleSelect();
            fullRefreshUI();
            alert("New vehicle added!");
        });
    }
}

// Helper: refresh everything based on active vehicle
function fullRefreshUI() {
    showFuel();
    showService();
    updateDashboard();
    updateVehicleBar();
    updateCareReminders();
    updateInsightsPanel();
    updateCharts();
}

// ===============================
// TAB SWITCHING (REUSABLE)
// ===============================
function setActiveTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.toggle("active", tab.id === tabId);
    });
}

document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        setActiveTab(btn.dataset.tab);
    });
});

// ===============================
// ADD FUEL ENTRY
// ===============================
function addFuel() {
    let odo = Number(document.getElementById("f_odo").value);
    let litres = Number(document.getElementById("f_litres").value);
    let price = Number(document.getElementById("f_price").value);

    if (!odo || !litres || !price) {
        alert("Enter all fields!");
        return;
    }

    let lastOdo = fuelLogs.length ? fuelLogs[fuelLogs.length - 1].odometer : odo;
    let distance = odo - lastOdo;
    let mileage = distance > 0 ? (distance / litres).toFixed(2) : "-";

    let entry = {
        date: new Date().toLocaleDateString(),
        odometer: odo,
        litres,
        price,
        total: litres * price,
        mileage
    };

    fuelLogs.push(entry);
    localStorage.setItem("fuelLogs", JSON.stringify(fuelLogs));

    document.getElementById("f_odo").value = "";
    document.getElementById("f_litres").value = "";
    document.getElementById("f_price").value = "";

    saveActiveVehicle();
    showFuel();
    updateDashboard();
    updateInsightsPanel();
    alert("Fuel entry added!");
}

// ===============================
// ADD SERVICE ENTRY
// ===============================
function addService() {
    let odo = Number(document.getElementById("s_odo").value);
    let type = document.getElementById("s_type").value;
    let cost = Number(document.getElementById("s_cost").value);

    if (!odo || !type || !cost) {
        alert("Enter all fields!");
        return;
    }

    let entry = {
        date: new Date().toLocaleDateString(),
        odometer: odo,
        type,
        cost
    };

    serviceLogs.push(entry);
    localStorage.setItem("serviceLogs", JSON.stringify(serviceLogs));

    document.getElementById("s_odo").value = "";
    document.getElementById("s_type").value = "";
    document.getElementById("s_cost").value = "";

    saveActiveVehicle();
    showService();
    updateDashboard();
    updateInsightsPanel();
    alert("Service entry added!");
}

// ===============================
// DISPLAY FUEL LOGS
// ===============================
function showFuel() {
    let container = document.getElementById("fuelList");
    if (!container) return;

    container.innerHTML = "";

    fuelLogs.slice().reverse().forEach(e => {
        container.innerHTML += `
        <div class="entry">
            <strong>${e.date}</strong><br>
            Odometer: ${e.odometer} km<br>
            Litres: ${e.litres}<br>
            Price: ₹${e.price}<br>
            Total: ₹${e.total}<br>
            Mileage: ${e.mileage} km/l
        </div>
        `;
    });
}

// ===============================
// DISPLAY SERVICE LOGS
// ===============================
function showService() {
    let container = document.getElementById("serviceList");
    if (!container) return;

    container.innerHTML = "";

    serviceLogs.slice().reverse().forEach(e => {
        container.innerHTML += `
        <div class="entry">
            <strong>${e.date}</strong><br>
            Odometer: ${e.odometer} km<br>
            ${e.type}<br>
            Cost: ₹${e.cost}
        </div>`;
    });
}

// ===============================
// DASHBOARD STATS + SMART STATS
// ===============================
function updateDashboard() {
    // basic totals
    if (fuelLogs.length >= 2) {
        let first = fuelLogs[0].odometer;
        let last = fuelLogs[fuelLogs.length - 1].odometer;

        let totalDistance = last - first;
        let totalCost = fuelLogs.reduce((a, b) => a + b.total, 0);
        let totalLitres = fuelLogs.reduce((a, b) => a + b.litres, 0);

        let avgMileage = totalLitres > 0 ? (totalDistance / totalLitres).toFixed(2) : "0.00";
        let costPerKm = totalDistance > 0 ? (totalCost / totalDistance).toFixed(2) : "0.00";

        document.getElementById("totalDistance").innerText = totalDistance + " km";
        document.getElementById("avgMileage").innerText = avgMileage + " km/l";
        document.getElementById("totalCost").innerText = "₹" + totalCost;
        document.getElementById("costPerKm").innerText = "₹" + costPerKm;
    } else {
        document.getElementById("totalDistance").innerText = "0 km";
        document.getElementById("avgMileage").innerText = "0 km/l";
        document.getElementById("totalCost").innerText = "₹0";
        document.getElementById("costPerKm").innerText = "₹0";
    }

    // SMART DASHBOARD STATS
    if (fuelLogs.length > 1) {
        const validMileage = fuelLogs
            .map(e => Number(e.mileage))
            .filter(m => !isNaN(m) && m > 0);

        const bestEl = document.getElementById("bestMileage");
        const worstEl = document.getElementById("worstMileage");

        if (validMileage.length > 0) {
            const best = Math.max(...validMileage).toFixed(2);
            const worst = Math.min(...validMileage).toFixed(2);

            if (bestEl) bestEl.innerText = best + " km/l";
            if (worstEl) worstEl.innerText = worst + " km/l";
        } else {
            if (bestEl) bestEl.innerText = "0 km/l";
            if (worstEl) worstEl.innerText = "0 km/l";
        }
    } else {
        const bestEl = document.getElementById("bestMileage");
        const worstEl = document.getElementById("worstMileage");
        if (bestEl) bestEl.innerText = "0 km/l";
        if (worstEl) worstEl.innerText = "0 km/l";
    }

    // Total refills & services
    const refEl = document.getElementById("totalRefills");
    const svcEl = document.getElementById("totalServices");
    if (refEl) refEl.innerText = fuelLogs.length;
    if (svcEl) svcEl.innerText = serviceLogs.length;

    // Recent lists
    let rf = document.getElementById("recentFuel");
    let rs = document.getElementById("recentService");

    if (rf) {
        rf.innerHTML = "";
        fuelLogs.slice(-3).forEach(e => {
            rf.innerHTML += `<div class="entry">${e.date} — ${e.mileage} km/l</div>`;
        });
    }

    if (rs) {
        rs.innerHTML = "";
        serviceLogs.slice(-3).forEach(e => {
            rs.innerHTML += `<div class="entry">${e.date} — ₹${e.cost}</div>`;
        });
    }

    updateCharts();
    updateInsightsPanel();
}

// ===============================
// CHARTS: Mileage & Fuel Cost
// ===============================
function updateCharts() {
    const ctxMileage = document.getElementById("mileageChart");
    const ctxCost = document.getElementById("costChart");

    if (!ctxMileage || !ctxCost || typeof Chart === "undefined") return;

    const labels = fuelLogs.map((e, i) => `#${i + 1}`);
    const mileageData = fuelLogs.map(e =>
        e.mileage === "-" ? null : Number(e.mileage)
    );
    const costData = fuelLogs.map(e => e.total);

    if (mileageChart) mileageChart.destroy();
    if (costChart) costChart.destroy();

    mileageChart = new Chart(ctxMileage, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Mileage (km/l)",
                data: mileageData,
                borderColor: "rgba(94, 188, 255, 1)",
                backgroundColor: "rgba(94, 188, 255, 0.2)",
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#cfd9ff" } },
                y: { ticks: { color: "#cfd9ff" } }
            }
        }
    });

    costChart = new Chart(ctxCost, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Fuel Cost (₹)",
                data: costData,
                backgroundColor: "rgba(111, 207, 151, 0.8)"
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#cfd9ff" } },
                y: { ticks: { color: "#cfd9ff" } }
            }
        }
    });
}

// ===============================
// EXPORT FUEL LOGS AS CSV
// ===============================
function exportFuelCSV() {
    if (fuelLogs.length === 0) {
        alert("No fuel logs to export.");
        return;
    }

    let csv = "Date,Odometer,Litres,Price per Litre,Total Cost,Mileage\n";

    fuelLogs.forEach(e => {
        csv += `${e.date},${e.odometer},${e.litres},${e.price},${e.total},${e.mileage}\n`;
    });

    downloadCSV(csv, "fuel_logs.csv");
}

// ===============================
// EXPORT SERVICE LOGS AS CSV
// ===============================
function exportServiceCSV() {
    if (serviceLogs.length === 0) {
        alert("No service logs to export.");
        return;
    }

    let csv = "Date,Odometer,Service Type,Cost\n";

    serviceLogs.forEach(e => {
        csv += `${e.date},${e.odometer},${e.type},${e.cost}\n`;
    });

    downloadCSV(csv, "service_logs.csv");
}

// ===============================
// DOWNLOAD HELPER
// ===============================
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

// ===============================
// RESET ALL DATA (THIS VEHICLE)
// ===============================
function resetAllData() {
    const sure = confirm(
        "This will delete ALL fuel and service data for the CURRENT vehicle on THIS device. Continue?"
    );
    if (!sure) return;

    fuelLogs = [];
    serviceLogs = [];
    careData = {};

    saveActiveVehicle();
    showFuel();
    showService();
    updateDashboard();
    updateCareReminders();
    updateInsightsPanel();
    updateCharts();
}

// ===============================
// VEHICLE PROFILE SAVE/LOAD
// ===============================
function openVehicleModal() {
    const modal = document.getElementById("vehicleModal");
    if (!modal) return;

    modal.classList.add("show");

    document.getElementById("v_name").value = vehicleProfile.name || "";
    document.getElementById("v_fuel").value = vehicleProfile.fuel || "Petrol";
    document.getElementById("v_tank").value = vehicleProfile.tank || "";
    document.getElementById("v_year").value = vehicleProfile.year || "";
    document.getElementById("v_reg").value = vehicleProfile.reg || "";
    document.getElementById("v_interval").value = vehicleProfile.interval || "";
    document.getElementById("v_lastservice").value = vehicleProfile.lastService || "";
    document.getElementById("v_insurance").value = vehicleProfile.insurance || "";
    document.getElementById("v_puc").value = vehicleProfile.puc || "";
}

function closeVehicleModal() {
    const modal = document.getElementById("vehicleModal");
    if (!modal) return;
    modal.classList.remove("show");
}

function saveVehicleProfile() {
    vehicleProfile = {
        name: document.getElementById("v_name").value,
        fuel: document.getElementById("v_fuel").value,
        tank: document.getElementById("v_tank").value,
        year: document.getElementById("v_year").value,
        reg: document.getElementById("v_reg").value,
        interval: document.getElementById("v_interval").value,
        lastService: document.getElementById("v_lastservice").value,
        insurance: document.getElementById("v_insurance").value,
        puc: document.getElementById("v_puc").value
    };

    localStorage.setItem("vehicleProfile", JSON.stringify(vehicleProfile));
    saveActiveVehicle();
    updateVehicleBar();
    refreshVehicleSelect();
    closeVehicleModal();
    alert("Vehicle profile updated!");
}

function updateVehicleBar() {
    const nameEl = document.getElementById("vehicleNameDisplay");
    const metaEl = document.getElementById("vehicleMetaDisplay");

    if (!nameEl || !metaEl) return;

    nameEl.innerText = vehicleProfile.name || "Your Vehicle";

    const metaParts = [];
    if (vehicleProfile.fuel) metaParts.push(vehicleProfile.fuel);
    if (vehicleProfile.year) metaParts.push(vehicleProfile.year);
    if (vehicleProfile.reg) metaParts.push(vehicleProfile.reg);

    metaEl.innerText = metaParts.length ? metaParts.join(" · ") : "Tap edit to add details";
}

// ===============================
// CARE REMINDERS: WASH & TYRE
// ===============================
function updateCareReminders() {
    const washEl = document.getElementById("washStatus");
    const tyreEl = document.getElementById("tyreStatus");
    if (!washEl || !tyreEl) return;

    const WASH_INTERVAL = 7;   // days
    const TYRE_INTERVAL = 14;  // days

    function statusText(lastISO, intervalDays) {
        if (!lastISO) return "Tap button to start tracking";

        const last = new Date(lastISO);
        const today = new Date();
        const diffMs = today - last;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const remaining = intervalDays - diffDays;

        const lastStr = last.toLocaleDateString();

        if (remaining > 0) {
            return `Next due in ${remaining} day${remaining === 1 ? "" : "s"} (last: ${lastStr})`;
        } else if (remaining === 0) {
            return `Due today (last: ${lastStr})`;
        } else {
            const overdue = -remaining;
            return `Overdue by ${overdue} day${overdue === 1 ? "" : "s"} (last: ${lastStr})`;
        }
    }

    updateCareReminders._lastWashText = statusText(careData.lastWash, WASH_INTERVAL);
    updateCareReminders._lastTyreText = statusText(careData.lastTyre, TYRE_INTERVAL);

    washEl.innerText = updateCareReminders._lastWashText;
    tyreEl.innerText = updateCareReminders._lastTyreText;
}

function markWashed() {
    careData.lastWash = new Date().toISOString();
    saveActiveVehicle();
    updateCareReminders();
    updateInsightsPanel();
    alert("Car wash date updated!");
}

function markTyreChecked() {
    careData.lastTyre = new Date().toISOString();
    saveActiveVehicle();
    updateCareReminders();
    updateInsightsPanel();
    alert("Tyre pressure check date updated!");
}

// ===============================
// SMART INSIGHTS PANEL
// ===============================
function updateInsightsPanel() {
    const list = document.getElementById("insightsList");
    if (!list) return;

    list.innerHTML = "";
    const insights = [];

    // 1) Mileage trend: last vs previous
    const validMileageEntries = fuelLogs
        .map(e => Number(e.mileage))
        .filter(m => !isNaN(m) && m > 0);

    if (validMileageEntries.length >= 2) {
        const last = validMileageEntries[validMileageEntries.length - 1];
        const prev = validMileageEntries[validMileageEntries.length - 2];
        const diff = last - prev;
        const percent = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : 0;

        if (diff > 0) {
            insights.push(`⚡ Your latest mileage is ${last} km/l, about ${percent}% better than the previous fill.`);
        } else if (diff < 0) {
            insights.push(`⚠️ Your latest mileage is ${last} km/l, about ${Math.abs(percent)}% lower than the previous fill.`);
        } else {
            insights.push(`ℹ️ Your last two mileage values are the same at ${last} km/l.`);
        }
    } else if (validMileageEntries.length === 1) {
        insights.push(`ℹ️ Mileage tracking started: current mileage is ${validMileageEntries[0]} km/l. Add more fills to see trends.`);
    } else {
        insights.push("ℹ️ Add fuel entries to unlock mileage insights.");
    }

    // 2) Service due / overdue (if profile + odometer info available)
    const intervalKm = Number(vehicleProfile.interval || 0);
    const lastServiceOdo = Number(vehicleProfile.lastService || 0);
    const currentOdo = fuelLogs.length ? fuelLogs[fuelLogs.length - 1].odometer : null;

    if (intervalKm > 0 && lastServiceOdo > 0 && currentOdo !== null) {
        const distanceSince = currentOdo - lastServiceOdo;
        const remaining = intervalKm - distanceSince;

        if (remaining > 1000) {
            insights.push(`🔧 Next service is roughly due in ${remaining.toFixed(0)} km (interval ${intervalKm} km).`);
        } else if (remaining > 0) {
            insights.push(`🟡 Service due soon: only about ${remaining.toFixed(0)} km left until the next scheduled service.`);
        } else {
            const overdue = Math.abs(remaining);
            insights.push(`🚨 Service overdue by about ${overdue.toFixed(0)} km. Consider servicing your vehicle soon.`);
        }
    } else {
        insights.push("🛠 Set your service interval and last service odometer in Vehicle Details to get service reminders.");
    }

    // 3) Wash care insight
    if (careData.lastWash) {
        const last = new Date(careData.lastWash);
        const today = new Date();
        const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
            insights.push(`🧽 Car wash is on time (last wash ${diffDays} day${diffDays === 1 ? "" : "s"} ago).`);
        } else {
            insights.push(`🧽 Car wash may be due: last wash was ${diffDays} day${diffDays === 1 ? "" : "s"} ago.`);
        }
    } else {
        insights.push("🧽 Start tracking your car wash using the Wash button in Care Reminders.");
    }

    // 4) Tyre check insight
    if (careData.lastTyre) {
        const last = new Date(careData.lastTyre);
        const today = new Date();
        const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
        if (diffDays <= 14) {
            insights.push(`🛞 Tyre pressure check is on track (checked ${diffDays} day${diffDays === 1 ? "" : "s"} ago).`);
        } else {
            insights.push(`🛞 Tyre pressure check overdue: last check was ${diffDays} day${diffDays === 1 ? "" : "s"} ago.`);
        }
    } else {
        insights.push("🛞 Track tyre pressure checks from the Care Reminders section to get tyre health insights.");
    }

    // Render insights
    insights.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
    });
}

// ===============================
// FLOATING ACTION BUTTON LOGIC
// ===============================
const fabMain = document.getElementById("fabMain");
const fabContainer = document.querySelector(".fab-container");

if (fabMain && fabContainer) {
    fabMain.addEventListener("click", () => {
        fabContainer.classList.toggle("open");
    });

    document.querySelectorAll(".fab-item").forEach(item => {
        item.addEventListener("click", () => {
            const action = item.dataset.action;

            if (action === "fuel") {
                setActiveTab("fuel");
                window.scrollTo({ top: 0, behavior: "smooth" });
            }

            if (action === "service") {
                setActiveTab("service");
                window.scrollTo({ top: 0, behavior: "smooth" });
            }

            fabContainer.classList.remove("open");
        });
    });
}

// ===============================
// PWA INSTALL HANDLING
// ===============================
let deferredPrompt;
const installBtn = document.getElementById("installBtn");

if (installBtn) {
    installBtn.style.display = "none";

    window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = "block";
    });

    installBtn.addEventListener("click", async () => {
        installBtn.style.display = "none";
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
        }
    });
}

// ===============================
// INITIAL LOAD (MUST BE LAST)
// ===============================
ensureVehiclesInitialized();
loadActiveVehicle();
refreshVehicleSelect();
setupVehicleSwitcherListeners();

showFuel();
showService();
updateDashboard();
updateVehicleBar();
updateCareReminders();
updateInsightsPanel();
updateCharts();

// Splash hide
window.addEventListener("load", () => {
    setTimeout(() => {
        document.body.classList.add("splash-done");
    }, 1500);
});
