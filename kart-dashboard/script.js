/* ===============================
   KART DASHBOARD SCRIPT (MET EDIT-FUNCTIE)
   =============================== */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykI7IjMAeUFrMhJJwFAIV7gvbdjhe1vqNLr1WRevW4Mee0M7v_Nw8P2H6IhzemydogHw/exec";

let ingelogdeNaam = "";
let ingelogdeRol = "";
let alleDefecten = []; 

// --- DEEL 1: DE "BEWAKER" ---
(function() {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    ingelogdeRol = localStorage.getItem('ingelogdeRol');
    if (!ingelogdeNaam || !ingelogdeRol) {
        alert("Je bent niet ingelogd."); window.location.href = "../login/"; return; 
    } 
    
    if (ingelogdeRol === 'manager') {
        document.body.classList.add('is-manager'); 
    }
    
    vulKartMeldDropdown(); 
    setupDefectForm();
    laadDefectenDashboard(); 
    setupKartFilter();

})(); 

// --- DEEL 2: FUNCTIES ---

function vulKartMeldDropdown() {
    const kartSelect = document.getElementById('new-defect-kart');
    if (!kartSelect) return; 
    for (let i = 1; i <= 40; i++) {
        kartSelect.add(new Option(`Kart ${i}`, i));
    }
}

function setupDefectForm() { // Kart defect
    const defectForm = document.getElementById('new-defect-form'); 
    if (!defectForm) return;
    const defectButton = document.getElementById('new-defect-submit'); 
    
    defectForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const kartNummer = document.getElementById('new-defect-kart').value; 
        const omschrijving = document.getElementById('new-defect-problem').value.trim(); 
        if (kartNummer === "" || omschrijving === "") {
            toonDefectStatus("Selecteer een kart en vul een omschrijving in.", "error"); return;
        }
        defectButton.disabled = true; defectButton.textContent = "Bezig...";
        const payload = { type: "LOG_DEFECT", medewerker: ingelogdeNaam, kartNummer: kartNummer, defect: omschrijving };
        
        callApi(payload)
            .then(data => {
                toonDefectStatus("Defect succesvol gemeld!", "success");
                defectForm.reset(); laadDefectenDashboard(); 
            })
            .catch(error => {
                toonDefectStatus(error.message || "Melden mislukt", "error");
            })
            .finally(() => {
                defectButton.disabled = false; defectButton.textContent = "+ Toevoegen";
            });
    });
}

function laadDefectenDashboard() {
    callApi({ type: "GET_DEFECTS" })
    .then(result => {
        alleDefecten = result.data; 
        updateStatBoxes(alleDefecten);
        renderDefectCards(alleDefecten); 
        setupDashboardListeners(); 
    })
    .catch(error => {
        if(document.getElementById('defect-card-container')) {
            document.getElementById('defect-card-container').innerHTML = `<p style="color: red;">Kon defecten niet laden: ${error.message}</p>`;
        }
    });
}

function updateStatBoxes(defects) {
    const openDefecten = defects.filter(d => d.status === 'Open');
    const uniekeKartsMetProbleem = [...new Set(openDefecten.map(d => d.kartNummer))];
    document.getElementById('stat-karts-problemen').textContent = uniekeKartsMetProbleem.length;
    document.getElementById('stat-werkende-karts').textContent = 40 - uniekeKartsMetProbleem.length;
}

function setupKartFilter() {
    const statusFilter = document.getElementById('filter-status');
    const wisButton = document.getElementById('filter-wissen-btn');
    function pasFiltersToe() {
        const geselecteerdeStatus = statusFilter.value;
        let gefilterdeLijst = alleDefecten;
        if (geselecteerdeStatus !== 'alle') {
            gefilterdeLijst = gefilterdeLijst.filter(d => d.status.toLowerCase() === geselecteerdeStatus);
        }
        renderDefectCards(gefilterdeLijst);
    }
    statusFilter.addEventListener('change', pasFiltersToe);
    wisButton.addEventListener('click', () => {
        statusFilter.value = 'open'; pasFiltersToe();
    });
}

