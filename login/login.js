/* ===============================
   LOGIN LOGICA (MET CACHE-BUSTER)
   =============================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykI7IjMAeUFrMhJJwFAIV7gvbdjhe1vqNLr1WRevW4Mee0M7v_Nw8P2H6IhzemydogHw/exec"; // <-- CRUCIAAL

document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById("login-form");
    const loginButton = document.getElementById("login-button");
    const statusDiv = document.getElementById("login-status");

    loginForm.addEventListener("submit", function(event) {
        event.preventDefault(); 
        const username = document.getElementById("username").value;
        const pincode = document.getElementById("pincode").value;
        if (username === "" || pincode === "") { toonStatus("Vul alle velden in.", "error"); return; }
        loginButton.disabled = true; loginButton.textContent = "Bezig..."; toonStatus("Inloggen...", "loading");
        const payload = { type: "LOGIN", username: username.toLowerCase(), pincode: pincode };

        fetch(WEB_APP_URL + "?v=" + new Date().getTime(), { // <-- CACHE-BUSTER
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            mode: 'cors' 
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                localStorage.setItem('ingelogdeMedewerker', data.volledigeNaam);
                localStorage.setItem('ingelogdeRol', data.rol); 
                window.location.href = "../index.html"; 
            } else { throw new Error(data.message); }
        })
        .catch(error => {
            toonStatus(error.message || "Failed to fetch", "error");
            loginButton.disabled = false; loginButton.textContent = "Inloggen";
        });
    });
    function toonStatus(bericht, type) {
        statusDiv.className = type; statusDiv.textContent = bericht;
        statusDiv.style.display = 'block';
    }
});