/* ===============================
   VOLLEDIGE SCRIPT.JS (MET BIJZONDERHEDEN)
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykI7IjMAeUFrMhJJwFAIV7gvbdjhe1vqNLr1WRevW4Mee0M7v_Nw8P2H6IhzemydogHw/exec";

// ==============================================================
//   CHECKLIST DATA (Hard-coded)
// ==============================================================
const CHECKLIST_DATA = { /* ... (Je checklist data) ... */ };
let ingelogdeNaam = "";
let ingelogdeRol = "";
let alleDefecten = []; 

// --- DEEL 1: DE "BEWAKER" ---
(function() {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    ingelogdeRol = localStorage.getItem('ingelogdeRol');
    if (!ingelogdeNaam || !ingelogdeRol) {
        alert("Je bent niet ingelogd."); window.location.href = "login/"; return; 
    } 
    
    document.getElementById('algemeen-welkom-naam').textContent = ingelogdeNaam;
    if (ingelogdeRol === 'manager') {
        document.querySelectorAll('.admin-tab').forEach(link => link.classList.add('zichtbaar'));
        document.querySelector('.container').classList.add('is-manager'); 
    }
    const activiteitSelect = document.getElementById('activiteit-select');
    for (const activiteit in CHECKLIST_DATA) {
        activiteitSelect.add(new Option(activiteit, activiteit));
    }
    koppelListeners();
    setupMainTabs();
    setupMobileMenu(); 
    vulKartMeldDropdown(); 
    setupDefectForm();
    laadDefectenDashboard(); 
    setupKartFilter();
})(); 

// --- DEEL 2: FUNCTIES ---

function setupMobileMenu() { /* ... (onveranderd) ... */ }
function setupMainTabs() { /* ... (onveranderd) ... */ }
function vulKartMeldDropdown() { /* ... (onveranderd) ... */ }
function setupDefectForm() { /* ... (onveranderd) ... */ }
function laadDefectenDashboard() { /* ... (onveranderd) ... */ }
function updateStatBoxes(defects) { /* ... (onveranderd) ... */ }
function setupKartFilter() { /* ... (onveranderd) ... */ }
function renderDefectCards(defects) { /* ... (onveranderd) ... */ }
function setupDashboardListeners() { /* ... (onveranderd) ... */ }
function markeerDefectOpgelost(rowId, buttonEl) { /* ... (onveranderd) ... */ }
function koppelListeners() { /* ... (onveranderd) ... */ }
function updateChecklists(activiteit) { /* ... (onveranderd) ... */ }

// ========================
//  AANGEPASTE FUNCTIE
// ========================
function verstuurData(lijstNaam) {
    const activiteit = document.getElementById('activiteit-select').value;
    if (activiteit === "") { toonStatus("Fout: Kies een activiteit.", "error"); return; }
    
    var listId, buttonId, bijzonderhedenId;
    if (lijstNaam === 'Checklist Openen') {
        listId = 'lijst-openen';
        buttonId = 'btn-openen';
        bijzonderhedenId = 'bijzonderheden-openen'; // <-- NIEUW
    } else {
        listId = 'lijst-sluiten';
        buttonId = 'btn-sluiten';
        bijzonderhedenId = 'bijzonderheden-sluiten'; // <-- NIEUW
    }
    
    var knop = document.getElementById(buttonId);
    knop.disabled = true; knop.textContent = "Bezig...";
    
    // Haal bijzonderheden op
    var bijzonderhedenText = document.getElementById(bijzonderhedenId).value.trim(); // <-- NIEUW
    
    var items = [];
    document.querySelectorAll("#" + listId + " li").forEach(li => {
        items.push({ label: li.querySelector('label').textContent, checked: li.querySelector('input').checked });
    });
    
    var dataPayload = { 
        type: "LOG_DATA", 
        lijstNaam: lijstNaam, 
        items: items, 
        medewerker: ingelogdeNaam, 
        activiteit: activiteit,
        bijzonderheden: bijzonderhedenText // <-- NIEUW
    };
    
    fetch(WEB_APP_URL + "?v=" + new Date().getTime(), { 
        method: 'POST', body: JSON.stringify(dataPayload), headers: { "Content-Type": "text/plain;charset=utf-8" }, mode: 'cors'
    })
    .then(response => response.json())
    .then(data => {
        if(data.status === "success") {
            toonStatus("'" + lijstNaam + "' is succesvol opgeslagen!", "success");
            resetCheckboxes(listId);
            document.getElementById(bijzonderhedenId).value = ''; // <-- NIEUW (maak leeg)
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        } else { throw new Error(data.message); }
    })
    .catch(error => {
        toonStatus(error.message || "Failed to fetch", "error");
        knop.disabled = false;
        knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
    });
}
// ========================

