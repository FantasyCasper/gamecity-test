const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

let ingelogdeNaam = "";
let ingelogdePermissies = {};
let alleDefectenCache = [];
let statusTimeout;

// 1. INIT & AUTH CHECK
(function() {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    const rawPerms = localStorage.getItem('ingelogdePermissies');

    if (!ingelogdeNaam || !rawPerms) {
        window.location.href = "../login/index.html";
        return;
    }
    ingelogdePermissies = JSON.parse(rawPerms);

    // Initialiseer functies
    setupModalLogic();
    setupFormListeners();
    setupFilters();
    
    // Start Data ophalen
    fetchAlgemeneDefecten();
})();

// 2. DATA OPHALEN
function fetchAlgemeneDefecten() {
    const grid = document.getElementById('algemeen-defecten-grid');
    grid.innerHTML = '<p style="text-align:center; color:#aaa;">Gegevens ophalen...</p>';

    // Als je admin/td bent, haal ALLES op (via GET_ALGEMEEN_DEFECTS). 
    // Als je user bent, haal alleen OPENBARE (via GET_PUBLIC_ALGEMEEN_DEFECTS).
    const type = (ingelogdePermissies.admin || ingelogdePermissies.td) ? "GET_ALGEMEEN_DEFECTS" : "GET_PUBLIC_ALGEMEEN_DEFECTS";

    callApi({ type: type })
        .then(result => {
            alleDefectenCache = result.data || [];
            filterEnRender();
        })
        .catch(error => {
            grid.innerHTML = `<p style="color:red; text-align:center;">Fout: ${error.message}</p>`;
        });
}

// 3. FILTER & RENDER
function setupFilters() {
    document.getElementById('filter-algemeen-locatie').addEventListener('change', filterEnRender);
}

function filterEnRender() {
    const filterLocatie = document.getElementById('filter-algemeen-locatie').value;
    const grid = document.getElementById('algemeen-defecten-grid');
    grid.innerHTML = '';

    let items = alleDefectenCache;

    // Filter status 'Verwijderd' eruit (behalve voor admins die dat misschien willen zien, maar standaard weg)
    items = items.filter(d => d.status !== 'Verwijderd');

    // Filter locatie
    if (filterLocatie !== 'alle') {
        items = items.filter(d => d.locatie === filterLocatie);
    }

    // Filter Status: Users zien alleen 'Open'. Admins zien alles.
    // (De API GET_PUBLIC filtert al op Open, maar voor admin lijst filteren we hier)
    if (!ingelogdePermissies.admin && !ingelogdePermissies.td) {
        items = items.filter(d => d.status === 'Open');
    }

    if (items.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:#888;">Geen meldingen gevonden.</p>';
        return;
    }

    // Sorteren: Nieuwste eerst
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    items.forEach(defect => {
        renderCard(defect, grid);
    });
}

function renderCard(defect, container) {
    const card = document.createElement('div');
    card.className = 'defect-card';
    if (defect.status === 'Opgelost') card.style.borderLeftColor = '#2ecc71'; // Groen

    const ts = new Date(defect.timestamp).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
    
    // Check rechten voor edit knop
    const isEigenaar = (defect.medewerker === ingelogdeNaam);
    const isVers = (Date.now() - new Date(defect.timestamp).getTime() < 86400000); // 24 uur
    const magBewerken = (isEigenaar && isVers && defect.status === 'Open') || ingelogdePermissies.admin || ingelogdePermissies.td;

    let editKnop = magBewerken ? `<button class="edit-icon-btn" data-id="${defect.rowId}">✎</button>` : '';

    // Extra info (TD)
    let extraInfo = '';
    if (defect.benodigdheden) extraInfo += `<div style="font-size:0.85em; color:#ffc107; margin-top:5px;">🛠️ Nodig: ${defect.benodigdheden}</div>`;
    if (defect.onderdelenStatus) extraInfo += `<div style="font-size:0.85em; color:#aaa; margin-top:2px;">📦 ${defect.onderdelenStatus}</div>`;

    card.innerHTML = `
        <h3>${defect.locatie}</h3>
        <div class="meta">
            <span>👤 ${defect.medewerker}</span> &bull; <span>🕒 ${ts}</span>
            <br>Status: <strong>${defect.status}</strong>
        </div>
        <div class="omschrijving">${defect.defect}</div>
        ${extraInfo}
        ${editKnop}
    `;

    // Event listener voor edit knop
    if (magBewerken) {
        const btn = card.querySelector('.edit-icon-btn');
        btn.addEventListener('click', () => openEditModal(defect));
    }

    container.appendChild(card);
}

