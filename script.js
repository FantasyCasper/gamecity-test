/* ===============================
   VOLLEDIGE SCRIPT.JS (MET PERMISSIES, PROGRESS BARS & FILTERS)
   =============================== */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

// Globale Variabelen
let CHECKLIST_DATA = {};
let ingelogdeNaam = "";
let ingelogdePermissies = {};
let alleAlgemeneDefectenData = []; // Cache voor het filteren
let GLOBALE_ACTIVITEITEN = [];

// --- DEEL 1: DE "BEWAKER" & INIT ---
(function () {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    const rawPerms = localStorage.getItem('ingelogdePermissies');

    // 1. Login Check
    if (!ingelogdeNaam || !rawPerms) {
        // Als we niet op de login pagina zijn, stuur terug
        if (!window.location.href.includes('login')) {
            window.location.href = "login/";
            return;
        }
    } else {
        // Parse de permissies
        ingelogdePermissies = JSON.parse(rawPerms);
    }

    // 2. Vul naam in op 'Algemeen' tab
    const welkomNaam = document.getElementById('algemeen-welkom-naam');
    if (welkomNaam) welkomNaam.textContent = ingelogdeNaam;

    // 3. TABBLADEN BEHEREN OP BASIS VAN VINKJES

    // A. Checklists Tabblad
    if (!ingelogdePermissies.checklists) {
        const checklistBtn = document.querySelector('.main-tab-link[data-tab="tab-checklists"]');
        if (checklistBtn) checklistBtn.style.display = 'none';
    }

    // B. Admin Panel Link (Toon als je Admin OF TD OF Users rechten hebt)
    if (ingelogdePermissies.admin || ingelogdePermissies.td || ingelogdePermissies.users) {
        document.querySelectorAll('.admin-tab').forEach(link => link.classList.add('zichtbaar'));
        const container = document.querySelector('.container');
        if (container) container.classList.add('is-manager');
    }

    // 4. Start alle modules
    koppelListeners();
    setupMainTabs();
    setupMobileMenu();

    // Defecten modules
    vulKartMeldDropdown();
    setupDefectForm();
    setupAlgemeenDefectForm();
    setupAlgemeenModalLogic();
    setupAlgemeenEditLogic();

    // Dashboards laden
    setTimeout(() => laadDefectenDashboard(), 10);
    setTimeout(() => laadBijzonderhedenVanGisteren(), 20);
    setTimeout(() => fetchAlgemeneDefecten(), 30);
    setTimeout(() => laadGlobaleInstellingen(), 40);

    // Checklists heeft prioriteit, die doen we direct
    if (ingelogdePermissies.checklists) {
        laadChecklistConfiguratie();
    }

    // Nieuw Dashboard met Filter
    fetchAlgemeneDefecten();
    setupAlgemeenFilter();

})();


// --- DEEL 2: ALGEMENE FUNCTIES ---

function setupMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => { mainNav.classList.toggle('is-open'); });
        document.querySelectorAll('.main-tab-link[data-tab]').forEach(button => {
            button.addEventListener('click', () => { if (window.innerWidth <= 720) { mainNav.classList.remove('is-open'); } });
        });
    }
}

function setupMainTabs() {
    document.querySelectorAll('.main-tab-link[data-tab]').forEach(button => {
        button.addEventListener('click', (e) => {
            if (button.tagName === 'BUTTON') {
                e.preventDefault();
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.main-tab-link').forEach(link => link.classList.remove('active'));
                const tabId = button.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
                button.classList.add('active');
            }
        });
    });
}

function koppelListeners() {
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            if (confirm('Weet je zeker dat je wilt uitloggen?')) {
                localStorage.clear(); window.location.href = 'login/';
            }
        });
    }

    const actSelect = document.getElementById('activiteit-select');
    if (actSelect) {
        actSelect.addEventListener('change', (e) => updateChecklists(e.target.value));
    }

    document.querySelectorAll(".collapsible").forEach(coll => {
        coll.addEventListener("click", function () {
            this.classList.toggle("active");
            var content = this.parentElement.querySelector('.content');
            content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + "px";
        });
    });
}

// --- API Helper (Met Permissies) ---
async function callApi(payload) {
    // Stuur de permissies mee, de backend checkt of het mag
    if (typeof ingelogdePermissies !== 'undefined') {
        payload.perms = ingelogdePermissies;
    }

    const url = WEB_APP_URL + "?v=" + new Date().getTime(); // Cache-buster

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        mode: 'cors'
    });

    const result = await response.json();

    if (result.status === "success") {
        return result;
    } else {
        throw new Error(result.message);
    }
}


