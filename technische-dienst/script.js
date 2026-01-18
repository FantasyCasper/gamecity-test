const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec"; // VERVANG DEZE INDIEN NODIG

let tasksCache = [];
let currentUser = "";
let currentPerms = {};

// INIT
(function () {
    currentUser = localStorage.getItem('ingelogdeMedewerker');
    const rawPerms = localStorage.getItem('ingelogdePermissies');

    if (!currentUser || !rawPerms) { window.location.href = "../login/"; return; }
    currentPerms = JSON.parse(rawPerms);

    // Event Listeners
    document.getElementById('add-task-btn').addEventListener('click', () => openModal());
    document.getElementById('sort-select').addEventListener('change', renderGrid);
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.querySelector('.btn-secondary').addEventListener('click', closeModal); // Annuleer knop
    document.getElementById('task-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('btn-delete').addEventListener('click', handleDelete);

    fetchTasks();
})();

// FETCH DATA
async function fetchTasks() {
    const grid = document.getElementById('td-grid');
    grid.innerHTML = '<p style="text-align:center;">Laden...</p>';

    // User ziet alleen openbaar? Nee, in dit TD dashboard laten we alles zien, 
    // of filteren we? Laten we de logica aanhouden: Admin/TD ziet alles, User ziet Open.
    // Echter, user kan nu ook "melden" via dit dashboard volgens jouw verzoek.
    const type = (currentPerms.admin || currentPerms.td) ? "GET_ALGEMEEN_DEFECTS" : "GET_PUBLIC_ALGEMEEN_DEFECTS";

    try {
        const result = await callApi({ type: type });
        tasksCache = result.data.filter(t => t.status !== 'Verwijderd' && t.status !== 'Opgelost');
        renderGrid();
    } catch (e) {
        grid.innerHTML = `<p style="color:red; text-align:center;">Fout: ${e.message}</p>`;
    }
}

// RENDER GRID
function renderGrid() {
    const grid = document.getElementById('td-grid');
    const sortMode = document.getElementById('sort-select').value;
    grid.innerHTML = '';

    // Sorteren... (deze code had je al, laat ik even kort)
    let items = [...tasksCache];
    if (sortMode === 'prio') items.sort((a, b) => a.prioriteit - b.prioriteit);
    else if (sortMode === 'date') items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    else if (sortMode === 'oldest') items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Filter "Verwijderd" eruit, maar laat "Opgelost" staan (zodat we ze grijs kunnen zien)
    items = items.filter(t => t.status !== 'Verwijderd');

    if(items.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:#666;">Geen taken gevonden.</p>';
        return;
    }

    items.forEach(task => {
        const daysAgo = calculateDaysAgo(task.timestamp);
        const prioBadgeClass = `bg-prio-${task.prioriteit || 3}`;
        const canEdit = (currentPerms.admin || currentPerms.td || task.medewerker === currentUser);
        
        // CHECK: Is hij opgelost?
        const isOpgelost = (task.status === 'Opgelost');
        const extraClass = isOpgelost ? 'status-opgelost' : `prio-${task.prioriteit || 3}`;

        const card = document.createElement('div');
        card.className = `task-card ${extraClass}`;
        
        // Bouw de HTML voor "Afgerond door"
        let afgerondHtml = '';
        if (isOpgelost && task.opgelostDoor) {
            afgerondHtml = `<div class="afgerond-info">✓ Afgerond door: ${task.opgelostDoor}</div>`;
        }

        // Knoppen tonen? Alleen als hij nog NIET opgelost is, OF als je admin bent (om evt te heropenen of verwijderen)
        let buttonsHtml = '';
        if (!isOpgelost && canEdit) {
            buttonsHtml = `
                <button class="btn-finish" onclick="finishTask(${task.rowId})">✔ Afronden</button>
                <button class="btn-edit" onclick='editTask(${JSON.stringify(task)})'>✎</button>
            `;
        } else if (isOpgelost && (currentPerms.admin || currentPerms.td)) {
            // Optioneel: Admins kunnen opgeloste taken nog bewerken/verwijderen
             buttonsHtml = `<button class="btn-edit" onclick='editTask(${JSON.stringify(task)})' style="width:100%; background:#555;">Bewerken / Heropenen</button>`;
        }

        card.innerHTML = `
            <div class="card-header">
                <h3>${task.locatie}</h3>
                <span class="prio-badge ${prioBadgeClass}">Prio ${task.prioriteit || 3}</span>
            </div>
            <div class="meta-info">
                Aangemaakt door: <strong>${task.medewerker}</strong><br>
                Aangemaakt op: ${daysAgo}
            </div>
            <div class="task-body">${task.defect}</div>
            
            ${afgerondHtml} ${!isOpgelost ? `
            <div class="td-details">
                <span style="color:#ffc107;">🛠️ Nodig: ${task.benodigdheden || '-'}</span>
                <span style="color:#aaa;">📦 Status: ${task.onderdelenStatus}</span>
            </div>` : ''}

            <div class="card-actions">
                ${buttonsHtml}
            </div>
        `;
        grid.appendChild(card);
    });
}

// ACTIONS
function renderGrid() {
    const grid = document.getElementById('td-grid');
    const sortMode = document.getElementById('sort-select').value;
    grid.innerHTML = '';

    // Sorteren... (deze code had je al, laat ik even kort)
    let items = [...tasksCache];
    if (sortMode === 'prio') items.sort((a, b) => a.prioriteit - b.prioriteit);
    else if (sortMode === 'date') items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    else if (sortMode === 'oldest') items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Filter "Verwijderd" eruit, maar laat "Opgelost" staan (zodat we ze grijs kunnen zien)
    items = items.filter(t => t.status !== 'Verwijderd');

    if(items.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:#666;">Geen taken gevonden.</p>';
        return;
    }

    items.forEach(task => {
        const daysAgo = calculateDaysAgo(task.timestamp);
        const prioBadgeClass = `bg-prio-${task.prioriteit || 3}`;
        const canEdit = (currentPerms.admin || currentPerms.td || task.medewerker === currentUser);
        
        // CHECK: Is hij opgelost?
        const isOpgelost = (task.status === 'Opgelost');
        const extraClass = isOpgelost ? 'status-opgelost' : `prio-${task.prioriteit || 3}`;

        const card = document.createElement('div');
        card.className = `task-card ${extraClass}`;
        
        // Bouw de HTML voor "Afgerond door"
        let afgerondHtml = '';
        if (isOpgelost && task.opgelostDoor) {
            afgerondHtml = `<div class="afgerond-info">✓ Afgerond door: ${task.opgelostDoor}</div>`;
        }

        // Knoppen tonen? Alleen als hij nog NIET opgelost is, OF als je admin bent (om evt te heropenen of verwijderen)
        let buttonsHtml = '';
        if (!isOpgelost && canEdit) {
            buttonsHtml = `
                <button class="btn-finish" onclick="finishTask(${task.rowId})">✔ Afronden</button>
                <button class="btn-edit" onclick='editTask(${JSON.stringify(task)})'>✎</button>
            `;
        } else if (isOpgelost && (currentPerms.admin || currentPerms.td)) {
            // Optioneel: Admins kunnen opgeloste taken nog bewerken/verwijderen
             buttonsHtml = `<button class="btn-edit" onclick='editTask(${JSON.stringify(task)})' style="width:100%; background:#555;">Bewerken / Heropenen</button>`;
        }

        card.innerHTML = `
            <div class="card-header">
                <h3>${task.locatie}</h3>
                <span class="prio-badge ${prioBadgeClass}">Prio ${task.prioriteit || 3}</span>
            </div>
            <div class="meta-info">
                Aangemaakt door: <strong>${task.medewerker}</strong><br>
                Aangemaakt op: ${daysAgo}
            </div>
            <div class="task-body">${task.defect}</div>
            
            ${afgerondHtml} ${!isOpgelost ? `
            <div class="td-details">
                <span style="color:#ffc107;">🛠️ Nodig: ${task.benodigdheden || '-'}</span>
                <span style="color:#aaa;">📦 Status: ${task.onderdelenStatus}</span>
            </div>` : ''}

            <div class="card-actions">
                ${buttonsHtml}
            </div>
        `;
        grid.appendChild(card);
    });
}

function handleFormSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Even geduld...";

    const id = document.getElementById('task-id').value;
    const isEdit = !!id;

    // Data verzamelen
    const payload = {
        prioriteit: document.getElementById('task-prio').value,
        benodigdheden: document.getElementById('task-needs').value,
        onderdelenStatus: document.getElementById('task-parts-status').value,
        nieuweLocatie: document.getElementById('task-title').value,      // Korte kop
        nieuweOmschrijving: document.getElementById('task-desc').value   // Lange tekst
    };

    if (isEdit) {
        // ... (Dit gedeelte voor bewerken was al goed) ...
        payload.type = "UPDATE_ALGEMEEN_DEFECT_EXTENDED";
        payload.rowId = id;
        payload.newStatus = "Open";
    } else {
        // --- DIT GEDEELTE MOET JE UPDATEN ---
        payload.type = "LOG_ALGEMEEN_DEFECT";
        payload.medewerker = currentUser;
        payload.nummer = ""; // Wordt niet gebruikt bij algemeen, maar voor de vorm

        // Data uit het formulier halen
        payload.locatie = document.getElementById('task-title').value;       // De Kop
        payload.defect = document.getElementById('task-desc').value;         // De Beschrijving
        payload.prio = document.getElementById('task-prio').value;           // De Prio
        payload.benodigdheden = document.getElementById('task-needs').value; // De Spullen
        payload.onderdelenStatus = document.getElementById('task-parts-status').value; // De Status
    }

    callApi(payload).then(() => {
        closeModal();
        fetchTasks();
    }).catch(e => alert(e.message)).finally(() => {
        btn.disabled = false; btn.textContent = "Opslaan";
    });
}

