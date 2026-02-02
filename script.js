// ===============================
// STATE: Local Storage
// ===============================
let fuelLogs = JSON.parse(localStorage.getItem("fuelLogs") || "[]");
let serviceLogs = JSON.parse(localStorage.getItem("serviceLogs") || "[]");
let documentLogs = []; // State for active vehicle documents

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
    documentLogs = v.documentLogs || [];

    // keep legacy keys loosely in sync (optional)
    localStorage.setItem("fuelLogs", JSON.stringify(fuelLogs));
    localStorage.setItem("serviceLogs", JSON.stringify(serviceLogs));
    localStorage.setItem("vehicleProfile", JSON.stringify(vehicleProfile));
    localStorage.setItem("careData", JSON.stringify(careData));

    // Refresh Dash
    renderDocuments();
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
        careData,
        documentLogs
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

// ===========================
// CAR DATABASE & MODAL LOGIC
// ===========================
const CAR_DATABASE = {
    "Maruti Suzuki": ["Alto", "Swift", "Baleno", "Dzire", "Brezza", "Ertiga", "WagonR", "Celerio", "Ignis", "S-Presso", "Jimny", "Grand Vitara", "Fronx", "Invicto"],
    "Hyundai": ["Creta", "Venue", "i20", "Grand i10 Nios", "Verna", "Aura", "Alcazar", "Tucson", "Exter", "Ioniq 5"],
    "Tata": ["Nexon", "Punch", "Tiago", "Tigor", "Harrier", "Safari", "Altroz", "Nexon EV", "Tiago EV"],
    "Mahindra": ["Thar", "Scorpio N", "Scorpio Classic", "XUV700", "XUV300", "Bolero", "Bolero Neo", "Marazzo"],
    "Toyota": ["Innova Crysta", "Innova Hycross", "Fortuner", "Glanza", "Urban Cruiser Hyryder", "Hilux", "Camry"],
    "Ford": ["EcoSport", "Endeavour", "Figo", "Aspire", "Freestyle", "Fiesta", "Ikon"],
    "Kia": ["Seltos", "Sonet", "Carens", "EV6"],
    "Honda": ["City", "Amaze", "Elevate"],
    "Volkswagen": ["Virtus", "Taigun", "Tiguan"],
    "Skoda": ["Slavia", "Kushaq", "Kodiaq"],
    "MG": ["Hector", "Hector Plus", "Astor", "ZS EV", "Comet EV", "Gloster"],
    "Renault": ["Kwid", "Triber", "Kiger"],
    "Nissan": ["Magnite"],
    "Jeep": ["Compass", "Meridian", "Wrangler"],
    "BMW": ["3 Series", "5 Series", "X1", "X3", "X5", "X7", "iX1"],
    "Mercedes-Benz": ["C-Class", "E-Class", "A-Class", "GLA", "GLC", "GLE", "S-Class"]
};

const BIKE_DATABASE = {
    "Hero": ["Splendor+", "HF Deluxe", "Glamour", "Passion", "Xtreme 125R", "Pleasure+", "Destini", "Xoom", "Karizma XMR"],
    "Honda": ["Activa 6G", "Activa 125", "Shine", "SP 125", "Dio", "Unicorn", "Hness CB350", "CB350RS", "Hornet 2.0"],
    "TVS": ["Jupiter", "Apache RTR 160", "Apache RTR 200", "Apache RR 310", "NTorq", "Raider", "Radeon", "Sport", "iQube", "Ronin"],
    "Bajaj": ["Pulsar 150", "Pulsar NS200", "Pulsar N160", "Platina", "CT 110", "Dominar 400", "Chetak EV", "Avenger"],
    "Royal Enfield": ["Classic 350", "Bullet 350", "Hunter 350", "Meteor 350", "Himalayan 450", "Interceptor 650", "Continental GT 650", "Super Meteor 650"],
    "Yamaha": ["R15 V4", "MT-15 V2", "Fazer", "FZ-S", "Fascino", "Ray ZR", "Aerox 155"],
    "Suzuki": ["Access 125", "Burgman Street", "Gixxer", "Gixxer SF", "V-Strom SX"],
    "Ather": ["450X", "450S", "Rizta"],
    "Ola": ["S1 Pro", "S1 Air", "S1 X"]
};

