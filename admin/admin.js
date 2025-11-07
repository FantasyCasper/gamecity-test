/* ===============================
   ADMIN LOGICA (admin.js)
   =============================== */

// ##################################################################
// #                        BELANGRIJKE STAP                        #
// # PLAK HIER JE GOOGLE WEB APP URL (DEZELFDE ALS IN SCRIPT.JS)    #
// ##################################################################
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_tSrtNqwiQrpvFW0v6KFI0y0t8gomgbV-C2AzRYdKlE0es7k7z9U72jb7HArTxQHatw/exec";


// --- DEEL 1: DE BEWAKER ---
// Wordt direct uitgevoerd
(function() {
    const ingelogdeRol = localStorage.getItem('ingelogdeRol');
    
    // 1. Check de rol. Is het geen manager? Stuur terug!
    if (ingelogdeRol !== 'manager') {
        alert("Toegang geweigerd. Je moet ingelogd zijn als manager.");
        window.location.href = "index.html"; // Terug naar de hoofd-app
        return; 
    }
    
    // 2. Rol is 'manager'. Haal de data op.
    fetchLogData(ingelogdeRol);

})(); 


// --- DEEL 2: FUNCTIES ---

/**
 * Haalt de log-data op van de Google Script API
 */
function fetchLogData(rol) {
    const statusDiv = document.getElementById('status-message');
    
    const payload = {
        type: "GET_LOGS",
        rol: rol // We sturen de rol mee als 'bewijs'
    };

    fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === "success") {
            statusDiv.style.display = 'none'; // Verberg 'Laden...'
            renderLogs(result.data);
        } else {
            throw new Error(result.message);
        }
    })
    .catch(error => {
        console.error("Fout bij ophalen logs:", error);
        statusDiv.className = 'error';
        statusDiv.textContent = 'Fout bij laden logboek: ' + error.message;
    });
}

/**
 * Bouwt de HTML-tabel op basis van de ontvangen data
 */
function renderLogs(logs) {
    const logBody = document.getElementById('log-body');
    if (logs.length === 0) {
        logBody.innerHTML = '<tr><td colspan="6">Nog geen logs gevonden.</td></tr>';
        return;
    }
    
    let html = '';
    logs.forEach(log => {
        // Formatteer de datum (optioneel, maar netter)
        let ts = new Date(log.timestamp).toLocaleString('nl-NL', {
            dateStyle: 'short', 
            timeStyle: 'short'
        });

        html += `
            <tr>
                <td data-label="Tijdstip">${ts}</td>
                <td data-label="Medewerker">${log.medewerker}</td>
                <td data-label="Activiteit">${log.activiteit}</td>
                <td data-label="Lijst">${log.lijstnaam}</td>
                <td data-label="Voltooid">${log.voltooid}</td>
                <td data-label="Gemist">${log.gemist}</td>
            </tr>
        `;
    });
    
    logBody.innerHTML = html;
}