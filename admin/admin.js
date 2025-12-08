/* ===============================
   VOLLEDIGE ADMIN.JS (MET ALLES EROP EN ERAAN)
   =============================== */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

const statusDiv = document.getElementById('status-message');
let ingelogdePermissies = {};
let BESCHIKBARE_ACTIVITEITEN = []; // Hier slaan we jouw lijst in op
let HUIDIGE_CHECKLIST_CONFIG = {};
let alleAdminDefectenCache = []; // Opslag voor filteren defecten
let localUsersCache = []; // Opslag voor optimistic UI gebruikers

// --- DEEL 1: BEWAKER & INIT ---
(function () {
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
        fetchSettings();
        setupSettingsForm();
    }

    // C. Gebruikers (Alleen Users recht)
    if (ingelogdePermissies.users) {
        fetchUsers();
        setupUserForm();
        setupUserActionListeners();
        setupUserPermListeners();
    }

})();

// --- DEEL 2: NAVIGATIE & UI ---

function manageTabVisibility() {
    // 1. Verberg alles eerst
    const logTab = document.querySelector('.tab-link[data-tab="tab-logs"]');
    const userTab = document.querySelector('.tab-link[data-tab="tab-users"]');
    const checkTab = document.querySelector('.tab-link[data-tab="tab-checklists"]');
    const defectTab = document.querySelector('.tab-link[data-tab="tab-algemeen-defecten"]');
    const settingsTab = document.querySelector('.tab-link[data-tab="tab-settings"]');

    if (logTab) logTab.style.display = 'none';
    if (userTab) userTab.style.display = 'none';
    if (checkTab) checkTab.style.display = 'none';
    if (defectTab) defectTab.style.display = 'none';
    if (settingsTab) settingsTab.style.display = 'none';

    // 2. Toon wat mag
    let firstVisibleTab = null;

    if (ingelogdePermissies.admin) {
        if (logTab) logTab.style.display = 'inline-block';
        if (checkTab) checkTab.style.display = 'inline-block';
        if (defectTab) defectTab.style.display = 'inline-block';
        if (settingsTab) settingsTab.style.display = 'inline-block';
        if (!firstVisibleTab) firstVisibleTab = 'tab-logs';
    }

    if (ingelogdePermissies.users) {
        if (userTab) userTab.style.display = 'inline-block';
        if (!firstVisibleTab) firstVisibleTab = 'tab-users';
    }

    if (ingelogdePermissies.td) {
        if (defectTab) defectTab.style.display = 'inline-block';
        if (!firstVisibleTab) firstVisibleTab = 'tab-algemeen-defecten';
    }

    // 3. Open het eerste tabblad dat mag
    if (firstVisibleTab) {
        const tabBtn = document.querySelector(`.tab-link[data-tab="${firstVisibleTab}"]`);
        if (tabBtn) tabBtn.click();
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

function setupTabNavigation() {
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

    if (titleEl) titleEl.textContent = titel;
    if (msgEl) msgEl.textContent = bericht;

    if (overlay && modal) {
        overlay.style.display = 'block';
        modal.style.display = 'block';
    }

    function sluitModal() {
        overlay.style.display = 'none';
        modal.style.display = 'none';
    }

    if (btn) btn.onclick = sluitModal;
    if (overlay) overlay.onclick = sluitModal;
}


// --- DEEL 3: LOGBOEK (Admin Only) ---
function fetchLogData() {
    if (statusDiv) { statusDiv.textContent = "Logboek laden..."; statusDiv.className = "loading"; }

    toonSkeletonRijen('algemeen-defect-body', 5, 7);

    callApi("GET_LOGS").then(result => {
        if (statusDiv) statusDiv.style.display = "none";
        renderLogs(result.data);
    }).catch(error => handleError(error, "Fout bij laden logboek: "));
}

function renderLogs(logs) {
    const logBody = document.getElementById("log-body");
    if (!logBody) return;

    // SAFETY CHECK
    if (!logs) logs = [];

    if (logs.length === 0) { logBody.innerHTML = '<tr><td colspan="7">Nog geen logs gevonden.</td></tr>'; return; }
    let html = "";
    logs.forEach(log => {
        let ts = new Date(log.timestamp).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
        html += `<tr><td data-label="Tijdstip">${ts}</td><td data-label="Medewerker">${log.medewerker}</td><td data-label="Activiteit">${log.activiteit}</td><td data-label="Lijst">${log.lijstnaam}</td><td data-label="Voltooid">${log.voltooid}</td><td data-label="Gemist">${log.gemist}</td><td data-label="Bijzonderheden">${log.bijzonderheden || ""}</td></tr>`;
    });
    logBody.innerHTML = html;
}


// --- DEEL 4: USERS (Users Recht) ---
function fetchUsers() {
    callApi("GET_USERS").then(result => {
        localUsersCache = result.data || []; // Cache bijwerken
        renderUsers(localUsersCache);
    }).catch(error => handleError(error, "Fout bij laden gebruikers: "));
}

function renderUsers(users) {
    const userBody = document.getElementById("user-body");
    if (!userBody) return;
    userBody.innerHTML = "";

    // SAFETY CHECK
    if (!users) users = [];

    const ingelogdeGebruikersnaam = localStorage.getItem('ingelogdeUsername');
    const ingelogdeVolledigeNaam = localStorage.getItem('ingelogdeMedewerker');

    users.forEach(user => {
        // 1. CHECK: Is dit de Super Admin? (Die mag je niet editen/verwijderen)
        if (user.username.toLowerCase() === 'admin') {
            return; 
        }

        // 2. CHECK: Ben ik dit zelf?
        let isSelf = false;
        if (ingelogdeGebruikersnaam && user.username.toLowerCase() === ingelogdeGebruikersnaam.toLowerCase()) {
            isSelf = true;
        } else if (ingelogdeVolledigeNaam && user.fullname === ingelogdeVolledigeNaam) {
            isSelf = true;
        }

        // Helper om een checkbox te maken
        const createCheckbox = (type, value) => `
            <input type="checkbox" 
                   class="perm-checkbox" 
                   data-username="${user.username}" 
                   data-type="${type}" 
                   ${value ? 'checked' : ''} 
                   ${isSelf ? 'disabled title="Je kunt je eigen rechten niet wijzigen"' : ''}> 
        `;

        const tr = document.createElement('tr');
        if (isSelf) tr.style.backgroundColor = "rgba(40, 167, 69, 0.1)";

        // --- DE NIEUWE KNOPPEN LOGICA ---
        let actieHtml = '';
        
        // Knop 1: Wachtwoord wijzigen (Blauw) - Altijd zichtbaar
        const changePassBtn = `<button class="btn-action btn-blue change-pin-btn" data-username="${user.username}" title="Wachtwoord wijzigen">Wachtwoord</button>`;
        
        // Knop 2: Verwijderen (Rood) - Alleen zichtbaar als het NIET jezelf is
        const deleteBtn = `<button class="btn-action btn-red delete-user-btn" data-username="${user.username}" title="Gebruiker verwijderen">X</button>`;

        if (isSelf) {
            // Bij jezelf: Alleen blauw
            actieHtml = `<div class="action-btn-group">${changePassBtn} <span style="font-size:0.8em; color:#aaa; margin-left:5px;">(Jij)</span></div>`;
        } else {
            // Bij anderen: Blauw én Rood
            actieHtml = `<div class="action-btn-group">${changePassBtn} ${deleteBtn}</div>`;
        }

        tr.innerHTML = `
            <td data-label="Gebruiker">${user.username}</td>
            <td data-label="Naam">${user.fullname}</td>
            <td data-label="Checklists" style="text-align:center;">${createCheckbox('checklists', user.perms.checklists)}</td>
            <td data-label="Admin" style="text-align:center;">${createCheckbox('admin', user.perms.admin)}</td>
            <td data-label="TD" style="text-align:center;">${createCheckbox('td', user.perms.td)}</td>
            <td data-label="Users" style="text-align:center;">${createCheckbox('users', user.perms.users)}</td>
            <td data-label="Actie">${actieHtml}</td>
        `;
        userBody.appendChild(tr);
    });
}

function setupUserForm() {
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

        // 2. OPTIMISTIC UI: Direct toevoegen aan cache en renderen
        localUsersCache.push(userData);
        renderUsers(localUsersCache);

        form.reset();
        toonMooieModal("Bezig...", "Gebruiker wordt op de achtergrond opgeslagen.");
        button.disabled = true;

        // 3. API Aanroep
        callApi("ADD_USER", { userData: userData }).then(result => {
            console.log("Gebruiker succesvol opgeslagen op server");
            // Optioneel: fetchUsers(); om te syncen
        }).catch(error => {
            console.error(error);
            alert("Fout bij opslaan! De gebruiker wordt weer verwijderd.");
            // Rollback
            localUsersCache = localUsersCache.filter(u => u.username !== userData.username);
            renderUsers(localUsersCache);
        }).finally(() => {
            button.disabled = false;
        });
    });
}

