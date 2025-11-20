/* ===============================
   VOLLEDIGE SCRIPT.JS (DYNAMISCHE CHECKLISTS)
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

// Start leeg. Deze wordt gevuld door de server (spreadsheet).
let CHECKLIST_DATA = {}; 

let ingelogdeNaam = "";
let ingelogdeRol = "";
let alleDefecten = []; 

// --- DEEL 1: DE "BEWAKER" & INIT ---
(function() {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    ingelogdeRol = localStorage.getItem('ingelogdeRol');
    
    // 1. Login Check
    if (!ingelogdeNaam || !ingelogdeRol) {
        // Als we niet op de login pagina zijn, stuur terug
        if (!window.location.href.includes('login')) {
             window.location.href = "login/"; 
             return;
        }
    } 
    
    // 2. Vul naam in op 'Algemeen' tab
    const welkomNaam = document.getElementById('algemeen-welkom-naam');
    if (welkomNaam) welkomNaam.textContent = ingelogdeNaam;

    // 3. Toon Admin & Manager functies
    if (ingelogdeRol === 'manager' || ingelogdeRol === 'TD') {
        document.querySelectorAll('.admin-tab').forEach(link => link.classList.add('zichtbaar'));
        const container = document.querySelector('.container');
        if(container) container.classList.add('is-manager'); // Voor knoppen in Kart Dashboard
    }
    
    // 4. Start alle modules
    koppelListeners();
    setupMainTabs();
    setupMobileMenu(); 
    
    // Defecten modules
    vulKartMeldDropdown(); 
    setupDefectForm(); // Kart defect
    setupAlgemeenDefectForm(); // Algemeen defect
    
    // Dashboards laden
    laadDefectenDashboard(); 
    setupKartFilter();
    laadBijzonderhedenVanGisteren();
    
    // 5. CRUCIAAL: Haal de checklists op uit de Spreadsheet
    laadChecklistConfiguratie();

})(); 


// --- DEEL 2: ALGEMENE FUNCTIES ---

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
        button.addEventListener('click', (e) => {
            if (button.tagName === 'BUTTON') {
                e.preventDefault(); 
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.main-tab-link').forEach(link => link.classList.remove('active'));
                const tabId = button.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
                button.classList.add('active');
            }
        });
    });
}

function koppelListeners() {
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Weet je zeker dat je wilt uitloggen?')) {
                localStorage.clear(); window.location.href = 'login/';
            }
        });
    }
    
    const actSelect = document.getElementById('activiteit-select');
    if (actSelect) {
        actSelect.addEventListener('change', (e) => updateChecklists(e.target.value));
    }

    document.querySelectorAll(".collapsible").forEach(coll => {
        coll.addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.parentElement.querySelector('.content');
            content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + "px";
        });
    });
}

// --- API Helper ---
async function callApi(payload) {
    // Voeg ALTIJD rol toe
    payload.rol = ingelogdeRol;

    const url = WEB_APP_URL + "?v=" + new Date().getTime(); // Cache-buster

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        mode: 'cors'
    });

    const result = await response.json();

    if (result.status === "success") {
        return result;
    } else {
        throw new Error(result.message);
    }
}


// --- DEEL 3: CHECKLIST FUNCTIES (DYNAMISCH) ---

function laadChecklistConfiguratie() {
    console.log("Checklists ophalen...");
    callApi({ type: "GET_CHECKLIST_CONFIG" })
    .then(result => {
        console.log("Checklists geladen:", result.data);
        CHECKLIST_DATA = result.data; // Vul de variabele
        
        // Vul de dropdown
        const activiteitSelect = document.getElementById('activiteit-select');
        if (activiteitSelect) {
            // Leegmaken (behalve eerste optie)
            while (activiteitSelect.options.length > 1) { activiteitSelect.remove(1); }
            
            for (const activiteit in CHECKLIST_DATA) {
                activiteitSelect.add(new Option(activiteit, activiteit));
            }
        }
    })
    .catch(error => {
        console.error("Fout:", error);
        toonStatus("Kon checklists niet laden.", "error");
    });
}

function updateChecklists(activiteit) {
    const container = document.querySelector('.container'); // Of specifieker: #tab-checklists
    const openLijstUL = document.getElementById('lijst-openen');
    const sluitLijstUL = document.getElementById('lijst-sluiten');
    
    if (!openLijstUL || !sluitLijstUL) return;

    openLijstUL.innerHTML = ''; 
    sluitLijstUL.innerHTML = '';
    
    // Reset panels
    document.querySelectorAll(".collapsible").forEach(coll => {
        coll.classList.remove("active");
        const content = coll.nextElementSibling;
        if (content) content.style.maxHeight = null;
    });
    
    if (activiteit && CHECKLIST_DATA[activiteit]) {
        const data = CHECKLIST_DATA[activiteit];
        
        if (data.openen) {
            data.openen.forEach((item, i) => { 
                openLijstUL.innerHTML += `<li><input type="checkbox" id="open-${i}"><label for="open-${i}">${item}</label></li>`; 
            });
        }
        if (data.sluiten) {
            data.sluiten.forEach((item, i) => { 
                sluitLijstUL.innerHTML += `<li><input type="checkbox" id="sluit-${i}"><label for="sluit-${i}">${item}</label></li>`; 
            });
        }
        
        if(container) container.classList.add('checklists-zichtbaar');
    } else {
        if(container) container.classList.remove('checklists-zichtbaar');
    }
}

function verstuurData(lijstNaam) {
    const activiteit = document.getElementById('activiteit-select').value;
    if (!activiteit) { toonStatus("Fout: Kies een activiteit.", "error"); return; }
    
    var listId, buttonId, bijzonderhedenId;
    if (lijstNaam === 'Checklist Openen') {
        listId = 'lijst-openen'; buttonId = 'btn-openen'; bijzonderhedenId = 'bijzonderheden-openen';
    } else {
        listId = 'lijst-sluiten'; buttonId = 'btn-sluiten'; bijzonderhedenId = 'bijzonderheden-sluiten';
    }
    
    var knop = document.getElementById(buttonId);
    knop.disabled = true; knop.textContent = "Bezig...";
    
    var bijzonderhedenText = document.getElementById(bijzonderhedenId).value.trim();
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
        bijzonderheden: bijzonderhedenText 
    };
    
    callApi(dataPayload)
    .then(data => {
        toonStatus("'" + lijstNaam + "' is succesvol opgeslagen!", "success");
        resetCheckboxes(listId);
        document.getElementById(bijzonderhedenId).value = ''; 
        knop.disabled = false;
        knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
    })
    .catch(error => {
        toonStatus(error.message || "Failed to fetch", "error");
        knop.disabled = false;
        knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
    });
}


// --- DEEL 4: ALGEMEEN TAB (BIJZONDERHEDEN) ---
function laadBijzonderhedenVanGisteren() {
    const tabelBody = document.getElementById('bijzonderheden-body');
    if (!tabelBody) return;
    
    callApi({ type: "GET_YESTERDAYS_BIJZONDERHEDDEN" })
    .then(result => {
        tabelBody.innerHTML = ''; 
        if (result.data.length === 0) {
            tabelBody.innerHTML = '<tr><td colspan="4">Geen bijzonderheden gemeld gisteren.</td></tr>';
        } else {
            result.data.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.medewerker}</td>
                    <td>${item.activiteit}</td>
                    <td>${item.lijstnaam.replace("Checklist ", "")}</td>
                    <td>${item.opmerking}</td>
                `;
                tabelBody.appendChild(tr);
            });
        }
    })
    .catch(error => {
        tabelBody.innerHTML = `<tr><td colspan="4" style="color: #e74c3c;">Kon bijzonderheden niet laden: ${error.message}</td></tr>`;
    });
}


// --- DEEL 5: ALGEMEEN DEFECT MELDEN ---
function setupAlgemeenDefectForm() {
    const form = document.getElementById('algemeen-defect-form');
    if (!form) return;
    const button = document.getElementById('algemeen-defect-submit');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const locatie = document.getElementById('locatie-select').value;
        const omschrijving = document.getElementById('algemeen-defect-omschrijving').value.trim();
        
        if (locatie === "" || omschrijving === "") {
            toonAlgemeenDefectStatus("Selecteer een locatie en vul een omschrijving in.", "error"); return;
        }
        button.disabled = true; button.textContent = "Bezig met melden...";
        
        const payload = { type: "LOG_ALGEMEEN_DEFECT", medewerker: ingelogdeNaam, locatie: locatie, defect: omschrijving };
        callApi(payload)
            .then(data => {
                toonAlgemeenDefectStatus("Defect succesvol gemeld!", "success");
                form.reset();
            })
            .catch(error => {
                toonAlgemeenDefectStatus(error.message || "Melden mislukt", "error");
            })
            .finally(() => {
                button.disabled = false; button.textContent = "Meld Algemeen Defect";
            });
    });
}


// --- DEEL 6: KART DASHBOARD FUNCTIES (Lege placeholders) ---
// (Deze functies worden geladen door kart-dashboard/script.js als je daar bent, 
// maar hier definiëren we ze leeg om errors in de console te voorkomen op de hoofdpagina)
function vulKartMeldDropdown() {}
function setupDefectForm() {}
function laadDefectenDashboard() {}
function setupKartFilter() {}


// --- STATUS HELPERS ---
function toonStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message');
    if (statusDiv) {
        statusDiv.textContent = bericht; statusDiv.className = type;
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
    }
}
function toonAlgemeenDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('algemeen-defect-status');
    if (statusDiv) {
        statusDiv.textContent = bericht; statusDiv.className = `status-bericht ${type}`;
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
    }
}
function toonDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message-defect');
    if (statusDiv) {
        statusDiv.textContent = bericht; statusDiv.className = `status-bericht ${type}`;
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
    }
}
function resetCheckboxes(listId) {
    document.querySelectorAll("#" + listId + " li input").forEach(cb => { cb.checked = false; });
}