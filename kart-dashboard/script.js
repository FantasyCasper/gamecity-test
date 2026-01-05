/* =======================================================
   UNIVERSEEL DEFECTEN DASHBOARD SCRIPT
   Voor: Karts, Lasergame & Prison Island
   ======================================================= */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

// --- CONFIGURATIE PER ACTIVITEIT ---
// Hier bepaal je hoe elk dashboard zich gedraagt
const CONFIG = {
    kart: {
        titel: "Kart Defecten",
        itemNaam: "Kart",       // Bijv: "Kart 5"
        settingKey: "totaal_karts", // Key in de 'Instellingen' sheet
        defaultTotaal: 48       // Fallback als instellingen niet laden
    },
    lasergame: {
        titel: "Lasergame Defecten",
        itemNaam: "Pak",        // Bijv: "Pak 5"
        settingKey: "totaal_lasergame",
        defaultTotaal: 24
    },
    prisonisland: {
        titel: "Prison Island Defecten",
        itemNaam: "Cel",        // Bijv: "Cel 5"
        settingKey: "totaal_pi",
        defaultTotaal: 24
    }
};

// Globale Variabelen
let ingelogdeNaam = "";
let ingelogdePermissies = {};
let alleDefecten = []; // Cache van opgehaalde data
let ACTIVE_TYPE = 'kart'; // Huidige geselecteerde dashboard (standaard kart)
let TOTAAL_ITEMS = 40; // Wordt overschreven door instellingen

/* ===============================
   DEEL 1: INITIALISATIE
   =============================== */
(function () {
    // 1. Login Check
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    const rawPerms = localStorage.getItem('ingelogdePermissies');

    if (!ingelogdeNaam || !rawPerms) {
        window.location.href = "../login/"; // Stuur terug naar login als niet ingelogd
        return;
    }
    ingelogdePermissies = JSON.parse(rawPerms);

    // 2. Manager UI aanpassingen (TD/Admin zien meer)
    if (ingelogdePermissies.admin || ingelogdePermissies.td) {
        document.body.classList.add('is-manager');
    }

    // 3. Modules opstarten
    setupDefectForm();
    setupEditModal();
    setupKartFilter(); // (Naam is oud, maar werkt universeel)

    // 4. Start het dashboard (kijk of er een ?type=... in de URL staat, anders karts)
    const urlParams = new URLSearchParams(window.location.search);
    const startType = urlParams.get('type');
    
    if(startType && CONFIG[startType]) {
        switchDashboard(startType);
    } else {
        switchDashboard('kart');
    }

})();


/* ===============================
   DEEL 2: SCHAKELEN TUSSEN DASHBOARDS
   ================================ */
window.switchDashboard = function(type) {
    if (!CONFIG[type]) return; // Veiligheidscheck

    ACTIVE_TYPE = type;
    const conf = CONFIG[type];

    // 1. Update de Titel & Navigatieknoppen
    const titleEl = document.getElementById('dashboard-title');
    if(titleEl) titleEl.textContent = conf.titel;

    document.querySelectorAll('.defect-nav-btn').forEach(btn => {
        btn.classList.remove('active');
        // Check of de knop tekst overeenkomt met het type (simpele check)
        const btnText = btn.innerText.toLowerCase();
        if (btnText.includes(type === 'prisonisland' ? 'prison' : type)) {
            btn.classList.add('active');
        }
    });

    // 2. Update de URL (zonder te herladen) voor als je F5 drukt
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?type=' + type;
    window.history.pushState({path:newUrl}, '', newUrl);

    // 3. Haal instellingen op (Aantal items) en laad daarna de data
    haalInstellingenOp(conf.settingKey, conf.defaultTotaal);
}


/* ===============================
   DEEL 3: DATA OPHALEN & VERWERKEN
   =============================== */
function haalInstellingenOp(key, fallback) {
    // Zet eerst de fallback, zodat we direct door kunnen
    TOTAAL_ITEMS = fallback;
    
    // Probeer echte instellingen te halen (asynchroon)
    callApi("GET_SETTINGS").then(res => {
        if(res.data && res.data[key]) {
            TOTAAL_ITEMS = parseInt(res.data[key]);
        }
        // Nu we het aantal weten, laden we de defecten en de dropdowns
        laadDefectenDashboard();
    }).catch(err => {
        console.warn("Instellingen niet geladen, gebruik fallback.", err);
        laadDefectenDashboard();
    });
}