// ========================
//  RENDER DEFECT CARDS (BIJGEWERKT)
// ========================
function renderDefectCards(defects){
    const container = document.getElementById("defect-card-container");
    if (!container) return;
    container.innerHTML = ""; 
    if (defects.length === 0) {
        container.innerHTML = "<p>Geen defecten gevonden voor deze selectie.</p>"; return;
    }
    defects.sort((a, b) => ("Open" === a.status ? -1 : 1) - ("Open" === b.status ? -1 : 1));
    defects.forEach(defect => {
        const ts = new Date(defect.timestamp).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
        const kaart = document.createElement("div");
        kaart.className = "defect-card";
        if (defect.status === "Opgelost") { kaart.classList.add("status-opgelost"); }
        
        let editKnopHtml = '';
        const isEigenaar = (defect.medewerker === ingelogdeNaam);
        const isBinnen24Uur = (Date.now() - new Date(defect.timestamp).getTime() < 86400000);
        
        if (isEigenaar && defect.status === "Open" && isBinnen24Uur) {
            // Sla de data op in de knop zelf
            editKnopHtml = `<button class="edit-defect-btn" 
                                    data-row-id="${defect.rowId}" 
                                    data-kart="${defect.kartNummer}" 
                                    data-omschrijving="${escape(defect.defect)}">
                                Aanpassen
                           </button>`;
        }
        
        const managerKnopHtml = (defect.status === "Open") 
            ? `<button class="manager-btn" data-row-id="${defect.rowId}">Markeer als Opgelost</button>` 
            : '';

        kaart.innerHTML = `
            <h3>Kart ${defect.kartNummer}</h3>
            <div class="meta">
                <span class="meta-item">Gemeld door: ${defect.medewerker}</span>
                <span class="meta-item">Op: ${ts}</span>
                <span class="meta-item">Status: <strong>${defect.status}</strong></span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
            <div class="knoppen-container">
                ${editKnopHtml}
                ${managerKnopHtml}
            </div>
        `;
        container.appendChild(kaart);
    });
}
// ========================

// ========================
//  SETUP DASHBOARD LISTENERS (BIJGEWERKT)
// ========================
function setupDashboardListeners(){
    const container = document.getElementById("defect-card-container");
    if (!container) return;
    container.addEventListener("click", e => {
        // Check voor "Opgelost" knop
        if (e.target.classList.contains("manager-btn")) {
            markeerDefectOpgelost(e.target.dataset.rowId, e.target);
        }
        // Check voor "Aanpassen" knop
        if (e.target.classList.contains("edit-defect-btn")) {
            handleDefectEdit(e.target);
        }
    });
}
// ========================

function markeerDefectOpgelost(rowId, buttonEl){
    if (!confirm("Weet je zeker dat je dit defect als opgelost wilt markeren?")) return;
    buttonEl.disabled = true; buttonEl.textContent = "Bezig...";
    const payload = { type: "UPDATE_DEFECT_STATUS", rol: ingelogdeRol, rowId: rowId, newStatus: "Opgelost" };
    callApi(payload)
    .then(result => {
        toonDefectStatus("Defect gemarkeerd als opgelost.", "success");
        laadDefectenDashboard(); 
    }).catch(error => {
        toonDefectStatus(error.message, "error");
        buttonEl.disabled = false; buttonEl.textContent = "Markeer als Opgelost";
    });
}

// ========================
//  NIEUWE FUNCTIE: Defect Aanpassen
// ========================
function handleDefectEdit(buttonEl) {
    const rowId = buttonEl.dataset.rowId;
    const huidigeKart = buttonEl.dataset.kart;
    const huidigeTekst = unescape(buttonEl.dataset.omschrijving);
    
    // Vraag 1: Kartnummer
    const nieuweKart = prompt("Pas kartnummer aan:", huidigeKart);
    if (!nieuweKart) { return; } // Gebruiker annuleerde
    
    // Vraag 2: Omschrijving
    const nieuweTekst = prompt("Pas omschrijving aan:", huidigeTekst);
    if (!nieuweTekst) { return; } // Gebruiker annuleerde
    
    // Check of er iets is gewijzigd
    if (nieuweKart.trim() === huidigeKart && nieuweTekst.trim() === huidigeTekst) {
        toonDefectStatus("Er is niets gewijzigd.", "error"); // 'error' is hier 'info'
        return;
    }
    
    buttonEl.disabled = true;
    buttonEl.textContent = "Opslaan...";
    
    const payload = { 
        type: "UPDATE_DEFECT", 
        rowId: rowId, 
        newKartNummer: newKartNummer.trim(), // Stuur nieuwe kartnummer mee
        newText: nieuweTekst.trim(), 
        medewerker: ingelogdeNaam 
    };

    callApi(payload)
    .then(result => {
        toonDefectStatus("Defect succesvol bijgewerkt.", "success");
        laadDefectenDashboard(); // Ververs de hele lijst
    })
    .catch(error => {
        toonDefectStatus(error.message, "error");
        buttonEl.disabled = false;
        buttonEl.textContent = "Aanpassen";
    });
}
// ========================

function toonDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message-defect');
    statusDiv.textContent = bericht; 
    statusDiv.className = `status-bericht ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
}

// --- ALGEMENE API CALL ---
async function callApi(payload) {
    // Voeg 'rol' toe aan *alleen* admin-verzoeken
    if (payload.type.startsWith("UPDATE_") || payload.type.startsWith("GET_") || payload.type.startsWith("ADD_") || payload.type.startsWith("DELETE_")) {
        payload.rol = ingelogdeRol;
    }
    
    const url = WEB_APP_URL + "?v=" + new Date().getTime(); // Cache-buster
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        mode: 'cors'
    });
    const result = await response.json();
    if (result.status === "success") { return result; } 
    else { throw new Error(result.message); }
}