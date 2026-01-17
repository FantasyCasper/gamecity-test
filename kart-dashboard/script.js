/* =======================================================
   UNIVERSEEL DEFECTEN DASHBOARD SCRIPT
   Locatie: kart-dashboard/script.js
   ======================================================= */

window.onerror = function(msg, url, line, col, error) {
    console.error("❌ JS ERROR:", msg, "op", line + ":" + col);
};

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

// --- CONFIGURATIE PER ACTIVITEIT ---
const CONFIG = {
    kart: {
        titel: "Kart Defecten",
        itemNaam: "Kart",       // Bijv: "Kart 5"
        settingKey: "totaal_karts",
        defaultTotaal: 40
    },
    lasergame: {
        titel: "Lasergame Defecten",
        itemNaam: "Pak",        // Bijv: "Pak 5"
        settingKey: "totaal_lasergame",
        defaultTotaal: 20
    },
    prisonisland: {
        titel: "Prison Island Defecten",
        itemNaam: "Cel",        // Bijv: "Cel 5"
        settingKey: "totaal_pi",
        defaultTotaal: 25
    }
};

// Globale Variabelen
let ingelogdeNaam = "";
let ingelogdePermissies = {};
let alleDefecten = []; 
let ACTIVE_TYPE = 'kart'; // Huidige tabblad
let TOTAAL_ITEMS = 40; 

/* ===============================
   DEEL 1: SCHAKELEN TUSSEN DASHBOARDS
   ================================ */