// 4. MODAL LOGICA
function setupModalLogic() {
    // Openen Melden Modal
    document.getElementById('open-defect-modal-btn').addEventListener('click', () => {
        document.getElementById('modal-overlay-algemeen').style.display = 'block';
        document.getElementById('modal-algemeen-defect').style.display = 'block';
    });

    // Sluiten (generic class)
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            document.getElementById(targetId).style.display = 'none';
            document.getElementById('modal-overlay-algemeen').style.display = 'none';
        });
    });
}

function openEditModal(defect) {
    const modal = document.getElementById('modal-edit-algemeen');
    const overlay = document.getElementById('modal-overlay-algemeen');

    // Vul velden
    document.getElementById('edit-algemeen-id').value = defect.rowId;
    document.getElementById('edit-algemeen-locatie').value = defect.locatie;
    document.getElementById('edit-algemeen-omschrijving').value = defect.defect;

    // TD Velden vullen & tonen indien rechten
    const tdContainer = document.getElementById('td-extra-fields');
    if (ingelogdePermissies.admin || ingelogdePermissies.td) {
        tdContainer.style.display = 'block';
        document.getElementById('edit-benodigdheden').value = defect.benodigdheden || '';
        document.getElementById('edit-onderdelen-status').value = defect.onderdelenStatus || '';
    } else {
        tdContainer.style.display = 'none';
    }

    modal.style.display = 'block';
    overlay.style.display = 'block';
}

