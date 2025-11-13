/* ===============================
   KART DASHBOARD SCRIPT
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
    
    // Toon manager knoppen
    if (ingelogdeRol === 'manager') {
        document.body.classList.add('is-manager'); 
    }
    
    // Koppel alle event listeners
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
        
        fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
            method: 'POST', body: JSON.stringify(payload), headers: { "Content-Type": "text/plain;charset=utf-8" }, mode: 'cors'
        }).then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                toonDefectStatus("Defect succesvol gemeld!", "success");
                defectForm.reset(); laadDefectenDashboard(); 
            } else { throw new Error(data.message); }
        }).catch(error => {
            toonDefectStatus(error.message || "Melden mislukt", "error");
        }).finally(() => {
            defectButton.disabled = false; defectButton.textContent = "+ Toevoegen";
        });
    });
}

function laadDefectenDashboard() {
    const payload = { type: "GET_DEFECTS" }; 
    fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
        method: 'POST', body: JSON.stringify(payload), headers: { "Content-Type": "text/plain;charset=utf-8" }, mode: 'cors'
    }).then(response => response.json())
    .then(result => {
        if (result.status === "success") {
            alleDefecten = result.data; 
            updateStatBoxes(alleDefecten);
            renderDefectCards(alleDefecten); 
            setupDashboardListeners(); 
        } else { throw new Error(result.message); }
    }).catch(error => {
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

function renderDefectCards(defects) {
    const container = document.getElementById('defect-card-container');
    if (!container) return;
    container.innerHTML = ''; 
    if (defects.length === 0) {
        container.innerHTML = '<p>Geen defecten gevonden voor deze selectie.</p>'; return;
    }
    defects.sort((a, b) => (a.status === 'Open' ? -1 : 1) - (b.status === 'Open' ? -1 : 1));
    defects.forEach(defect => {
        const ts = new Date(defect.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
        const kaart = document.createElement('div');
        kaart.className = 'defect-card';
        if (defect.status === 'Opgelost') { kaart.classList.add('status-opgelost'); }
        kaart.innerHTML = `
            <h3>Kart ${defect.kartNummer}</h3>
            <div class="meta">
                <span class="meta-item">Gemeld door: ${defect.medewerker}</span>
                <span class="meta-item">Op: ${ts}</span>
                <span class="meta-item">Status: <strong>${defect.status}</strong></span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
            ${defect.status === 'Open' ? `<button class="manager-btn" data-row-id="${defect.rowId}">Markeer als Opgelost</button>` : ''}
        `;
        container.appendChild(kaart);
    });
}

function setupDashboardListeners() {
    const container = document.getElementById('defect-card-container');
    if (!container) return;
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('manager-btn')) {
            const rowId = e.target.dataset.rowId;
            markeerDefectOpgelost(rowId, e.target);
        }
    });
}

function markeerDefectOpgelost(rowId, buttonEl) {
    if (!confirm('Weet je zeker dat je dit defect als opgelost wilt markeren?')) { return; }
    buttonEl.disabled = true; buttonEl.textContent = "Bezig...";
    const payload = { type: "UPDATE_DEFECT_STATUS", rol: ingelogdeRol, rowId: rowId, newStatus: "Opgelost" };
    fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
        method: 'POST', body: JSON.stringify(payload), headers: { "Content-Type": "text/plain;charset=utf-8" }, mode: 'cors'
    }).then(response => response.json())
    .then(result => {
        if (result.status === "success") {
            toonDefectStatus("Defect gemarkeerd als opgelost.", "success");
            laadDefectenDashboard(); 
        } else { throw new Error(result.message); }
    }).catch(error => {
        toonDefectStatus(error.message, "error");
        buttonEl.disabled = false; buttonEl.textContent = "Markeer als Opgelost";
    });
}

function toonDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message-defect');
    statusDiv.textContent = bericht; 
    statusDiv.className = `status-bericht ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
}