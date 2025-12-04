/* ===============================
   KART DASHBOARD SCRIPT (MET PERMISSIES)
   =============================== */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

let ingelogdeNaam = "";
let ingelogdePermissies = {};
let alleDefecten = [];
let TOTAAL_KARTS = 40; // Standaard fallback, wordt overschreven door server

// --- DEEL 1: DE "BEWAKER" ---
(function () {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    const rawPerms = localStorage.getItem('ingelogdePermissies');

    // 1. Login Check
    if (!ingelogdeNaam || !rawPerms) {
        alert("Je bent niet ingelogd.");
        window.location.href = "../login/";
        return;
    }

    // Parse de permissies
    ingelogdePermissies = JSON.parse(rawPerms);

    // 2. Bepaal of we 'Manager' knoppen (Oplossen/Verwijderen) mogen zien
    // Dit mag als je 'Admin' OF 'TD' rechten hebt.
    if (ingelogdePermissies.admin || ingelogdePermissies.td) {
        document.body.classList.add('is-manager');
    }

    // 3. Start modules
    vulKartDropdowns(); // Tekent eerst 1-40 (zodat je direct beeld hebt)
    haalInstellingenOp(); // Haalt op de achtergrond het echte aantal op (bijv. 50) en tekent opnieuw
    setupDefectForm();
    laadDefectenDashboard();
    setupKartFilter();
    setupEditModal();

})();

// --- DEEL 2: FUNCTIES ---

function vulKartDropdowns() {
    const meldSelect = document.getElementById('new-defect-kart');
    const editSelect = document.getElementById('edit-kart-select');
    
    // Eerst leegmaken (voor als we de functie opnieuw aanroepen na laden settings)
    if (meldSelect) {
        meldSelect.innerHTML = '<option value="">Kart...</option>';
        for (let i = 1; i <= TOTAAL_KARTS; i++) {
            meldSelect.add(new Option(`Kart ${i}`, i));
        }
    }
    
    if (editSelect) {
        // Edit select heeft geen placeholder nodig, die wordt later gezet
        editSelect.innerHTML = ''; 
        for (let i = 1; i <= TOTAAL_KARTS; i++) {
            editSelect.add(new Option(`Kart ${i}`, i));
        }
    }
    
    // Update ook even het tekstje in het dashboard (Statistieken blokje)
    const totaalVeld = document.getElementById('stat-totaal-karts');
    if (totaalVeld) totaalVeld.textContent = TOTAAL_KARTS;
}

function setupDefectForm() { // Kart defect
    const defectForm = document.getElementById('new-defect-form');
    if (!defectForm) return;
    const defectButton = document.getElementById('new-defect-submit');

    defectForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const kartNummer = document.getElementById('new-defect-kart').value;
        const omschrijving = document.getElementById('new-defect-problem').value.trim();
        if (kartNummer === "" || omschrijving === "") {
            toonDefectStatus("Selecteer een kart en vul een omschrijving in.", "error"); return;
        }
        defectButton.disabled = true; defectButton.textContent = "Bezig...";

        // Let op: type is "LOG_DEFECT"
        const payload = { type: "LOG_DEFECT", medewerker: ingelogdeNaam, kartNummer: kartNummer, defect: omschrijving };

        callApi(payload)
            .then(data => {
                toonDefectStatus("Defect succesvol gemeld!", "success");
                defectForm.reset(); laadDefectenDashboard();
            })
            .catch(error => {
                toonDefectStatus(error.message || "Melden mislukt", "error");
            })
            .finally(() => {
                defectButton.disabled = false; defectButton.textContent = "+ Toevoegen";
            });
    });
}

function laadDefectenDashboard() {
    // NIEUWE REGEL:
    toonSkeletonKaarten('defect-card-container', 4);

    callApi({ type: "GET_DEFECTS" })
        .then(result => {
            alleDefecten = result.data;
            updateStatBoxes(alleDefecten);
            renderDefectCards(alleDefecten);
            setupDashboardListeners();
        })
        .catch(error => {
            if (document.getElementById('defect-card-container')) {
                document.getElementById('defect-card-container').innerHTML = `<p style="color: red;">Kon defecten niet laden: ${error.message}</p>`;
            }
        });
}

function updateStatBoxes(defects) {
    const openDefecten = defects.filter(d => d.status === 'Open');
    const uniekeKartsMetProbleem = [...new Set(openDefecten.map(d => d.kartNummer))];
    
    document.getElementById('stat-karts-problemen').textContent = uniekeKartsMetProbleem.length;
    
    // AANGEPAST: Gebruik nu TOTAAL_KARTS in plaats van 40
    document.getElementById('stat-werkende-karts').textContent = TOTAAL_KARTS - uniekeKartsMetProbleem.length;
}

