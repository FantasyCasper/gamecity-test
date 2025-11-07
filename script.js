/* ===============================
   VOLLEDIGE SCRIPT.JS (FIREBASE VERSIE)
   =============================== */

// -----------------------------------------------------------------
// STAP 1: JOUW FIREBASE CONFIG
// Plak hier HETZELFDE 'firebaseConfig' object
// dat je ook in login.js hebt geplakt.
// -----------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyDHUy897zy7Ay405HMh--oPQx0De670s_A",
  authDomain: "gamecity-opensluit.firebaseapp.com",
  projectId: "gamecity-opensluit",
  storageBucket: "gamecity-opensluit.firebasestorage.app",
  messagingSenderId: "770535174835",
  appId: "1:770535174835:web:eb9a28bf8f273e2b5ff6c6"
};

// -----------------------------------------------------------------
// STAP 2: FIREBASE INITIALISEREN
// -----------------------------------------------------------------
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Globale variabele om de naam van de ingelogde gebruiker te bewaren
let ingelogdeNaam = "";

// ==============================================================
//   CHECKLIST DATA (Deze is ongewijzigd)
// ==============================================================
const CHECKLIST_DATA = {
    "Baan": {
        openen: ["Baan lichten aan", "Karts controleren", "Helmen desinfecteren", "Pitdeur openen"],
        sluiten: ["Karts aan de lader", "Baan lichten uit", "Helmen opruimen", "Pitdeur sluiten"]
    },
    "Lasergame": {
        openen: ["Arena lichten en geluid aan", "Pakken opstarten (test 1)", "Rookmachine controleren/vullen"],
        sluiten: ["Alle pakken uitschakelen", "Arena lichten uit", "Rookmachine uit"]
    },
    "Prison Island": {
        openen: ["Alle cellen resetten", "Systeem opstarten", "Controleer schermen"],
        sluiten: ["Systeem afsluiten", "Verlichting uit", "Deuren controleren"]
    },
    "Minigolf": {
        openen: ["Ballen en clubs klaarzetten", "Verlichting banen aan", "Scorekaarten aanvullen"],
        sluiten: ["Ballen en clubs innemen/opruimen", "Verlichting uit", "Afval controleren"]
    }
};
// ==============================================================


// --- DEEL 1: DE NIEUWE "BEWAKER" (Firebase Auth) ---
// Dit wordt direct uitgevoerd als de pagina laadt.
// onAuthStateChanged is een 'listener' die constant luistert
// of de gebruiker is ingelogd of niet.
auth.onAuthStateChanged((user) => {
  if (user) {
    // --- GEBRUIKER IS INGELOGD ---
    
    // 1. Haal het profiel op uit Firestore
    db.collection('profiles').doc(user.uid).get()
      .then((doc) => {
        if (doc.exists) {
          ingelogdeNaam = doc.data().volledige_naam; // Sla naam op
          const medewerkerDisplay = document.getElementById('medewerker-naam-display');
          if (medewerkerDisplay) {
            medewerkerDisplay.textContent = `Ingelogd als: ${ingelogdeNaam}`;
          }
        } else {
          // Gebruiker is ingelogd, maar heeft geen profiel-document.
          alert('Fout: Gebruiker-profiel niet gevonden. Neem contact op met de beheerder.');
          auth.signOut(); // Log de gebruiker uit
        }
      })
      .catch((error) => {
        alert('Fout bij ophalen profiel: ' + error.message);
        auth.signOut();
      });

    // 2. Koppel alle Event Listeners (nu we zeker weten dat de gebruiker er is)
    koppelListeners();

  } else {
    // --- GEBRUIKER IS NIET INGELOGD ---
    alert("Je bent niet ingelogd. Je wordt nu teruggestuurd naar de inlogpagina.");
    window.location.href = "login/"; // Verwijst naar de login-map
  }
});


// --- DEEL 2: FUNCTIES ---

// Deze functie koppelt alle 'klik'-events
function koppelListeners() {
    // Uitlogknop logica
    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', function() {
            if (confirm('Weet je zeker dat je wilt uitloggen?')) {
                auth.signOut(); // Dit triggert de 'onAuthStateChanged' en stuurt je naar de login.
            }
        });
    }

    // Activiteit selectie logica
    const activiteitSelect = document.getElementById('activiteit-select');
    if(activiteitSelect) {
        activiteitSelect.addEventListener('change', function(e) {
            const geselecteerdeActiviteit = e.target.value;
            updateChecklists(geselecteerdeActiviteit);
        });
    }

    // Collapsible (inklap) logica
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
        if (!coll[i].dataset.listenerAttached) { // Voorkom dubbele listeners
            coll[i].addEventListener("click", function() {
                this.classList.toggle("active");
                var content = this.parentElement.querySelector('.content');
                if (content.style.maxHeight){
                    content.style.maxHeight = null;
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                } 
            });
            coll[i].dataset.listenerAttached = 'true';
        }
    }
}

/**
 * Functie om de checklists te vullen (ONGWIJZIGD)
 */
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

/**
 * Functie om data te versturen (NU NAAR FIRESTORE)
 */
function verstuurData(lijstNaam) {
    
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
    
    var voltooideTaken = [];
    var gemisteTaken = [];
    var listItems = document.querySelectorAll("#" + listId + " li");
    
    listItems.forEach(function(li) {
        var checkbox = li.querySelector('input[type="checkbox"]');
        var label = li.querySelector('label');
        if (checkbox.checked) {
            voltooideTaken.push(label.textContent);
        } else {
            gemisteTaken.push(label.textContent);
        }
    });

    // =======================================================
    //   DE NIEUWE FIREBASE OPSLAAN LOGICA
    // =======================================================
    
    // 1. Bouw het data-object
    const dataPayload = {
        medewerker_naam: ingelogdeNaam, // De naam die we bij login hebben opgehaald
        activiteit: activiteit,
        lijst_naam: lijstNaam,
        voltooide_taken: voltooideTaken,
        gemiste_taken: gemisteTaken,
        created_at: firebase.firestore.FieldValue.serverTimestamp() // Voeg een tijdstempel toe
    };

    // 2. Verstuur naar de 'logboek' collectie in Firestore
    db.collection("logboek").add(dataPayload)
        .then((docRef) => {
            // Gelukt!
            toonStatus("'" + lijstNaam + "' is succesvol opgeslagen!", "success");
            resetCheckboxes(listId);
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        })
        .catch((error) => {
            // Mislukt!
            console.error("Fout bij opslaan: ", error);
            toonStatus("Fout: " + error.message, "error");
            knop.disabled = false;
            knop.textContent = lijstNaam.replace("Checklist ", "") + " Voltooid & Verzenden";
        });
}

// Functie om vinkjes te resetten (ONGWIJZIGD)
function resetCheckboxes(listId) {
    var listItems = document.querySelectorAll("#" + listId + " li");
    listItems.forEach(function(li) {
        var checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.checked = false;
    });
}

// Functie om statusbericht te tonen (ONGWIJZIGD)
function toonStatus(bericht, type) {
    var statusDiv = document.getElementById('status-message');
    statusDiv.textContent = bericht;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
    setTimeout(function() { statusDiv.style.display = 'none'; }, 5000);
}