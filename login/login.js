/* ===============================
   LOGIN LOGICA (login.js)
   =============================== */

// ##################################################################
// #                        BELANGRIJKE STAP                        #
// # PLAK HIER JE GOOGLE WEB APP URL (DEZELFDE ALS IN SCRIPT.JS)    #
// ##################################################################
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_tSrtNqwiQrpvFW0v6KFI0y0t8gomgbV-C2AzRYdKlE0es7k7z9U72jb7HArTxQHatw/exec";

// --- Wacht tot de pagina geladen is ---
document.addEventListener("DOMContentLoaded", function () {

    const loginForm = document.getElementById("login-form");
    const loginButton = document.getElementById("login-button");
    const statusDiv = document.getElementById("login-status");

    loginForm.addEventListener("submit", function (event) {
        event.preventDefault(); // Voorkom dat de pagina herlaadt

        const username = document.getElementById("username").value;
        const pincode = document.getElementById("pincode").value;

        // Validatie
        if (username === "" || pincode === "") {
            toonStatus("Vul alle velden in.", "error");
            return;
        }

        // De knop uitschakelen en status tonen
        loginButton.disabled = true;
        loginButton.textContent = "Bezig...";
        toonStatus("Inloggen...", "loading");

        // De data die we naar de backend sturen
        const payload = {
            type: "LOGIN", // Dit vertelt Code.gs dat het een login-poging is
            username: username.toLowerCase(), // Altijd kleine letters sturen
            pincode: pincode
        };

        // De fetch-call naar de Google Script API
        fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === "success") {
                    // ------ DIT IS DE MAGISCHE STAP ------
                    // Sla de naam van de medewerker op in het lokale geheugen van de browser
                    localStorage.setItem('ingelogdeMedewerker', data.volledigeNaam);

                    // Stuur de gebruiker door naar de checklist-pagina

                    window.location.href = "../index.html";

                } else {
                    // De API stuurde een fout terug (via checkLogin)
                    throw new Error(data.message);
                }
            })
            .catch(error => {
                // Er ging iets mis (netwerkfout, of de 'throw' van hierboven)
                toonStatus(error.message, "error");
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