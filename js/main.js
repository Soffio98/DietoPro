// === MAIN.JS - INIZIALIZZAZIONE E COORDINAMENTO ===

// === VARIABILI GLOBALI ===
let currentClient = null;
let clients = [];
let templates = [];
let currentDiets = [];

// === INIZIALIZZAZIONE APP ===
document.addEventListener('DOMContentLoaded', function() {
    // Aspetta che i componenti siano caricati
    setTimeout(() => {
        loadRecentClients();
        loadTemplates();
        setupFormHandlers();
    }, 500);
});

// === SETUP FORM HANDLERS ===
function setupFormHandlers() {
    const handlers = [
        { id: 'clientForm', handler: handleNewClient },
        { id: 'dietForm', handler: handleNewDiet }
    ];
    
    handlers.forEach(({ id, handler }) => {
        const form = document.getElementById(id);
        if (form) form.addEventListener('submit', handler);
    });
}

// === API UTILITY ===
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`http://localhost:3005/api${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        throw error;
    }
}

// === CARICAMENTO DATI INIZIALI ===
async function loadRecentClients() {
    try {
        const data = await apiCall('/clients');
        displayRecentClients(data.slice(0, 6));
    } catch (error) {
        const container = document.getElementById('recent-clients');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #999;">Impossibile caricare i clienti. Verificare che il server sia attivo.</p>';
        }
    }
}

async function loadTemplates() {
    try {
        templates = await apiCall('/templates');
    } catch (error) {
        console.error('❌ Error loading templates:', error);
    }
}

// === RESET DATI ===
function resetAllClientData() {

    
    // Reset variabili globali di main.js
    currentClient = null;
    clients = [];
    templates = [];
    currentDiets = [];
    
    // Reset variabili di planning.js se esistono
    if (typeof resetPlanningState === 'function') {
        resetPlanningState();
    }
    
    // Reset variabili di planning globali direttamente
    if (typeof weeklyPlanData !== 'undefined') {
        weeklyPlanData = {
            lunedi: [], martedi: [], mercoledi: [], giovedi: [],
            venerdi: [], sabato: [], domenica: []
        };
    }
    
    if (typeof currentDietId !== 'undefined') {
        currentDietId = null;
    }
    
    if (typeof currentClientId !== 'undefined') {
        currentClientId = null;
    }
    
    if (typeof planningConfig !== 'undefined') {
        planningConfig = {};
    }
    
}

// AGGIUNGI listener per quando si chiude/ricarica la pagina
window.addEventListener('beforeunload', function() {
    if (typeof resetPlanningCache === 'function') {
        resetPlanningCache();
    }
});