// Deze functie staat op 'window' zodat de HTML knoppen hem kunnen vinden
window.switchDashboard = function(type) {
    if (!CONFIG[type]) type = 'kart';

    ACTIVE_TYPE = type;
    const conf = CONFIG[type];

    // Titel
    const titleEl = document.getElementById('dashboard-title');
    if (titleEl) titleEl.textContent = conf.titel;

    // Menu actief
    document.querySelectorAll('.defect-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // URL bijwerken
    const newUrl =
        window.location.protocol +
        "//" +
        window.location.host +
        window.location.pathname +
        '?type=' + type;

    window.history.replaceState({}, '', newUrl);

    // Instellingen + data laden
    haalInstellingenOp(conf.settingKey, conf.defaultTotaal);
};

/* ===============================
   DEEL 2: INITIALISATIE
   =============================== */
(function () {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    const rawPerms = localStorage.getItem('ingelogdePermissies');

    if (!ingelogdeNaam || !rawPerms) {
        window.location.href = "../login/";
        return;
    }

    ingelogdePermissies = JSON.parse(rawPerms);

    if (ingelogdePermissies.admin || ingelogdePermissies.td) {
        document.body.classList.add('is-manager');
    }

    setupDefectForm();
    setupEditModal();
    setupFilters();

    const urlParams = new URLSearchParams(window.location.search);
    const startType = urlParams.get('type');

    switchDashboard(startType && CONFIG[startType] ? startType : 'kart');
})();

/* ===============================
   DEEL 3: DATA OPHALEN
   =============================== */

function haalInstellingenOp(key, fallback) {
    TOTAAL_ITEMS = fallback;
    
    callApi({ type: "GET_SETTINGS" }) 
        .then(res => {
            if(res.data && res.data[key]) {
                TOTAAL_ITEMS = parseInt(res.data[key]);
            }
            laadDefectenDashboard();
        })
        .catch(err => {
            console.warn("Instellingen niet geladen, gebruik fallback.", err);
            laadDefectenDashboard();
        });
}

function laadDefectenDashboard() {
    // Zet een laad-melding of skeleton
    const container = document.getElementById('defect-card-container');
    container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Gegevens laden...</div>';

    // Vraag defecten op voor het actieve type
    const payload = { type: "GET_OBJECT_DEFECTS", subType: ACTIVE_TYPE };

    callApi(payload)
        .then(result => {
            alleDefecten = result.data;
            updateUI(); // Teken alles
        })
        .catch(error => {
            container.innerHTML = `<p style="color: red; text-align:center;">Fout bij laden: ${error.message}</p>`;
        });
}

function updateUI() {
    const conf = CONFIG[ACTIVE_TYPE];

    // 1. Dropdowns verversen
    vulDropdowns(conf.itemNaam, TOTAAL_ITEMS);

    // 2. Statistieken berekenen
    const openDefecten = alleDefecten.filter(d => d.status === 'Open');
    // Unieke items tellen (bijv. Kart 5 telt maar 1x mee, ook al zijn er 3 meldingen over)
    const uniekeKapotteItems = [...new Set(openDefecten.map(d => d.nummer))];

    const aantalKapot = uniekeKapotteItems.length;
    const aantalWerkend = TOTAAL_ITEMS - aantalKapot;

    // 3. Update de boxen
    document.getElementById('stat-totaal').textContent = TOTAAL_ITEMS;
    document.getElementById('stat-label-totaal').textContent = `Totaal ${conf.itemNaam}s`;

    document.getElementById('stat-problemen').textContent = aantalKapot;
    document.getElementById('stat-label-probleem').textContent = `Defecte ${conf.itemNaam}s`;

    document.getElementById('stat-werkend').textContent = aantalWerkend;
    document.getElementById('stat-label-werkend').textContent = `Werkende ${conf.itemNaam}s`;

    // 4. Kaarten tekenen
    renderCards(alleDefecten);
}

function vulDropdowns(naam, totaal) {
    const ids = ['new-defect-kart', 'edit-kart-select', 'filter-kart-select'];
    
    ids.forEach(id => {
        const select = document.getElementById(id);
        if(!select) return;

        // Bepaal de standaard tekst
        let eersteOptie = (id === 'filter-kart-select') ? "Alle nummers" : `Kies ${naam}...`;
        
        select.innerHTML = `<option value="">${eersteOptie}</option>`;
        for (let i = 1; i <= totaal; i++) {
            select.add(new Option(`${naam} ${i}`, i));
        }
    });
}


/* ===============================
   DEEL 4: KAARTEN RENDERING
   =============================== */
function renderCards(lijst) {
    const container = document.getElementById("defect-card-container");
    container.innerHTML = "";
    
    // Filters toepassen (vanuit UI)
    const filterStatusEl = document.getElementById('filter-status');
const filterStatus = filterStatusEl ? filterStatusEl.value : "";
    const filterNummer = document.getElementById('filter-kart-select').value;
    
    let items = lijst.filter(d => d.status !== 'Verwijderd');
    
    if(filterStatus) items = items.filter(d => d.status === filterStatus);
    if(filterNummer) items = items.filter(d => d.nummer == filterNummer);

    if (items.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888; margin-top:20px;'>Geen defecten gevonden.</p>"; 
        return;
    }

    // Sorteren: Open eerst
    items.sort((a, b) => ("Open" === a.status ? -1 : 1) - ("Open" === b.status ? -1 : 1));

    items.forEach(defect => {
        const conf = CONFIG[ACTIVE_TYPE];
        
        const kaart = document.createElement("div");
        kaart.className = "defect-card";
        if (defect.status === "Opgelost") kaart.classList.add("status-opgelost");

        // --- Rechten Logica ---
        let editKnopHtml = '';
        const isEigenaar = (defect.medewerker === ingelogdeNaam);
        const isVers = (Date.now() - new Date(defect.timestamp).getTime() < 86400000); // 24 uur
        const isTD = ingelogdePermissies.td || ingelogdePermissies.admin;

        // Potloodje tonen als: (Eigen melding & Open & <24u) OF (TD/Admin)
        if ((isEigenaar && defect.status === "Open" && isVers) || isTD) {
            // We geven het hele object mee aan de modal functie
            // We gebruiken escape om quotes in tekst niet te breken
            const jsonString = JSON.stringify(defect).replace(/'/g, "&#39;");
            editKnopHtml = `<button class="edit-icon-btn" onclick='openEditModal(${jsonString})'>✎</button>`;
        }

        // Extra info (TD velden)
        let extraInfo = '';
        if (defect.benodigdheden) extraInfo += `<div style="font-size: 0.85em; color: #ffc107; margin-top:5px;">🛠️ Nodig: ${defect.benodigdheden}</div>`;
        if (defect.onderdelenStatus) extraInfo += `<div style="font-size: 0.85em; color: #2ecc71;">📦 ${defect.onderdelenStatus}</div>`;

        kaart.innerHTML = `
            <h3>${conf.itemNaam} ${defect.nummer}</h3>
            <div class="meta">
                <span>👤 ${defect.medewerker}</span>
                <span>🕒 ${tijdGeleden(defect.timestamp)}</span>
                <span>Status: <strong>${defect.status}</strong></span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
            ${extraInfo}
            ${editKnopHtml}
        `;
        container.appendChild(kaart);
    });
}


/* ===============================
   DEEL 5: FORMULIEREN & MODAL
   =============================== */

function setupDefectForm() {
    const form = document.getElementById('new-defect-form');
    if(!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        
        const nummer = document.getElementById('new-defect-kart').value;
        const omschrijving = document.getElementById('new-defect-problem').value.trim();
        const btn = document.getElementById('new-defect-submit');

        if (!nummer || !omschrijving) return;
        
        btn.disabled = true; btn.textContent = "Versturen...";

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
            btn.disabled = false; btn.textContent = "+ Toevoegen"; 
        });
    });
}