// SMART VARIANTS DATABASE (Example for Popular Models)
// Structure: Brand -> Model -> [ {minYear, maxYear, variants: []} ]
const SMART_VARIANTS_DB = {
    "Maruti Suzuki": {
        "Swift": [
            { min: 2005, max: 2010, variants: ["LXi", "VXi", "ZXi", "LDi", "VDi", "ZDi"] },
            { min: 2011, max: 2017, variants: ["LXi", "VXi", "ZXi", "LDi", "VDi", "ZDi", "RS"] },
            { min: 2018, max: 2019, variants: ["LXi", "VXi", "ZXi", "ZXi+", "LDi", "VDi", "ZDi", "ZDi+", "AMT"] },
            { min: 2020, max: 2024, variants: ["LXi", "VXi", "ZXi", "ZXi+", "CNG"] }
        ],
        "Baleno": [
            { min: 2015, max: 2019, variants: ["Sigma", "Delta", "Zeta", "Alpha", "RS"] },
            { min: 2020, max: 2024, variants: ["Sigma", "Delta", "Zeta", "Alpha", "CNG"] }
        ],
        "Brezza": [
            { min: 2016, max: 2019, variants: ["LDi", "VDi", "ZDi", "ZDi+"] },
            { min: 2020, max: 2024, variants: ["LXi", "VXi", "ZXi", "ZXi+", "CNG"] }
        ]
    },
    "Hyundai": {
        "Creta": [
            { min: 2015, max: 2019, variants: ["E", "E+", "S", "SX", "SX(O)", "1.4 CRDi", "1.6 CRDi", "1.6 VTVT"] },
            { min: 2020, max: 2024, variants: ["E", "EX", "S", "S+", "SX", "SX(O)", "SX Tech", "Knight Edition", "N Line"] }
        ],
        "i20": [
            { min: 2014, max: 2019, variants: ["Era", "Magna", "Sportz", "Asta", "Asta(O)", "Active"] },
            { min: 2020, max: 2024, variants: ["Magna", "Sportz", "Asta", "Asta(O)", "N Line"] }
        ]
    },
    "Tata": {
        "Nexon": [
            { min: 2017, max: 2019, variants: ["XE", "XM", "XT", "XZ", "XZ+", "Kraz"] },
            { min: 2020, max: 2023, variants: ["XE", "XM", "XM(S)", "XZ", "XZ+", "XZ+(S)", "Jet", "Kaziranga", "Dark"] },
            { min: 2023, max: 2024, variants: ["Smart", "Smart+", "Pure", "Pure S", "Creative", "Creative+", "Fearless", "Fearless+"] }
        ],
        "Punch": [
            { min: 2021, max: 2024, variants: ["Pure", "Adventure", "Accomplished", "Creative", "Camo", "CNG"] }
        ]
    },
    "Mahindra": {
        "Thar": [
            { min: 2010, max: 2019, variants: ["DI 2WD", "DI 4WD", "CRDe 4WD"] },
            { min: 2020, max: 2024, variants: ["AX(O)", "LX", "RWD", "4WD", "Earth Edition"] }
        ],
        "XUV700": [
            { min: 2021, max: 2024, variants: ["MX", "AX3", "AX5", "AX7", "AX7 L", "Blaze Edition"] }
        ]
    },
    "Ford": {
        "EcoSport": [
            { min: 2013, max: 2015, variants: ["Ambiente", "Trend", "Titanium", "Titanium(O)"] },
            { min: 2016, max: 2021, variants: ["Ambiente", "Trend", "Trend+", "Titanium", "Titanium+", "S", "SE", "Thunder"] }
        ],
        "Endeavour": [
            { min: 2003, max: 2015, variants: ["XLT", "Limited", "Hurricane", "3.0L 4x4"] },
            { min: 2016, max: 2019, variants: ["Trend", "Titanium", "2.2L 4x2", "3.2L 4x4"] },
            { min: 2020, max: 2021, variants: ["Titanium+", "Sport", "2.0L EcoBlue"] }
        ],
        "Figo": [
            { min: 2010, max: 2015, variants: ["LXi", "VXi", "ZXi", "Titanium"] },
            { min: 2015, max: 2021, variants: ["Base", "Ambiente", "Trend", "Titanium", "Titanium Blu", "Freestyle"] }
        ]
    }
};

const GENERIC_VARIANTS = ["Base Model", "Mid Variant", "Top Model", "Automatic", "Manual", "CNG", "Diesel Base", "Diesel Top"];
const BIKE_GENERIC_VARIANTS = ["Standard", "Drum", "Disc", "Alloy", "Dual Channel ABS", "Connected"];

function getVariants(type, brand, model, year) {
    if (type === "Car" && SMART_VARIANTS_DB[brand] && SMART_VARIANTS_DB[brand][model]) {
        const history = SMART_VARIANTS_DB[brand][model];
        const match = history.find(h => year >= h.min && year <= h.max);
        if (match) return match.variants;
    }
    if (type === "Bike") return BIKE_GENERIC_VARIANTS;
    return GENERIC_VARIANTS;
}

let isManualVehicleMode = false;
let editingVehicleIndex = null;
let currentVehicleType = "Car"; // Default Car

