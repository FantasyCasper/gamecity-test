/* ===============================
   LOGIN.JS - UPDATE VOOR PERMISSIES
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxCpoAN_0SEKUgIa4QP4Fl1Na2AqjM-t_GtEsvCd_FbgfApY-_vHd-5CBYNGWUaOeGoYw/exec"; // <-- JOUW URL

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("login-form");
    const loginButton = document.getElementById("login-button");
    const statusDiv = document.getElementById("login-status");

    // --- NIEUW: ALLEEN CIJFERS TOESTAAN IN PINCODE ---
    const pinInput = document.getElementById("pincode");
    if (pinInput) {
        pinInput.addEventListener('input', function () {
            // Vervang alles wat NIET een cijfer (0-9) is door niks
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        // AANGEPAST: .trim() toegevoegd om spaties op mobiel te voorkomen
        const username = document.getElementById("username").value.trim();
        const pincode = document.getElementById("pincode").value.trim();

        if (username === "" || pincode === "") { toonStatus("Vul alle velden in.", "error"); return; }

        loginButton.disabled = true; loginButton.textContent = "Bezig..."; toonStatus("Inloggen...", "loading");

        const payload = { type: "LOGIN", username: username.toLowerCase(), pincode: pincode };

        fetch(WEB_APP_URL + "?v=" + new Date().getTime(), {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            mode: 'cors'
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === "success") {
                    localStorage.setItem('ingelogdeMedewerker', data.volledigeNaam);

                    // NIEUW: Sla ook de gebruikersnaam op voor de admin checks
                    localStorage.setItem('ingelogdeUsername', username.toLowerCase());

                    localStorage.setItem('ingelogdePermissies', JSON.stringify(data.perms));
                    window.location.href = "../index.html";
                } else { throw new Error(data.message); }
            })
            .catch(error => {
                toonStatus(error.message || "Login mislukt", "error");
                loginButton.disabled = false; loginButton.textContent = "Inloggen";
            });
    });
    function toonStatus(bericht, type) {
        statusDiv.className = type; statusDiv.textContent = bericht;
        statusDiv.style.display = 'block';
    }
});