function setupKartFilter() {
    const statusFilter = document.getElementById('filter-status');
    const wisButton = document.getElementById('filter-wissen-btn');
    function pasFiltersToe() {
        const geselecteerdeStatus = statusFilter.value;
        let gefilterdeLijst = alleDefecten;
        if (geselecteerdeStatus !== 'alle') {
            gefilterdeLijst = gefilterdeLijst.filter(d => d.status.toLowerCase() === geselecteerdeStatus);
        }
        renderDefectCards(gefilterdeLijst);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', pasFiltersToe);
        wisButton.addEventListener('click', () => {
            statusFilter.value = 'open'; pasFiltersToe();
        });
    }
}

function renderDefectCards(defects) {
    const container = document.getElementById("defect-card-container");
    if (!container) return;
    container.innerHTML = "";

    // Filter "Verwijderd" eruit VOORDAT we renderen
    const actieveDefecten = defects.filter(d => d.status !== 'Verwijderd');

    if (actieveDefecten.length === 0) {
        container.innerHTML = "<p>Geen defecten gevonden voor deze selectie.</p>"; return;
    }
    actieveDefecten.sort((a, b) => ("Open" === a.status ? -1 : 1) - ("Open" === b.status ? -1 : 1));

    actieveDefecten.forEach(defect => {
        const ts = tijdGeleden(defect.timestamp);
        const kaart = document.createElement("div");
        kaart.className = "defect-card";
        if (defect.status === "Opgelost") { kaart.classList.add("status-opgelost"); }

        let editKnopHtml = '';
        const isEigenaar = (defect.medewerker === ingelogdeNaam);
        const isBinnen24Uur = (Date.now() - new Date(defect.timestamp).getTime() < 86400000);

        if (isEigenaar && defect.status === "Open" && isBinnen24Uur) {
            editKnopHtml = `<button class="edit-defect-btn" 
                                    data-row-id="${defect.rowId}" 
                                    data-kart="${defect.kartNummer}" 
                                    data-omschrijving="${escape(defect.defect)}">
                                Aanpassen
                           </button>`;
        }

        const managerKnopHtml = (defect.status === "Open")
            ? `<button class="manager-btn" data-row-id="${defect.rowId}">Markeer als Opgelost</button>`
            : '';

        kaart.innerHTML = `
            <h3>Kart ${defect.kartNummer}</h3>
            <div class="meta">
                <span class="meta-item">Gemeld door: ${defect.medewerker}</span>
                <span class="meta-item">Gemeld: ${ts}</span>
                <span class="meta-item">Status: <strong>${defect.status}</strong></span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
            <div class="knoppen-container">
                ${editKnopHtml}
                ${managerKnopHtml}
            </div>
        `;
        container.appendChild(kaart);
    });
}

function setupDashboardListeners() {
    const container = document.getElementById("defect-card-container");
    if (!container) return;
    container.addEventListener("click", e => {
        if (e.target.classList.contains("manager-btn")) {
            markeerDefectOpgelost(e.target.dataset.rowId, e.target);
        }
        if (e.target.classList.contains("edit-defect-btn")) {
            const knop = e.target;
            openEditModal(
                knop.dataset.rowId,
                knop.dataset.kart,
                unescape(knop.dataset.omschrijving)
            );
        }
    });
}

function markeerDefectOpgelost(rowId, buttonEl) {
    if (!confirm("Weet je zeker dat je dit defect als opgelost wilt markeren?")) return;
    buttonEl.disabled = true; buttonEl.textContent = "Bezig...";

    // API Call update: we sturen nu impliciet permissies mee via callApi
    const payload = { type: "UPDATE_DEFECT_STATUS", rowId: rowId, newStatus: "Opgelost" };

    callApi(payload)
        .then(result => {
            toonDefectStatus("Defect gemarkeerd als opgelost.", "success");
            laadDefectenDashboard();
        }).catch(error => {
            toonDefectStatus(error.message, "error");
            buttonEl.disabled = false; buttonEl.textContent = "Markeer als Opgelost";
        });
}

// ========================
//  MODAL FUNCTIES
// ========================