function initVehicleModal() {
    const brandSelect = document.getElementById("v_brand_select");
    const modelSelect = document.getElementById("v_model_select");
    const yearSelect = document.getElementById("v_year_select");
    const variantSelect = document.getElementById("v_variant"); // Select
    const manualBtn = document.getElementById("manualToggleBtn");

    // Type Buttons
    const btnCar = document.getElementById("typeAccCar");
    const btnBike = document.getElementById("typeAccBike");

    if (!brandSelect || !yearSelect) return;

    // Helper: Reset Variant
    const resetVariants = () => {
        if (variantSelect) {
            variantSelect.innerHTML = '<option value="">Select Year First</option>';
            // variantSelect.disabled = true; // Optional: disable if strict
        }
    };

    // 1. Logic to Populate Brands based on Type
    const populateBrands = (type) => {
        currentVehicleType = type;
        const DB = (type === "Car") ? CAR_DATABASE : BIKE_DATABASE;

        // Reset Brand Dropdown
        brandSelect.innerHTML = '<option value="">Select Brand</option>';
        Object.keys(DB).sort().forEach(brand => {
            const opt = document.createElement("option");
            opt.value = brand;
            opt.innerText = brand;
            brandSelect.appendChild(opt);
        });

        // Reset Model Dropdown
        modelSelect.innerHTML = '<option value="">Select Brand First</option>';
        modelSelect.disabled = true;

        resetVariants();

        // Update Labels (Dynamic)
        const lgBrand = document.getElementById("lbl_brand");
        const lgModel = document.getElementById("lbl_model");
        if (lgBrand) lgBrand.innerText = `${type} Brand`;
        if (lgModel) lgModel.innerText = `${type} Model`;
    };

    // 2. Initial Load
    populateBrands("Car");

    // 3. Button Events
    if (btnCar && btnBike) {
        btnCar.addEventListener("click", () => {
            btnCar.classList.add("active");
            btnBike.classList.remove("active");
            populateBrands("Car");
        });

        btnBike.addEventListener("click", () => {
            btnBike.classList.add("active");
            btnCar.classList.remove("active");
            populateBrands("Bike");
        });
    }

    // 4. Brand Change Logic
    brandSelect.addEventListener("change", (e) => {
        const brand = e.target.value;
        const DB = (currentVehicleType === "Car") ? CAR_DATABASE : BIKE_DATABASE;

        modelSelect.innerHTML = '<option value="">Select Model</option>';
        if (brand && DB[brand]) {
            DB[brand].sort().forEach(model => {
                const opt = document.createElement("option");
                opt.value = model;
                opt.innerText = model;
                modelSelect.appendChild(opt);
            });
            modelSelect.disabled = false;
        } else {
            modelSelect.disabled = true;
        }
        resetVariants();
    });

    // 5. Model Change Logic
    modelSelect.addEventListener("change", () => {
        resetVariants();
        // If year is already selected, update variants
        if (yearSelect.value) updateVariantsList();
        else {
            if (variantSelect) variantSelect.innerHTML = '<option value="">Select Year</option>';
        }
    });

    // 5. Populate Years
    yearSelect.innerHTML = '<option value="">Select Year</option>';
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 1; y >= 1980; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.innerText = y;
        yearSelect.appendChild(opt);
    }

    // 6. Year Change -> Populate Variants
    function updateVariantsList() {
        if (!brandSelect.value || !modelSelect.value || !yearSelect.value) return;

        const variants = getVariants(
            currentVehicleType,
            brandSelect.value,
            modelSelect.value,
            Number(yearSelect.value)
        );

        if (variantSelect) {
            variantSelect.innerHTML = '<option value="">Select Variant</option>';
            variants.forEach(v => {
                const opt = document.createElement("option");
                opt.value = v;
                opt.innerText = v;
                variantSelect.appendChild(opt);
            });
            variantSelect.disabled = false;
        }
    }

    yearSelect.addEventListener("change", updateVariantsList);

    // 7. Manual Toggle
    if (manualBtn) manualBtn.addEventListener("click", toggleVehicleMode);
}

function toggleVehicleMode() {
    isManualVehicleMode = !isManualVehicleMode;
    const btn = document.getElementById("manualToggleBtn");
    const selMode = document.getElementById("selectionMode");
    const manMode = document.getElementById("manualMode");

    if (isManualVehicleMode) {
        selMode.style.display = "none";
        manMode.style.display = "block";
        btn.innerText = "Back to List Selection";
    } else {
        selMode.style.display = "block";
        manMode.style.display = "none";
        btn.innerText = "Can't find car? Add Manually";
    }
}

