/* ===============================
   VOLLEDIGE ADMIN.JS (MET PERMISSIES & FILTERS)
   =============================== */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

const statusDiv = document.getElementById('status-message');
let ingelogdePermissies = {};
let HUIDIGE_CHECKLIST_CONFIG = {}; 
let alleAdminDefectenCache = [];
let localUsersCache = [];

// --- DEEL 1: BEWAKER & INIT ---
(function() {
    const rawPerms = localStorage.getItem('ingelogdePermissies');
    
    // 1. Login Check
    if (!rawPerms) {
        window.location.href = "../index.html"; 
        return; 
    }
    ingelogdePermissies = JSON.parse(rawPerms);

    // 2. Beveiliging: Heb je uberhaupt iets te zoeken hier?
    if (!ingelogdePermissies.admin && !ingelogdePermissies.td && !ingelogdePermissies.users) {
        alert("Geen toegang tot Admin Panel.");
        window.location.href = "../index.html"; 
        return;
    }

    // 3. Interface aanpassen op basis van rechten
    manageTabVisibility();
    setupMobileMenu();
    setupTabNavigation();

    // 4. Data ophalen & Listeners starten op basis van rechten
    
    // A. Defecten (Admin & TD)
    if (ingelogdePermissies.admin || ingelogdePermissies.td) {
        fetchAlgemeenDefects(); 
        setupAlgemeenDefectListeners();
        
        // Filter listener
        const filterSelect = document.getElementById('admin-filter-locatie');
        if (filterSelect) {
            filterSelect.addEventListener('change', filterAdminDefecten);
        }
    }
    
    // B. Logs & Checklists (Alleen Admin)
    if (ingelogdePermissies.admin) {
        fetchLogData();
        fetchChecklistConfig(); 
        setupChecklistEditor();
    }
    
    // C. Gebruikers (Alleen Users recht)
    if (ingelogdePermissies.users) {
        fetchUsers();
        setupUserForm();
        setupUserDeleteListener();
        setupUserPermListeners(); // De nieuwe interactieve vinkjes
    }

})(); 

// --- DEEL 2: NAVIGATIE & UI ---

function manageTabVisibility() {
    // 1. Verberg alles eerst
    const logTab = document.querySelector('.tab-link[data-tab="tab-logs"]');
    const userTab = document.querySelector('.tab-link[data-tab="tab-users"]');
    const checkTab = document.querySelector('.tab-link[data-tab="tab-checklists"]');
    const defectTab = document.querySelector('.tab-link[data-tab="tab-algemeen-defecten"]');

    if(logTab) logTab.style.display = 'none';
    if(userTab) userTab.style.display = 'none';
    if(checkTab) checkTab.style.display = 'none';
    if(defectTab) defectTab.style.display = 'none';

    // 2. Toon wat mag
    let firstVisibleTab = null;

    if (ingelogdePermissies.admin) {
        if(logTab) logTab.style.display = 'inline-block';
        if(checkTab) checkTab.style.display = 'inline-block';
        if(defectTab) defectTab.style.display = 'inline-block'; 
        if(!firstVisibleTab) firstVisibleTab = 'tab-logs';
    }

    if (ingelogdePermissies.users) {
        if(userTab) userTab.style.display = 'inline-block';
        if(!firstVisibleTab) firstVisibleTab = 'tab-users';
    }

    if (ingelogdePermissies.td) {
        if(defectTab) defectTab.style.display = 'inline-block';
        if(!firstVisibleTab) firstVisibleTab = 'tab-algemeen-defecten';
    }

    // 3. Open het eerste tabblad dat mag
    if (firstVisibleTab) {
        const tabBtn = document.querySelector(`.tab-link[data-tab="${firstVisibleTab}"]`);
        if(tabBtn) tabBtn.click();
    }
}

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

// Custom Modal Functie
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

    function sluitModal() {
        overlay.style.display = 'none';
        modal.style.display = 'none';
    }

    if(btn) btn.onclick = sluitModal;
    if(overlay) overlay.onclick = sluitModal;
}


