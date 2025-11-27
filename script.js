/* ===============================
   VOLLEDIGE SCRIPT.JS (DYNAMISCHE CHECKLISTS)
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

// Start leeg. Deze wordt gevuld door de server (spreadsheet).
let CHECKLIST_DATA = {};

let ingelogdeNaam = "";
let ingelogdeRol = "";
let alleDefecten = [];
let alleAlgemeneDefectenData = [];

// --- DEEL 1: DE "BEWAKER" & INIT ---
let ingelogdePermissies = {}; // Globale variabele

(function () {
    ingelogdeNaam = localStorage.getItem('ingelogdeMedewerker');
    const rawPerms = localStorage.getItem('ingelogdePermissies');

    // 1. Login Check
    if (!ingelogdeNaam || !rawPerms) {
        if (!window.location.href.includes('login')) {
            window.location.href = "login/";
            return;
        }
    } else {
        // Parse de permissies
        ingelogdePermissies = JSON.parse(rawPerms);
    }

    // 2. Vul naam in
    const welkomNaam = document.getElementById('algemeen-welkom-naam');
    if (welkomNaam) welkomNaam.textContent = ingelogdeNaam;

    // 3. TABBLADEN BEHEREN OP BASIS VAN VINKJES
    // A. Checklists Tabblad
    if (!ingelogdePermissies.checklists) {
        // Verberg de knop in het menu
        const checklistBtn = document.querySelector('.main-tab-link[data-tab="tab-checklists"]');
        if (checklistBtn) checklistBtn.style.display = 'none';
    }

    // B. Admin Panel Link
    // Toon link als je Admin OF TD OF Users rechten hebt
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

    // Dashboards laden
    laadDefectenDashboard();
    setupKartFilter();
    laadBijzonderhedenVanGisteren();
    fetchAlgemeneDefecten();

    // 5. Checklists ophalen (Alleen als je rechten hebt, scheelt data)
    if (ingelogdePermissies.checklists) {
        laadChecklistConfiguratie();
    }
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

// --- API Helper ---
async function callApi(payload) {
    // Voeg ALTIJD rol toe
    payload.perms = ingelogdePermissies;

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


// --- DEEL 3: CHECKLIST FUNCTIES (DYNAMISCH) ---

function laadChecklistConfiguratie() {
    console.log("Checklists ophalen...");
    callApi({ type: "GET_CHECKLIST_CONFIG" })
        .then(result => {
            console.log("Checklists geladen:", result.data);
            CHECKLIST_DATA = result.data; // Vul de variabele

            // Vul de dropdown
            const activiteitSelect = document.getElementById('activiteit-select');
            if (activiteitSelect) {
                // Leegmaken (behalve eerste optie)
                while (activiteitSelect.options.length > 1) { activiteitSelect.remove(1); }

                for (const activiteit in CHECKLIST_DATA) {
                    activiteitSelect.add(new Option(activiteit, activiteit));
                }
            }
        })
        .catch(error => {
            console.error("Fout:", error);
            toonStatus("Kon checklists niet laden.", "error");
        });
}

// 1. De functie die de balk berekent
function updateProgress() {
    // Zoek alle checkboxes in het checklist-tabblad
    const checkboxes = document.querySelectorAll('#tab-checklists input[type="checkbox"]');
    const total = checkboxes.length;

    // Tel hoeveel er aangevinkt zijn
    const checked = document.querySelectorAll('#tab-checklists input[type="checkbox"]:checked').length;

    const container = document.getElementById('progress-container');
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');

    // Alleen tonen als er daadwerkelijk taken zijn
    if (total > 0 && container) {
        container.style.display = 'block';

        const percentage = Math.round((checked / total) * 100);

        // Update de breedte en tekst
        bar.style.width = percentage + "%";
        text.textContent = percentage + "%";

        // Leuke extra: Maak hem Goud/Blauw als hij 100% is!
        if (percentage === 100) {
            bar.style.backgroundColor = "#00d2d3"; // Of goud: #ffd700
            text.style.color = "#00d2d3";
        } else {
            bar.style.backgroundColor = "#28a745"; // Terug naar groen
            text.style.color = "#fff";
        }
    } else if (container) {
        container.style.display = 'none';
    }
}

// 2. Luisteren naar klikken (Event Listener)
// We voegen dit toe aan de hele pagina, maar filteren op checkboxes
document.addEventListener('change', function (e) {
    // Als het veranderde element een checkbox is binnen het checklist tabblad...
    if (e.target.type === 'checkbox' && e.target.closest('#tab-checklists')) {
        updateProgress();
    }
});

function updateChecklists(activiteit) {
    const container = document.querySelector('.container'); // Of specifieker: #tab-checklists
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
    } else {
        if (container) container.classList.remove('checklists-zichtbaar');
    }
    updateProgress();

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
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        })
        .catch(error => {
            toonStatus(error.message || "Failed to fetch", "error");
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        });
}


// --- DEEL 4: ALGEMEEN TAB (BIJZONDERHEDEN) ---
function laadBijzonderhedenVanGisteren() {
    const tabelBody = document.getElementById('bijzonderheden-body');
    if (!tabelBody) return;

    callApi({ type: "GET_YESTERDAYS_BIJZONDERHEDDEN" })
        .then(result => {
            tabelBody.innerHTML = '';
            if (result.data.length === 0) {
                tabelBody.innerHTML = '<tr><td colspan="4">Geen bijzonderheden gemeld gisteren.</td></tr>';
            } else {
                result.data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                    <td>${item.medewerker}</td>
                    <td>${item.activiteit}</td>
                    <td>${item.lijstnaam.replace("Checklist ", "")}</td>
                    <td>${item.opmerking}</td>
                `;
                    tabelBody.appendChild(tr);
                });
            }
        })
        .catch(error => {
            tabelBody.innerHTML = `<tr><td colspan="4" style="color: #e74c3c;">Kon bijzonderheden niet laden: ${error.message}</td></tr>`;
        });
}


// --- DEEL 5: ALGEMEEN DEFECT MELDEN ---
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
        button.disabled = true; button.textContent = "Bezig met melden...";

        const payload = { type: "LOG_ALGEMEEN_DEFECT", medewerker: ingelogdeNaam, locatie: locatie, defect: omschrijving };
        callApi(payload)
            .then(data => {
                toonAlgemeenDefectStatus("Defect succesvol gemeld!", "success");
                form.reset();
                fetchAlgemeneDefecten();
            })
            .catch(error => {
                toonAlgemeenDefectStatus(error.message || "Melden mislukt", "error");
            })
            .finally(() => {
                button.disabled = false; button.textContent = "Meld Algemeen Defect";
            });
    });
}
// --- DEEL 6: ALGEMEEN DASHBOARD (MET FILTER & GROEPERING) ---

function setupAlgemeenFilter() {
    const filterSelect = document.getElementById('filter-algemeen-locatie');
    if (filterSelect) {
        filterSelect.addEventListener('change', filterEnRenderDefecten);
    }
}

function fetchAlgemeneDefecten() {
    callApi({ type: "GET_PUBLIC_ALGEMEEN_DEFECTS" })
        .then(result => {
            // Sla de ruwe data op in onze globale variabele
            alleAlgemeneDefectenData = result.data || [];
            // Roep de filter-functie aan om ze te tonen
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

    // Welke locatie wil de gebruiker zien?
    const gekozenLocatie = filterSelect ? filterSelect.value : 'alle';

    // 1. Begin met alle data
    let teTonenLijst = alleAlgemeneDefectenData;

    // 2. Filteren (als er niet 'alle' is gekozen)
    if (gekozenLocatie !== 'alle') {
        teTonenLijst = teTonenLijst.filter(d => d.locatie === gekozenLocatie);
    }

    // 3. Renderen (deze functie zorgt ook voor het sorteren/groeperen)
    laadAlgemeneDefecten(teTonenLijst);
}

function laadAlgemeneDefecten(defecten) {
    const container = document.getElementById('algemeen-defecten-grid');
    container.innerHTML = "";

    if (!defecten) return; // Gebeurt alleen bij ernstige fout

    // Filter alleen 'Open' status (voor de zekerheid)
    const openDefecten = defecten.filter(d => d.status === 'Open');

    if (openDefecten.length === 0) {
        container.innerHTML = "<p>Geen openstaande defecten voor deze selectie.</p>";
        return;
    }

    // Sorteer op Locatie (Groepeer), daarna op Tijd (nieuwste eerst)
    openDefecten.sort((a, b) => {
        // Eerst sorteren op locatie (alfabetisch)
        if (a.locatie < b.locatie) return -1;
        if (a.locatie > b.locatie) return 1;
        // Als locatie hetzelfde is, sorteer op tijd (nieuwste bovenaan)
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Bouw de kaartjes
    openDefecten.forEach(defect => {
        const ts = new Date(defect.timestamp).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });

        const card = document.createElement('div');
        card.className = 'defect-card';

        // Visuele hint: Voeg de locatienaam toe als class (bijv. 'locatie-baan')
        // Hiermee zou je later in CSS specifieke kleuren kunnen geven
        card.classList.add('locatie-' + defect.locatie.toLowerCase().replace(/\s+/g, '-'));

        card.innerHTML = `
            <h3>${defect.locatie}</h3>
            <div class="meta">
                <span class="meta-item">Gemeld door: ${defect.medewerker}</span>
                <span class="meta-item">Op: ${ts}</span>
            </div>
            <p class="omschrijving">${defect.defect}</p>
        `;
        container.appendChild(card);
    });
}


// --- DEEL 6: KART DASHBOARD FUNCTIES (Lege placeholders) ---
// (Deze functies worden geladen door kart-dashboard/script.js als je daar bent, 
// maar hier definiëren we ze leeg om errors in de console te voorkomen op de hoofdpagina)
function vulKartMeldDropdown() { }
function setupDefectForm() { }
function laadDefectenDashboard() { }
function setupKartFilter() { }


// --- STATUS HELPERS ---
let statusTimeout;

function toonStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message');

    if (statusDiv) {
        // 1. Reset eventuele vorige timers, zodat hij niet te vroeg verdwijnt
        if (statusTimeout) {
            clearTimeout(statusTimeout);
        }

        // 2. Reset de weergave even om de animatie opnieuw te kunnen starten
        statusDiv.style.display = 'none';
        void statusDiv.offsetWidth; // Dit trucje forceert de browser om te 'verversen'

        // 3. Vul de inhoud en class
        var icon = type === 'success' ? '✅ ' : '⚠️ ';
        statusDiv.textContent = icon + bericht;
        statusDiv.className = 'status-bericht ' + type;

        // 4. Toon de melding
        statusDiv.style.display = 'block';

        // 5. Start de nieuwe timer van 4 seconden
        statusTimeout = setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 4000);
    }
}
function toonAlgemeenDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('algemeen-defect-status');
    if (statusDiv) {
        statusDiv.textContent = bericht; statusDiv.className = `status-bericht ${type}`;
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
    }
}
function toonDefectStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message-defect');
    if (statusDiv) {
        statusDiv.textContent = bericht; statusDiv.className = `status-bericht ${type}`;
        statusDiv.style.display = 'block';
        setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
    }
}
function resetCheckboxes(listId) {
    document.querySelectorAll("#" + listId + " li input").forEach(cb => { cb.checked = false; });
}