// HELPER: Pas doPost aan in Code.gs als je LOG_ALGEMEEN_DEFECT aanroept
// in Code.gs stond: return createJsonResponse(logAlgemeenDefect(data.medewerker, data.locatie, data.defect));
// DIT MOET WORDEN: return createJsonResponse(logAlgemeenDefect(data.medewerker, data.locatie, data.defect, data.prio));

function openModal(task = null) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-task');
    const title = document.getElementById('modal-title');
    const delBtn = document.getElementById('btn-delete');

    if (task) {
        // Edit Mode
        title.textContent = "Taak Bewerken";
        document.getElementById('task-id').value = task.rowId;
        document.getElementById('task-title').value = task.locatie;
        document.getElementById('task-desc').value = task.defect;
        document.getElementById('task-prio').value = task.prioriteit || 3;
        document.getElementById('task-needs').value = task.benodigdheden || "";
        document.getElementById('task-parts-status').value = task.onderdelenStatus || "Niet nodig";
        delBtn.style.display = 'block';
    } else {
        // New Mode
        title.textContent = "Nieuwe Taak";
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = "";
        delBtn.style.display = 'none';
    }

    overlay.style.display = 'block';
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-task').style.display = 'none';
}

function handleDelete() {
    if (!confirm("Definitief verwijderen?")) return;
    const id = document.getElementById('task-id').value;
    callApi({ type: "UPDATE_ALGEMEEN_DEFECT_STATUS", rowId: id, newStatus: "Verwijderd" })
        .then(() => { closeModal(); fetchTasks(); });
}

// UTILS
function calculateDaysAgo(dateString) {
    const diff = new Date() - new Date(dateString);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Vandaag";
    if (days === 1) return "Gisteren";
    return `${days} dagen geleden`;
}

// API CALL
async function callApi(payload) {
    if (currentPerms) payload.perms = currentPerms;
    const req = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
    const res = await req.json();
    if (res.status === 'success') return res;
    throw new Error(res.message);
}

// Globale scope voor HTML onclicks
window.finishTask = finishTask;
window.editTask = function (t) { openModal(t); };