function openAddVehicleModal() {
    editingVehicleIndex = null;

    // Reset Form
    document.getElementById("v_name").value = "";
    document.getElementById("v_tank").value = "";
    document.getElementById("v_reg").value = "";
    document.getElementById("v_variant").value = "";
    document.getElementById("v_insurance").value = "";
    document.getElementById("v_lastservice").value = "";
    document.getElementById("v_interval").value = "";

    // Reset Dropdowns
    document.getElementById("v_year_select").value = "";

    // Reset Manual Inputs
    document.getElementById("v_brand_input").value = "";
    document.getElementById("v_model_input").value = "";

    // Reset to Car Default Logic
    const btnCar = document.getElementById("typeAccCar");
    if (btnCar) btnCar.click(); // This will trigger populateBrands("Car") via listener

    // Force List Mode
    isManualVehicleMode = true; // trick toggle
    toggleVehicleMode(); // now false (list mode)

    document.getElementById("vehicleModal").classList.add("show");
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
            // Open Updated Modal instead of Prompt
            openAddVehicleModal();
        });
    }

    // Init the logic once
    initVehicleModal();
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
    renderDocuments();
    renderTripUI();
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
    // 1. Determine Brand/Model
    let brand, model;
    if (isManualVehicleMode) {
        brand = document.getElementById("v_brand_input").value;
        model = document.getElementById("v_model_input").value;
    } else {
        brand = document.getElementById("v_brand_select").value;
        model = document.getElementById("v_model_select").value;
    }

    // 2. Other Fields
    const year = document.getElementById("v_year_select").value;
    const variant = document.getElementById("v_variant").value;
    const fuel = document.getElementById("v_fuel").value;
    const reg = document.getElementById("v_reg").value;
    const name = document.getElementById("v_name").value || `${brand} ${model}`;
    const tank = document.getElementById("v_tank").value;
    const interval = document.getElementById("v_interval").value;
    const lastService = document.getElementById("v_lastservice").value;
    const insurance = document.getElementById("v_insurance").value;
    const puc = document.getElementById("v_puc").value;

    // Type (Car/Bike) - Assuming currentVehicleType is set by the switcher
    const type = currentVehicleType;

    // Validation
    if (!brand || !model || !year) {
        alert("Please fill in Brand, Model, and Year.");
        return;
    }

    // 3. Construct Object
    // Check if we are editing an existing vehicle or adding a new one
    // We'll assume if activeVehicleIndex is valid, we are editing.
    // NOTE: The 'Add' flow needs to set activeVehicleIndex to null or handle strictly.
    // For now, let's update strict properties.

    const existing = (activeVehicleIndex !== null && vehicles[activeVehicleIndex]) ? vehicles[activeVehicleIndex] : {};

    const updatedVehicle = {
        ...existing, // Keep logs!
        id: existing.id || Date.now(),
        brand, model, variant, year,
        fuelType: fuel,
        regNumber: reg, name,
        tankCapacity: tank,
        serviceInterval: interval,
        lastServiceOdo: lastService,
        insuranceExpiry: insurance,
        pucExpiry: puc,
        type: type,
        isManual: isManualVehicleMode,
        // Ensure arrays exist if new
        fuelLogs: existing.fuelLogs || [],
        serviceLogs: existing.serviceLogs || [],
        documentLogs: existing.documentLogs || []
    };

    if (activeVehicleIndex !== null && vehicles[activeVehicleIndex]) {
        vehicles[activeVehicleIndex] = updatedVehicle;
    } else {
        vehicles.push(updatedVehicle);
        activeVehicleIndex = vehicles.length - 1;
    }

    localStorage.setItem("vehicles", JSON.stringify(vehicles));

    // Reload UI
    loadActiveVehicle();
    updateVehicleBar();
    refreshVehicleSelect();
    closeVehicleModal(); // function defined at line 820

    if (window.Cloud && typeof Cloud.syncUp === 'function') Cloud.syncUp();

    // Show Toast if available, else alert
    if (window.showToast) showToast("Vehicle Saved Successfully!");
    else alert("Vehicle Saved!");
}

// Open modal to Edit
function openEditVehicleModal() {
    if (activeVehicleIndex === null) return;
    editingVehicleIndex = activeVehicleIndex;
    const v = vehicles[activeVehicleIndex];

    document.getElementById("v_name").value = v.name || "";
    document.getElementById("v_fuel").value = v.fuelType || "Petrol";
    document.getElementById("v_tank").value = v.tankCapacity || "";

    // Fill Comprehensive Details
    document.getElementById("v_reg").value = v.regNumber || "";
    document.getElementById("v_variant").value = v.variant || "";
    document.getElementById("v_insurance").value = v.insuranceExpiry || "";
    document.getElementById("v_lastservice").value = v.lastServiceOdo || "";
    document.getElementById("v_interval").value = v.serviceInterval || "";

    // Handle Brand/Model Pre-filling
    if (v.isManual) {
        isManualVehicleMode = true;
        document.getElementById("selectionMode").style.display = "none";
        document.getElementById("manualMode").style.display = "block";
        document.getElementById("manualToggleBtn").innerText = "Back to List Selection";

        document.getElementById("v_brand_input").value = v.brand || "";
        document.getElementById("v_model_input").value = v.model || "";
    } else {
        isManualVehicleMode = false;
        document.getElementById("selectionMode").style.display = "block";
        document.getElementById("manualMode").style.display = "none";
        document.getElementById("manualToggleBtn").innerText = "Can't find car? Add Manually";

        // Try to set selects
        const brandSel = document.getElementById("v_brand_select");
        brandSel.value = v.brand || "";

        // Trigger populate models logic
        if (v.brand && CAR_DATABASE[v.brand]) {
            const modelSel = document.getElementById("v_model_select");
            modelSel.innerHTML = '<option value="">Select Model</option>';
            CAR_DATABASE[v.brand].sort().forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.innerText = m;
                modelSel.appendChild(opt);
            });
            modelSel.value = v.model || "";
            modelSel.disabled = false;
        }
    }

    document.getElementById("v_year_select").value = v.year || "";

    document.getElementById("vehicleModal").classList.add("show");
}