function laadDefectenDashboard() {
    // Toon "Laden..." animatie
    toonSkeletonKaarten('defect-card-container', 4);

    // Vraag defecten op voor het actieve type
    const payload = { type: "GET_OBJECT_DEFECTS", subType: ACTIVE_TYPE };

    callApi(payload)
        .then(result => {
            alleDefecten = result.data;
            updateUI(); // Teken alles op het scherm
        })
        .catch(error => {
            document.getElementById('defect-card-container').innerHTML = `<p style="color: red; text-align:center;">Fout bij laden: ${error.message}</p>`;
        });
}

function updateUI() {
    const conf = CONFIG[ACTIVE_TYPE];

    // 1. Dropdowns verversen (Kart 1..40 of Cel 1..25)
    vulDropdowns(conf.itemNaam, TOTAAL_ITEMS);

    // 2. Statistieken berekenen
    const openDefecten = alleDefecten.filter(d => d.status === 'Open');
    // Gebruik Set om unieke nummers te tellen (als Kart 5 twee defecten heeft, telt hij als 1 kapotte kart)
    const uniekeKapotteItems = [...new Set(openDefecten.map(d => d.nummer))];

    const aantalKapot = uniekeKapotteItems.length;
    const aantalWerkend = TOTAAL_ITEMS - aantalKapot;

    // Update de boxen
    document.getElementById('stat-totaal').textContent = TOTAAL_ITEMS;
    document.getElementById('stat-label-totaal').textContent = `Totaal ${conf.itemNaam}s`; // "Totaal Karts"

    document.getElementById('stat-problemen').textContent = aantalKapot;
    document.getElementById('stat-label-probleem').textContent = `Defecte ${conf.itemNaam}s`;

    document.getElementById('stat-werkend').textContent = aantalWerkend;
    document.getElementById('stat-label-werkend').textContent = `Werkende ${conf.itemNaam}s`;

    // 3. Kaarten tekenen
    renderDefectCards(alleDefecten);
}

function vulDropdowns(naam, totaal) {
    const ids = ['new-defect-kart', 'edit-kart-select', 'filter-kart-select'];
    
    ids.forEach(id => {
        const select = document.getElementById(id);
        if(!select) return;

        // Reset
        let eersteOptieTekst = (id === 'filter-kart-select') ? "Alles Tonen" : `Kies ${naam}...`;
        select.innerHTML = `<option value="">${eersteOptieTekst}</option>`;

        for (let i = 1; i <= totaal; i++) {
            select.add(new Option(`${naam} ${i}`, i));
        }
    });
}


/* ===============================
   DEEL 4: KAARTEN RENDEREN
   =============================== */
