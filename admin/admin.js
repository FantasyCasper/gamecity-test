/* ===============================
   VOLLEDIGE ADMIN.JS (MET CHECKLIST BEHEER)
   =============================== */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykI7IjMAeUFrMhJJwFAIV7gvbdjhe1vqNLr1WRevW4Mee0M7v_Nw8P2H6IhzemydogHw/exec";

const ingelogdeRol = localStorage.getItem('ingelogdeRol');
const statusDiv = document.getElementById('status-message');
let HUIDIGE_CHECKLIST_CONFIG = {}; // Voor de checklist editor

// --- DEEL 1: BEWAKER & INIT ---
(function() {
    if (ingelogdeRol !== 'manager' && ingelogdeRol !== 'TD') {
        alert("Toegang geweigerd."); window.location.href = "../index.html"; return; 
    }
    
    // Data ophalen
    fetchAlgemeenDefects(); 
    if (ingelogdeRol === 'manager') {
        fetchLogData();
        fetchUsers();
        fetchChecklistConfig(); // Alleen managers mogen checklists laden/aanpassen
    }

    // Interface aanpassen voor TD
    if (ingelogdeRol === 'TD') {
        document.querySelector('.tab-link[data-tab="tab-logs"]').style.display = 'none';
        document.querySelector('.tab-link[data-tab="tab-users"]').style.display = 'none';
        document.querySelector('.tab-link[data-tab="tab-checklists"]').style.display = 'none'; // Ook checklist beheer verbergen
        
        document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        
        const defectBtn = document.querySelector('.tab-link[data-tab="tab-algemeen-defecten"]');
        const defectContent = document.getElementById('tab-algemeen-defecten');
        if (defectBtn) defectBtn.classList.add('active');
        if (defectContent) defectContent.classList.add('active');
    }
    
    // Koppel de listeners
    setupTabNavigation();
    setupMobileMenu(); 
    setupUserForm();
    setupUserDeleteListener();
    setupAlgemeenDefectListeners(); 
    setupChecklistEditor(); // Nieuw

})(); 

// --- DEEL 2: NAVIGATIE FUNCTIES ---
function setupMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mainNav = document.querySelector('.tab-nav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => { mainNav.classList.toggle('is-open'); });
        document.querySelectorAll('.tab-link').forEach(button => {
            button.addEventListener('click', () => { if (window.innerWidth <= 720) { mainNav.classList.remove('is-open'); } });
        });
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => { if (window.innerWidth <= 720) { mainNav.classList.remove('is-open'); } });
        }
    }
}
function setupTabNavigation(){
    document.querySelectorAll(".tab-link").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
            document.querySelectorAll(".tab-link").forEach(link => link.classList.remove("active"));
            const tabId = button.getAttribute("data-tab");
            
            const tabContent = document.getElementById(tabId);
            if (tabContent) { // Zorg dat het element bestaat
                tabContent.classList.add("active");
                button.classList.add("active");
            }
        });
    });
}

// --- DEEL 3: LOGBOEK FUNCTIES ---
function fetchLogData(){
    statusDiv.textContent = "Logboek laden..."; statusDiv.className = "loading";
    callApi("GET_LOGS").then(result => {
        statusDiv.style.display = "none"; 
        renderLogs(result.data);
    }).catch(error => handleError(error, "Fout bij laden logboek: "));
}
function renderLogs(logs){
    const logBody = document.getElementById("log-body");
    if (!logBody) return;
    if (logs.length === 0) {
        logBody.innerHTML = '<tr><td colspan="7">Nog geen logs gevonden.</td></tr>'; return;
    }
    let html = "";
    logs.forEach(log => {
        let ts = new Date(log.timestamp).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
        html += `
            <tr>
                <td data-label="Tijdstip">${ts}</td><td data-label="Medewerker">${log.medewerker}</td>
                <td data-label="Activiteit">${log.activiteit}</td><td data-label="Lijst">${log.lijstnaam}</td>
                <td data-label="Voltooid">${log.voltooid}</td><td data-label="Gemist">${log.gemist}</td>
                <td data-label="Bijzonderheden">${log.bijzonderheden || ""}</td>
            </tr>
        `;
    });
    logBody.innerHTML = html;
}

// --- DEEL 4: GEBRUIKERSBEHEER FUNCTIES ---
function fetchUsers(){
    callApi("GET_USERS").then(result => { renderUsers(result.data); })
    .catch(error => handleError(error, "Fout bij laden gebruikers: "));
}
function renderUsers(users){
    const userBody = document.getElementById("user-body");
    if (!userBody) return;
    userBody.innerHTML = "";
    if (users.length === 0) {
        userBody.innerHTML = '<tr><td colspan="4">Geen gebruikers gevonden.</td></tr>'; return;
    }
    let html = "";
    users.forEach(user => {
        html += `<tr><td data-label="Gebruikersnaam">${user.username}</td><td data-label="Volledige Naam">${user.fullname}</td><td data-label="Rol">${user.role}</td><td data-label="Actie"><button class="delete-btn" data-username="${user.username}">Verwijder</button></td></tr>`;
    });
    userBody.innerHTML = html;
}
function setupUserForm(){
    const form = document.getElementById("add-user-form"), button = document.getElementById("add-user-button");
    if (!form) return; // Sla over als de gebruiker TD is
    form.addEventListener("submit", e => {
        e.preventDefault(); button.disabled = true; button.textContent = "Bezig...";
        const userData = {
            username: document.getElementById("new-username").value,
            fullname: document.getElementById("new-fullname").value,
            pincode: document.getElementById("new-pincode").value,
            role: document.getElementById("new-role").value
        };
        callApi("ADD_USER", { userData: userData }).then(result => {
            alert(result.message); form.reset(); fetchUsers(); 
        }).catch(error => handleError(error, "Fout bij toevoegen: ")).finally(() => {
            button.disabled = false; button.textContent = "Gebruiker Toevoegen";
        });
    });
}
function setupUserDeleteListener(){
    const userTable = document.getElementById("user-table");
    if (!userTable) return; // Sla over als de gebruiker TD is
    userTable.addEventListener("click", e => {
        if (e.target.classList.contains("delete-btn")) {
            const button = e.target, username = button.dataset.username;
            if (confirm(`Weet je zeker dat je "${username}" wilt verwijderen?`)) {
                button.disabled = true; button.textContent = "Bezig...";
                callApi("DELETE_USER", { username: username }).then(result => {
                    alert(result.message); fetchUsers();
                }).catch(error => {
                    handleError(error, "Fout bij verwijderen: ");
                    button.disabled = false; button.textContent = "Verwijder";
                });
            }
        }
    });
}

