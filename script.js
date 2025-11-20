/* ===============================
   VOLLEDIGE SCRIPT.JS (MET SPREADSHEET CHECKLISTS)
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

// We beginnen leeg, de data komt uit de spreadsheet!
let CHECKLIST_DATA = {};

let ingelogdeNaam = "";
let ingelogdeRol = "";
let alleDefecten = [];

// --- DEEL 1: DE "BEWAKER" ---
(function () {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    ingelogdeRol = localStorage.getItem('ingelogdeRol');
    if (!ingelogdeNaam || !ingelogdeRol) {
        alert("Je bent niet ingelogd."); window.location.href = "login/"; return;
    }

    document.getElementById('algemeen-welkom-naam').textContent = ingelogdeNaam;

    if (ingelogdeRol === 'manager' || ingelogdeRol === 'TD') {
        document.querySelectorAll('.admin-tab').forEach(link => link.classList.add('zichtbaar'));
        document.querySelector('.container').classList.add('is-manager');
    }

    // Koppel alle event listeners
    koppelListeners();
    setupMainTabs();
    setupMobileMenu();
    vulKartMeldDropdown();
    setupDefectForm();
    setupAlgemeenDefectForm();
    laadDefectenDashboard();
    setupKartFilter();
    laadBijzonderhedenVanGisteren();

    // HAAL DE CHECKLISTS OP!
    laadChecklistConfiguratie();

})();

// --- DEEL 2: FUNCTIES ---

function laadChecklistConfiguratie() {
    console.log("Checklists ophalen...");
    callApi({ type: "GET_CHECKLIST_CONFIG" })
    .then(result => {
        CHECKLIST_DATA = result.data;
        const select = document.getElementById('activiteit-select');
        select.innerHTML = '<option value="">-- Selecteer een activiteit --</option>';
        for (const act in CHECKLIST_DATA) {
            select.add(new Option(act, act));
        }
    })
    .catch(error => alert("Kon checklists niet laden: " + error.message));
}


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

async function callApi(payload) {
    if (payload.type.startsWith("UPDATE") || payload.type.startsWith("GET_LOGS") || payload.type.startsWith("ADD") || payload.type.startsWith("DELETE") || payload.type.startsWith("SET")) {
        payload.rol = ingelogdeRol;
    }
    const res = await fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
        method: 'POST', body: JSON.stringify(payload), headers: { "Content-Type": "text/plain;charset=utf-8" }, mode: 'cors'
    });
    const json = await res.json();
    if (json.status === "success") return json;
    throw new Error(json.message);
}

// --- DEEL 3: ALGEMEEN TAB FUNCTIES ---
function laadBijzonderhedenVanGisteren() {
    const tabelBody = document.getElementById('bijzonderheden-body');
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

// --- DEEL 4: CHECKLIST TAB FUNCTIES ---
function updateChecklists(activiteit) {
    const container = document.querySelector('.container');
    const openUl = document.getElementById('lijst-openen');
    const sluitUl = document.getElementById('lijst-sluiten');
    openUl.innerHTML = ''; sluitUl.innerHTML = '';
    
    if (activiteit && CHECKLIST_DATA[activiteit]) {
        const data = CHECKLIST_DATA[activiteit];
        data.openen.forEach((t, i) => openUl.innerHTML += `<li><input type="checkbox" id="o${i}"><label for="o${i}">${t}</label></li>`);
        data.sluiten.forEach((t, i) => sluitUl.innerHTML += `<li><input type="checkbox" id="s${i}"><label for="s${i}">${t}</label></li>`);
        container.classList.add('checklists-zichtbaar');
    } else {
        container.classList.remove('checklists-zichtbaar');
    }
}

function verstuurData(lijstNaam) {
    const activiteit = document.getElementById('activiteit-select').value;
    if (!activiteit) return toonStatus("Kies activiteit", "error");
    const suffix = lijstNaam.includes("Open") ? "openen" : "sluiten";
    const listId = "lijst-" + suffix;
    const textId = "bijzonderheden-" + suffix;
    const items = [];
    document.querySelectorAll(`#${listId} li`).forEach(li => items.push({ label: li.innerText, checked: li.querySelector('input').checked }));
    const opm = document.getElementById(textId).value;

    callApi({ type: "LOG_DATA", lijstNaam: lijstNaam, items: items, medewerker: ingelogdeNaam, activiteit: activiteit, bijzonderheden: opm })
        .then(() => {
            toonStatus("Opgeslagen!", "success");
            document.getElementById(textId).value = "";
            document.querySelectorAll(`#${listId} input`).forEach(i => i.checked = false);
        })
        .catch(e => toonStatus(e.message, "error"));
}

// --- DEEL 5: ALGEMEEN DEFECT TAB FUNCTIES ---
function setupAlgemeenDefectForm() {
    const form = document.getElementById('algemeen-defect-form');
    if (!form) return;
    const button = document.getElementById('algemeen-defect-submit');
    form.addEventListener('submit', function (e) {
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

// --- DEEL 6: KART DASHBOARD (Lege functies, want die staan in hun eigen bestand) ---
function vulKartMeldDropdown() { }
function setupDefectForm() { }
function laadDefectenDashboard() { }
function setupKartFilter() { }
function renderDefectCards(defects) { }
function setupDashboardListeners() { }
function markeerDefectOpgelost(rowId, buttonEl) { }
function updateStatBoxes(defects) { }
function handleDefectEdit(buttonEl) { }
function toonDefectStatus(bericht, type) { }
function closeEditModal() { }
function openEditModal(rowId, kartNummer, omschrijving) { }
function setupEditModal() { }