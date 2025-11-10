/* ===============================
   VOLLEDIGE ADMIN.JS (MET DEFECTEN-MODULE)
   =============================== */

// ##################################################################
// #                        BELANGRIJKE STAP                        #
// # PLAK HIER JE GOOGLE WEB APP URL                                #
// ##################################################################
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykI7IjMAeUFrMhJJwFAIV7gvbdjhe1vqNLr1WRevW4Mee0M7v_Nw8P2H6IhzemydogHw/exec";

// Globale variabelen
const ingelogdeRol = localStorage.getItem('ingelogdeRol');
const statusDiv = document.getElementById('status-message');
let HUIDIGE_CHECKLIST_CONFIG = {}; 

// --- DEEL 1: BEWAKER & INIT (BIJGEWERKT) ---
(function() {
    if (ingelogdeRol !== 'manager') {
        alert("Toegang geweigerd.");
        window.location.href = "../index.html"; 
        return; 
    }
    
    // Haal alle data op bij het laden
    fetchLogData();
    fetchUsers();
    fetchChecklistConfig(); 
    fetchDefects(); // <-- NIEUWE FUNCTIEAANROEP
    
    // Koppel de listeners
    setupTabNavigation();
    setupUserForm();
    setupUserDeleteListener();
    setupChecklistEditor();

})(); 


// --- DEEL 2: TAB NAVIGATIE (Ongewijzigd) ---
function setupTabNavigation() {
    document.querySelectorAll('.tab-link').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            button.classList.add('active');
        });
    });
}


// --- DEEL 3: LOGBOEK FUNCTIES (Ongewijzigd) ---
function fetchLogData() { 
    statusDiv.textContent = "Logboek laden..."; statusDiv.className = 'loading';
    callApi("GET_LOGS").then(result => {
        statusDiv.style.display = 'none'; renderLogs(result.data);
    }).catch(error => handleError(error, "Fout bij laden logboek: "));
}
function renderLogs(logs) {
    const logBody = document.getElementById('log-body');
    if (logs.length === 0) { logBody.innerHTML = '<tr><td colspan="6">Nog geen logs gevonden.</td></tr>'; return; }
    let html = '';
    logs.forEach(log => {
        let ts = new Date(log.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
        html += `<tr><td data-label="Tijdstip">${ts}</td><td data-label="Medewerker">${log.medewerker}</td><td data-label="Activiteit">${log.activiteit}</td><td data-label="Lijst">${log.lijstnaam}</td><td data-label="Voltooid">${log.voltooid}</td><td data-label="Gemist">${log.gemist}</td></tr>`;
    });
    logBody.innerHTML = html;
}

// --- DEEL 4: GEBRUIKERSBEHEER FUNCTIES (Ongewijzigd) ---
function fetchUsers() { 
    callApi("GET_USERS").then(result => { renderUsers(result.data); })
    .catch(error => handleError(error, "Fout bij laden gebruikers: "));
}
function renderUsers(users) {
    const userBody = document.getElementById('user-body');
    userBody.innerHTML = '';
    if (users.length === 0) { userBody.innerHTML = '<tr><td colspan="4">Geen gebruikers gevonden.</td></tr>'; return; }
    let html = '';
    users.forEach(user => {
        html += `<tr><td data-label="Gebruikersnaam">${user.username}</td><td data-label="Volledige Naam">${user.fullname}</td><td data-label="Rol">${user.role}</td><td data-label="Actie"><button class="delete-btn" data-username="${user.username}">Verwijder</button></td></tr>`;
    });
    userBody.innerHTML = html;
}
function setupUserForm() {
    const form = document.getElementById('add-user-form');
    const button = document.getElementById('add-user-button');
    form.addEventListener('submit', (e) => {
        e.preventDefault(); button.disabled = true; button.textContent = "Bezig...";
        const userData = {
            username: document.getElementById('new-username').value,
            fullname: document.getElementById('new-fullname').value,
            pincode: document.getElementById('new-pincode').value,
            role: document.getElementById('new-role').value
        };
        callApi("ADD_USER", { userData: userData }).then(result => {
            alert(result.message); form.reset(); fetchUsers(); 
        }).catch(error => handleError(error, "Fout bij toevoegen: ")).finally(() => {
            button.disabled = false; button.textContent = "Gebruiker Toevoegen";
        });
    });
}
function setupUserDeleteListener() {
    document.getElementById('user-table').addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-btn')) return;
        const button = e.target; const username = button.dataset.username;
        if (!confirm(`Weet je zeker dat je "${username}" wilt verwijderen?`)) return;
        button.disabled = true; button.textContent = "Bezig...";
        callApi("DELETE_USER", { username: username }).then(result => {
            alert(result.message); fetchUsers();
        }).catch(error => {
            handleError(error, "Fout bij verwijderen: ");
            button.disabled = false; button.textContent = "Verwijder";
        });
    });
}

