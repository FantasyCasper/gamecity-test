/* ===============================
   VOLLEDIGE SCRIPT.JS (FETCHT CHECKLISTS)
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyuq7nCyeUXVDV44T2YhZFKbXvXU84SsJfvIyybgswcxVgXuTatRtFoDXTdxkVJtbot8g/exec";

let CHECKLIST_DATA = {};
let ingelogdeNaam = "";
let ingelogdeRol = "";

// --- DEEL 1: DE "BEWAKER" ---
(function () {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    ingelogdeRol = localStorage.getItem('ingelogdeRol');
    if (!ingelogdeNaam || !ingelogdeRol) {
        alert("Je bent niet ingelogd."); window.location.href = "login/"; return;
    }
    document.getElementById('medewerker-naam-display').textContent = `Ingelogd als: ${ingelogdeNaam}`;
    if (ingelogdeRol === 'manager') {
        document.querySelectorAll('.admin-link').forEach(link => link.classList.add('zichtbaar'));
    }
    koppelListeners();
    laadChecklistConfiguratie();
})();

// --- DEEL 2: FUNCTIES ---
function laadChecklistConfiguratie() {
    console.log("Checklists ophalen...");
    fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
        method: 'POST',
        body: JSON.stringify({ type: "GET_CHECKLIST_CONFIG" }), // Dit is nu een publieke call
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        mode: 'cors'
    })
        .then(response => response.json())
        .then(result => {
            if (result.status === "success") {
                console.log("Checklists succesvol geladen.");
                CHECKLIST_DATA = result.data;
                const activiteitSelect = document.getElementById('activiteit-select');
                while (activiteitSelect.options.length > 1) { activiteitSelect.remove(1); }
                for (const activiteit in CHECKLIST_DATA) {
                    activiteitSelect.add(new Option(activiteit, activiteit));
                }
            } else { throw new Error(result.message); }
        })
        .catch(error => {
            alert("KON CHECKLISTS NIET LADEN. " + error.message);
        });
}
function koppelListeners() {
    document.getElementById('logout-button').addEventListener('click', function () {
        if (confirm('Weet je zeker dat je wilt uitloggen?')) {
            localStorage.clear(); window.location.href = 'login/';
        }
    });
    document.getElementById('activiteit-select').addEventListener('change', (e) => updateChecklists(e.target.value));
    document.querySelectorAll(".collapsible").forEach(coll => {
        coll.addEventListener("click", function () {
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
            if (data.status === "success") {
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