function renderDefectCards(defects) {
    const container = document.getElementById("defect-card-container");
    container.innerHTML = "";
    
    const actieveDefecten = defects.filter(d => d.status !== 'Verwijderd');

    if (actieveDefecten.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888; margin-top:20px;'>Geen defecten gevonden. Alles werkt!</p>"; 
        return;
    }

    // Sorteren: Open eerst, daarna Opgelost
    actieveDefecten.sort((a, b) => ("Open" === a.status ? -1 : 1) - ("Open" === b.status ? -1 : 1));

    actieveDefecten.forEach(defect => {
        const conf = CONFIG[ACTIVE_TYPE];
        const ts = tijdGeleden(defect.timestamp);
        
        const kaart = document.createElement("div");
        kaart.className = "defect-card";
        if (defect.status === "Opgelost") kaart.classList.add("status-opgelost");

        // Edit/Delete Rechten Check
        let editKnopHtml = '';
        const isEigenaar = (defect.medewerker === ingelogdeNaam);
        // Eigenaar mag binnen 24u bewerken. TD/Admin mag altijd alles.
        const isVers = (Date.now() - new Date(defect.timestamp).getTime() < 86400000);
        const isTD = ingelogdePermissies.td || ingelogdePermissies.admin;

        if ((isEigenaar && defect.status === "Open" && isVers) || isTD) {
            // We stoppen alle data in data-attributen zodat de modal ze kan lezen
            editKnopHtml = `
                <button class="edit-icon-btn" 
                        data-row-id="${defect.rowId}" 
                        data-nummer="${defect.nummer}" 
                        data-omschrijving="${escapeHtml(defect.defect)}"
                        data-status="${defect.status}"
                        data-benodigdheden="${escapeHtml(defect.benodigdheden || '')}"
                        data-onderdelen="${escapeHtml(defect.onderdelenStatus || '')}"
                        onclick="openEditModal(this.dataset)">
                    ✎
               </button>`;
        }

        // Extra info tonen (TD info)
        let extraInfo = '';
        if (defect.benodigdheden) extraInfo += `<div style="font-size: 0.85em; color: #ffc107; margin-top:5px;">🛠️ Nodig: ${defect.benodigdheden}</div>`;
        if (defect.onderdelenStatus) extraInfo += `<div style="font-size: 0.85em; color: #2ecc71;">📦 Onderdeel: ${defect.onderdelenStatus}</div>`;

        kaart.innerHTML = `
            <h3>${conf.itemNaam} ${defect.nummer}</h3>
            <div class="meta">
                <span class="meta-item">👤 ${defect.medewerker}</span>
                <span class="meta-item">🕒 ${ts}</span>
                <span class="meta-item">Status: <strong>${defect.status}</strong></span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
            ${extraInfo}
            ${editKnopHtml}
        `;
        container.appendChild(kaart);
    });
}


/* ===============================
   DEEL 5: FORMULIEREN (MELDEN & MODAL)
   =============================== */

function setupDefectForm() {
    const form = document.getElementById('new-defect-form');
    if(!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        
        const nummer = document.getElementById('new-defect-kart').value;
        const omschrijving = document.getElementById('new-defect-problem').value.trim();
        const btn = document.getElementById('new-defect-submit');

        if (!nummer || !omschrijving) {
            toonDefectStatus("Vul alles in aub.", "error");
            return;
        }
        
        btn.disabled = true; 
        btn.textContent = "Versturen...";

        // BELANGRIJK: subType meesturen!
        const payload = { 
            type: "LOG_OBJECT_DEFECT", 
            subType: ACTIVE_TYPE,
            medewerker: ingelogdeNaam, 
            nummer: nummer, 
            defect: omschrijving 
        };

        callApi(payload).then(() => {
            toonDefectStatus("Gemeld!", "success");
            form.reset(); 
            laadDefectenDashboard();
        }).catch(err => {
            toonDefectStatus(err.message, "error");
        }).finally(() => { 
            btn.disabled = false; 
            btn.textContent = "+ Toevoegen"; 
        });
    });
}

function setupEditModal() {
    // Sluit knoppen (Annuleren)
    const overlay = document.getElementById('modal-overlay');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const editForm = document.getElementById('edit-defect-form');

    const sluit = () => {
        document.getElementById('edit-modal').style.display = 'none';
        overlay.style.display = 'none';
    };

    if(cancelBtn) cancelBtn.onclick = sluit;
    if(overlay) overlay.onclick = (e) => { if(e.target === overlay) sluit(); };

    // Formulier Opslaan (Update Extended)
    if(editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('modal-save-btn');
            btn.disabled = true; btn.textContent = "Opslaan...";

            const payload = {
                type: "UPDATE_OBJECT_EXTENDED",
                subType: ACTIVE_TYPE, // Welk tabblad?
                rowId: document.getElementById('edit-row-id').value,
                newNummer: document.getElementById('edit-kart-select').value,
                newText: document.getElementById('edit-defect-omschrijving').value,
                benodigdheden: document.getElementById('edit-benodigdheden').value,
                onderdelenStatus: document.getElementById('edit-onderdelen-status').value
            };

            callApi(payload).then(() => {
                toonDefectStatus("Opgeslagen.", "success");
                sluit();
                laadDefectenDashboard();
            }).catch(err => alert("Fout: " + err.message))
              .finally(() => { btn.disabled = false; btn.textContent = "Opslaan"; });
        });
    }

    // Markeer Opgelost
    const resolveBtn = document.getElementById('modal-resolve-btn');
    if(resolveBtn) {
        resolveBtn.onclick = function() {
            updateStatus(document.getElementById('edit-row-id').value, "Opgelost", sluit);
        };
    }

    // Verwijder
    const deleteBtn = document.getElementById('modal-delete-btn');
    if(deleteBtn) {
        deleteBtn.onclick = function() {
            if(confirm("Weet je zeker dat je dit defect wilt verwijderen?")) {
                updateStatus(document.getElementById('edit-row-id').value, "Verwijderd", sluit);
            }
        };
    }
}

