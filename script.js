/* ===============================
   VOLLEDIGE SCRIPT.JS (GOOGLE SCRIPT VERSIE)
   =============================== */

// ##################################################################
// #                        BELANGRIJKE STAP                        #
// # PLAK HIER JE GOOGLE WEB APP URL (DEZELFDE ALS IN LOGIN.JS)     #
// ##################################################################
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_tSrtNqwiQrpvFW0v6KFI0y0t8gomgbV-C2AzRYdKlE0es7k7z9U72jb7HArTxQHatw/exec";


// --- CHECKLIST DATA (Vul deze zelf in) ---
const CHECKLIST_DATA = {
    "Baan": {
        openen: ["Baan lichten aan", "Karts controleren"],
        sluiten: ["Karts aan de lader", "Baan lichten uit"]
    },
    "Lasergame": {
        openen: ["Arena lichten en geluid aan", "Pakken opstarten"],
        sluiten: ["Alle pakken uitschakelen", "Arena lichten uit"]
    },
    "Prison Island": {
        openen: ["Alle cellen resetten", "Systeem opstarten"],
        sluiten: ["Systeem afsluiten", "Verlichting uit"]
    },
    "Minigolf": {
        openen: ["Ballen en clubs klaarzetten", "Verlichting aan"],
        sluiten: ["Ballen en clubs innemen", "Verlichting uit"]
    }
};

// --- DEEL 1: DE "BEWAKER" (LocalStorage) ---
// --- DEEL 1: DE "BEWAKER" (LocalStorage) ---
(function() {
    const ingelogdeMedewerker = localStorage.getItem('ingelogdeMedewerker');
    const ingelogdeRol = localStorage.getItem('ingelogdeRol'); // <-- NIEUWE REGEL
    
    if (!ingelogdeMedewerker) {
        // ... (terugsturen, dit blijft hetzelfde) ...
        alert("Je bent niet ingelogd. Je wordt nu teruggestuurd naar de inlogpagina.");
        window.location.href = "login/index.html"; 
        return; 
    } 
    
    // Welkom-bericht (blijft hetzelfde)
    const medewerkerDisplay = document.getElementById('medewerker-naam-display');
    if (medewerkerDisplay) {
        medewerkerDisplay.textContent = `Ingelogd als: ${ingelogdeMedewerker}`;
    }

    // ========================
    //   NIEUWE ROL-CHECK
    // ========================
    if (ingelogdeRol === 'manager') {
        const adminButton = document.getElementById('admin-button');
        if (adminButton) {
            adminButton.classList.add('zichtbaar');
        }
    }
    // ========================

    // Koppel de listeners nu de gebruiker is geverifieerd
    koppelListeners();

})(); 

// --- DEEL 2: FUNCTIES ---

function koppelListeners() {
    // Uitlogknop logica
    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', function() {
            if (confirm('Weet je zeker dat je wilt uitloggen?')) {
                localStorage.removeItem('ingelogdeMedewerker');
                window.location.href = 'login/index.html';
            }
        });
    }

    // Activiteit selectie logica
    const activiteitSelect = document.getElementById('activiteit-select');
    if(activiteitSelect) {
        activiteitSelect.addEventListener('change', function(e) {
            updateChecklists(e.target.value);
        });
    }

    // Collapsible (inklap) logica
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.parentElement.querySelector('.content');
            if (content.style.maxHeight){
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            } 
        });
    }
}

function updateChecklists(activiteit) {
    const container = document.querySelector('.container');
    const openLijstUL = document.getElementById('lijst-openen');
    const sluitLijstUL = document.getElementById('lijst-sluiten');
    
    openLijstUL.innerHTML = '';
    sluitLijstUL.innerHTML = '';
    
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
        coll[i].classList.remove("active");
        coll[i].parentElement.querySelector('.content').style.maxHeight = null;
    }

    if (activiteit && CHECKLIST_DATA[activiteit]) {
        const data = CHECKLIST_DATA[activiteit];
        
        data.openen.forEach((item, index) => {
            const id = `open-${index}`;
            const li = `<li><input type="checkbox" id="${id}"><label for="${id}">${item}</label></li>`;
            openLijstUL.innerHTML += li;
        });
        
        data.sluiten.forEach((item, index) => {
            const id = `sluit-${index}`;
            const li = `<li><input type="checkbox" id="${id}"><label for="${id}">${item}</label></li>`;
            sluitLijstUL.innerHTML += li;
        });

        container.classList.add('checklists-zichtbaar');
    } else {
        container.classList.remove('checklists-zichtbaar');
    }
}

function verstuurData(lijstNaam) {
    
    const medewerker = localStorage.getItem('ingelogdeMedewerker');
    const activiteit = document.getElementById('activiteit-select').value;

    if (activiteit === "") {
        toonStatus("Fout: Kies een activiteit.", "error");
        return; 
    }

    var listId, buttonId;
    if (lijstNaam === 'Checklist Openen') {
        listId = 'lijst-openen';
        buttonId = 'btn-openen';
    } else {
        listId = 'lijst-sluiten';
        buttonId = 'btn-sluiten';
    }
    
    var knop = document.getElementById(buttonId);
    knop.disabled = true;
    knop.textContent = "Bezig met opslaan...";
    
    var items = [];
    var listItems = document.querySelectorAll("#" + listId + " li");
    
    var voltooideTaken = [];
    var gemisteTaken = [];
    
    listItems.forEach(function(li) {
        var checkbox = li.querySelector('input[type="checkbox"]');
        var label = li.querySelector('label');
        var itemData = { label: label.textContent, checked: checkbox.checked };
        items.push(itemData); // Stuur de 'checked' status mee
    });

    var dataPayload = {
        type: "LOG_DATA",
        lijstNaam: lijstNaam,
        items: items, // Stuur de volledige lijst met 'checked' info
        medewerker: medewerker,
        activiteit: activiteit
    };
    
    fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify(dataPayload),
        headers: {
            "Content-Type": "text/plain;charset=utf-8",
        },
    })
    .then(response => response.json())
    .then(data => {
        if(data.status === "success") {
            toonStatus("'" + lijstNaam + "' is succesvol opgeslagen!", "success");
            resetCheckboxes(listId);
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        } else {
            throw new Error(data.message);
        }
    })
    .catch(error => {
        console.error("Fout bij opslaan: ", error);
        toonStatus("Fout: " + error.message, "error");
        knop.disabled = false;
        knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
    });
}

function resetCheckboxes(listId) {
    var listItems = document.querySelectorAll("#" + listId + " li");
    listItems.forEach(function(li) {
        var checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.checked = false;
    });
}

function toonStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message');
    statusDiv.textContent = bericht;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
    setTimeout(function() { statusDiv.style.display = 'none'; }, 5000);
}