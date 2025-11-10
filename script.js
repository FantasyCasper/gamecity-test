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
    
    // Vul namen in (op beide tabbladen)
    document.getElementById('medewerker-naam-display').textContent = `Ingelogd als: ${ingelogdeNaam}`;
    document.getElementById('algemeen-welkom-naam').textContent = ingelogdeNaam;

    // Toon admin tabs
    if (ingelogdeRol === 'manager') {
        document.querySelectorAll('.admin-tab').forEach(link => {
            link.classList.add('zichtbaar');
        });
        // Voeg de manager-class toe aan de container (voor "Opgelost" knoppen)
        document.querySelector('.container').classList.add('is-manager');
    }
    
    // Vul checklist dropdown
    const activiteitSelect = document.getElementById('activiteit-select');
    for (const activiteit in CHECKLIST_DATA) {
        activiteitSelect.add(new Option(activiteit, activiteit));
    }
    
    // Koppel alle event listeners
    koppelListeners();
    setupMainTabs(); // <-- DEZE FUNCTIE VOOR DE TABS
    vulKartDropdown();
    setupDefectForm();
    laadDefectenDashboard(); // Laad de defecten in het Kart Dashboard
    setupKartFilter();

})(); 

// --- DEEL 2: FUNCTIES ---

/**
 * Functie om de hoofd-tabs te laten werken
 */
function setupMainTabs() {
    document.querySelectorAll('.main-tab-link[data-tab]').forEach(button => {
        button.addEventListener('click', () => {
            // Verberg alle inhoud
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            // Maak alle knoppen inactief
            document.querySelectorAll('.main-tab-link').forEach(link => link.classList.remove('active'));
            
            // Toon de juiste tab-inhoud
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Maak de geklikte knop actief
            button.classList.add('active');
        });
    });
}

// --- DEFECTEN FUNCTIES ---

function vulKartDropdown() {
    const kartSelect = document.getElementById('kart-select');
    if (!kartSelect) return; 
    const kartFilter = document.getElementById('kart-filter');
    
    for (let i = 1; i <= 40; i++) {
        kartSelect.add(new Option(`Kart ${i}`, i));
        // Voeg ook toe aan de filter-dropdown
        if (kartFilter) {
            kartFilter.add(new Option(`Kart ${i}`, i));
        }
    }
}

function setupDefectForm() {
    const defectForm = document.getElementById('defect-form');
    if (!defectForm) return;
    const defectButton = document.getElementById('defect-submit-button');
    
    defectForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const kartNummer = document.getElementById('kart-select').value;
        const omschrijving = document.getElementById('defect-omschrijving').value.trim();
        
        if (kartNummer === "" || omschrijving === "") {
            toonDefectStatus("Selecteer een kart en vul een omschrijving in.", "error");
            return;
        }
        
        defectButton.disabled = true;
        defectButton.textContent = "Bezig met melden...";
        
        const payload = {
            type: "LOG_DEFECT",
            medewerker: ingelogdeNaam, 
            kartNummer: kartNummer,
            defect: omschrijving
        };
        
        fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            mode: 'cors'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                toonDefectStatus("Defect succesvol gemeld!", "success");
                defectForm.reset(); 
                laadDefectenDashboard(); // Ververs het dashboard
            } else {
                throw new Error(data.message);
            }
        })
        .catch(error => {
            toonDefectStatus(error.message || "Melden mislukt", "error");
        })
        .finally(() => {
            defectButton.disabled = false;
            defectButton.textContent = "Meld Defect";
        });
    });
}

