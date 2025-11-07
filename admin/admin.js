/* ===============================
   VOLLEDIGE ADMIN.JS (MET GEBRUIKERSBEHEER)
   =============================== */

// ##################################################################
// #                        BELANGRIJKE STAP                        #
// # PLAK HIER JE GOOGLE WEB APP URL                                #
// ##################################################################
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_tSrtNqwiQrpvFW0v6KFI0y0t8gomgbV-C2AzRYdKlE0es7k7z9U72jb7HArTxQHatw/exec";

// Globale variabelen
const ingelogdeRol = localStorage.getItem('ingelogdeRol');
const statusDiv = document.getElementById('status-message');

// --- DEEL 1: BEWAKER & INIT ---
(function() {
    // 1. Check de rol. Is het geen manager? Stuur terug!
    if (ingelogdeRol !== 'manager') {
        alert("Toegang geweigerd. Je moet ingelogd zijn als manager.");
        window.location.href = "../index.html"; // Terug naar de hoofd-app
        return; 
    }
    
    // 2. Rol is 'manager'. Haal alle data op.
    fetchLogData();
    fetchUsers();
    
    // 3. Koppel de listeners
    setupTabNavigation();
    setupUserForm();
    setupUserDeleteListener();

})(); 


// --- DEEL 2: TAB NAVIGATIE ---
function setupTabNavigation() {
    document.querySelectorAll('.tab-link').forEach(button => {
        button.addEventListener('click', () => {
            // Verberg alle content, maak knoppen inactief
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
            
            // Toon de juiste tab
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            button.classList.add('active');
        });
    });
}


// --- DEEL 3: LOGBOEK FUNCTIES ---
function fetchLogData() {
    statusDiv.textContent = "Logboek laden...";
    statusDiv.className = 'loading';
    
    callApi("GET_LOGS")
        .then(result => {
            statusDiv.style.display = 'none';
            renderLogs(result.data);
        })
        .catch(error => handleError(error, "Fout bij laden logboek: "));
}

function renderLogs(logs) {
    const logBody = document.getElementById('log-body');
    if (logs.length === 0) {
        logBody.innerHTML = '<tr><td colspan="6">Nog geen logs gevonden.</td></tr>';
        return;
    }
    let html = '';
    logs.forEach(log => {
        let ts = new Date(log.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
        html += `
            <tr>
                <td data-label="Tijdstip">${ts}</td>
                <td data-label="Medewerker">${log.medewerker}</td>
                <td data-label="Activiteit">${log.activiteit}</td>
                <td data-label="Lijst">${log.lijstnaam}</td>
                <td data-label="Voltooid">${log.voltooid}</td>
                <td data-label="Gemist">${log.gemist}</td>
            </tr>
        `;
    });
    logBody.innerHTML = html;
}

// --- DEEL 4: GEBRUIKERSBEHEER FUNCTIES ---

function fetchUsers() {
    callApi("GET_USERS")
        .then(result => {
            renderUsers(result.data);
        })
        .catch(error => handleError(error, "Fout bij laden gebruikers: "));
}

function renderUsers(users) {
    const userBody = document.getElementById('user-body');
    userBody.innerHTML = ''; // Maak de tabel leeg
    if (users.length === 0) {
        userBody.innerHTML = '<tr><td colspan="4">Geen gebruikers gevonden.</td></tr>';
        return;
    }
    let html = '';
    users.forEach(user => {
        html += `
            <tr>
                <td data-label="Gebruikersnaam">${user.username}</td>
                <td data-label="Volledige Naam">${user.fullname}</td>
                <td data-label="Rol">${user.role}</td>
                <td data-label="Actie">
                    <button class="delete-btn" data-username="${user.username}">Verwijder</button>
                </td>
            </tr>
        `;
    });
    userBody.innerHTML = html;
}

function setupUserForm() {
    const form = document.getElementById('add-user-form');
    const button = document.getElementById('add-user-button');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        button.disabled = true;
        button.textContent = "Bezig...";
        
        const userData = {
            username: document.getElementById('new-username').value,
            fullname: document.getElementById('new-fullname').value,
            pincode: document.getElementById('new-pincode').value,
            role: document.getElementById('new-role').value
        };
        
        callApi("ADD_USER", { userData: userData })
            .then(result => {
                alert(result.message); // Toon "Gebruiker toegevoegd"
                form.reset(); // Maak het formulier leeg
                fetchUsers(); // Ververs de gebruikerslijst
            })
            .catch(error => handleError(error, "Fout bij toevoegen: "))
            .finally(() => {
                button.disabled = false;
                button.textContent = "Gebruiker Toevoegen";
            });
    });
}

function setupUserDeleteListener() {
    const userTable = document.getElementById('user-table');
    userTable.addEventListener('click', (e) => {
        // Check of er op een delete-knop is geklikt
        if (!e.target.classList.contains('delete-btn')) {
            return;
        }
        
        const button = e.target;
        const username = button.dataset.username;
        
        if (!confirm(`Weet je zeker dat je "${username}" wilt verwijderen? Dit kan niet ongedaan gemaakt worden.`)) {
            return;
        }
        
        button.disabled = true;
        button.textContent = "Bezig...";
        
        callApi("DELETE_USER", { username: username })
            .then(result => {
                alert(result.message);
                fetchUsers(); // Ververs de gebruikerslijst
            })
            .catch(error => {
                handleError(error, "Fout bij verwijderen: ");
                button.disabled = false;
                button.textContent = "Verwijder";
            });
    });
}

// --- DEEL 5: ALGEMENE API & FOUTAFHANDELING ---

/**
 * De centrale functie om API calls te doen
 */
async function callApi(type, extraData = {}) {
    const payload = {
        type: type,
        rol: ingelogdeRol, // Stuur de rol altijd mee voor beveiliging
        ...extraData
    };

    const response = await fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
    
    const result = await response.json();
    
    if (result.status === "success") {
        return result;
    } else {
        throw new Error(result.message);
    }
}

/**
 * Toont een foutmelding in de status-div
 */
function handleError(error, prefix = "Fout: ") {
    console.error(prefix, error);
    statusDiv.style.display = 'block';
    statusDiv.className = 'error';
    statusDiv.textContent = prefix + error.message;
}