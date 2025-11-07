/* ===============================
   LOGIN LOGICA (FIREBASE VERSIE)
   =============================== */

// -----------------------------------------------------------------
// STAP 1: JOUW FIREBASE CONFIG
// Plak hier het 'firebaseConfig' object dat je 
// van de Firebase website hebt gekopieerd (Stap 2, Deel E).
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


// --- Wacht tot de pagina geladen is ---
document.addEventListener("DOMContentLoaded", function() {
    
    const loginForm = document.getElementById("login-form");
    const loginButton = document.getElementById("login-button");
    const statusDiv = document.getElementById("login-status");

    loginForm.addEventListener("submit", function(event) {
        event.preventDefault(); // Voorkom dat de pagina herlaadt
        
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        // Validatie
        if (email === "" || password === "") {
            toonStatus("Vul alle velden in.", "error");
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Bezig...";
        toonStatus("Inloggen...", "loading");

        // =======================================================
        //   DE NIEUWE FIREBASE LOGIN LOGICA
        // =======================================================

        // 1. Probeer in te loggen bij Firebase Authentication
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Login gelukt! Nu de 'volledige_naam' ophalen.
                const user = userCredential.user;
                
                // 2. Haal het gekoppelde profiel-document op uit Firestore
                return db.collection('profiles').doc(user.uid).get();
            })
            .then((doc) => {
                // 3. Profiel-document opgehaald
                if (doc.exists) {
                    const volledigeNaam = doc.data().volledige_naam;
                    
                    // 4. Sla de naam op in het browsergeheugen
                    localStorage.setItem('ingelogdeMedewerker', volledigeNaam);
                    
                    // 5. Stuur door naar de checklist-pagina
                    window.location.href = "../index.html"; // Ga één map omhoog
                
                } else {
                    // Help! De gebruiker kon inloggen, maar heeft geen profiel
                    // Dit gebeurt als je stap 5-10 van de 'Nieuwe Werkwijze' hebt overgeslagen.
                    throw new Error("Login gelukt, maar geen profiel-data gevonden. Neem contact op met de beheerder.");
                }
            })
            .catch((error) => {
                // Er ging iets mis.
                console.error("Login Fout:", error);
                
                let bericht;
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        bericht = "Verkeerd e-mailadres of wachtwoord.";
                        break;
                    default:
                        bericht = error.message;
                }
                
                toonStatus(bericht, "error");
                loginButton.disabled = false;
                loginButton.textContent = "Inloggen";
            });
    });

    // Helper functie om statusberichten te tonen
    function toonStatus(bericht, type) {
        statusDiv.className = type; // "error" of "loading"
        statusDiv.textContent = bericht;
        statusDiv.style.display = 'block';
    }
});