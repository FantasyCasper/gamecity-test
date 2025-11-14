/* ===============================
   VOLLEDIGE SCRIPT.JS (MET ALLES)
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykI7IjMAeUFrMhJJwFAIV7gvbdjhe1vqNLr1WRevW4Mee0M7v_Nw8P2H6IhzemydogHw/exec";

// ==============================================================
//   CHECKLIST DATA (Hard-coded)
// ==============================================================
const CHECKLIST_DATA = {
    "Baan": {
        openen: ["Baan lichten aan", "Karts controleren", "Helmen desinfecteren", "Pitdeur openen"],
        sluiten: ["Karts aan de lader", "Baan lichten uit", "Helmen opruimen", "Pitdeur sluiten"]
    },
    "Lasergame": {
        openen: ["Lichten aan", "Blacklights aan", "Rookmachines aan", "Computer aan", "Printer aan", "Versterker aan", "Pakken uit pluggen", "Ronde in de Arena lopen"],
        sluiten: ["Lasermaxx afsluiten (via exit)", "Computer uit", "Versterker uit", "Ventilator/Verwarming opruimen", "Printer uit - papier bijvullen", "Pakken inpluggen", "Ruimte controleren op defecten en rommel", "Ronde in de Arena lopen met stoffer en blik", "Luchtverfrissers controleren", "Rookmachines bijvullen", "Prullenbak legen"]
    },
    "Prison Island": {
        openen: ["lichten aan", "Briefings TV aan", "Computer aan", "Printer aan", "Rondje door de hal + cellen controleren"],
        sluiten: ["Lichten uit", "Computer + Printer + Scherm uit", "Printer bijvullen", "Briefings TV uit", "Cellen + briefingsruimte controleren op defecten/rommel", "Alle brievenbusjes naar beneden", "Bureau netjes achterlaten", "De hal met stoffer en blik vegen", "Prullenback checken, is die vol dan vervangen."]
    },
    "Minigolf": {
        openen: ["Ballen en clubs klaarzetten", "Verlichting banen aan", "Scorekaarten aanvullen"],
        sluiten: ["Ballen en clubs innemen/opruimen", "Verlichting uit", "Afval controleren"]
    }
};
// ==============================================================

let ingelogdeNaam = "";
let ingelogdeRol = "";

// --- DEEL 1: DE "BEWAKER" (De functie die alles start) ---
(function() {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    ingelogdeRol = localStorage.getItem('ingelogdeRol');
    if (!ingelogdeNaam || !ingelogdeRol) {
        alert("Je bent niet ingelogd."); window.location.href = "login/"; return; 
    } 
    
    document.getElementById('algemeen-welkom-naam').textContent = ingelogdeNaam;

    if (ingelogdeRol === 'manager' || ingelogdeRol === 'TD') {
        document.querySelectorAll('.admin-tab').forEach(link => link.classList.add('zichtbaar'));
    }
    
    const activiteitSelect = document.getElementById('activiteit-select');
    for (const activiteit in CHECKLIST_DATA) {
        activiteitSelect.add(new Option(activiteit, activiteit));
    }
    
    // Koppel alle event listeners
    koppelListeners();
    setupMainTabs();
    setupMobileMenu(); 
    setupAlgemeenDefectForm(); 
    laadBijzonderhedenVanGisteren();
})(); 

// --- DEEL 2: FUNCTIES ---

function setupMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => { mainNav.classList.toggle('is-open'); });
        document.querySelectorAll('.main-tab-link').forEach(button => {
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
function toonStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message');
    statusDiv.textContent = bericht; statusDiv.className = type;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
}
function toonAlgemeenDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('algemeen-defect-status');
    statusDiv.textContent = bericht;
    statusDiv.className = `status-bericht ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
}
function resetCheckboxes(listId) {
    document.querySelectorAll("#" + listId + " li input").forEach(cb => { cb.checked = false; });
}

// --- DEEL 3: ALGEMEEN TAB FUNCTIES ---
function laadBijzonderhedenVanGisteren() {
    const tabelBody = document.getElementById('bijzonderheden-body');
    const payload = { type: "GET_YESTERDAYS_BIJZONDERHEDDEN" }; 
    callApi(payload)
    .then(result => {
        tabelBody.innerHTML = ''; 
        if (result.data.length === 0) {
            tabelBody.innerHTML = '<tr><td colspan="3">Geen bijzonderheden gemeld gisteren.</td></tr>';
        } else {
            result.data.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.activiteit}</td>
                    <td>${item.lijstnaam.replace("Checklist ", "")}</td>
                    <td>${item.opmerking}</td>
                `;
                tabelBody.appendChild(tr);
            });
        }
    })
    .catch(error => {
        tabelBody.innerHTML = `<tr><td colspan="3" style="color: #e74c3c;">Kon bijzonderheden niet laden: ${error.message}</td></tr>`;
    });
}

// --- DEEL 4: CHECKLIST TAB FUNCTIES ---
function updateChecklists(activiteit) {
    const container = document.querySelector('#tab-checklists .container'); // Wees specifieker
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
        if (container) container.classList.add('checklists-zichtbaar');
    } else {
        if (container) container.classList.remove('checklists-zichtbaar');
    }
}
function verstuurData(lijstNaam) {
    const activiteit = document.getElementById('activiteit-select').value;
    if (activiteit === "") { toonStatus("Fout: Kies een activiteit.", "error"); return; }
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
        type: "LOG_DATA", lijstNaam: lijstNaam, items: items, 
        medewerker: ingelogdeNaam, activiteit: activiteit, bijzonderheden: bijzonderhedenText
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

// --- DEEL 5: ALGEMEEN DEFECT TAB FUNCTIES ---
function setupAlgemeenDefectForm() {
    const form = document.getElementById('algemeen-defect-form');
    if (!form) return;
    const button = document.getElementById('algemeen-defect-submit');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const locatie = document.getElementById('locatie-select').value;
        const omschrijving = document.getElementById('algemeen-defect-omschrijving').value.trim();
        
        if (locatie === "" || omschrijving === "") {
            toonAlgemeenDefectStatus("Selecteer een locatie en vul een omschrijving in.", "error");
            return;
        }
        
        button.disabled = true;
        button.textContent = "Bezig met melden...";
        
        const payload = {
            type: "LOG_ALGEMEEN_DEFECT",
            medewerker: ingelogdeNaam,
            locatie: locatie,
            defect: omschrijving
        };
        
        callApi(payload)
            .then(data => {
                toonAlgemeenDefectStatus("Defect succesvol gemeld!", "success");
                form.reset();
            })
            .catch(error => {
                toonAlgemeenDefectStatus(error.message || "Melden mislukt", "error");
            })
            .finally(() => {
                button.disabled = false;
                button.textContent = "Meld Algemeen Defect";
            });
    });
}

// --- DEEL 6: KART DASHBOARD (Lege functies, want die staan in hun eigen bestand) ---
// We roepen deze aan, maar ze bestaan niet in dit bestand. Dat is OKÉ,
// want deze code wordt alleen geladen op index.html, niet op kart-dashboard/index.html.
function vulKartMeldDropdown() {}
function setupDefectForm() {}
function laadDefectenDashboard() {}
function setupKartFilter() {}
function renderDefectCards(defects) {}
function setupDashboardListeners() {}
function markeerDefectOpgelost(rowId, buttonEl) {}
function updateStatBoxes(defects) {}
function handleDefectEdit(buttonEl) {}
function toonDefectStatus(bericht, type) {} // Herdefinieer om crashes te voorkomen
function closeEditModal() {}
function openEditModal(rowId, kartNummer, omschrijving) {}
function setupEditModal() {}


// --- DEEL 7: ALGEMENE API FUNCTIE ---
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