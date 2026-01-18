const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

let tasksCache = [];
let currentUser = "";
let currentPerms = {};

// ================= INIT =================
(function () {
    currentUser = localStorage.getItem('ingelogdeMedewerker');
    const rawPerms = localStorage.getItem('ingelogdePermissies');

    if (!currentUser || !rawPerms) {
        window.location.href = "../login/";
        return;
    }

    currentPerms = JSON.parse(rawPerms);

    document.getElementById('add-task-btn').addEventListener('click', () => openModal());
    document.getElementById('sort-select').addEventListener('change', renderGrid);
    document.querySelector('.close-modal').addEventListener('click', closeModal);

    const cancelBtn = document.querySelector('.btn-secondary');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    document.getElementById('task-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('btn-delete').addEventListener('click', handleDelete);

    fetchTasks();
})();

// ================= FETCH =================
async function fetchTasks() {
    const grid = document.getElementById('td-grid');
    grid.innerHTML = '<p style="text-align:center;">Laden...</p>';
    
    const type = (currentPerms.admin || currentPerms.td) ? "GET_ALGEMEEN_DEFECTS" : "GET_PUBLIC_ALGEMEEN_DEFECTS";

    try {
        const result = await callApi({ type });
        // Filter verwijderde taken eruit
        tasksCache = result.data.filter(t => t.status !== 'Verwijderd');
        renderGrid();
    } catch (e) {
        grid.innerHTML = `<p style="color:red; text-align:center;">Fout: ${e.message}</p>`;
    }
}

// ================= RENDER =================
function renderGrid() {
    const grid = document.getElementById('td-grid');
    const sortMode = document.getElementById('sort-select').value;
    grid.innerHTML = '';

    let items = [...tasksCache];

    // Sorteren
    if (sortMode === 'prio')
        items.sort((a, b) => Number(a.prioriteit) - Number(b.prioriteit));
    else if (sortMode === 'date')
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    else if (sortMode === 'oldest')
        items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (!items.length) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:#666;">Geen taken gevonden.</p>';
        return;
    }

    // --- RECHTEN CHECK VOOR RENDEREN ---
    const isTD = currentPerms.admin || currentPerms.td;

    items.forEach(task => {
        const isOpgelost = task.status === 'Opgelost';
        const isCreator = task.medewerker === currentUser;
        
        // CHECK: Is de taak minder dan 24 uur oud? (86400000 ms = 1 dag)
        const isVers = (Date.now() - new Date(task.timestamp).getTime() < 86400000);

        const card = document.createElement('div');
        card.className = `task-card ${isOpgelost ? 'status-opgelost' : `prio-${task.prioriteit || 3}`}`;

        // KNOPPEN LOGICA
        let buttonsHtml = '';

        if (!isOpgelost) {
            // 1. Afronden knop: ALLEEN voor TD of Admin
            if (isTD) {
                buttonsHtml += `<button class="btn-finish" onclick="finishTask(${task.rowId})">✔ Afronden</button>`;
            }

            // 2. Bewerk knop: Voor TD/Admin (altijd) OF de maker (alleen binnen 24u)
            if (isTD || (isCreator && isVers)) {
                buttonsHtml += `<button class="btn-edit" onclick="editTaskById(${task.rowId})">✎</button>`;
            }
        } else if (isOpgelost && isTD) {
            // Als opgelost: Alleen TD/Admin mag heropenen/bewerken
            buttonsHtml = `
                <button class="btn-edit"
                        onclick="editTaskById(${task.rowId})"
                        style="width:100%; background:#555;">
                    Bewerken / Heropenen
                </button>`;
        }

        // HTML Opbouw
        card.innerHTML = `
            <div class="card-header">
                <h3>${task.locatie}</h3>
                <span class="prio-badge bg-prio-${task.prioriteit || 3}">
                    Prio ${task.prioriteit || 3}
                </span>
            </div>

            <div class="meta-info">
                Aangemaakt door: <strong>${task.medewerker}</strong><br>
                Aangemaakt op: ${calculateDaysAgo(task.timestamp)}
            </div>

            <div class="task-body">${task.defect}</div>

            ${isOpgelost && task.opgelostDoor
                ? `<div class="afgerond-info">✓ Afgerond door: ${task.opgelostDoor}</div>`
                : `
                <div class="td-details">
                    <span style="color:#ffc107;">🛠️ Nodig: ${task.benodigdheden || '-'}</span>
                    <span style="color:#aaa;">📦 Status: ${task.onderdelenStatus}</span>
                </div>`}

            <div class="card-actions">${buttonsHtml}</div>
        `;

        grid.appendChild(card);
    });
}