// --- DEEL 3: LOGBOEK (Admin Only) ---
function fetchUsers(){
    callApi("GET_USERS").then(result => { 
        localUsersCache = result.data; // <--- SLA OP
        renderUsers(localUsersCache); 
    }).catch(error => handleError(error, "Fout bij laden gebruikers: "));
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


// --- DEEL 4: USERS (Users Recht) ---
function fetchUsers(){
    callApi("GET_USERS").then(result => { renderUsers(result.data); }).catch(error => handleError(error, "Fout bij laden gebruikers: "));
}

function renderUsers(users) {
    const userBody = document.getElementById("user-body");
    if(!userBody) return;
    userBody.innerHTML = "";
    
    // Haal de huidige ingelogde gebruiker op
    const ingelogdeGebruiker = localStorage.getItem('ingelogdeUsername') || "";

    users.forEach(user => {
        // Check of dit de regel is van de persoon die nu kijkt
        const isSelf = (user.username.toLowerCase() === ingelogdeGebruiker.toLowerCase());
        
        // Helper om een checkbox te maken
        // AANPASSING: Als isSelf waar is, zijn ALLE vinkjes disabled.
        const createCheckbox = (type, value) => `
            <input type="checkbox" 
                   class="perm-checkbox" 
                   data-username="${user.username}" 
                   data-type="${type}" 
                   ${value ? 'checked' : ''} 
                   ${isSelf ? 'disabled title="Je kunt je eigen rechten niet wijzigen"' : ''}> 
        `;

        const tr = document.createElement('tr');
        // Geef de eigen rij een subtiele kleur zodat je hem herkent
        if (isSelf) tr.style.backgroundColor = "rgba(40, 167, 69, 0.1)"; 

        tr.innerHTML = `
            <td>${user.username} ${isSelf ? ' (Jij)' : ''}</td>
            <td>${user.fullname}</td>
            <td style="text-align:center;">${createCheckbox('checklists', user.perms.checklists)}</td>
            <td style="text-align:center;">${createCheckbox('admin', user.perms.admin)}</td>
            <td style="text-align:center;">${createCheckbox('td', user.perms.td)}</td>
            <td style="text-align:center;">${createCheckbox('users', user.perms.users)}</td>
            <td>
                ${!isSelf ? `<button class="delete-btn" data-username="${user.username}">Verwijder</button>` : '<span style="color:#aaa; font-size:0.8em; font-style:italic;">Niet verwijderbaar</span>'}
            </td>
        `;
        userBody.appendChild(tr);
    });
}
function setupUserForm(){
    const form = document.getElementById("add-user-form");
    const button = document.getElementById("add-user-button");
    if (!form) return; 
    
    form.addEventListener("submit", e => {
        e.preventDefault(); 
        
        // 1. Data verzamelen
        const userData = {
            username: document.getElementById("new-username").value.toLowerCase(),
            fullname: document.getElementById("new-fullname").value,
            pincode: document.getElementById("new-pincode").value,
            perms: {
                checklists: document.getElementById("perm-checklists").checked,
                admin: document.getElementById("perm-admin").checked,
                td: document.getElementById("perm-td").checked,
                users: document.getElementById("perm-users").checked
            }
        };

        // 2. OPTIMISTIC UI: Voeg direct toe aan de lokale lijst en teken opnieuw
        // We faken even dat het gelukt is voor de gebruiker
        localUsersCache.push(userData); 
        renderUsers(localUsersCache);
        
        // Reset formulier direct
        form.reset();
        toonMooieModal("Bezig...", "Gebruiker wordt op de achtergrond opgeslagen.");

        // 3. Stuur nu pas naar de server (op de achtergrond)
        button.disabled = true; // Even blokkeren om dubbel klikken te voorkomen
        
        callApi("ADD_USER", { userData: userData })
            .then(result => {
                console.log("Server bevestigt: gebruiker opgeslagen.");
                // Optioneel: We kunnen stiekem nog eens fetchen om zeker te zijn
                // fetchUsers(); 
            })
            .catch(error => {
                // Oei, het ging mis. Draai de wijziging terug!
                console.error("Fout bij opslaan:", error);
                alert("Er ging iets mis! De gebruiker wordt weer verwijderd.");
                
                // Verwijder de laatste toevoeging uit de lokale cache
                localUsersCache = localUsersCache.filter(u => u.username !== userData.username);
                renderUsers(localUsersCache);
            })
            .finally(() => {
                button.disabled = false;
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
                    toonMooieModal("Succes", result.message); 
                    fetchUsers();
                }).catch(error => {
                    handleError(error, "Fout bij verwijderen: ");
                    button.disabled = false; button.textContent = "Verwijder";
                });
            }
        }
    });
}

