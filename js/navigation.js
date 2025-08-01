// === NAVIGATION.JS - GESTIONE NAVIGAZIONE TRA SEZIONI ===

// === NAVIGAZIONE SEZIONI ===
function showHomepage() {
    // RESET CACHE quando esci dal cliente
    if (typeof resetPlanningCache === 'function') {
        resetPlanningCache();
    }
    
    // Reset variabili globali
    if (typeof currentClient !== 'undefined') currentClient = null;
    if (typeof currentDiets !== 'undefined') currentDiets = [];
    
    hideAllSections();
    document.getElementById('homepage').classList.remove('hidden');
    document.querySelector('.back-btn').classList.add('hidden');
    
    if (typeof loadRecentClients === 'function') {
        loadRecentClients();
    }
}

function showNewClientForm() {
    hideAllSections();
    document.getElementById('new-client').classList.remove('hidden');
    document.querySelector('.back-btn').classList.remove('hidden');
    const form = document.getElementById('clientForm');
    if (form) form.reset();
}

function showAlimentiManagement() {
    console.log('Mostrando gestione alimenti...');
    
    hideAllSections();
    
    // Mostra la sezione alimenti
    const alimentiSection = document.getElementById('alimenti-management-section');
    if (alimentiSection) {
        alimentiSection.classList.remove('hidden');
        document.querySelector('.back-btn').classList.remove('hidden');
        
        // Inizializza le funzioni alimenti quando viene mostrata la sezione
        if (typeof initializeAlimentiFunctions === 'function') {
            setTimeout(() => {
                initializeAlimentiFunctions();
            }, 100);
        }
    } else {
        console.error('Sezione alimenti non trovata');
    }
}

function showClientList() {
    // RESET CACHE quando esci dal dettaglio cliente
    if (typeof resetPlanningCache === 'function') {
        resetPlanningCache();
    }
    
    // Reset variabili globali
    if (typeof currentClient !== 'undefined') currentClient = null;
    if (typeof currentDiets !== 'undefined') currentDiets = [];
    
    hideAllSections();
    document.getElementById('client-list-section').classList.remove('hidden');
    document.querySelector('.back-btn').classList.remove('hidden');
    
    if (typeof loadClientsData === 'function') {
        loadClientsData();
    }
}


async function showClientDetail(clientId) {
    // RESET CACHE PIANIFICAZIONE quando cambi cliente
    if (typeof resetPlanningCache === 'function') {
        resetPlanningCache();
    }
    
    hideAllSections();
    document.getElementById('client-detail-section').classList.remove('hidden');
    document.querySelector('.back-btn').classList.remove('hidden');
    
    if (typeof loadClientDetail === 'function') {
        await loadClientDetail(clientId);
    }
}


// Funzione helper per nascondere tutte le sezioni
function hideAllSections() {
    const sections = [
        'homepage',
        'new-client-form',
        'client-list',
        'client-detail-section',
        'alimenti-management-section',
        'pasti-management-section',
        'planning-modal-section',
        'new-client'
    ];
    
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('hidden');
        }
    });
}


// 2. Aggiungere la nuova funzione showPastiManagement DOPO showAlimentiManagement:
function showPastiManagement() {
    console.log('Mostrando gestione pasti...');
    
    hideAllSections();
    
    // Mostra la sezione pasti
    const pastiSection = document.getElementById('pasti-management-section');
    if (pastiSection) {
        pastiSection.classList.remove('hidden');
        document.querySelector('.back-btn').classList.remove('hidden');
        
        // Verifica che il contenuto sia stato caricato
        const pastiContent = pastiSection.querySelector('#pasti-management');
        if (pastiContent) {
            pastiContent.classList.remove('hidden');
        }
        
        // Carica i pasti esistenti
        if (typeof loadPresetMeals === 'function') {
            loadPresetMeals();
        }
    } else {
        console.error('Sezione pasti non trovata');
    }
}

function showAlimentiManagement() {
    console.log('Mostrando gestione alimenti...');
    
    hideAllSections();
    
    // Mostra la sezione alimenti
    const alimentiSection = document.getElementById('alimenti-management-section');
    if (alimentiSection) {
        alimentiSection.classList.remove('hidden');
        document.querySelector('.back-btn').classList.remove('hidden');
        
        // Verifica che il contenuto sia stato caricato
        const alimentiContent = alimentiSection.querySelector('#alimenti-management');
        if (!alimentiContent) {
            console.error('Contenuto alimenti non trovato - potrebbe non essere stato caricato');
            return;
        }
        
        // Rimuovi la classe hidden dal contenuto interno
        alimentiContent.classList.remove('hidden');
        
        // Inizializza le funzioni alimenti quando viene mostrata la sezione
        if (typeof initializeAlimentiFunctions === 'function') {
            setTimeout(() => {
                initializeAlimentiFunctions();
            }, 100);
        } else {
            console.error('initializeAlimentiFunctions non trovata');
        }
    } else {
        console.error('Sezione alimenti non trovata');
    }
}





function showHomepage() {
    // RESET CACHE quando esci dal cliente
    if (typeof resetPlanningCache === 'function') {
        resetPlanningCache();
    }
    
    // Reset variabili globali
    if (typeof currentClient !== 'undefined') currentClient = null;
    if (typeof currentDiets !== 'undefined') currentDiets = [];
    
    hideAllSections();
    document.getElementById('homepage').classList.remove('hidden');
    document.querySelector('.back-btn').classList.add('hidden');
    
    if (typeof loadRecentClients === 'function') {
        loadRecentClients();
    }
}

function showClientList() {
    hideAllSections();
    const section = document.getElementById('client-list');
    if (section) {
        section.classList.remove('hidden');
    }
    document.querySelector('.back-btn').classList.remove('hidden');
    
    if (typeof loadClientsData === 'function') {
        loadClientsData();
    }
}

function showClientDetail(clientId) {
    hideAllSections();
    const section = document.getElementById('client-detail');
    if (section) {
        section.classList.remove('hidden');
    }
    document.querySelector('.back-btn').classList.remove('hidden');
    
    if (typeof loadClientDetail === 'function') {
        loadClientDetail(clientId);
    }
}

function loadClients() {
    showClientList();
}

// Esporta le funzioni globalmente per gli onclick
window.showHomepage = showHomepage;
window.showNewClientForm = showNewClientForm;
window.showClientList = showClientList;
window.showClientDetail = showClientDetail;
window.showAlimentiManagement = showAlimentiManagement;
window.showPastiManagement = showPastiManagement;
window.loadClients = loadClients;
window.hideAllSections = hideAllSections;
