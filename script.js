/* ===============================
   SCRIPT.JS - HOOFDMAP (OPGESCHOOND)
   Bevat: Login check, Navigatie, Checklists & Home Dashboard
   =============================== */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec";

// Globale Variabelen
let CHECKLIST_DATA = {};
let ingelogdeNaam = "";
let ingelogdePermissies = {};
let GLOBALE_ACTIVITEITEN = [];
let statusTimeout;

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

    // 4. Start modules
    koppelListeners();
    setupMainTabs();
    setupMobileMenu();

    // Data laden
    setTimeout(() => laadBijzonderhedenVanGisteren(), 20);
    setTimeout(() => laadGlobaleInstellingen(), 40);

    // Checklists heeft prioriteit
    if (ingelogdePermissies.checklists) {
        laadChecklistConfiguratie();
    }

})();


// --- DEEL 2: ALGEMENE UI FUNCTIES ---

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
    if (typeof ingelogdePermissies !== 'undefined') {
        payload.perms = ingelogdePermissies;
    }

    const url = WEB_APP_URL + "?v=" + new Date().getTime();

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
    const cachedData = localStorage.getItem('CHECKLIST_CACHE');
    if (cachedData) {
        CHECKLIST_DATA = JSON.parse(cachedData);
        vulActiviteitDropdown();
    }

    callApi({ type: "GET_CHECKLIST_CONFIG" })
        .then(result => {
            if (JSON.stringify(result.data) !== cachedData) {
                CHECKLIST_DATA = result.data;
                localStorage.setItem('CHECKLIST_CACHE', JSON.stringify(CHECKLIST_DATA));
                if (!cachedData) vulActiviteitDropdown();
            }
        })
        .catch(error => {
            console.error("Kon server niet bereiken, draai op cache.", error);
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

        // Vangnet voor oude data die wel in config zit maar niet in de globale lijst
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
            updateProgress();
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
            bar.style.backgroundColor = "#00d2d3";
            text.style.color = "#00d2d3";
        } else {
            bar.style.backgroundColor = "#28a745";
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


// --- DEEL 5: HOME TAB (BIJZONDERHEDEN) ---

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


// --- DEEL 6: HELPERS & INSTELLINGEN ---

function laadGlobaleInstellingen() {
    callApi({ type: "GET_SETTINGS" }).then(result => {
        const settings = result.data;
        if (settings && settings['activiteiten']) {
            try {
                GLOBALE_ACTIVITEITEN = JSON.parse(settings['activiteiten']);
                vulActiviteitDropdown();
            } catch (e) {
                console.error("Kon activiteiten niet lezen, we gebruiken de standaard.", e);
            }
        }
    }).catch(err => console.log("Geen instellingen gevonden, we gebruiken defaults."));
}

function toonStatus(bericht, type) {
    const statusDiv = document.getElementById('status-message');
    if (statusDiv) {
        clearTimeout(statusTimeout);
        statusDiv.style.display = 'none';
        void statusDiv.offsetWidth; 

        const icon = type === 'success' ? '✅ ' : '⚠️ ';
        statusDiv.textContent = icon + bericht;
        statusDiv.className = 'status-bericht ' + type;
        statusDiv.style.display = 'block';

        statusTimeout = setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 4000);
    }
}

function resetCheckboxes(listId) {
    document.querySelectorAll("#" + listId + " li input").forEach(cb => { cb.checked = false; });
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