// --- DEEL 5: CHECKLIST FUNCTIES (Ongewijzigd) ---
function fetchChecklistConfig() {
    callApi("GET_CHECKLIST_CONFIG").then(result => {
        HUIDIGE_CHECKLIST_CONFIG = result.data;
        console.log("Checklist configuratie geladen.");
    }).catch(error => handleError(error, "Fout bij laden checklists: "));
}
function createTaakLi(taak) {
    const li = document.createElement('li');
    const span = document.createElement('span'); span.textContent = taak;
    const button = document.createElement('button'); button.className = 'delete-task-btn'; button.textContent = 'X';
    li.appendChild(span); li.appendChild(button);
    return li;
}
function renderTaskList(listId, takenArray) {
    const ul = document.getElementById(listId);
    ul.innerHTML = ''; 
    takenArray.forEach(taak => {
        ul.appendChild(createTaakLi(taak));
    });
}
function setupChecklistEditor() {
    const activiteitSelect = document.getElementById('cl-activiteit');
    const saveButton = document.getElementById('checklist-save-button');
    
    activiteitSelect.addEventListener('change', () => {
        const activiteit = activiteitSelect.value;
        const openenList = document.getElementById('cl-openen-list');
        const sluitenList = document.getElementById('cl-sluiten-list');
        
        if (activiteit && HUIDIGE_CHECKLIST_CONFIG[activiteit]) {
            const config = HUIDIGE_CHECKLIST_CONFIG[activiteit];
            renderTaskList('cl-openen-list', config.openen);
            renderTaskList('cl-sluiten-list', config.sluiten);
        } else {
            openenList.innerHTML = '';
            sluitenList.innerHTML = '';
        }
    });
    document.querySelectorAll('.add-task-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetListId = button.dataset.targetList;
            const sourceInputId = button.dataset.sourceInput;
            const input = document.getElementById(sourceInputId);
            const list = document.getElementById(targetListId);
            const taakText = input.value.trim();
            if (taakText) {
                list.appendChild(createTaakLi(taakText));
                input.value = ''; input.focus(); 
            }
        });
        const input = document.getElementById(button.dataset.sourceInput);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); button.click(); }
        });
    });
    document.querySelectorAll('.task-list').forEach(list => {
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-task-btn')) {
                e.target.parentElement.remove();
            }
        });
    });
    saveButton.addEventListener('click', () => {
        const activiteit = activiteitSelect.value;
        if (!activiteit) { alert("Selecteer eerst een activiteit."); return; }
        const takenOpenen = Array.from(document.querySelectorAll('#cl-openen-list li span')).map(span => span.textContent);
        const takenSluiten = Array.from(document.querySelectorAll('#cl-sluiten-list li span')).map(span => span.textContent);
        saveButton.disabled = true; saveButton.textContent = "Opslaan...";
        callApi("SET_CHECKLIST_CONFIG", { activiteit: activiteit, type: "openen", taken: takenOpenen })
            .then(result => {
                return callApi("SET_CHECKLIST_CONFIG", { activiteit: activiteit, type: "sluiten", taken: takenSluiten });
            })
            .then(result => {
                alert(`Checklist voor "${activiteit}" succesvol opgeslagen.`);
                fetchChecklistConfig(); 
            })
            .catch(error => handleError(error, "Fout bij opslaan checklist: "))
            .finally(() => {
                saveButton.disabled = false; saveButton.textContent = "Checklist Opslaan";
            });
    });
}

// ========================
//  NIEUWE FUNCTIES
// ========================
function fetchDefects() {
    callApi("GET_DEFECTS")
        .then(result => {
            renderDefects(result.data);
        })
        .catch(error => handleError(error, "Fout bij laden defecten: "));
}

function renderDefects(defects) {
    const defectBody = document.getElementById('defect-body');
    if (!defectBody) return; // Zorg dat het niet crasht
    
    if (defects.length === 0) {
        defectBody.innerHTML = '<tr><td colspan="4">Geen defecten gevonden.</td></tr>';
        return;
    }
    
    let html = '';
    defects.forEach(defect => {
        let ts = new Date(defect.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
        html += `
            <tr>
                <td data-label="Tijdstip">${ts}</td>
                <td data-label="Gemeld door">${defect.medewerker}</td>
                <td data-label="Kart #">${defect.kartNummer}</td>
                <td data-label="Omschrijving Defect">${defect.defect}</td>
            </tr>
        `;
    });
    defectBody.innerHTML = html;
}
// ========================


// --- DEEL 7: ALGEMENE API & FOUTAFHANDELING (Ongewijzigd) ---
async function callApi(type, extraData = {}) {
    const url = WEB_APP_URL + "?v=" + new Date().getTime(); // Cache-buster
    const payload = { type: type, rol: ingelogdeRol, ...extraData };
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
function handleError(error, prefix = "Fout: ") {
    console.error(prefix, error);
    statusDiv.style.display = 'block';
    statusDiv.className = 'error';
    statusDiv.textContent = prefix + (error.message || "Failed to fetch");
}