function laadDefectenDashboard() {
    const payload = { type: "GET_DEFECTS" }; 
    
    fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        mode: 'cors'
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === "success") {
            alleDefecten = result.data; 
            updateStatBoxes(alleDefecten);
            renderDefectCards(alleDefecten);
            // We vullen de kart-filter niet meer hier, dat doet vulKartDropdown al
            setupDashboardListeners(); 
        } else {
            throw new Error(result.message);
        }
    })
    .catch(error => {
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
    document.getElementById('kart-filter').addEventListener('change', (e) => {
        const geselecteerdeKart = e.target.value;
        if (geselecteerdeKart === 'alle') {
            renderDefectCards(alleDefecten); // Toon alles
        } else {
            const gefilterdeLijst = alleDefecten.filter(d => d.kartNummer == geselecteerdeKart);
            renderDefectCards(gefilterdeLijst);
        }
    });
}

function renderDefectCards(defects) {
    const container = document.getElementById('defect-card-container');
    container.innerHTML = ''; 
    
    const openDefecten = defects.filter(d => d.status === 'Open');
    
    if (openDefecten.length === 0) {
        container.innerHTML = '<p>Geen openstaande defecten gevonden.</p>';
        return;
    }
    
    openDefecten.forEach(defect => {
        const ts = new Date(defect.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
        const kaart = document.createElement('div');
        kaart.className = 'defect-card';
        kaart.innerHTML = `
            <h3>Kart ${defect.kartNummer}</h3>
            <div class="meta">
                <span class="meta-item">Gemeld door: ${defect.medewerker}</span>
                <span class="meta-item">Op: ${ts}</span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
            <button class="manager-btn" data-row-id="${defect.rowId}">Markeer als Opgelost</button>
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
    if (!confirm('Weet je zeker dat je dit defect als opgelost wilt markeren?')) {
        return;
    }
    buttonEl.disabled = true;
    buttonEl.textContent = "Bezig...";
    
    const payload = {
        type: "UPDATE_DEFECT_STATUS",
        rol: ingelogdeRol, // Admin check
        rowId: rowId,
        newStatus: "Opgelost"
    };
    
    fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        mode: 'cors'
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === "success") {
            toonDefectStatus("Defect gemarkeerd als opgelost.", "success");
            laadDefectenDashboard(); // Ververs het hele dashboard
        } else {
            throw new Error(result.message);
        }
    })
    .catch(error => {
        toonDefectStatus(error.message, "error");
        buttonEl.disabled = false;
        buttonEl.textContent = "Markeer als Opgelost";
    });
}


// --- CHECKLIST FUNCTIES ---

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

function verstuurData(lijstNaam) {
    const activiteit = document.getElementById('activiteit-select').value;
    if (activiteit === "") { toonStatus("Fout: Kies een activiteit.", "error"); return; }
    var listId, buttonId;
    if (lijstNaam === 'Checklist Openen') { listId = 'lijst-openen'; buttonId = 'btn-openen'; }
    else { listId = 'lijst-sluiten'; buttonId = 'btn-sluiten'; }
    var knop = document.getElementById(buttonId);
    knop.disabled = true; knop.textContent = "Bezig...";
    var items = [];
    document.querySelectorAll("#" + listId + " li").forEach(li => {
        items.push({ label: li.querySelector('label').textContent, checked: li.querySelector('input').checked });
    });
    var dataPayload = { type: "LOG_DATA", lijstNaam: lijstNaam, items: items, medewerker: ingelogdeNaam, activiteit: activiteit };
    
    fetch(WEB_APP_URL + "?v=" + new Date().getTime(), { 
        method: 'POST',
        body: JSON.stringify(dataPayload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        mode: 'cors'
    })
    .then(response => response.json())
    .then(data => {
        if(data.status === "success") {
            toonStatus("'" + lijstNaam + "' is succesvol opgeslagen!", "success");
            resetCheckboxes(listId);
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

function resetCheckboxes(listId) {
    document.querySelectorAll("#" + listId + " li input").forEach(cb => { cb.checked = false; });
}

// --- STATUSBERICHT FUNCTIES ---
function toonStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message');
    statusDiv.textContent = bericht; statusDiv.className = type;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
}

function toonDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('defect-status-message');
    statusDiv.textContent = bericht; statusDiv.className = type;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
}