function setupEditModal() {
    const modal = document.getElementById('edit-modal');
    const overlay = document.getElementById('modal-overlay');
    const form = document.getElementById('edit-defect-form');
    const saveButton = document.getElementById('modal-save-btn');
    const cancelButton = document.getElementById('modal-cancel-btn');
    const closeButton = document.getElementById('modal-close-btn');
    const deleteButton = document.getElementById('modal-delete-btn');

    if (!form) return;

    // OPSLAAN (Aanpassen)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = "Opslaan...";

        const payload = {
            type: "UPDATE_DEFECT",
            rowId: document.getElementById('edit-row-id').value,
            newKartNummer: document.getElementById('edit-kart-select').value,
            newText: document.getElementById('edit-defect-omschrijving').value.trim(),
            medewerker: ingelogdeNaam
        };

        callApi(payload)
            .then(result => {
                toonDefectStatus("Defect succesvol bijgewerkt.", "success");
                closeEditModal();
                laadDefectenDashboard();
            })
            .catch(error => {
                alert("Fout: " + error.message);
            })
            .finally(() => {
                saveButton.disabled = false;
                saveButton.textContent = "Opslaan";
            });
    });

    // VERWIJDEREN (alleen voor managers/TD)
    if (deleteButton) {
        deleteButton.addEventListener('click', () => {
            if (!confirm('Weet je zeker dat je deze melding permanent wilt verwijderen?')) {
                return;
            }

            deleteButton.disabled = true;
            deleteButton.textContent = "Bezig...";

            const rowId = document.getElementById('edit-row-id').value;
            const payload = {
                type: "UPDATE_DEFECT_STATUS",
                rowId: rowId,
                newStatus: "Verwijderd"
            };

            callApi(payload)
                .then(result => {
                    toonDefectStatus("Defect succesvol verwijderd.", "success");
                    closeEditModal();
                    laadDefectenDashboard();
                })
                .catch(error => {
                    alert("Fout: " + error.message);
                })
                .finally(() => {
                    deleteButton.disabled = false;
                    deleteButton.textContent = "Verwijderen";
                });
        });
    }

    if (cancelButton) cancelButton.addEventListener('click', closeEditModal);
    if (closeButton) closeButton.addEventListener('click', closeEditModal);
    if (overlay) overlay.addEventListener('click', closeEditModal);
}

function openEditModal(rowId, kartNummer, omschrijving) {
    document.getElementById('edit-row-id').value = rowId;
    document.getElementById('edit-kart-select').value = kartNummer;
    document.getElementById('edit-defect-omschrijving').value = omschrijving;

    const modal = document.getElementById('edit-modal');
    const overlay = document.getElementById('modal-overlay');

    if (modal && overlay) {
        modal.style.display = 'block';
        overlay.style.display = 'block';
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    const overlay = document.getElementById('modal-overlay');

    if (modal && overlay) {
        modal.style.display = 'none';
        overlay.style.display = 'none';
    }
}

function toonDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message-defect');
    if (statusDiv) {
        statusDiv.textContent = bericht;
        statusDiv.className = `status-bericht ${type}`;
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 4000);
    }
}

// --- ALGEMENE API CALL (AANGEPAST VOOR PERMISSIES) ---
async function callApi(type, extraData = {}) {
    const url = WEB_APP_URL + "?v=" + new Date().getTime();
    let payload;

    // Support voor beide aanroep-stijlen (string of object)
    if (typeof type === 'string') {
        payload = { type: type, ...extraData };
    } else {
        payload = type;
    }

    // VOEG PERMISSIES TOE
    if (typeof ingelogdePermissies !== 'undefined') {
        payload.perms = ingelogdePermissies;
    }

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

function tijdGeleden(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " jaar geleden";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " maanden geleden";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " dagen geleden";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " uur geleden";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min geleden";

    return "Zojuist";
}

function toonSkeletonKaarten(containerId, aantal) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    for (let i = 0; i < aantal; i++) {
        html += `<div class="defect-card skeleton-card skeleton"></div>`;
    }
    container.innerHTML = html;
}

function haalInstellingenOp() {
    callApi("GET_SETTINGS").then(result => {
        if (result.data && result.data['totaal_karts']) {
            // Update de variabele met de waarde uit de spreadsheet
            TOTAAL_KARTS = parseInt(result.data['totaal_karts']);
            
            // Ververs de dropdowns en statistieken met het nieuwe aantal
            vulKartDropdowns();
            
            // Als we defecten al geladen hadden, update de statistiek-boxen dan ook
            if (typeof alleDefecten !== 'undefined') {
                updateStatBoxes(alleDefecten);
            }
        }
    }).catch(err => console.log("Kon instellingen niet laden, gebruik standaard 40."));
}