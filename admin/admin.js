/* ===============================
   VOLLEDIGE ADMIN.JS (OPGESCHOOND - 3 TABS)
   =============================== */

const WEB_APP_URL = "PLAK_HIER_JE_NIEUWE_URL"; // <-- CRUCIAAL

const ingelogdeRol = localStorage.getItem('ingelogdeRol');
const statusDiv = document.getElementById('status-message');

// --- DEEL 1: BEWAKER & INIT ---
(function() {
    if (ingelogdeRol !== 'manager' && ingelogdeRol !== 'TD') {
        alert("Toegang geweigerd."); 
        window.location.href = "../index.html"; 
        return; 
    }
    
    // Data ophalen
    fetchAlgemeenDefects(); 
    
    if (ingelogdeRol === 'manager') {
        // Alleen managers mogen logs en gebruikers zien
        fetchLogData();
        fetchUsers();
    }

    // Interface aanpassen voor TD
    if (ingelogdeRol === 'TD') {
        const logBtn = document.querySelector('.tab-link[data-tab="tab-logs"]');
        const userBtn = document.querySelector('.tab-link[data-tab="tab-users"]');
        if (logBtn) logBtn.style.display = 'none';
        if (userBtn) userBtn.style.display = 'none';

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
            if (tabContent) {
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
    if (logs.length === 0) {
        logBody.innerHTML = '<tr><td colspan="7">Nog geen logs gevonden.</td></tr>'; return;
    }
    let html = "";
    logs.forEach(log => {
        let ts = new Date(log.timestamp).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
        html += `
            <tr>
                <td data-label="Tijdstip">${ts}</td>
                <td data-label="Medewerker">${log.medewerker}</td>
                <td data-label="Activiteit">${log.activiteit}</td>
                <td data-label="Lijst">${log.lijstnaam}</td>
                <td data-label="Voltooid">${log.voltooid}</td>
                <td data-label="Gemist">${log.gemist}</td>
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
    document.getElementById("user-table").addEventListener("click", e => {
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

// --- DEEL 6: ALGEMENE API & FOUTAFHANDELING ---
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