// --- DEEL 5: ALGEMEEN DEFECTEN FUNCTIES ---
function fetchAlgemeenDefects() {
    callApi("GET_ALGEMEEN_DEFECTS")
        .then(result => {
            statusDiv.style.display = "none"; // Verberg 'Laden...'
            renderAlgemeenDefects(result.data);
        })
        .catch(error => handleError(error, "Fout bij laden algemene defecten: "));
}
function renderAlgemeenDefects(defects) {
    const defectBody = document.getElementById('algemeen-defect-body');
    if (!defectBody) return;
    defectBody.innerHTML = '';
    if (defects.length === 0) {
        defectBody.innerHTML = '<tr><td colspan="6">Geen algemene defecten gevonden.</td></tr>';
        return;
    }
    defects.forEach(defect => {
        let ts = new Date(defect.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
        const tr = document.createElement('tr');
        if (defect.status === 'Opgelost') {
            tr.classList.add('status-opgelost');
        }
        const isOpgelost = defect.status === 'Opgelost';
        const actieKnop = isOpgelost 
            ? `<button class="delete-btn" data-row-id="${defect.rowId}">Verwijder</button>`
            : `<button class="action-btn" data-row-id="${defect.rowId}">Markeer Opgelost</button>`;
        
        tr.innerHTML = `
            <td data-label="Tijdstip">${ts}</td>
            <td data-label="Gemeld door">${defect.medewerker}</td>
            <td data-label="Locatie">${defect.locatie}</td>
            <td data-label="Omschrijving">${defect.defect}</td>
            <td data-label="Status"><strong>${defect.status}</strong></td>
            <td data-label="Actie">${actieKnop}</td>
        `;
        defectBody.appendChild(tr);
    });
}
function setupAlgemeenDefectListeners() {
    document.getElementById('algemeen-defect-table').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('action-btn')) { // 'Markeer Opgelost'
            const rowId = target.dataset.rowId;
            markeerAlgemeenDefect(rowId, "Opgelost", target);
        }
        if (target.classList.contains('delete-btn')) { // 'Verwijder'
            if (confirm('Weet je zeker dat je dit opgeloste defect permanent wilt verwijderen?')) {
                const rowId = target.dataset.rowId;
                markeerAlgemeenDefect(rowId, "Verwijderd", target); // Gebruikt dezelfde functie
            }
        }
    });
}
function markeerAlgemeenDefect(rowId, newStatus, buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = "Bezig...";
    const payload = {
        type: "UPDATE_ALGEMEEN_DEFECT_STATUS",
        rol: ingelogdeRol, 
        rowId: rowId,
        newStatus: newStatus
    };
    callApi("UPDATE_ALGEMEEN_DEFECT_STATUS", payload)
        .then(result => {
            fetchAlgemeenDefects(); // Ververs de lijst
        })
        .catch(error => {
            handleError(error, `Fout bij bijwerken: `);
            buttonEl.disabled = false;
        });
}

// --- DEEL 6: CHECKLIST FUNCTIES (TERUG) ---
function fetchChecklistConfig() {
    callApi("GET_CHECKLIST_CONFIG").then(result => {
        HUIDIGE_CHECKLIST_CONFIG = result.data;
    }).catch(error => handleError(error, "Fout bij laden checklists: "));
}
function createTaakLi(taak) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${taak}</span><button class="delete-task-btn">X</button>`;
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
    if (!activiteitSelect) return; // Stop als de gebruiker een TD is

    activiteitSelect.addEventListener('change', () => {
        const activiteit = activiteitSelect.value;
        const config = HUIDIGE_CHECKLIST_CONFIG[activiteit];
        if (config) {
            renderTaskList('cl-openen-list', config.openen);
            renderTaskList('cl-sluiten-list', config.sluiten);
        } else {
            renderTaskList('cl-openen-list', []);
            renderTaskList('cl-sluiten-list', []);
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
                fetchChecklistConfig(); // Ververs de config
            })
            .catch(error => handleError(error, "Fout bij opslaan checklist: "))
            .finally(() => {
                saveButton.disabled = false; saveButton.textContent = "Checklist Opslaan";
            });
    });
}

// --- DEEL 7: ALGEMENE API & FOUTAFHANDELING ---
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