// ================= FORM =================
function handleFormSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Even geduld...";

    const id = document.getElementById('task-id').value;
    const isEdit = !!id;

    const payload = {
        type: isEdit ? "UPDATE_ALGEMEEN_DEFECT_EXTENDED" : "LOG_ALGEMEEN_DEFECT",
        rowId: id,
        medewerker: currentUser,
        locatie: document.getElementById('task-title').value,
        defect: document.getElementById('task-desc').value,
        prioriteit: document.getElementById('task-prio').value,
        benodigdheden: document.getElementById('task-needs').value,
        onderdelenStatus: document.getElementById('task-parts-status').value,
        newStatus: "Open"
    };

    callApi(payload)
        .then(() => {
            closeModal();
            fetchTasks();
        })
        .catch(e => alert(e.message))
        .finally(() => {
            btn.disabled = false;
            btn.textContent = "Opslaan";
        });
}

// ================= ACTIONS =================
function finishTask(rowId) {
    if (!confirm("Taak afronden?")) return;

    callApi({
        type: "UPDATE_ALGEMEEN_DEFECT_STATUS",
        rowId,
        newStatus: "Opgelost",
        opgelostDoor: currentUser
    }).then(fetchTasks)
      .catch(e => alert(e.message));
}

function handleDelete() {
    if (!confirm("Definitief verwijderen?")) return;

    callApi({
        type: "UPDATE_ALGEMEEN_DEFECT_STATUS",
        rowId: document.getElementById('task-id').value,
        newStatus: "Verwijderd"
    }).then(() => {
        closeModal();
        fetchTasks();
    });
}

// ================= MODAL =================
function openModal(task = null) {
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('modal-task').style.display = 'block';

    const delBtn = document.getElementById('btn-delete');
    
    // RECHTEN CHECKS
    const isTD = currentPerms.admin || currentPerms.td;
    const tdSection = document.querySelector('.td-section');

    // TD sectie alleen voor TD/Admin
    tdSection.style.display = isTD ? 'block' : 'none';

    if (task) {
        document.getElementById('modal-title').textContent = "Taak Bewerken";
        document.getElementById('task-id').value = task.rowId;
        document.getElementById('task-title').value = task.locatie;
        document.getElementById('task-desc').value = task.defect;
        document.getElementById('task-prio').value = task.prioriteit || 3;
        
        document.getElementById('task-needs').value = task.benodigdheden || "";
        document.getElementById('task-parts-status').value = task.onderdelenStatus || "Niet nodig";
        
        // CHECK: Mag je verwijderen? (TD/Admin altijd, Creator alleen binnen 24u)
        const isCreator = (task.medewerker === currentUser);
        const isVers = (Date.now() - new Date(task.timestamp).getTime() < 86400000);

        if (isTD || (isCreator && isVers)) {
            delBtn.style.display = 'block';
        } else {
            delBtn.style.display = 'none';
        }

    } else {
        document.getElementById('modal-title').textContent = "Nieuwe Taak";
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = "";
        delBtn.style.display = 'none'; // Bij nieuwe taak geen verwijderknop nodig
    }
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-task').style.display = 'none';
}

// ================= UTILS =================
function calculateDaysAgo(dateString) {
    const days = Math.floor((new Date() - new Date(dateString)) / 86400000);
    return days === 0 ? "Vandaag" : days === 1 ? "Gisteren" : `${days} dagen geleden`;
}

async function callApi(payload) {
    payload.perms = currentPerms;
    const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res.status === 'success') return res;
    throw new Error(res.message);
}

// ================= GLOBAL =================
window.finishTask = finishTask;
window.editTaskById = id => {
    const task = tasksCache.find(t => t.rowId === id);
    if (task) openModal(task);
};