// --- DEEL 3: CHECKLIST FUNCTIES ---

function laadChecklistConfiguratie() {
    console.log("Checklists laden...");

    // 1. EERST: Kijk of we nog data van vorige keer hebben
    const cachedData = localStorage.getItem('CHECKLIST_CACHE');
    if (cachedData) {
        console.log("Cache gevonden! Direct tonen.");
        CHECKLIST_DATA = JSON.parse(cachedData);
        vulActiviteitDropdown(); // Hulpfunctie om dubbele code te voorkomen
    }

    // 2. DAARNA: Haal verse data van de server (Silent update)
    callApi({ type: "GET_CHECKLIST_CONFIG" })
        .then(result => {
            console.log("Verse data ontvangen van server");

            // Is de data anders dan wat we hadden?
            if (JSON.stringify(result.data) !== cachedData) {
                CHECKLIST_DATA = result.data;
                localStorage.setItem('CHECKLIST_CACHE', JSON.stringify(CHECKLIST_DATA));

                // Alleen dropdown verversen als we nog geen cache hadden 
                // OF als de gebruiker nog niks aan het doen is (om verspringen te voorkomen)
                if (!cachedData) {
                    vulActiviteitDropdown();
                }
            }
        })
        .catch(error => {
            console.error("Kon server niet bereiken, we draaien op cache als die er is.");
            if (!cachedData) toonStatus("Kon checklists niet laden.", "error");
        });
}

function vulActiviteitDropdown() {
    const activiteitSelect = document.getElementById('activiteit-select');
    if (activiteitSelect) {
        const currentVal = activiteitSelect.value;

        while (activiteitSelect.options.length > 1) { activiteitSelect.remove(1); }

        let teTonenLijst = GLOBALE_ACTIVITEITEN;

        if (teTonenLijst.length === 0) {
            teTonenLijst = ["Baan", "Lasergame", "Prison Island", "Minigolf"];
        }

        teTonenLijst.forEach(naam => {
            activiteitSelect.add(new Option(naam, naam));
        });

        // Vangnet voor oude data
        for (const activiteit in CHECKLIST_DATA) {
            if (!teTonenLijst.includes(activiteit)) {
                activiteitSelect.add(new Option(activiteit, activiteit));
            }
        }

        if (currentVal) activiteitSelect.value = currentVal;
    }
}

function updateChecklists(activiteit) {
    const container = document.querySelector('.container');
    const openLijstUL = document.getElementById('lijst-openen');
    const sluitLijstUL = document.getElementById('lijst-sluiten');

    if (!openLijstUL || !sluitLijstUL) return;

    openLijstUL.innerHTML = '';
    sluitLijstUL.innerHTML = '';

    // Reset panels
    document.querySelectorAll(".collapsible").forEach(coll => {
        coll.classList.remove("active");
        const content = coll.nextElementSibling;
        if (content) content.style.maxHeight = null;
    });

    if (activiteit && CHECKLIST_DATA[activiteit]) {
        const data = CHECKLIST_DATA[activiteit];

        if (data.openen) {
            data.openen.forEach((item, i) => {
                openLijstUL.innerHTML += `<li><input type="checkbox" id="open-${i}"><label for="open-${i}">${item}</label></li>`;
            });
        }
        if (data.sluiten) {
            data.sluiten.forEach((item, i) => {
                sluitLijstUL.innerHTML += `<li><input type="checkbox" id="sluit-${i}"><label for="sluit-${i}">${item}</label></li>`;
            });
        }

        if (container) container.classList.add('checklists-zichtbaar');

        updateProgress();

    } else {
        if (container) container.classList.remove('checklists-zichtbaar');
    }
}

function verstuurData(lijstNaam) {
    const activiteit = document.getElementById('activiteit-select').value;
    if (!activiteit) { toonStatus("Fout: Kies een activiteit.", "error"); return; }

    var listId, buttonId, bijzonderhedenId;
    if (lijstNaam === 'Checklist Openen') {
        listId = 'lijst-openen'; buttonId = 'btn-openen'; bijzonderhedenId = 'bijzonderheden-openen';
    } else {
        listId = 'lijst-sluiten'; buttonId = 'btn-sluiten'; bijzonderhedenId = 'bijzonderheden-sluiten';
    }

    var knop = document.getElementById(buttonId);
    knop.disabled = true; knop.textContent = "Bezig...";

    var bijzonderhedenText = document.getElementById(bijzonderhedenId).value.trim();
    var items = [];
    document.querySelectorAll("#" + listId + " li").forEach(li => {
        items.push({ label: li.querySelector('label').textContent, checked: li.querySelector('input').checked });
    });

    var dataPayload = {
        type: "LOG_DATA",
        lijstNaam: lijstNaam,
        items: items,
        medewerker: ingelogdeNaam,
        activiteit: activiteit,
        bijzonderheden: bijzonderhedenText
    };

    callApi(dataPayload)
        .then(data => {
            toonStatus("'" + lijstNaam + "' is succesvol opgeslagen!", "success");
            resetCheckboxes(listId);
            document.getElementById(bijzonderhedenId).value = '';
            updateProgress(); // Reset ook de balk
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        })
        .catch(error => {
            toonStatus(error.message || "Failed to fetch", "error");
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        });
}


