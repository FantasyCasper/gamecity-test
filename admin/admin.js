// ##################################################################
// #                        BELANGRIJKE STAP                        #
// # PLAK HIER JE GOOGLE WEB APP URL                                #
// ##################################################################
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_tSrtNqwiQrpvFW0v6KFI0y0t8gomgbV-C2AzRYdKlE0es7k7z9U72jb7HArTxQHatw/exec";

// Globale variabelen
const ingelogdeRol = localStorage.getItem('ingelogdeRol');
const statusDiv = document.getElementById('status-message');
let HUIDIGE_CHECKLIST_CONFIG = {}; // Sla de config op

// --- DEEL 1: BEWAKER & INIT ---
(function() {
    if (ingelogdeRol !== 'manager') {
        alert("Toegang geweigerd.");
        window.location.href = "../index.html";
        return; 
    }
    
    // Haal *alle* data op bij het laden
    fetchLogData();
    fetchUsers();
    fetchChecklistConfig(); // <-- NIEUW
    
    // Koppel de listeners
    setupTabNavigation();
    setupUserForm();
    setupUserDeleteListener();
    setupChecklistEditor(); // <-- NIEUW

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
function fetchLogData() { /* ... (code van vorige stap is identiek) ... */ 
    statusDiv.textContent = "Logboek laden...";
    statusDiv.className = 'loading';
    callApi("GET_LOGS").then(result => {
        statusDiv.style.display = 'none';
        renderLogs(result.data);
    }).catch(error => handleError(error, "Fout bij laden logboek: "));
}
function renderLogs(logs) { /* ... (code van vorige stap is identiek) ... */
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
function fetchUsers() { /* ... (code van vorige stap is identiek) ... */
    callApi("GET_USERS").then(result => {
        renderUsers(result.data);
    }).catch(error => handleError(error, "Fout bij laden gebruikers: "));
}
function renderUsers(users) { /* ... (code van vorige stap is identiek) ... */
    const userBody = document.getElementById('user-body');
    userBody.innerHTML = '';
    if (users.length === 0) { userBody.innerHTML = '<tr><td colspan="4">Geen gebruikers gevonden.</td></tr>'; return; }
    let html = '';
    users.forEach(user => {
        html += `<tr><td data-label="Gebruikersnaam">${user.username}</td><td data-label="Volledige Naam">${user.fullname}</td><td data-label="Rol">${user.role}</td><td data-label="Actie"><button class="delete-btn" data-username="${user.username}">Verwijder</button></td></tr>`;
    });
    userBody.innerHTML = html;
}
function setupUserForm() { /* ... (code van vorige stap is identiek) ... */
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
function setupUserDeleteListener() { /* ... (code van vorige stap is identiek) ... */
    const userTable = document.getElementById('user-table');
    userTable.addEventListener('click', (e) => {
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

// --- DEEL 5: NIEUWE CHECKLIST FUNCTIES ---

function fetchChecklistConfig() {
    callApi("GET_CHECKLIST_CONFIG")
        .then(result => {
            HUIDIGE_CHECKLIST_CONFIG = result.data;
            const dataList = document.getElementById('activiteiten-lijst');
            dataList.innerHTML = '';
            // Vul de datalist (voor autocomplete)
            for (const activiteit in HUIDIGE_CHECKLIST_CONFIG) {
                dataList.innerHTML += `<option value="${activiteit}">`;
            }
        })
        .catch(error => handleError(error, "Fout bij laden checklists: "));
}

function setupChecklistEditor() {
    const activiteitInput = document.getElementById('cl-activiteit');
    const openenText = document.getElementById('cl-openen');
    const sluitenText = document.getElementById('cl-sluiten');
    const saveButton = document.getElementById('checklist-save-button');

    // Als de gebruiker een activiteit kiest (of typt), vul de velden
    activiteitInput.addEventListener('change', () => {
        const activiteit = activiteitInput.value;
        const config = HUIDIGE_CHECKLIST_CONFIG[activiteit];
        
        if (config) {
            // Bestaande activiteit: vul taken in
            openenText.value = config.openen.join('\n');
            sluitenText.value = config.sluiten.join('\n');
        } else {
            // Nieuwe activiteit: maak velden leeg
            openenText.value = '';
            sluitenText.value = '';
        }
    });

    // Opslaan knop
    saveButton.addEventListener('click', () => {
        const activiteit = document.getElementById('cl-activiteit').value;
        if (!activiteit) {
            alert("Vul een activiteit-naam in.");
            return;
        }
        
        // Lees de textareas en split op newline, filter lege regels
        const takenOpenen = openenText.value.split('\n').filter(Boolean);
        const takenSluiten = sluitenText.value.split('\n').filter(Boolean);

        saveButton.disabled = true;
        saveButton.textContent = "Opslaan...";

        // We moeten twee aparte API calls doen, na elkaar
        callApi("SET_CHECKLIST_CONFIG", { activiteit: activiteit, type: "openen", taken: takenOpenen })
            .then(result => {
                // Eerste call (openen) gelukt. Doe nu de tweede (sluiten).
                return callApi("SET_CHECKLIST_CONFIG", { activiteit: activiteit, type: "sluiten", taken: takenSluiten });
            })
            .then(result => {
                // Beide gelukt!
                alert(`Checklist voor "${activiteit}" succesvol opgeslagen.`);
                fetchChecklistConfig(); // Ververs de config
            })
            .catch(error => handleError(error, "Fout bij opslaan checklist: "))
            .finally(() => {
                saveButton.disabled = false;
                saveButton.textContent = "Checklist Opslaan";
            });
    });
}


// --- DEEL 6: ALGEMENE API & FOUTAFHANDELING (Ongewijzigd) ---
async function callApi(type, extraData = {}) {
    const payload = { type: type, rol: ingelogdeRol, ...extraData };
    const response = await fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
    const result = await response.json();
    if (result.status === "success") { return result; } 
    else { throw new Error(result.message); }
}
function handleError(error, prefix = "Fout: ") {
    console.error(prefix, error);
    statusDiv.style.display = 'block';
    statusDiv.className = 'error';
    statusDiv.textContent = prefix + error.message;
}