function closeVehicleModal() {
    document.getElementById("vehicleModal").classList.remove("show");
}

function saveVehicle() {
    let brand, model;

    if (isManualVehicleMode) {
        brand = document.getElementById("v_brand_input").value.trim();
        model = document.getElementById("v_model_input").value.trim();
    } else {
        brand = document.getElementById("v_brand_select").value;
        model = document.getElementById("v_model_select").value;
    }

    const yearVal = document.getElementById("v_year_select").value;
    const fuel = document.getElementById("v_fuel").value;
    const variant = document.getElementById("v_variant").value.trim();
    const reg = document.getElementById("v_reg").value.trim().toUpperCase();
    const nickname = document.getElementById("v_name").value.trim();

    // Construct Name if Nickname Empty
    const name = nickname || `${brand} ${model}`;

    if (!brand || !model || !name) {
        alert("Please enter at least Brand and Model.");
        return;
    }

    const tank = parseFloat(document.getElementById("v_tank").value) || 0;

    // Enhanced Object
    const vehicleData = {
        name: name,
        brand: brand,
        model: model,
        year: yearVal,
        fuelType: fuel,
        tankCapacity: tank,
        variant: variant,
        regNumber: reg,
        isManual: isManualVehicleMode,

        // Maintenance
        serviceInterval: parseFloat(document.getElementById("v_interval").value) || 0,
        lastServiceOdo: parseFloat(document.getElementById("v_lastservice").value) || 0,
        insuranceExpiry: document.getElementById("v_insurance").value,

        // Preserve Logs if editing
        fuelLogs: editingVehicleIndex !== null ? vehicles[editingVehicleIndex].fuelLogs : [],
        serviceLogs: editingVehicleIndex !== null ? vehicles[editingVehicleIndex].serviceLogs : [],
        careData: editingVehicleIndex !== null ? vehicles[editingVehicleIndex].careData : {}
    };

    if (editingVehicleIndex !== null) {
        vehicles[editingVehicleIndex] = vehicleData;
    } else {
        vehicles.push(vehicleData);
        activeVehicleIndex = vehicles.length - 1;
    }

    saveData();
    closeVehicleModal();
    loadActiveVehicle(); // Refresh UI
    refreshVehicleSelect();

    // Auto cloud sync if online
    if (typeof Cloud !== 'undefined' && Cloud.user) Cloud.syncUp();
}