// --- DEEL 4: PROGRESS BAR FUNCTIES ---

function updateProgress() {
    updateSingleProgress('lijst-openen', 'progress-container-openen', 'progress-bar-openen', 'progress-text-openen');
    updateSingleProgress('lijst-sluiten', 'progress-container-sluiten', 'progress-bar-sluiten', 'progress-text-sluiten');
}

function updateSingleProgress(listId, containerId, barId, textId) {
    const list = document.getElementById(listId);
    const container = document.getElementById(containerId);
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);

    if (!list || !container || !bar || !text) return;

    const checkboxes = list.querySelectorAll('input[type="checkbox"]');
    const total = checkboxes.length;
    const checked = list.querySelectorAll('input[type="checkbox"]:checked').length;

    if (total > 0) {
        container.style.display = 'block';
        const percentage = Math.round((checked / total) * 100);

        bar.style.width = percentage + "%";
        text.textContent = percentage + "%";

        if (percentage === 100) {
            bar.style.backgroundColor = "#00d2d3"; // Cyaan/Blauw
            text.style.color = "#00d2d3";
        } else {
            bar.style.backgroundColor = "#28a745"; // Groen
            text.style.color = "#fff";
        }
    } else {
        container.style.display = 'none';
    }
}

document.addEventListener('change', function (e) {
    if (e.target.type === 'checkbox' && e.target.closest('#tab-checklists')) {
        updateProgress();
    }
});


// --- DEEL 5: ALGEMEEN TAB (BIJZONDERHEDEN) ---