// Functie wordt aangeroepen door de onclick in de HTML knop
window.openEditModal = function(dataset) {
    // Velden vullen
    document.getElementById('edit-row-id').value = dataset.rowId;
    document.getElementById('edit-kart-select').value = dataset.nummer; // Let op: dataset.nummer
    document.getElementById('edit-defect-omschrijving').value = dataset.omschrijving; // Is al escaped?
    
    // TD velden (indien aanwezig)
    const benod = document.getElementById('edit-benodigdheden');
    const onder = document.getElementById('edit-onderdelen-status');
    if(benod) benod.value = dataset.benodigdheden || '';
    if(onder) onder.value = dataset.onderdelen || '';

    // TD Sectie tonen/verbergen
    const tdSection = document.getElementById('td-fields');
    const modalBox = document.getElementById('edit-modal');
    const isTD = ingelogdePermissies.td || ingelogdePermissies.admin;

    if (tdSection) {
        if (isTD) {
            tdSection.style.display = 'block';
            if(modalBox) modalBox.classList.add('wide-mode');
        } else {
            tdSection.style.display = 'none';
            if(modalBox) modalBox.classList.remove('wide-mode');
        }
    }

    // Delete knop tonen?
    const delBtn = document.getElementById('modal-delete-btn');
    if(delBtn) delBtn.style.display = (isTD) ? 'block' : 'none'; // Alleen TD mag verwijderen in dit ontwerp

    // Openen
    if(modalBox) modalBox.style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';
}

function updateStatus(rowId, newStatus, callback) {
    callApi({
        type: "UPDATE_OBJECT_STATUS",
        subType: ACTIVE_TYPE,
        rowId: rowId,
        newStatus: newStatus
    }).then(() => {
        toonDefectStatus("Status: " + newStatus, "success");
        if(callback) callback();
        laadDefectenDashboard();
    }).catch(err => alert(err.message));
}


/* ===============================
   DEEL 6: HELPERS (FILTER, API, TIJD)
   =============================== */

function setupKartFilter() {
    const filterSelect = document.getElementById('filter-kart-select');
    if(!filterSelect) return;

    filterSelect.addEventListener('change', function() {
        const val = this.value;
        if(val === "") {
            renderDefectCards(alleDefecten);
        } else {
            // Filter op nummer. Let op: nummer in data is vaak number, value is string.
            const gefilterd = alleDefecten.filter(d => d.nummer == val);
            renderDefectCards(gefilterd);
        }
    });
}

async function callApi(payload) {
    // Permissies altijd meesturen
    if (typeof ingelogdePermissies !== 'undefined') {
        payload.perms = ingelogdePermissies;
    }

    const url = WEB_APP_URL + "?v=" + new Date().getTime(); // Cache buster
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    
    const result = await response.json();
    if (result.status === "success") return result;
    else throw new Error(result.message);
}

function toonSkeletonKaarten(containerId, aantal) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = "";
    for (let i = 0; i < aantal; i++) {
        html += `
        <div class="defect-card skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 60%"></div>
        </div>`;
    }
    container.innerHTML = html;
}

function toonDefectStatus(msg, type) {
    const el = document.getElementById('status-message-defect');
    if(!el) return;
    el.textContent = (type === 'success' ? '✅ ' : '⚠️ ') + msg;
    el.className = 'status-bericht ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function tijdGeleden(dateString) {
    const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (diff < 60) return "Zojuist";
    if (diff < 3600) return Math.floor(diff / 60) + "m geleden";
    if (diff < 86400) return Math.floor(diff / 3600) + "u geleden";
    return Math.floor(diff / 86400) + "d geleden";
}