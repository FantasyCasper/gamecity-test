/* ===============================
   VOLLEDIGE ADMIN.JS (MET FILTER VOOR VERWIJDERDE ITEMS)
   =============================== */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

const ingelogdeRol = localStorage.getItem('ingelogdeRol');
const statusDiv = document.getElementById('status-message');
let HUIDIGE_CHECKLIST_CONFIG = {}; 

// --- DEEL 1: BEWAKER & INIT ---
(function() {
    if (ingelogdeRol !== 'manager' && ingelogdeRol !== 'TD') {
        alert("Toegang geweigerd."); 
        window.location.href = "../index.html"; 
        return; 
    }
    
    fetchAlgemeenDefects(); 
    
    if (ingelogdeRol === 'manager') {
        fetchLogData();
        fetchUsers();
        fetchChecklistConfig(); 
    }

    if (ingelogdeRol === 'TD') {
        const logBtn = document.querySelector('.tab-link[data-tab="tab-logs"]');
        const userBtn = document.querySelector('.tab-link[data-tab="tab-users"]');
        const checkBtn = document.querySelector('.tab-link[data-tab="tab-checklists"]');
        if (logBtn) logBtn.style.display = 'none';
        if (userBtn) userBtn.style.display = 'none';
        if (checkBtn) checkBtn.style.display = 'none';

        document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        
        const defectBtn = document.querySelector('.tab-link[data-tab="tab-algemeen-defecten"]');
        const defectContent = document.getElementById('tab-algemeen-defecten');
        
        if (defectBtn) defectBtn.classList.add('active');
        if (defectContent) defectContent.classList.add('active');
    }
    
    setupTabNavigation();
    setupMobileMenu(); 
    setupUserForm();
    setupUserDeleteListener();
    setupAlgemeenDefectListeners(); 
    setupChecklistEditor();

})(); 

// --- DEEL 2: NAVIGATIE ---
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
            if (tabContent) {
                tabContent.classList.add("active");
                button.classList.add("active");
            }
        });
    });
}

// --- DEEL 3: LOGBOEK ---
function fetchLogData(){
    statusDiv.textContent = "Logboek laden..."; statusDiv.className = "loading";
    callApi("GET_LOGS").then(result => {
        statusDiv.style.display = "none"; renderLogs(result.data);
    }).catch(error => handleError(error, "Fout bij laden logboek: "));
}
function renderLogs(logs){
    const logBody = document.getElementById("log-body");
    if (!logBody) return;
    if (logs.length === 0) { logBody.innerHTML = '<tr><td colspan="7">Nog geen logs gevonden.</td></tr>'; return; }
    let html = "";
    logs.forEach(log => {
        let ts = new Date(log.timestamp).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
        html += `<tr><td data-label="Tijdstip">${ts}</td><td data-label="Medewerker">${log.medewerker}</td><td data-label="Activiteit">${log.activiteit}</td><td data-label="Lijst">${log.lijstnaam}</td><td data-label="Voltooid">${log.voltooid}</td><td data-label="Gemist">${log.gemist}</td><td data-label="Bijzonderheden">${log.bijzonderheden || ""}</td></tr>`;
    });
    logBody.innerHTML = html;
}

// --- DEEL 4: USERS ---
function fetchUsers(){
    callApi("GET_USERS").then(result => { renderUsers(result.data); }).catch(error => handleError(error, "Fout bij laden gebruikers: "));
}
function renderUsers(users){
    const userBody = document.getElementById("user-body");
    if (!userBody) return;
    userBody.innerHTML = "";
    if (users.length === 0) { userBody.innerHTML = '<tr><td colspan="4">Geen gebruikers gevonden.</td></tr>'; return; }
    let html = "";
    users.forEach(user => {
        html += `<tr><td data-label="Gebruikersnaam">${user.username}</td><td data-label="Volledige Naam">${user.fullname}</td><td data-label="Rol">${user.role}</td><td data-label="Actie"><button class="delete-btn" data-username="${user.username}">Verwijder</button></td></tr>`;
    });
    userBody.innerHTML = html;
}
function setupUserForm(){
    const form = document.getElementById("add-user-form"), button = document.getElementById("add-user-button");
    if (!form) return; 
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
    if (!userTable) return; 
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

// --- DEEL 5: ALGEMEEN DEFECTEN (MET FILTER) ---
function fetchAlgemeenDefects() {
    callApi("GET_ALGEMEEN_DEFECTS")
        .then(result => {
            if (statusDiv) statusDiv.style.display = "none"; 
            renderAlgemeenDefects(result.data);
        })
        .catch(error => handleError(error, "Fout bij laden algemene defecten: "));
}
function renderAlgemeenDefects(defects) {
    const defectBody = document.getElementById('algemeen-defect-body');
    if (!defectBody) return;
    defectBody.innerHTML = '';
    
    // --- HIER IS DE FIX: Filter verwijderde items eruit ---
    const zichtbareDefecten = defects.filter(d => d.status !== "Verwijderd");

    if (zichtbareDefecten.length === 0) {
        defectBody.innerHTML = '<tr><td colspan="6">Geen algemene defecten gevonden.</td></tr>';
        return;
    }
    
    zichtbareDefecten.forEach(defect => {
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
    const table = document.getElementById('algemeen-defect-table');
    if (!table) return;
    table.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('action-btn')) { 
            const rowId = target.dataset.rowId;
            markeerAlgemeenDefect(rowId, "Opgelost", target);
        }
        if (target.classList.contains('delete-btn')) { 
            if (confirm('Weet je zeker dat je dit opgeloste defect permanent wilt verwijderen?')) {
                const rowId = target.dataset.rowId;
                markeerAlgemeenDefect(rowId, "Verwijderd", target); 
            }
        }
    });
}
function markeerAlgemeenDefect(rowId, newStatus, buttonEl) {
    buttonEl.disabled = true; buttonEl.textContent = "Bezig...";
    const payload = { type: "UPDATE_ALGEMEEN_DEFECT_STATUS", rol: ingelogdeRol, rowId: rowId, newStatus: newStatus };
    callApi("UPDATE_ALGEMEEN_DEFECT_STATUS", payload).then(result => {
        fetchAlgemeenDefects(); 
    }).catch(error => {
        handleError(error, `Fout bij bijwerken: `);
        buttonEl.disabled = false;
    });
}