function updateVehicleBar() {
    const nameEl = document.getElementById("vehicleNameDisplay");
    const metaEl = document.getElementById("vehicleMetaDisplay");

    if (!nameEl || !metaEl) return;

    // Get current
    const v = vehicles[activeVehicleIndex];
    if (!v) return;

    nameEl.innerText = v.name || "Your Vehicle";

    const metaParts = [];
    if (v.regNumber) metaParts.push(v.regNumber);
    if (v.model) metaParts.push(v.model);
    if (v.fuelType) metaParts.push(v.fuelType);

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
// DOCUMENT VAULT LOGIC
// ===============================

function openDocModal() {
    document.getElementById("docModal").classList.add("show");
    document.getElementById("d_title").value = "";
    document.getElementById("d_file").value = "";
    document.getElementById("d_previewHelp").innerText = "";
}

function closeDocModal() {
    document.getElementById("docModal").classList.remove("show");
}

function closeViewDoc() {
    document.getElementById("viewDocModal").classList.remove("show");
}

function renderDocuments() {
    const grid = document.getElementById("docGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (!documentLogs || documentLogs.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#aaa; font-style:italic; padding:20px;">No documents saved yet.</div>';
        return;
    }

    documentLogs.forEach((doc, index) => {
        const div = document.createElement("div");
        div.className = "card";
        div.style.padding = "10px";
        div.style.textAlign = "center";

        div.innerHTML = `
            <div style="height: 100px; overflow: hidden; border-radius: 6px; margin-bottom: 10px; background: #000; display:flex; align-items:center; justify-content:center;">
                <img src="${doc.data}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${doc.title}</div>
            <button onclick="viewDocument(${index})" style="width:100%; padding: 5px; background: rgba(255,255,255,0.1); border:none; color: #38bdf8; cursor:pointer; border-radius:4px; font-size:12px;">View</button>
        `;
        grid.appendChild(div);
    });
}

async function saveDocument() {
    const title = document.getElementById("d_title").value.trim();
    const fileInput = document.getElementById("d_file");
    const file = fileInput.files[0];

    if (!title || !file) {
        alert("Please provide both a title and an image.");
        return;
    }

    // Checking 5MB limit loosely here, but compression is key
    if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Please choose an image under 5MB.");
        return;
    }

    const btn = document.querySelector("#docModal .primary-btn");
    const originalText = btn.innerText;
    btn.innerText = "Compressing & Saving...";
    btn.disabled = true;

    try {
        const compressedData = await compressImage(file);

        // Save
        documentLogs.push({
            id: Date.now(),
            title: title,
            data: compressedData
        });

        saveActiveVehicle();
        renderDocuments();
        closeDocModal();

        // Toast
        if (typeof Cloud !== 'undefined' && Cloud.showToast) {
            Cloud.showToast("Document saved securely!");
        } else {
            alert("Document saved!");
        }
    } catch (e) {
        console.error(e);
        alert("Failed to save image. It might be too large even after compression.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function viewDocument(index) {
    const doc = documentLogs[index];
    if (!doc) return;

    const modal = document.getElementById("viewDocModal");
    const img = document.getElementById("viewDocImg");
    const delBtn = document.getElementById("deleteDocBtn");

    img.src = doc.data;
    delBtn.onclick = () => deleteDocument(index);

    modal.classList.add("show");
}

function deleteDocument(index) {
    if (confirm("Are you sure you want to delete this document?")) {
        documentLogs.splice(index, 1);
        saveActiveVehicle(); // Auto syncs
        renderDocuments();
        closeViewDoc();
    }
}

// Image Compression Helper
function compressImage(file, maxWidth = 1000, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // Scale down
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to Base64 JPEG
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// ===============================
// TRIP TOOLS & SOS
// ===============================
function calculateTripCost() {
    const dist = parseFloat(document.getElementById("calc_dist").value);
    if (!dist) return;

    if (activeVehicleIndex === null || !vehicles[activeVehicleIndex]) {
        alert("Please select a vehicle first.");
        return;
    }

    const v = vehicles[activeVehicleIndex];
    let mileage = 0;
    let price = 100; // default ballpark

    // Try to get mileage from existing logs
    if (v.fuelLogs && v.fuelLogs.length > 1) {
        // Simple avg calc
        let totDist = 0;
        let totFuel = 0;
        let lastLog = v.fuelLogs[v.fuelLogs.length - 1];
        if (lastLog.price) price = lastLog.price;

        for (let i = 1; i < v.fuelLogs.length; i++) {
            totDist += (v.fuelLogs[i].odo - v.fuelLogs[i - 1].odo);
            totFuel += v.fuelLogs[i].litres;
        }
        if (totFuel > 0) mileage = totDist / totFuel;
    }

    // Fallback if no logs
    if (mileage === 0) mileage = (v.type === 'Bike') ? 40 : 15;

    const fuelNeeded = dist / mileage;
    const cost = fuelNeeded * price;

    document.getElementById("calc_result").innerText = `Est: ₹${Math.round(cost)} (${fuelNeeded.toFixed(1)}L)`;
}

function sendSOS() {
    if (!confirm("Send SOS message via WhatsApp?")) return;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
            const msg = `SOS! I am having vehicle trouble. My location: ${mapsLink}`;
            const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        }, () => {
            alert("Could not pull GPS location.");
            const msg = `SOS! I am having vehicle trouble. Call me!`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });
    } else {
        alert("Geolocation not supported.");
    }
}

function logout() {
    if (typeof Cloud !== 'undefined' && Cloud.auth) {
        Cloud.logout();
    }
    localStorage.setItem("ms_logged_in", "false");
    window.location.href = "login.html";
}

