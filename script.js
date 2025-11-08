/* ===============================
   VOLLEDIGE SCRIPT.JS (STABIELE VERSIE)
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykI7IjMAeUFrMhJJwFAIV7gvbdjhe1vqNLr1WRevW4Mee0M7v_Nw8P2H6IhzemydogHw/exec"; 

// ==============================================================
//   CHECKLIST DATA (LASERGAME IS NU BIJGEWERKT)
// ==============================================================
const CHECKLIST_DATA = {
    "Baan": {
        openen: ["Baan lichten aan", "Karts controleren", "Helmen desinfecteren", "Pitdeur openen"],
        sluiten: ["Karts aan de lader", "Baan lichten uit", "Helmen opruimen", "Pitdeur sluiten"]
    },
    "Lasergame": {
        openen: [
            "Lichten aan","Blacklights aan","Rookmachines aan","Computer aan","Printer aan","Versterker aan","Pakken uit pluggen","Ronde in de Arena lopen"
        ],
        sluiten: [
            "Lasermaxx afsluiten (via exit)","Computer uit","Versterker uit","Ventilator/Verwarming opruimen","Printer uit - papier bijvullen","Pakken inpluggen","Ruimte controleren op defecten en rommel","Ronde in de Arena lopen met stoffer en blik","Luchtverfrissers controleren","Rookmachines bijvullen","Prullenbak legen"
        ]
    },
    "Prison Island": {
        openen: ["Alle cellen resetten", "Systeem opstarten", "Controleer schermen"],
        sluiten: ["Systeem afsluiten", "Verlichting uit", "Deuren controleren"]
    },
    "Minigolf": {
        openen: ["Ballen en clubs klaarzetten", "Verlichting banen aan", "Scorekaarten aanvullen"],
        sluiten: ["Ballen en clubs innemen/opruimen", "Verlichting uit", "Afval controleren"]
    }
};
// ==============================================================

let ingelogdeNaam = "";
let ingelogdeRol = "";

// --- DEEL 1: DE "BEWAKER" ---
(function() {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    ingelogdeRol = localStorage.getItem('ingelogdeRol');
    if (!ingelogdeNaam || !ingelogdeRol) {
        alert("Je bent niet ingelogd."); window.location.href = "login/"; return; 
    } 
    document.getElementById('medewerker-naam-display').textContent = `Ingelogd als: ${ingelogdeNaam}`;
    if (ingelogdeRol === 'manager') {
        document.querySelectorAll('.admin-link').forEach(link => link.classList.add('zichtbaar'));
    }
    
    // Vul de dropdown direct
    const activiteitSelect = document.getElementById('activiteit-select');
    for (const activiteit in CHECKLIST_DATA) {
        activiteitSelect.add(new Option(activiteit, activiteit));
    }
    
    koppelListeners();
})(); 

// --- DEEL 2: FUNCTIES ---

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
    
    fetch(WEB_APP_URL + "?v=" + new Date().getTime(), { // Cache-buster
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
            knop.disabled = false; knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        } else { throw new Error(data.message); }
    })
    .catch(error => {
        toonStatus(error.message || "Failed to fetch", "error");
        knop.disabled = false; knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
    });
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