// --- DEEL 6: CHECKLISTS ---
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
    if (!ul) return;
    ul.innerHTML = ''; 
    if (!takenArray) return;
    takenArray.forEach(taak => { ul.appendChild(createTaakLi(taak)); });
}
function setupChecklistEditor() {
    const activiteitSelect = document.getElementById('cl-activiteit');
    const saveButton = document.getElementById('checklist-save-button');
    if (!activiteitSelect || !saveButton) return; 

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
            if (input && list) {
                const taakText = input.value.trim();
                if (taakText) {
                    list.appendChild(createTaakLi(taakText));
                    input.value = ''; input.focus(); 
                }
            }
        });
        const input = document.getElementById(button.dataset.sourceInput);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); button.click(); }
            });
        }
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
        if (!activiteit || activiteit === "") { alert("Selecteer eerst een activiteit."); return; }
        
        const takenOpenen = Array.from(document.querySelectorAll('#cl-openen-list li span')).map(span => span.textContent);
        const takenSluiten = Array.from(document.querySelectorAll('#cl-sluiten-list li span')).map(span => span.textContent);
        saveButton.disabled = true; saveButton.textContent = "Opslaan...";
        
        if (!HUIDIGE_CHECKLIST_CONFIG[activiteit]) HUIDIGE_CHECKLIST_CONFIG[activiteit] = {};
        HUIDIGE_CHECKLIST_CONFIG[activiteit].openen = takenOpenen;
        HUIDIGE_CHECKLIST_CONFIG[activiteit].sluiten = takenSluiten;
        
        callApi({ type: "SET_CHECKLIST_CONFIG", activiteit: activiteit, onderdeel: "openen", taken: takenOpenen })
            .then(result => {
                return callApi({ type: "SET_CHECKLIST_CONFIG", activiteit: activiteit, onderdeel: "sluiten", taken: takenSluiten });
            })
            .then(result => {
                toonMooieModal("Opgeslagen!", `Checklist voor "${activiteit}" is succesvol opgeslagen.`);
            })
            .catch(error => handleError(error, "Fout bij opslaan checklist: "))
            .finally(() => {
                saveButton.disabled = false; saveButton.textContent = "Checklist Opslaan";
            });
    });
}

// --- NIEUWE MODAL FUNCTIE ---
function toonMooieModal(titel, bericht) {
    const overlay = document.getElementById('custom-modal-overlay');
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const btn = document.getElementById('modal-ok-btn');

    if(titleEl) titleEl.textContent = titel;
    if(msgEl) msgEl.textContent = bericht;

    if(overlay && modal) {
        overlay.style.display = 'block';
        modal.style.display = 'block';
    }

    // Sluit functie
    function sluitModal() {
        overlay.style.display = 'none';
        modal.style.display = 'none';
    }

    // Koppel klik events (zorg dat we niet dubbel koppelen)
    btn.onclick = sluitModal;
    overlay.onclick = sluitModal;
}

// --- API ---
async function callApi(type, extraData = {}) {
    const url = WEB_APP_URL + "?v=" + new Date().getTime(); 
    let payload;
    if (typeof type === 'string') {
        payload = { type: type, rol: ingelogdeRol, ...extraData };
    } else {
        payload = type;
        payload.rol = ingelogdeRol;
    }
    const response = await fetch(url, {
        method: 'POST', body: JSON.stringify(payload), headers: { "Content-Type": "text/plain;charset=utf-8" }, mode: 'cors'
    });
    const result = await response.json();
    if (result.status === "success") { return result; } 
    else { throw new Error(result.message); }
}
function handleError(error, prefix = "Fout: ") {
    console.error(prefix, error);
    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'error';
        statusDiv.textContent = prefix + (error.message || "Failed to fetch");
    }
}