// ===============================
// TRIP MANAGER LOGIC
// ===============================
function renderTripUI() {
    if (activeVehicleIndex === null || !vehicles[activeVehicleIndex]) return;

    const v = vehicles[activeVehicleIndex];
    if (v.activeTrip) {
        document.getElementById("tripStartView").style.display = "none";
        document.getElementById("tripActiveView").style.display = "block";
        document.getElementById("t_active_name").innerText = v.activeTrip.name;

        let total = 0;
        const logDiv = document.getElementById("t_log");
        logDiv.innerHTML = "";

        v.activeTrip.expenses.forEach((ex, index) => {
            total += ex.amount;
            const row = document.createElement("div");
            row.className = "entry";
            row.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <strong>${ex.cat}</strong>
                    <span>₹${ex.amount}</span>
                </div>
                <div style="font-size:11px; color:#aaa;">${ex.desc}</div>
            `;
            logDiv.prepend(row);
        });

        document.getElementById("t_total").innerText = total;
    } else {
        document.getElementById("tripStartView").style.display = "block";
        document.getElementById("tripActiveView").style.display = "none";
    }
}

function startTrip() {
    if (activeVehicleIndex === null) { alert("Select vehicle first"); return; }

    const name = document.getElementById("t_new_name").value || "Road Trip";
    vehicles[activeVehicleIndex].activeTrip = {
        name: name,
        startDate: Date.now(),
        expenses: []
    };
    saveActiveVehicle();
    renderTripUI();
}

function addTripExpense() {
    if (activeVehicleIndex === null) return;

    const amt = parseFloat(document.getElementById("t_amt").value);
    const cat = document.getElementById("t_cat").value;
    const desc = document.getElementById("t_desc").value || cat;

    if (!amt) { alert("Enter amount"); return; }

    vehicles[activeVehicleIndex].activeTrip.expenses.push({
        amount: amt, cat, desc, date: Date.now()
    });

    document.getElementById("t_amt").value = "";
    document.getElementById("t_desc").value = "";

    saveActiveVehicle();
    renderTripUI();
}

function endTrip() {
    if (!confirm("End this trip? It will be archived to history.")) return;

    const v = vehicles[activeVehicleIndex];
    if (!v.activeTrip) return;

    // Initialize history if needed
    if (!v.tripHistory) v.tripHistory = [];

    // Archive
    v.activeTrip.endDate = Date.now();
    v.tripHistory.push(v.activeTrip);

    // Clear active
    delete v.activeTrip;

    saveActiveVehicle();
    renderTripUI();
    showToast("Trip archived to History.");
}

function showTripHistory() {
    const v = vehicles[activeVehicleIndex];
    if (!v || !v.tripHistory || v.tripHistory.length === 0) {
        alert("No past trips found.");
        return;
    }

    let msg = "Past Trips:\n";
    v.tripHistory.forEach(t => {
        const cost = t.expenses.reduce((s, x) => s + x.amount, 0);
        msg += `- ${t.name}: ₹${cost} (${new Date(t.startDate).toLocaleDateString()})\n`;
    });
    alert(msg);
}

function openSplitModal() {
    const modal = document.getElementById("splitModal");
    modal.classList.add("show");

    // Calc total
    const v = vehicles[activeVehicleIndex];
    if (v && v.activeTrip) {
        let total = v.activeTrip.expenses.reduce((sum, item) => sum + item.amount, 0);
        document.getElementById("sm_total").innerText = total;
        calcSplit();
    }
}

function calcSplit() {
    const total = parseFloat(document.getElementById("sm_total").innerText);
    const people = parseInt(document.getElementById("sm_people").value) || 1;
    document.getElementById("sm_per_person").innerText = Math.ceil(total / people);
}

function shareTripSummary() {
    const v = vehicles[activeVehicleIndex];
    if (!v || !v.activeTrip) return;

    let total = 0;
    let text = `*Trip Summary: ${v.activeTrip.name}*\n----------------\n`;
    v.activeTrip.expenses.forEach(ex => {
        text += `${ex.cat}: ₹${ex.amount} (${ex.desc})\n`;
        total += ex.amount;
    });

    const people = parseInt(document.getElementById("sm_people").value) || 1;
    const share = Math.ceil(total / people);

    text += `----------------\n*Total: ₹${total}*\n`;
    text += `Split (${people} ppl): *₹${share} / person*\n`;
    text += `\n- Sent via MS MotorMate`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// Ensure UI updates on load
// I will hook into loadActiveVehicle logic ideally, or call it manually in init.
// ===============================
// RADAR / DRIVE MODE LOGIC
// ===============================
let savedCameras = JSON.parse(localStorage.getItem("savedCameras") || "[]");
let radarWatchId = null;
let lastAlertTime = 0;

function toggleDriveMode() {
    const btn = document.getElementById("btnStartDrive");
    const statusDiv = document.getElementById("driveStatus");

    if (radarWatchId) {
        // STOP
        navigator.geolocation.clearWatch(radarWatchId);
        radarWatchId = null;
        btn.innerText = "Start Radar";
        btn.classList.remove("active");
        statusDiv.innerText = "Radar OFF";
        statusDiv.style.background = "#aaa";
        document.getElementById("driveSpeed").innerText = "0";
    } else {
        // START
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by this browser.");
            return;
        }

        radarWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, speed } = pos.coords;
                // Update UI
                const speedKmh = speed ? Math.round(speed * 3.6) : 0;
                document.getElementById("driveSpeed").innerText = speedKmh;
                document.getElementById("driveLat").innerText = "Lat: " + latitude.toFixed(4);
                document.getElementById("driveLng").innerText = "Lng: " + longitude.toFixed(4);

                checkProximity(latitude, longitude);
            },
            (err) => {
                console.error(err);
                alert("GPS Error: " + err.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 1000
            }
        );

        btn.innerText = "Stop Radar";
        btn.classList.add("active");
        statusDiv.innerText = "Scanning...";
        statusDiv.style.background = "#22c55e"; // Green
    }
}

function markCameraLocation() {
    if (!navigator.geolocation) {
        alert("GPS not supported");
        return;
    }

    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        const name = prompt("Enter Camera Name (e.g. 'MVD AI Cam Bypass')", "AI Camera");
        if (name) {
            savedCameras.push({
                id: Date.now(),
                name,
                lat: latitude,
                lng: longitude
            });
            localStorage.setItem("savedCameras", JSON.stringify(savedCameras));
            updateCameraList();
            alert("Camera location marked!");
        }
    });
}

function clearAllCameras() {
    if (confirm("Clear all marked cameras?")) {
        savedCameras = [];
        localStorage.setItem("savedCameras", "[]");
        updateCameraList();
    }
}

function updateCameraList() {
    const list = document.getElementById("cameraList");
    if (!list) return;
    list.innerHTML = "";

    if (savedCameras.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:#aaa; text-align:center;">No cameras marked. Click "Mark AI Camera" when passing one.</div>';
        return;
    }

    savedCameras.forEach(cam => {
        const div = document.createElement("div");
        div.style.padding = "8px";
        div.style.borderBottom = "1px solid #333";
        div.style.fontSize = "13px";
        div.innerHTML = `🎥 <strong>${cam.name}</strong> <br> <span style="color:#aaa;">${cam.lat.toFixed(4)}, ${cam.lng.toFixed(4)}</span>`;
        list.appendChild(div);
    });
}

function checkProximity(lat, lng) {
    const statusDiv = document.getElementById("driveStatus");
    let danger = false;
    let minDistance = 9999;

    savedCameras.forEach(cam => {
        const d = getDistanceFromLatLonInKm(lat, lng, cam.lat, cam.lng);
        if (d < 0.5) { // 500 meters
            danger = true;
            if (d < minDistance) minDistance = d;
        }
    });

    if (danger) {
        statusDiv.innerText = `⚠️ AI CAMERA AHEAD (${(minDistance * 1000).toFixed(0)}m) ⚠️`;
        statusDiv.style.background = "#ef4444"; // Red

        // Alert Sound (Throttle to every 5s)
        const now = Date.now();
        if (now - lastAlertTime > 5000) {
            playAlertSound();
            lastAlertTime = now;
        }
    } else {
        statusDiv.innerText = "SAFE - No Cameras Nearby";
        statusDiv.style.background = "#22c55e"; // Green
    }
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function playAlertSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.2);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) { console.error("Audio error", e); }
}


// ===============================
// OBD-II / CONNECT CAR LOGIC
// ===============================
let obdInterval = null;
let isObdConnected = false;

function connectToOBD() {
    // Check if API available
    if (!navigator.bluetooth) {
        // Fallback to demo mode immediately
        startOBDDemo("Bluetooth API not available. Starting Demo Mode.");
        return;
    }

    navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 0xfff0] // Standard OBD services often vary
    })
        .then(device => {
            showToast(`Connected to ${device.name}!`);
            isObdConnected = true;
            document.getElementById("obd_dot").style.background = "#4ade80"; // Green
            document.getElementById("obd_dot").style.boxShadow = "0 0 8px #4ade80";
            startOBDLoop(); // Ideally we read characteristics here
        })
        .catch(error => {
            console.log(error);
            startOBDDemo("Connection failed/cancelled. Starting Demo Mode.");
        });
}

function startOBDDemo(msg) {
    showToast(msg);
    isObdConnected = false; // It's demo
    document.getElementById("obd_dot").style.background = "#fbbf24"; // Orange (Demo)
    document.getElementById("obd_dot").style.boxShadow = "0 0 8px #fbbf24";
    startOBDLoop();
}

function startOBDLoop() {
    const modal = document.getElementById("liveDataModal");
    modal.classList.add("show");

    if (obdInterval) clearInterval(obdInterval);

    obdInterval = setInterval(() => {
        // Simulated Data (since we don't have real parser yet)
        const rpm = Math.floor(Math.random() * (3000 - 800) + 800);
        const speed = Math.floor(Math.random() * 80);
        const temp = Math.floor(Math.random() * (95 - 85) + 85);
        const batt = (Math.random() * (14.4 - 13.5) + 13.5).toFixed(1);

        document.getElementById("live_rpm").innerText = rpm;
        document.getElementById("live_speed").innerText = speed;
        document.getElementById("live_temp").innerText = temp + "°C";
        document.getElementById("live_batt").innerText = batt + "v";

        // Update Drive Mode Speed too if active
        if (document.getElementById("drive").style.display === "block") {
            const driveSpeed = document.getElementById("driveSpeed");
            if (driveSpeed) driveSpeed.innerText = speed;
        }

    }, 1000);
}

function disconnectOBD() {
    if (obdInterval) clearInterval(obdInterval);
    document.getElementById("liveDataModal").classList.remove("show");

    document.getElementById("obd_dot").style.background = "#ef4444"; // Red
    document.getElementById("obd_dot").style.boxShadow = "0 0 5px #ef4444";

    showToast("Disconnected.");
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
renderDocuments(); // init docs
updateCameraList(); // init cameras

// Splash hide
window.addEventListener("load", () => {
    setTimeout(() => {
        document.body.classList.add("splash-done");
    }, 1500);
});