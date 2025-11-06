/* ===============================
   VOLLEDIGE SCRIPT.JS
   (BIJGEWERKT MET DYNAMISCHE LIJSTEN & UITLOGGEN)
   =============================== */

// ##################################################################
// #                        BELANGRIJKE STAP                        #
// # PLAK HIER JE GOOGLE WEB APP URL                                #
// ##################################################################
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_tSrtNqwiQrpvFW0v6KFI0y0t8gomgbV-C2AzRYdKlE0es7k7z9U72jb7HArTxQHatw/exec";

// ==============================================================
//   NIEUWE CHECKLIST DATA
//   Vul hier je eigen checklist items in!
// ==============================================================
const CHECKLIST_DATA = {
    "Baan": {
        openen: [
            "Baan lichten aan",
            "Karts controleren",
            "Helmen desinfecteren en klaarleggen",
            "Pitdeur openen"
        ],
        sluiten: [
            "Karts aan de lader",
            "Baan lichten uit",
            "Helmen opruimen",
            "Pitdeur sluiten"
        ]
    },
    "Lasergame": {
        openen: [
            "Arena lichten en geluid aan",
            "Pakken opstarten (test 1)",
            "Rookmachine controleren/vullen"
        ],
        sluiten: [
            "Alle pakken uitschakelen",
            "Arena lichten uit",
            "Rookmachine uit"
        ]
    },
    "Prison Island": {
        openen: [
            "Alle cellen resetten",
            "Systeem opstarten",
            "Controleer schermen"
        ],
        sluiten: [
            "Systeem afsluiten",
            "Verlichting uit",
            "Deuren controleren"
        ]
    },
    "Minigolf": {
        openen: [
            "Ballen en clubs klaarzetten",
            "Verlichting banen aan",
            "Scorekaarten aanvullen"
        ],
        sluiten: [
            "Ballen en clubs innemen/opruimen",
            "Verlichting uit",
            "Afval controleren"
        ]
    }
};
// ==============================================================


// --- DEEL 1: DE BEWAKER & EVENT LISTENERS ---
(function() {
    // 1. Haal de ingelogde naam op
    const ingelogdeMedewerker = localStorage.getItem('ingelogdeMedewerker');
    
    // 2. Controleer of de naam bestaat
    if (!ingelogdeMedewerker) {
        // 3. Zo nee: STUUR TERUG!
        alert("Je bent niet ingelogd. Je wordt nu teruggestuurd naar de inlogpagina.");
        window.location.href = "login/login.html";; // Verwijst naar de login-map
        return; // Stop verdere uitvoering
    } 
    
    // 4. Zo ja: Welkom & Event Listeners toevoegen
    
    // Toon welkomstbericht
    const medewerkerDisplay = document.getElementById('medewerker-naam-display');
    if (medewerkerDisplay) {
        medewerkerDisplay.textContent = `Ingelogd als: ${ingelogdeMedewerker}`;
    }

    // NIEUW: Uitlogknop logica
    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', function() {
            if (confirm('Weet je zeker dat je wilt uitloggen?')) {
                localStorage.removeItem('ingelogdeMedewerker');
                window.location.href = "login/login.html";;
            }
        });
    }

    // NIEUW: Activiteit selectie logica
    const activiteitSelect = document.getElementById('activiteit-select');
    if(activiteitSelect) {
        activiteitSelect.addEventListener('change', function(e) {
            const geselecteerdeActiviteit = e.target.value;
            updateChecklists(geselecteerdeActiviteit);
        });
    }

    // Logica voor het in- en uitklappen (is gebleven)
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.parentElement.querySelector('.content');
            if (content.style.maxHeight){
                content.style.maxHeight = null;
            } else {
                // Zorg dat de lijst dynamisch de juiste hoogte krijgt
                content.style.maxHeight = content.scrollHeight + "px";
            } 
        });
    }

})(); // Deze functie roept zichzelf direct aan


// --- DEEL 2: FUNCTIES ---

/**
 * NIEUWE FUNCTIE
 * Vult de <ul> lijsten op basis van de gekozen activiteit
 */
function updateChecklists(activiteit) {
    const container = document.querySelector('.container');
    const openLijstUL = document.getElementById('lijst-openen');
    const sluitLijstUL = document.getElementById('lijst-sluiten');
    
    // Reset de lijsten
    openLijstUL.innerHTML = '';
    sluitLijstUL.innerHTML = '';
    
    // Reset de 'collapsible' knoppen (sluit ze)
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
        coll[i].classList.remove("active");
        coll[i].parentElement.querySelector('.content').style.maxHeight = null;
    }

    if (activiteit && CHECKLIST_DATA[activiteit]) {
        // Haal de data op
        const data = CHECKLIST_DATA[activiteit];
        
        // Bouw de 'Openen' lijst
        data.openen.forEach((item, index) => {
            const id = `open-${index}`;
            const li = `<li><input type="checkbox" id="${id}"><label for="${id}">${item}</label></li>`;
            openLijstUL.innerHTML += li;
        });
        
        // Bouw de 'Sluiten' lijst
        data.sluiten.forEach((item, index) => {
            const id = `sluit-${index}`;
            const li = `<li><input type="checkbox" id="${id}"><label for="${id}">${item}</label></li>`;
            sluitLijstUL.innerHTML += li;
        });

        // Toon de checklist secties
        container.classList.add('checklists-zichtbaar');

    } else {
        // Verberg de checklist secties
        container.classList.remove('checklists-zichtbaar');
    }
}

/**
 * Functie om de data naar de backend te sturen
 * (Licht aangepast)
 */
function verstuurData(lijstNaam) {
    
    const medewerker = localStorage.getItem('ingelogdeMedewerker');
    const activiteit = document.getElementById('activiteit-select').value;

    // Activiteit-check is nog steeds nodig
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
    // Zoek de items in de specifieke lijst (werkt nog steeds)
    var listItems = document.querySelectorAll("#" + listId + " li");
    
    listItems.forEach(function(li) {
        var checkbox = li.querySelector('input[type="checkbox"]');
        var label = li.querySelector('label');
        items.push({
            label: label.textContent,
            checked: checkbox.checked
        });
    });
    
    // Voorkom dat een lege lijst wordt verstuurd
    if (items.length === 0) {
        toonStatus("Fout: Geen checklist items gevonden voor deze activiteit.", "error");
        knop.disabled = false;
        knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        return;
    }

    var dataPayload = {
        type: "LOG_DATA",
        lijstNaam: lijstNaam,
        items: items,
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
            resetCheckboxes(listId); // Reset alleen de vinkjes, niet de lijst
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        } else {
            throw new Error(data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        toonStatus("Fout: " + error.message, "error");
        knop.disabled = false;
        knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
    });
}

// Functie om de vinkjes te resetten
function resetCheckboxes(listId) {
    var listItems = document.querySelectorAll("#" + listId + " li");
    listItems.forEach(function(li) {
        var checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.checked = false;
    });
}

// Functie om een statusbericht te tonen
function toonStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message');
    statusDiv.textContent = bericht;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
    setTimeout(function() { statusDiv.style.display = 'none'; }, 5000);
}