function resetCheckboxes(listId) { /* ... (onveranderd) ... */ }
function toonStatus(bericht, type) { /* ... (onveranderd) ... */ }
function toonDefectStatus(bericht, type) { /* ... (onveranderd) ... */ }


// --- Hier zijn alle onveranderde functies (voor de zekerheid) ---
function setupMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => { mainNav.classList.toggle('is-open'); });
        document.querySelectorAll('.main-tab-link[data-tab]').forEach(button => {
            button.addEventListener('click', () => { if (window.innerWidth <= 720) { mainNav.classList.remove('is-open'); } });
        });
    }
}
function setupMainTabs() {
    document.querySelectorAll('.main-tab-link[data-tab]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.main-tab-link').forEach(link => link.classList.remove('active'));
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            button.classList.add('active');
        });
    });
}
function vulKartMeldDropdown() {
    const kartSelect = document.getElementById('new-defect-kart');
    if (!kartSelect) return; 
    for (let i = 1; i <= 40; i++) { kartSelect.add(new Option(`Kart ${i}`, i)); }
}
function setupDefectForm() {
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
        document.getElementById('defect-card-container').innerHTML = `<p style="color: red;">Kon defecten niet laden: ${error.message}</p>`;
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
    document.getElementById('defect-card-container').addEventListener('click', (e) => {
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
function koppelListeners() {
    document.getElementById('logout-button').addEventListener('click', function() {
        if (confirm('Weet je zeker dat je wilt uitloggen?')) {
            localStorage.clear(); window.location.href = 'login/';
        }
    });
    document.getElementById('activiteit-select').addEventListener('change', (e) => updateChecklists(e.target.value));
    document.querySelectorAll(".collapsible").forEach(coll => {
        coll.addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.parentElement.querySelector('.content');
            content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + "px";
        });
    });
}
function updateChecklists(activiteit) {
    const container = document.querySelector('.container');
    const openLijstUL = document.getElementById('lijst-openen');
    const sluitLijstUL = document.getElementById('lijst-sluiten');
    openLijstUL.innerHTML = ''; sluitLijstUL.innerHTML = '';
    document.querySelectorAll(".collapsible").forEach(coll => {
        coll.classList.remove("active");
        coll.parentElement.querySelector('.content').style.maxHeight = null;
    });
    if (activiteit && CHECKLIST_DATA[activiteit]) {
        const data = CHECKLIST_DATA[activiteit];
        data.openen.forEach((item, i) => { openLijstUL.innerHTML += `<li><input type="checkbox" id="open-${i}"><label for="open-${i}">${item}</label></li>`; });
        data.sluiten.forEach((item, i) => { sluitLijstUL.innerHTML += `<li><input type="checkbox" id="sluit-${i}"><label for="sluit-${i}">${item}</label></li>`; });
        container.classList.add('checklists-zichtbaar');
    } else {
        container.classList.remove('checklists-zichtbaar');
    }
}
function resetCheckboxes(listId) {
    document.querySelectorAll("#" + listId + " li input").forEach(cb => { cb.checked = false; });
}
function toonStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message');
    statusDiv.textContent = bericht; statusDiv.className = type;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
}
function toonDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message-defect');
    statusDiv.textContent = bericht; statusDiv.className = `status-bericht ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
}