function setupUserPermListeners() {
    const table = document.getElementById('user-table');
    if (!table) return;

    table.addEventListener('change', (e) => {
        if (e.target.classList.contains('perm-checkbox')) {
            const checkbox = e.target;
            const username = checkbox.dataset.username;
            const permType = checkbox.dataset.type;
            const newValue = checkbox.checked;

            checkbox.disabled = true;
            document.body.style.cursor = 'wait';

            callApi("UPDATE_USER_PERMS", { 
                targetUser: username, 
                permType: permType, 
                newValue: newValue 
            })
            .then(result => {
                // Stil succes, of eventueel een kleine toast
                console.log(`Rechten voor ${username} bijgewerkt.`);
            })
            .catch(error => {
                checkbox.checked = !newValue; // Terugzetten bij fout
                toonMooieModal("Fout", "Kon rechten niet aanpassen: " + error.message);
            })
            .finally(() => {
                checkbox.disabled = false;
                document.body.style.cursor = 'default';
            });
        }
    });
}


// --- DEEL 5: ALGEMEEN DEFECTEN (Admin & TD) ---
function fetchAlgemeenDefects() {
    callApi("GET_ALGEMEEN_DEFECTS")
        .then(result => {
            if (statusDiv) statusDiv.style.display = "none"; 
            
            // 1. Sla data op in cache
            alleAdminDefectenCache = result.data || [];
            
            // 2. Filter en render
            filterAdminDefecten();
        })
        .catch(error => handleError(error, "Fout bij laden algemene defecten: "));
}

function filterAdminDefecten() {
    const filterSelect = document.getElementById('admin-filter-locatie');
    const gekozenLocatie = filterSelect ? filterSelect.value : 'alle';
    
    let teTonen = alleAdminDefectenCache;
    
    // Filter ook hier "Verwijderd" eruit voor de zekerheid, tenzij je die wilt zien
    teTonen = teTonen.filter(d => d.status !== "Verwijderd");

    if (gekozenLocatie !== 'alle') {
        teTonen = teTonen.filter(d => d.locatie === gekozenLocatie);
    }
    
    renderAlgemeenDefects(teTonen);
}

function renderAlgemeenDefects(defects) {
    const defectBody = document.getElementById('algemeen-defect-body');
    if (!defectBody) return;
    defectBody.innerHTML = '';
    
    if (defects.length === 0) {
        defectBody.innerHTML = '<tr><td colspan="6">Geen defecten gevonden voor deze selectie.</td></tr>';
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
    const payload = { type: "UPDATE_ALGEMEEN_DEFECT_STATUS", rowId: rowId, newStatus: newStatus };
    callApi("UPDATE_ALGEMEEN_DEFECT_STATUS", payload).then(result => {
        fetchAlgemeenDefects(); 
    }).catch(error => {
        handleError(error, `Fout bij bijwerken: `);
        buttonEl.disabled = false;
    });
}


// --- DEEL 6: CHECKLISTS (Admin Only) ---
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
                toonMooieModal("Opgeslagen", `Checklist voor "${activiteit}" succesvol opgeslagen.`);
            })
            .catch(error => handleError(error, "Fout bij opslaan checklist: "))
            .finally(() => {
                saveButton.disabled = false; saveButton.textContent = "Checklist Opslaan";
            });
    });
}


// --- API HELPER (MET PERMISSIES) ---
async function callApi(type, extraData = {}) {
    const url = WEB_APP_URL + "?v=" + new Date().getTime(); 
    let payload;

    if (typeof type === 'string') {
        payload = { type: type, ...extraData };
    } else {
        payload = type;
    }

    if (typeof ingelogdePermissies !== 'undefined') {
        payload.perms = ingelogdePermissies;
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
    } else {
        alert(prefix + error.message);
    }
}