// Functie om de modal te openen (aangeroepen vanuit HTML button)
window.openEditModal = function(d) {
    // Velden vullen
    document.getElementById('edit-row-id').value = d.rowId;
    document.getElementById('edit-kart-select').value = d.nummer;
    document.getElementById('edit-defect-omschrijving').value = d.defect;
    
    // TD velden
    document.getElementById('edit-benodigdheden').value = d.benodigdheden || '';
    document.getElementById('edit-onderdelen-status').value = d.onderdelenStatus || '';

    // Layout aanpassen voor TD
    const isTD = ingelogdePermissies.td || ingelogdePermissies.admin;
    const tdSec = document.getElementById('td-fields');
    const modalBox = document.getElementById('edit-modal');
    const delBtn = document.getElementById('modal-delete-btn');

    if (tdSec) tdSec.style.display = isTD ? 'block' : 'none';
    if (delBtn) delBtn.style.display = isTD ? 'block' : 'none';
    
    // 'Wide mode' voor desktop als TD velden zichtbaar zijn
    if (modalBox) {
        if(isTD) modalBox.classList.add('wide-mode');
        else modalBox.classList.remove('wide-mode');
    }

    // Openen
    document.getElementById('edit-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';
}

function setupEditModal() {
    const sluit = () => { 
        document.getElementById('edit-modal').style.display = 'none'; 
        document.getElementById('modal-overlay').style.display = 'none'; 
    };

    // Sluit knoppen
    document.getElementById('modal-cancel-btn').onclick = sluit;
    document.getElementById('modal-overlay').onclick = sluit;
    // (Optioneel kruisje als je die hebt toegevoegd in HTML)
    const closeBtn = document.getElementById('modal-close-btn');
    if(closeBtn) closeBtn.onclick = sluit;

    // Opslaan
    document.getElementById('edit-defect-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const btn = document.getElementById('modal-save-btn');
        btn.disabled = true; btn.textContent = "...";

        const payload = {
            type: "UPDATE_OBJECT_EXTENDED",
            subType: ACTIVE_TYPE,
            rowId: document.getElementById('edit-row-id').value,
            newNummer: document.getElementById('edit-kart-select').value,
            newText: document.getElementById('edit-defect-omschrijving').value,
            benodigdheden: document.getElementById('edit-benodigdheden').value,
            onderdelenStatus: document.getElementById('edit-onderdelen-status').value,
            newStatus: "Open" // Standaard blijft hij open bij bewerken
        };

        callApi(payload).then(() => {
            toonDefectStatus("Opgeslagen.", "success");
            sluit();
            laadDefectenDashboard();
        }).catch(err => alert("Fout: " + err.message))
          .finally(() => { btn.disabled = false; btn.textContent = "Opslaan"; });
    });

    // Oplossen
    document.getElementById('modal-resolve-btn').onclick = function() {
        if(confirm("Markeren als Opgelost?")) {
            updateStatus(document.getElementById('edit-row-id').value, "Opgelost", sluit);
        }
    };

    // Verwijderen
    document.getElementById('modal-delete-btn').onclick = function() {
        if(confirm("Definitief verwijderen?")) {
            updateStatus(document.getElementById('edit-row-id').value, "Verwijderd", sluit);
        }
    };
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

function setupFilters() {
    const s1 = document.getElementById('filter-status');
    const s2 = document.getElementById('filter-kart-select');
    if(s1) s1.addEventListener('change', () => renderCards(alleDefecten));
    if(s2) s2.addEventListener('change', () => renderCards(alleDefecten));
}


/* ===============================
   HELPERS
   =============================== */
async function callApi(payload) {
    if (typeof ingelogdePermissies !== 'undefined') {
        payload.perms = ingelogdePermissies;
    }
    const url = WEB_APP_URL + "?v=" + Date.now();
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status === "success") return result;
    else throw new Error(result.message);
}

function toonDefectStatus(msg, type) {
    const el = document.getElementById('status-message-defect');
    if(!el) return;
    el.textContent = (type === 'success' ? '✅ ' : '⚠️ ') + msg;
    el.className = 'status-bericht ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function tijdGeleden(s) {
    const d = Math.floor((new Date() - new Date(s)) / 1000);
    if (d < 60) return "Zojuist";
    if (d < 3600) return Math.floor(d / 60) + "m";
    if (d < 86400) return Math.floor(d / 3600) + "u";
    return Math.floor(d / 86400) + "d";
}