function setupUserActionListeners() {
    const userTable = document.getElementById("user-table");
    if (!userTable) return;

    userTable.addEventListener("click", e => {
        const target = e.target;
        
        // ACTIE 1: WACHTWOORD WIJZIGEN (BLAUW)
        if (target.classList.contains("change-pin-btn")) {
            const username = target.dataset.username;
            const newPin = prompt(`Voer nieuwe 4-cijferige pincode in voor gebruiker "${username}":`);
            
            if (newPin !== null) {
                if (newPin.length !== 4 || isNaN(newPin)) {
                    alert("De pincode moet uit precies 4 cijfers bestaan.");
                    return;
                }

                target.disabled = true; target.textContent = "...";

                callApi("UPDATE_USER_PIN", { targetUser: username, newPin: newPin })
                    .then(result => {
                        toonMooieModal("Succes", `Pincode van ${username} is gewijzigd.`);
                    })
                    .catch(error => {
                        alert("Fout: " + error.message);
                    })
                    .finally(() => {
                        target.disabled = false; target.textContent = "Wachtwoord";
                    });
            }
        }

        // ACTIE 2: VERWIJDEREN (ROOD)
        if (target.classList.contains("delete-user-btn")) {
            const username = target.dataset.username;
            const row = target.closest('tr'); // Handig om visueel te verwijderen

            if (confirm(`Weet je zeker dat je "${username}" definitief wilt verwijderen?`)) {
                target.disabled = true; target.textContent = "...";
                
                callApi("DELETE_USER", { username: username }).then(result => {
                    toonMooieModal("Succes", result.message);
                    // Update de lijst (of haal rij weg voor snelle feedback)
                    fetchUsers(); 
                }).catch(error => {
                    alert("Fout: " + error.message);
                    target.disabled = false; target.textContent = "X";
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
    // NIEUWE REGEL: Toon 5 neppe rijen met 6 kolommen (want je tabel heeft 6 headers)
    toonSkeletonRijen('algemeen-defect-body', 5, 6);

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

    // Filter "Verwijderd" eruit
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

    // SAFETY CHECK
    if (!defects) defects = [];

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

    // MAAK HET ITEM SLEEPBAAR
    li.classList.add('draggable');
    li.setAttribute('draggable', 'true'); // Voor desktop

    // NIEUWE HTML: Met een Sleep Hendel (☰)
    // We geven de tekst 'flex-grow: 1' zodat hij de ruimte opvult en de delete-knop naar rechts duwt
    li.innerHTML = `
        <span class="drag-handle">☰</span>
        <span style="flex-grow: 1;">${taak}</span>
        <button class="delete-task-btn">X</button>
    `;

    // --- 1. DESKTOP (Muis) ---
    // Werkt zoals voorheen, sleep gewoon het hele ding
    li.addEventListener('dragstart', () => { li.classList.add('dragging'); });
    li.addEventListener('dragend', () => { li.classList.remove('dragging'); });

    // --- 2. MOBIEL (Aanraking - HIER ZIT DE FIX) ---

    // START SLEPEN
    li.addEventListener('touchstart', (e) => {
        // BELANGRIJK: Raakten we de hendel aan?
        if (e.target.classList.contains('drag-handle')) {
            // JA: Blokkeer scrollen en start slepen
            e.preventDefault();
            li.classList.add('dragging');
            document.body.style.overflow = 'hidden'; // Stop pagina scroll
        }
        // NEE (je raakte de tekst): Doe niks, laat de browser gewoon scrollen!
    }, { passive: false });

    // STOP SLEPEN
    li.addEventListener('touchend', (e) => {
        // Alleen actie ondernemen als we echt aan het slepen waren
        if (li.classList.contains('dragging')) {
            li.classList.remove('dragging');
            document.body.style.overflow = ''; // Scrollen weer aanzetten
        }
    });

    // BEWEGEN
    li.addEventListener('touchmove', (e) => {
        // Als we NIET aan het slepen zijn (dus we waren aan het scrollen), stop hier.
        if (!li.classList.contains('dragging')) return;

        // Als we WEL aan het slepen zijn: voer de logica uit
        e.preventDefault();
        const touch = e.touches[0];
        const container = li.parentElement;

        const afterElement = getDragAfterElement(container, touch.clientY);

        if (afterElement == null) {
            container.appendChild(li);
        } else {
            container.insertBefore(li, afterElement);
        }
    }, { passive: false });

    return li;
}

function renderTaskList(listId, takenArray) {
    const ul = document.getElementById(listId);
    if (!ul) return;
    ul.innerHTML = '';
    if (!takenArray) return;
    takenArray.forEach(taak => { ul.appendChild(createTaakLi(taak)); });
}

function updateChecklistDropdown() {
    const dropdown = document.getElementById('cl-activiteit');
    if (!dropdown) return;

    // Huidige selectie onthouden
    const currentVal = dropdown.value;

    // Leegmaken (behalve de eerste optie)
    while (dropdown.options.length > 1) { dropdown.remove(1); }

    // 1. Gebruik jouw lijst uit de instellingen
    if (BESCHIKBARE_ACTIVITEITEN.length > 0) {
        BESCHIKBARE_ACTIVITEITEN.forEach(naam => {
            dropdown.add(new Option(naam, naam));
        });
    } else {
        // Fallback als er nog niks is ingesteld
        ["Baan", "Lasergame", "Prison Island", "Minigolf"].forEach(naam => {
            dropdown.add(new Option(naam, naam));
        });
    }

    // 2. Voeg ook items toe die WEL in de config zitten maar NIET in je lijst
    // (Zodat je oude checklists niet kwijtraakt)
    for (const act in HUIDIGE_CHECKLIST_CONFIG) {
        let bestaatAl = false;
        for (let i = 0; i < dropdown.options.length; i++) {
            if (dropdown.options[i].value === act) exists = true;
        }
        // Als hij nog niet in de dropdown staat, voeg toe
        // (Simpele check: zit hij in BESCHIKBARE_ACTIVITEITEN?)
        if (!BESCHIKBARE_ACTIVITEITEN.includes(act) && act !== "Baan" && act !== "Lasergame") { // Voorkom dubbelen bij fallback
            dropdown.add(new Option(act, act));
        }
    }

    if (currentVal) dropdown.value = currentVal;
}

function setupChecklistEditor() {
    const activiteitSelect = document.getElementById('cl-activiteit');
    const saveButton = document.getElementById('checklist-save-button');
    // Selecteer ook de invulvelden en plus-knoppen
    const inputs = document.querySelectorAll('#checklist-editor input[type="text"]');
    const buttons = document.querySelectorAll('#checklist-editor .add-task-btn');

    if (!activiteitSelect || !saveButton) return;

    // Hulpfunctie: Zet alles aan of uit
    function toggleEditor(disabled) {
        inputs.forEach(input => {
            input.disabled = disabled;
            if (disabled) input.value = ''; // Leegmaken voor netheid
        });
        buttons.forEach(btn => btn.disabled = disabled);
        saveButton.disabled = disabled;
        
        // Visuele feedback (optioneel, maakt het grijzer)
        const editor = document.getElementById('checklist-editor');
        editor.style.opacity = disabled ? '0.5' : '1';
    }

    // 1. Initialisatie: Zet standaard op slot als er niets gekozen is
    if (activiteitSelect.value === "") {
        toggleEditor(true);
    }

    activiteitSelect.addEventListener('change', () => {
        const activiteit = activiteitSelect.value;
        
        // CHECK: Is het leeg?
        if (activiteit === "") {
            toggleEditor(true); // Op slot
            renderTaskList('cl-openen-list', []);
            renderTaskList('cl-sluiten-list', []);
            return; // Stop hier
        }

        // Als we hier komen, is er iets gekozen -> Openen!
        toggleEditor(false);

        const config = HUIDIGE_CHECKLIST_CONFIG[activiteit];
        if (config) {
            renderTaskList('cl-openen-list', config.openen);
            renderTaskList('cl-sluiten-list', config.sluiten);
        } else {
            renderTaskList('cl-openen-list', []);
            renderTaskList('cl-sluiten-list', []);
        }
    });

    // ... (Hieronder blijft de rest van je bestaande code voor knoppen/drag&drop hetzelfde) ...
    
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

        const takenOpenen = Array.from(document.querySelectorAll('#cl-openen-list li span:nth-child(2)')).map(span => span.textContent);
        const takenSluiten = Array.from(document.querySelectorAll('#cl-sluiten-list li span:nth-child(2)')).map(span => span.textContent);
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

    // --- DRAG & DROP LOGICA ---
    const lists = document.querySelectorAll('.task-list');

    lists.forEach(list => {
        list.addEventListener('dragover', e => {
            e.preventDefault(); 
            const afterElement = getDragAfterElement(list, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (afterElement == null) {
                list.appendChild(draggable);
            } else {
                list.insertBefore(draggable, afterElement);
            }
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

function toonSkeletonRijen(bodyId, aantalRijen, aantalKolommen) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    let html = '';
    for (let i = 0; i < aantalRijen; i++) {
        html += `<tr class="skeleton-row">`;
        for (let j = 0; j < aantalKolommen; j++) {
            html += `<td><div></div></td>`;
        }
        html += `</tr>`;
    }
    body.innerHTML = html;
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

// Hulpfunctie voor Drag & Drop: Bepaalt onder welk element we zitten
function getDragAfterElement(container, y) {
    // Selecteer alle items behalve degene die we nu slepen
    const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2; // Afstand tot het midden van het item

        // We zoeken het item waar we NET boven zitten (offset is negatief maar dichtbij 0)
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ===============================
   MULTI-SELECT DROPDOWN LOGICA
   =============================== */

(function setupDropdown() {
    const dropdown = document.getElementById('rechten-dropdown');
    const btn = document.getElementById('dropdown-btn');
    const list = document.getElementById('dropdown-list');
    const textSpan = document.getElementById('dropdown-text');
    const checkboxes = list.querySelectorAll('input[type="checkbox"]');

    if (!dropdown || !btn || !list) return;

    // 1. Toggle open/dicht
    btn.addEventListener('click', (e) => {
        dropdown.classList.toggle('active');
        e.stopPropagation(); // Voorkom dat window click hem direct weer sluit
    });

    // 2. Sluit als je ergens anders klikt
    window.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // 3. Update de tekst in de knop als je vinkjes zet
    checkboxes.forEach(box => {
        box.addEventListener('change', updateDropdownText);
    });

    function updateDropdownText() {
        // Verzamel de namen van alle aangevinkte boxen
        let selected = [];
        checkboxes.forEach(box => {
            if (box.checked) {
                // Haal de tekst uit de <label> (de tekst node naast de input)
                selected.push(box.parentElement.textContent.trim());
            }
        });

        if (selected.length === 0) {
            textSpan.textContent = "Selecteer rechten...";
            btn.classList.remove('has-selection');
        } else if (selected.length <= 2) {
            // Bij 1 of 2 keuzes: toon de namen (bv: "Admin, TD")
            textSpan.textContent = selected.join(', ');
            btn.classList.add('has-selection');
        } else {
            // Bij veel keuzes: toon aantal (bv: "3 rechten geselecteerd")
            textSpan.textContent = `${selected.length} rechten geselecteerd`;
            btn.classList.add('has-selection');
        }
    }

    // Reset tekst ook na succesvol opslaan (kan gekoppeld worden aan je form submit)
    const form = document.getElementById("add-user-form");
    if (form) {
        form.addEventListener('reset', () => {
            // Wacht heel even tot de browser de vinkjes heeft weggehaald
            setTimeout(updateDropdownText, 10);
        });
    }
})();

// --- DEEL 7: INSTELLINGEN (Admin Only) ---

function fetchSettings() {
    callApi("GET_SETTINGS").then(result => {
        const settings = result.data;
        
        // 1. Vul Totaal Karts
        if (settings['totaal_karts']) {
            document.getElementById('setting-totaal-karts').value = settings['totaal_karts'];
        }

        // 2. Vul Activiteiten Lijst & Variabele
        const list = document.getElementById('setting-activiteiten-list');
        if (settings['activiteiten']) {
            try {
                // Sla op in de variabele voor de dropdown
                BESCHIKBARE_ACTIVITEITEN = JSON.parse(settings['activiteiten']);
                
                // Update de dropdown in Checklist Beheer direct!
                updateChecklistDropdown();

                // Vul de lijst in het Instellingen scherm
                if (list) {
                    list.innerHTML = ''; 
                    BESCHIKBARE_ACTIVITEITEN.forEach(act => {
                        list.appendChild(createTaakLi(act));
                    });
                }
            } catch (e) {
                console.error("Fout bij parsen activiteiten:", e);
            }
        }
    }).catch(error => handleError(error, "Kon instellingen niet laden: "));
}

function setupSettingsForm() {
    const form = document.getElementById('settings-form');
    const btn = document.getElementById('save-settings-btn');

    // Start de logica voor de lijst (toevoegen/verwijderen)
    setupActivityListLogic();

    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        btn.disabled = true; btn.textContent = "Opslaan...";

        const karts = document.getElementById('setting-totaal-karts').value;

        // Verzamelen van de activiteiten uit de lijst
        const activiteitenLijst = [];
        document.querySelectorAll('#setting-activiteiten-list li span:nth-child(2)').forEach(span => {
            activiteitenLijst.push(span.textContent);
        });

        // We sturen twee verzoeken naar de server
        // 1. Karts opslaan
        callApi({ type: "SAVE_SETTING", key: "totaal_karts", value: karts })
            .then(() => {
                // 2. Activiteiten opslaan (als JSON string, bv: '["Baan","Lasergame"]')
                return callApi({ type: "SAVE_SETTING", key: "activiteiten", value: JSON.stringify(activiteitenLijst) });
            })
            .then(result => {
                toonMooieModal("Succes", "Alle instellingen zijn bijgewerkt.");
            })
            .catch(error => handleError(error, "Fout bij opslaan: "))
            .finally(() => {
                btn.disabled = false; btn.textContent = "Instellingen Opslaan";
            });
    });
}

function setupActivityListLogic() {
    const list = document.getElementById('setting-activiteiten-list');
    const input = document.getElementById('new-activity-input');
    const addBtn = document.getElementById('add-activity-btn');

    if (!list || !input || !addBtn) return;

    // Helper om items toe te voegen (hergebruikt createTaakLi logica)
    function addActivityItem(text) {
        // We hergebruiken createTaakLi uit de checklist sectie voor de Drag & Drop functionaliteit!
        // Zorg dat createTaakLi beschikbaar is in je scope (dat is hij in admin.js)
        const li = createTaakLi(text);
        list.appendChild(li);
    }

    // Klikken op plusje
    addBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            addActivityItem(text);
            input.value = '';
            input.focus();
        }
    });

    // Enter toets in input
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addBtn.click();
        }
    });

    // Verwijder knop functionaliteit (Delegeer event)
    list.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-task-btn')) {
            e.target.parentElement.remove();
        }
    });
}