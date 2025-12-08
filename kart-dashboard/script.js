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

/* --- Vervang de functie renderDefectCards --- */
function renderDefectCards(defects) {
    const container = document.getElementById("defect-card-container");
    if (!container) return;
    container.innerHTML = "";

    // Filter verwijderde items
    const actieveDefecten = defects.filter(d => d.status !== 'Verwijderd');

    if (actieveDefecten.length === 0) {
        container.innerHTML = "<p>Geen defecten gevonden voor deze selectie.</p>"; return;
    }
    
    // Sorteren: Open eerst
    actieveDefecten.sort((a, b) => ("Open" === a.status ? -1 : 1) - ("Open" === b.status ? -1 : 1));

    actieveDefecten.forEach(defect => {
        const ts = tijdGeleden(defect.timestamp);
        const kaart = document.createElement("div");
        kaart.className = "defect-card";
        kaart.style.position = "relative"; 

        if (defect.status === "Opgelost") { kaart.classList.add("status-opgelost"); }

        // --- KNOPPEN LOGICA AANGEPAST ---
        let actieKnop = '';
        
        const isEigenaar = (defect.medewerker === ingelogdeNaam);
        const isVers = (Date.now() - new Date(defect.timestamp).getTime() < 86400000);
        const isTD = ingelogdePermissies.td || ingelogdePermissies.admin;

        // Situatie 1: Defect is nog OPEN
        if (defect.status === 'Open') {
            // Eigenaar (<24u) OF TD mag bewerken -> Potloodje
            if ((isEigenaar && isVers) || isTD) {
                actieKnop = maakEditKnop(defect);
            }
        } 
        // Situatie 2: Defect is OPGELOST
        else if (defect.status === 'Opgelost') {
            // ALLEEN TD/Admin mag verwijderen -> Rood Kruisje
            // De eigenaar ziet hier nu niets meer.
            if (isTD) {
                actieKnop = `
                    <button class="delete-icon-btn" data-row-id="${defect.rowId}">
                        ✖
                    </button>`;
            }
        }

        // TD Info opbouwen (blijft hetzelfde)
        let extraInfo = '';
        if (defect.benodigdheden) {
            extraInfo += `<div style="font-size: 0.85em; color: #ffc107; margin-top:5px;">Nodig: ${defect.benodigdheden}</div>`;
        }
        if (defect.onderdelenStatus && defect.onderdelenStatus !== 'Niet nodig') {
            const kleur = defect.onderdelenStatus === 'Aanwezig' ? '#2ecc71' : '#e74c3c'; 
            extraInfo += `<div style="font-size: 0.85em; color: ${kleur};">Onderdeel: ${defect.onderdelenStatus}</div>`;
        }

        kaart.innerHTML = `
            <h3>Kart ${defect.kartNummer}</h3>
            <div class="meta">
                <span class="meta-item">Gemeld door: ${defect.medewerker}</span>
                <span class="meta-item">Gemeld: ${ts}</span>
                <span class="meta-item">Status: <strong>${defect.status}</strong></span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
            ${extraInfo}
            ${actieKnop}
        `;
        container.appendChild(kaart);
    });
}

// Hulpfunctie om dubbele code te voorkomen
function maakEditKnop(defect) {
    return `<button class="edit-icon-btn" 
                data-row-id="${defect.rowId}" 
                data-kart="${defect.kartNummer}" 
                data-omschrijving="${escape(defect.defect)}"
                data-status="${defect.status}"
                data-benodigdheden="${escape(defect.benodigdheden || '')}"
                data-onderdelen="${escape(defect.onderdelenStatus || '')}">
            ✎
       </button>`;
}

function setupDashboardListeners() {
    const container = document.getElementById("defect-card-container");
    if (!container) return;
    
    container.addEventListener("click", e => {
        // 1. KLIK OP POTLOOD (Bewerken)
        const editKnop = e.target.closest('.edit-icon-btn');
        if (editKnop) {
            openEditModal(editKnop.dataset);
        }

        // 2. KLIK OP KRUISJE (Verwijderen door TD)
        const deleteKnop = e.target.closest('.delete-icon-btn');
        if (deleteKnop) {
            const rowId = deleteKnop.dataset.rowId;
            // Bevestiging vragen
            if (confirm("Wil je dit opgeloste defect definitief verwijderen?")) {
                
                // Visuele feedback
                deleteKnop.disabled = true; 
                deleteKnop.innerHTML = "..."; 

                // We gebruiken hier de bestaande UPDATE functie die TD'ers mogen gebruiken
                const payload = { 
                    type: "UPDATE_DEFECT_STATUS", 
                    rowId: rowId, 
                    newStatus: "Verwijderd" 
                };

                callApi(payload)
                    .then(res => {
                        toonDefectStatus("Defect verwijderd.", "success");
                        laadDefectenDashboard();
                    })
                    .catch(err => {
                        alert("Fout: " + err.message);
                        deleteKnop.disabled = false; deleteKnop.innerHTML = "✖";
                    });
            }
        }
    });
}

