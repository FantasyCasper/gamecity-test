/* ===============================
   LOGIN LOGICA (GOOGLE SCRIPT VERSIE)
   =============================== */

// ##################################################################
// #                        BELANGRIJKE STAP                        #
// # PLAK HIER JE GOOGLE WEB APP URL (UIT STAP 1C)                  #
// ##################################################################
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_tSrtNqwiQrpvFW0v6KFI0y0t8gomgbV-C2AzRYdKlE0es7k7z9U72jb7HArTxQHatw/exec";

document.addEventListener("DOMContentLoaded", function() {
    
    const loginForm = document.getElementById("login-form");
    const loginButton = document.getElementById("login-button");
    const statusDiv = document.getElementById("login-status");

    loginForm.addEventListener("submit", function(event) {
        event.preventDefault(); 
        
        const username = document.getElementById("username").value;
        const pincode = document.getElementById("pincode").value;

        if (username === "" || pincode === "") {
            toonStatus("Vul alle velden in.", "error");
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Bezig...";
        toonStatus("Inloggen...", "loading");

        const payload = {
            type: "LOGIN", 
            username: username.toLowerCase(),
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
                // Opslaan in browsergeheugen
                localStorage.setItem('ingelogdeMedewerker', data.volledigeNaam);
                // Doorsturen naar de hoofd-app
                window.location.href = "../index.html"; // Ga één map omhoog
                
            } else {
                throw new Error(data.message);
            }
        })
        .catch(error => {
            toonStatus(error.message, "error");
            loginButton.disabled = false;
            loginButton.textContent = "Inloggen";
        });
    });

    function toonStatus(bericht, type) {
        statusDiv.className = type;
        statusDiv.textContent = bericht;
        statusDiv.style.display = 'block';
    }
});