// 5. FORMULIER AFHANDELING
function setupFormListeners() {
    // A. NIEUW DEFECT
    document.getElementById('algemeen-defect-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = "Bezig...";

        const payload = {
            type: "LOG_ALGEMEEN_DEFECT",
            medewerker: ingelogdeNaam,
            locatie: document.getElementById('locatie-select').value,
            defect: document.getElementById('algemeen-defect-omschrijving').value
        };

        callApi(payload).then(() => {
            toonStatus("Defect gemeld!", "success");
            e.target.reset();
            document.getElementById('modal-algemeen-defect').style.display = 'none';
            document.getElementById('modal-overlay-algemeen').style.display = 'none';
            fetchAlgemeneDefecten();
        }).catch(err => toonStatus("Fout: " + err.message, "error"))
          .finally(() => { btn.disabled = false; btn.textContent = "Versturen"; });
    });

    // B. BEWERKEN / OPSLAAN
    document.getElementById('edit-algemeen-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-edit-algemeen-btn');
        btn.disabled = true; btn.textContent = "Opslaan...";

        // Check welke API call we moeten doen (Simpel update of Extended update voor TD)
        let payload;
        if (ingelogdePermissies.admin || ingelogdePermissies.td) {
            // Gebruik de nieuwe UPDATE_DEFECT_EXTENDED_ALGEMEEN die we in Code.gs hebben gemaakt
            payload = {
                type: "UPDATE_DEFECT_EXTENDED_ALGEMEEN",
                rowId: document.getElementById('edit-algemeen-id').value,
                newStatus: "Open", // Blijft open bij edit, tenzij we status dropdown toevoegen (kan later)
                benodigdheden: document.getElementById('edit-benodigdheden').value,
                onderdelenStatus: document.getElementById('edit-onderdelen-status').value
            };
            // Voor de locatie/omschrijving update moeten we eigenlijk ook zorgen dat die mee gaan, 
            // of we gebruiken de generieke UPDATE_ALGEMEEN_DEFECT. 
            // Laten we voor nu de UPDATE_ALGEMEEN_DEFECT gebruiken en daarna extended, of simpelweg:
            // TIP: Voeg locatie/omschrijving toe aan UPDATE_DEFECT_EXTENDED_ALGEMEEN in Code.gs als je die ook wilt wijzigen als TD.
            // Voor nu doe ik even de basis update:
             callApi({
                type: "UPDATE_ALGEMEEN_DEFECT",
                rowId: document.getElementById('edit-algemeen-id').value,
                nieuweLocatie: document.getElementById('edit-algemeen-locatie').value,
                nieuweOmschrijving: document.getElementById('edit-algemeen-omschrijving').value,
                medewerker: ingelogdeNaam // Voor eigenaar check
            }).then(() => {
                // En DAARNA de TD velden
                return callApi(payload);
            }).then(afronden).catch(err => { alert(err.message); btn.disabled=false; btn.textContent="Opslaan"; });

        } else {
            // Gewone gebruiker update
            payload = {
                type: "UPDATE_ALGEMEEN_DEFECT",
                rowId: document.getElementById('edit-algemeen-id').value,
                nieuweLocatie: document.getElementById('edit-algemeen-locatie').value,
                nieuweOmschrijving: document.getElementById('edit-algemeen-omschrijving').value,
                medewerker: ingelogdeNaam
            };
            callApi(payload).then(afronden).catch(handleErr);
        }

        function afronden() {
            toonStatus("Wijzigingen opgeslagen.", "success");
            document.getElementById('modal-edit-algemeen').style.display = 'none';
            document.getElementById('modal-overlay-algemeen').style.display = 'none';
            fetchAlgemeneDefecten();
            btn.disabled = false; btn.textContent = "Opslaan";
        }
        function handleErr(err) { alert(err.message); btn.disabled=false; btn.textContent="Opslaan"; }
    });

    // C. VERWIJDEREN
    document.getElementById('delete-algemeen-btn').addEventListener('click', () => {
        if(!confirm("Weet je zeker dat je dit wilt verwijderen?")) return;
        
        const rowId = document.getElementById('edit-algemeen-id').value;
        const type = (ingelogdePermissies.admin || ingelogdePermissies.td) 
            ? "UPDATE_ALGEMEEN_DEFECT_STATUS" // Admin zet status op 'Verwijderd'
            : "DELETE_OWN_ALGEMEEN_DEFECT";   // User probeert eigen te verwijderen

        // Let op payload verschil
        let payload = { type: type, rowId: rowId };
        if (type === "UPDATE_ALGEMEEN_DEFECT_STATUS") payload.newStatus = "Verwijderd";
        else payload.medewerker = ingelogdeNaam;

        callApi(payload).then(() => {
            toonStatus("Verwijderd.", "success");
            document.getElementById('modal-edit-algemeen').style.display = 'none';
            document.getElementById('modal-overlay-algemeen').style.display = 'none';
            fetchAlgemeneDefecten();
        }).catch(err => alert("Fout: " + err.message));
    });
}

// 6. HELPERS
async function callApi(payload) {
    if (ingelogdePermissies) payload.perms = ingelogdePermissies;
    const response = await fetch(WEB_APP_URL + "?v=" + Date.now(), {
        method: 'POST', body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status === "success") return result;
    else throw new Error(result.message);
}

function toonStatus(msg, type) {
    const el = document.getElementById('algemeen-defect-status');
    el.textContent = msg;
    el.className = 'status-bericht ' + type;
    el.style.display = 'block';
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => { el.style.display = 'none'; }, 3000);
}