/* --- Vervang setupEditModal en voeg logic toe --- */
function setupEditModal() {
    const overlay = document.getElementById('modal-overlay');
    const form = document.getElementById('edit-defect-form');
    const saveButton = document.getElementById('modal-save-btn');
    const resolveButton = document.getElementById('modal-resolve-btn'); // De nieuwe knop
    const deleteButton = document.getElementById('modal-delete-btn');

    // Sluit knoppen logic
    document.getElementById('modal-close-btn').onclick = closeEditModal;
    document.getElementById('modal-cancel-btn').onclick = closeEditModal;
    if (overlay) overlay.onclick = closeEditModal;

    if (!form) return;

    // ALGEMENE FUNCTIE OM TE SAVEN
    function verwerkOpslaan(nieuweStatus) {
        // Welke knop drukten we in? (Visuele feedback)
        const actieveKnop = (nieuweStatus === "Opgelost") ? resolveButton : saveButton;
        actieveKnop.disabled = true;
        actieveKnop.textContent = "Bezig...";

        const payload = {
            type: "UPDATE_DEFECT_EXTENDED",
            rowId: document.getElementById('edit-row-id').value,
            newKartNummer: document.getElementById('edit-kart-select').value,
            newText: document.getElementById('edit-defect-omschrijving').value.trim(),
            // Lees de TD velden uit
            benodigdheden: document.getElementById('edit-benodigdheden').value,
            onderdelenStatus: document.getElementById('edit-onderdelen-status').value,
            // Gebruik de status die we meekrijgen (Opgelost of de originele)
            newStatus: nieuweStatus,
            medewerker: ingelogdeNaam
        };

        callApi(payload)
            .then(result => {
                const melding = (nieuweStatus === "Opgelost") ? "Defect opgelost!" : "Wijzigingen opgeslagen.";
                toonDefectStatus(melding, "success");
                closeEditModal();
                laadDefectenDashboard();
            })
            .catch(error => {
                toonDefectStatus("Fout: " + error.message, "error");
            })
            .finally(() => {
                actieveKnop.disabled = false;
                actieveKnop.textContent = (nieuweStatus === "Opgelost") ? "✓ Markeer als Opgelost" : "Opslaan";
            });
    }

    // KNOP 1: OPSLAAN (Status blijft zoals hij was, meestal 'Open')
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const huidigeStatus = document.getElementById('original-status').value;
        verwerkOpslaan(huidigeStatus);
    });

    // KNOP 2: OPLOSSEN (Nieuwe knop)
    if (resolveButton) {
        resolveButton.addEventListener('click', () => {
            // Bevestiging is misschien fijn, maar hoeft niet perse
            if (!confirm("Weet je zeker dat je dit defect als opgelost wilt markeren?")) return;
            verwerkOpslaan("Opgelost");
        });
    }

    // KNOP 3: VERWIJDEREN (Bestaande logica)
    if (deleteButton) {
        deleteButton.addEventListener('click', () => {
            if (!confirm('Weet je zeker dat je dit defect definitief wilt verwijderen uit de lijst?')) return;

            deleteButton.disabled = true; deleteButton.textContent = "...";
            const rowId = document.getElementById('edit-row-id').value;

            callApi({ type: "UPDATE_DEFECT_STATUS", rowId: rowId, newStatus: "Verwijderd" })
                .then(result => {
                    toonDefectStatus("Verwijderd.", "success");
                    closeEditModal();
                    laadDefectenDashboard();
                })
                .catch(err => alert(err.message))
                .finally(() => {
                    deleteButton.disabled = false; deleteButton.textContent = "Verwijderen";
                });
        });
    }
}

/* --- De nieuwe openEditModal --- */
function openEditModal(dataset) {
    // 1. Vul de standaard velden
    document.getElementById('edit-row-id').value = dataset.rowId;
    document.getElementById('edit-kart-select').value = dataset.kart;
    document.getElementById('edit-defect-omschrijving').value = unescape(dataset.omschrijving);
    document.getElementById('original-status').value = dataset.status;

    // 2. TD Logica
    const tdSection = document.getElementById('td-fields');
    const deleteBtn = document.getElementById('modal-delete-btn');
    const resolveBtn = document.getElementById('modal-resolve-btn'); // De nieuwe knop
    const isTD = ingelogdePermissies.td || ingelogdePermissies.admin;

    if (isTD) {
        tdSection.style.display = 'block';

        // HIER IS DE FIX: Vul de velden met de data uit de knop
        document.getElementById('edit-benodigdheden').value = dataset.benodigdheden ? unescape(dataset.benodigdheden) : '';
        document.getElementById('edit-onderdelen-status').value = dataset.onderdelen || '';


        // Knoppen tonen/verbergen op basis van status
        if (dataset.status === 'Opgelost') {
            deleteBtn.style.display = 'block';
            if (resolveBtn) resolveBtn.style.display = 'none'; // Al opgelost, dus knop weg
        } else {
            deleteBtn.style.display = 'none';
            if (resolveBtn) resolveBtn.style.display = 'block'; // Nog open, dus knop tonen
        }

    } else {
        tdSection.style.display = 'none';
        deleteBtn.style.display = 'none';
        if (resolveBtn) resolveBtn.style.display = 'none';
    }

    // 3. Open de modal
    document.getElementById('edit-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';
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