function laadBijzonderhedenVanGisteren() {
    toonSkeletonRijen('bijzonderheden-body', 3, 4);

    const tabelBody = document.getElementById('bijzonderheden-body');
    if (!tabelBody) return;

    callApi({ type: "GET_YESTERDAYS_BIJZONDERHEDEN" })
        .then(result => {
            tabelBody.innerHTML = '';
            if (result.data.length === 0) {
                tabelBody.innerHTML = '<tr><td colspan="4">Geen bijzonderheden gemeld gisteren.</td></tr>';
            } else {
                result.data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                    <td data-label="Medewerker">${item.medewerker}</td>
                    <td data-label="Activiteit">${item.activiteit}</td>
                    <td data-label="Lijst">${item.lijstnaam.replace("Checklist ", "")}</td>
                    <td data-label="Bijzonderheid">${item.opmerking}</td>
                    `;
                    tabelBody.appendChild(tr);
                });
            }
        })
        .catch(error => {
            tabelBody.innerHTML = `<tr><td colspan="4" style="color: #e74c3c;">Kon bijzonderheden niet laden: ${error.message}</td></tr>`;
        });
}


// --- DEEL 6: ALGEMEEN DEFECT MELDEN ---

function setupAlgemeenModalLogic() {
    const openBtn = document.getElementById('open-defect-modal-btn');
    const closeBtn = document.getElementById('close-defect-modal-btn');
    const cancelBtn = document.getElementById('cancel-defect-modal-btn');
    const modal = document.getElementById('modal-algemeen-defect');
    const overlay = document.getElementById('modal-overlay-algemeen');

    if (!openBtn || !modal || !overlay) return;

    function openModal() {
        modal.style.display = 'block';
        overlay.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
        overlay.style.display = 'none';
    }

    openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    window.sluitAlgemeenDefectModal = closeModal;
}

function setupAlgemeenDefectForm() {
    const form = document.getElementById('algemeen-defect-form');
    if (!form) return;
    const button = document.getElementById('algemeen-defect-submit');

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const locatie = document.getElementById('locatie-select').value;
        const omschrijving = document.getElementById('algemeen-defect-omschrijving').value.trim();

        if (locatie === "" || omschrijving === "") {
            toonAlgemeenDefectStatus("Selecteer een locatie en vul een omschrijving in.", "error"); return;
        }
        button.disabled = true; button.textContent = "Bezig...";

        const payload = { type: "LOG_ALGEMEEN_DEFECT", medewerker: ingelogdeNaam, locatie: locatie, defect: omschrijving };
        callApi(payload)
            .then(data => {
                toonAlgemeenDefectStatus("Defect succesvol gemeld!", "success");
                form.reset();
                if (window.sluitAlgemeenDefectModal) window.sluitAlgemeenDefectModal();
                fetchAlgemeneDefecten();
            })
            .catch(error => {
                toonAlgemeenDefectStatus(error.message || "Melden mislukt", "error");
            })
            .finally(() => {
                button.disabled = false; button.textContent = "Versturen";
            });
    });
}

function setupAlgemeenEditLogic() {
    const container = document.getElementById('algemeen-defecten-grid');
    const modal = document.getElementById('modal-edit-algemeen');
    const overlay = document.getElementById('modal-overlay-edit-algemeen');

    const form = document.getElementById('edit-algemeen-form');
    const inputId = document.getElementById('edit-algemeen-id');
    const inputLocatie = document.getElementById('edit-algemeen-locatie');
    const inputDescr = document.getElementById('edit-algemeen-omschrijving');

    const closeBtn = document.getElementById('close-edit-algemeen-btn');
    const cancelBtn = document.getElementById('cancel-edit-algemeen-btn');
    const deleteBtn = document.getElementById('delete-algemeen-btn');

    if (!container || !modal) return;

    function sluitModal() {
        modal.style.display = 'none';
        overlay.style.display = 'none';
    }

    container.addEventListener('click', (e) => {
        const knop = e.target.closest('.edit-icon-btn');
        if (knop) {
            inputId.value = knop.dataset.id;
            inputLocatie.value = knop.dataset.locatie;
            inputDescr.value = unescape(knop.dataset.descr);

            modal.style.display = 'block';
            overlay.style.display = 'block';
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-edit-algemeen-btn');
        btn.disabled = true; btn.textContent = "Opslaan...";

        const payload = {
            type: "UPDATE_ALGEMEEN_DEFECT",
            rowId: inputId.value,
            nieuweLocatie: inputLocatie.value,
            nieuweOmschrijving: inputDescr.value,
            medewerker: ingelogdeNaam
        };

        callApi(payload).then(res => {
            toonAlgemeenDefectStatus("Defect bijgewerkt!", "success");
            sluitModal();
            fetchAlgemeneDefecten();
        }).catch(err => {
            alert("Fout: " + err.message);
        }).finally(() => {
            btn.disabled = false; btn.textContent = "Opslaan";
        });
    });

    deleteBtn.addEventListener('click', () => {
        if (!confirm("Weet je zeker dat je dit defect wilt verwijderen?")) return;

        deleteBtn.disabled = true; deleteBtn.textContent = "...";

        callApi({
            type: "DELETE_OWN_ALGEMEEN_DEFECT",
            rowId: inputId.value,
            medewerker: ingelogdeNaam
        }).then(res => {
            toonAlgemeenDefectStatus("Defect verwijderd.", "success");
            sluitModal();
            fetchAlgemeneDefecten();
        }).catch(err => {
            alert("Fout: " + err.message);
        }).finally(() => {
            deleteBtn.disabled = false; deleteBtn.textContent = "Verwijderen";
        });
    });

    if (closeBtn) closeBtn.addEventListener('click', sluitModal);
    if (cancelBtn) cancelBtn.addEventListener('click', sluitModal);
    if (overlay) overlay.addEventListener('click', sluitModal);
}

// --- DEEL 7: ALGEMEEN DASHBOARD (MET FILTER & GROEPERING) ---

function setupAlgemeenFilter() {
    const filterSelect = document.getElementById('filter-algemeen-locatie');
    if (filterSelect) {
        filterSelect.addEventListener('change', filterEnRenderDefecten);
    }
}

function fetchAlgemeneDefecten() {
    toonSkeletonKaarten('algemeen-defecten-grid', 3);

    callApi({ type: "GET_PUBLIC_ALGEMEEN_DEFECTS" })
        .then(result => {
            alleAlgemeneDefectenData = result.data || [];
            filterEnRenderDefecten();
        })
        .catch(error => {
            console.error("Kon algemene defecten niet ophalen:", error);
            const container = document.getElementById('algemeen-defecten-grid');
            if (container) container.innerHTML = "<p>Kan lijst niet laden.</p>";
        });
}

function filterEnRenderDefecten() {
    const container = document.getElementById('algemeen-defecten-grid');
    const filterSelect = document.getElementById('filter-algemeen-locatie');

    if (!container) return;

    const gekozenLocatie = filterSelect ? filterSelect.value : 'alle';
    let teTonenLijst = alleAlgemeneDefectenData;

    if (gekozenLocatie !== 'alle') {
        teTonenLijst = teTonenLijst.filter(d => d.locatie === gekozenLocatie);
    }

    laadAlgemeneDefecten(teTonenLijst);
}

// --- HIER IS DE AANPASSING VOOR DE EXTRA INFO ---
function laadAlgemeneDefecten(defecten) {
    const container = document.getElementById('algemeen-defecten-grid');
    container.innerHTML = "";
    if (!defecten) return;

    const openDefecten = defecten.filter(d => d.status === 'Open');
    if (openDefecten.length === 0) {
        container.innerHTML = "<p>Geen openstaande defecten.</p>";
        return;
    }

    openDefecten.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    openDefecten.forEach(defect => {
        const ts = tijdGeleden(defect.timestamp);
        const card = document.createElement('div');
        
        // Zorg voor de juiste classes voor styling en rode rand
        card.className = 'defect-card status-open'; // 'status-open' toegevoegd voor zekerheid
        card.classList.add('locatie-' + defect.locatie.toLowerCase().replace(/\s+/g, '-'));

        const isEigenaar = (defect.medewerker === ingelogdeNaam);
        const isVers = (Date.now() - new Date(defect.timestamp).getTime() < 86400000);

        let editKnop = '';
        if (isEigenaar && isVers) {
            editKnop = `<button class="edit-icon-btn" data-id="${defect.rowId}" data-locatie="${defect.locatie}" data-descr="${escape(defect.defect)}">✎</button>`;
        }

        // INFO BLOKJES (Geel/Groen)
        let extraInfo = '';
        if (defect.benodigdheden) {
            extraInfo += `<div style="font-size: 0.85em; color: #ffc107; margin-top:8px;">🛠️ Nodig: ${defect.benodigdheden}</div>`;
        }
        if (defect.onderdelenStatus) {
            extraInfo += `<div style="font-size: 0.85em; color: #2ecc71; margin-top:2px;">📦 ${defect.onderdelenStatus}</div>`;
        }

        card.innerHTML = `
            <h3>${defect.locatie}</h3>
            <div class="meta">
                <span class="meta-item">Gemeld door: ${defect.medewerker}</span>
                <span class="meta-item">${ts}</span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
            ${extraInfo}
            ${editKnop}
        `;
        container.appendChild(card);
    });
}


// --- DEEL 8: KART DASHBOARD PLACEHOLDERS ---
function vulKartMeldDropdown() { }
function setupDefectForm() { }
function laadDefectenDashboard() { }
function setupKartFilter() { }


// --- DEEL 9: STATUS HELPERS ---

let statusTimeout;
let algemeenDefectTimeout;
let defectTimeout;

function toonStatus(bericht, type) {
    toonMeldingOpElement('status-message', bericht, type, statusTimeout, (t) => statusTimeout = t);
}

function toonAlgemeenDefectStatus(bericht, type) {
    toonMeldingOpElement('algemeen-defect-status', bericht, type, algemeenDefectTimeout, (t) => algemeenDefectTimeout = t);
}

function toonDefectStatus(bericht, type) {
    toonMeldingOpElement('status-message-defect', bericht, type, defectTimeout, (t) => defectTimeout = t);
}

function toonMeldingOpElement(elementId, bericht, type, currentTimeout, setTimeoutCallback) {
    var statusDiv = document.getElementById(elementId);
    if (statusDiv) {
        if (currentTimeout) clearTimeout(currentTimeout);

        statusDiv.style.display = 'none';
        void statusDiv.offsetWidth; 

        var icon = type === 'success' ? '✅ ' : '⚠️ ';
        statusDiv.textContent = icon + bericht;
        statusDiv.className = 'status-bericht ' + type;

        statusDiv.style.display = 'block';

        const t = setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 4000);

        setTimeoutCallback(t);
    }
}

function resetCheckboxes(listId) {
    document.querySelectorAll("#" + listId + " li input").forEach(cb => { cb.checked = false; });
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

function laadGlobaleInstellingen() {
    callApi({type: "GET_SETTINGS"}).then(result => {
        const settings = result.data;
        if (settings && settings['activiteiten']) {
            try {
                GLOBALE_ACTIVITEITEN = JSON.parse(settings['activiteiten']);
                console.log("Activiteiten geladen uit instellingen:", GLOBALE_ACTIVITEITEN);
                vulActiviteitDropdown();
            } catch (e) {
                console.error("Kon activiteiten niet lezen, we gebruiken de standaard.", e);
            }
        }
    }).catch(err => console.log("Geen instellingen gevonden, we gebruiken defaults."));
}