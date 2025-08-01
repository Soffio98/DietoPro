// === GESTIONE ALIMENTI - JAVASCRIPT ===

// Variabili globali
let alimentiSearchTimeout;
let loadedFoods = new Map(); // Mappa degli alimenti caricati
let modifiedFoods = new Set(); // Set degli ID modificati

// Configurazione campi nutrienti
const NUTRIENT_FIELDS = [
    { key: 'Nome', field: 'Nome', type: 'text', label: 'Nome' },
    { key: 'Kcal', field: 'Kcal', type: 'number', label: 'Kcal', step: 0.1 },
    { key: 'Proteine', field: 'Proteine', type: 'number', label: 'Proteine (g)', step: 0.1 },
    { key: 'Carboidrati', field: 'Carboidrati', type: 'number', label: 'Carboidrati (g)', step: 0.1 },
    { key: 'Lipidi', field: 'Lipidi', type: 'number', label: 'Grassi (g)', step: 0.1 },  // Cambiato da 'Grassi' a 'Lipidi'
    { key: 'Sodio', field: 'Sodio', type: 'number', label: 'Sodio (mg)', step: 0.1 },
    { key: 'Potassio', field: 'Potassio', type: 'number', label: 'Potassio (mg)', step: 0.1 },
    { key: 'Calcio', field: 'Calcio', type: 'number', label: 'Calcio (mg)', step: 0.1 },
    { key: 'Ferro', field: 'Ferro', type: 'number', label: 'Ferro (mg)', step: 0.01 },
    { key: 'Vitamina_D', field: 'Vitamina_D', type: 'number', label: 'Vitamina D (μg)', step: 0.1 },
    { key: 'Vitamina_A', field: 'Vitamina_A', type: 'number', label: 'Vitamina A (μg)', step: 1 },  // Cambiato da 'Vitamina_A1' a 'Vitamina_A'
    { key: 'Vitamina_C', field: 'Vitamina_C', type: 'number', label: 'Vitamina C (mg)', step: 0.1 },
    { key: 'Vitamina_B1', field: 'Vitamina_B1', type: 'number', label: 'Vitamina B1 (mg)', step: 0.001 },
    { key: 'Vitamina_B12', field: 'Vitamina_B12', type: 'number', label: 'Vitamina B12 (μg)', step: 0.1 },
    { key: 'Folati', field: 'Folati', type: 'number', label: 'Folati (μg)', step: 1 },
    { key: 'Sale', field: 'Sale', type: 'number', label: 'Sale (μg)', step: 1 }
];

// 2. AGGIUNGI questa funzione di inizializzazione:
function initializeAlimentiFunctions() {
    console.log('Inizializzazione funzioni alimenti...');
    
    // Verifica che gli elementi esistano
    const searchInput = document.getElementById('foodSearch');
    const searchResults = document.getElementById('searchResults');
    const foodsList = document.getElementById('foodsList');
    
    if (!searchInput || !searchResults || !foodsList) {
        console.error('Elementi alimenti non trovati nel DOM');
        return;
    }
    
    // Inizializza le funzionalità
    setupSearch();
    setupEventDelegation();
    
    console.log('✅ Funzioni alimenti inizializzate');
}

// === AGGIUNGERE ALL'INIZIO DI alimenti.js DOPO le variabili globali ===

// Inizializzazione immediata delle funzioni globali
(function() {
    // Assicurati che le funzioni siano disponibili globalmente immediatamente
    window.showNewFoodForm = function() {
        const form = document.getElementById('newFoodForm');
        if (form) {
            form.classList.remove('hidden');
            const nomeInput = document.getElementById('new-nome');
            if (nomeInput) nomeInput.focus();
        } else {
            console.error('newFoodForm non trovato');
        }
    };

    window.hideNewFoodForm = function() {
        const form = document.getElementById('newFoodForm');
        if (form) {
            form.classList.add('hidden');
            form.querySelectorAll('input, select').forEach(input => {
                if (input.type === 'number') {
                    input.value = '0';
                } else {
                    input.value = '';
                }
            });
        }
    };
})();


// Setup event delegation per gestire eventi dinamici
function setupEventDelegation() {
    // Delega eventi per i risultati di ricerca
    document.getElementById('searchResults').addEventListener('click', function(e) {
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem && resultItem.dataset.foodId) {
            loadFood(parseInt(resultItem.dataset.foodId));
        }
    });
    
    // Delega eventi per le card alimenti
    document.getElementById('foodsList').addEventListener('click', function(e) {
        // Bottone rimuovi
        if (e.target.closest('.remove-food-btn')) {
            const card = e.target.closest('.food-card');
            if (card && card.dataset.foodId) {
                removeLoadedFood(parseInt(card.dataset.foodId));
            }
        }
        
        // Bottone salva
        if (e.target.closest('.save-food-btn')) {
            const card = e.target.closest('.food-card');
            if (card && card.dataset.foodId) {
                saveFood(parseInt(card.dataset.foodId));
            }
        }
    });
    
    // Delega eventi per input changes
    document.getElementById('foodsList').addEventListener('change', function(e) {
        if (e.target.classList.contains('form-input')) {
            const card = e.target.closest('.food-card');
            if (card && card.dataset.foodId) {
                markAsModified(parseInt(card.dataset.foodId));
            }
        }
    });
}

// Setup ricerca con autocomplete
function setupSearch() {
    const searchInput = document.getElementById('foodSearch');
    const searchResults = document.getElementById('searchResults');
    
    searchInput.addEventListener('input', function() {
        clearTimeout(alimentiSearchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }
        
        alimentiSearchTimeout = setTimeout(() => searchFood(query), 300);
    });
    
    // Chiudi risultati quando clicchi fuori
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
}

// Cerca alimento
async function searchFood(query) {
    const searchResults = document.getElementById('searchResults');
    
    try {
        const response = await fetch(`http://localhost:3005/api/foods/search/${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Errore ricerca');
        
        const foods = await response.json();
        
        // Pulisci risultati precedenti
        searchResults.innerHTML = '';
        
        if (foods.length === 0) {
            searchResults.innerHTML = '<div class="no-results">Nessun alimento trovato</div>';
        } else {
            // Usa il template per creare i risultati
            const template = document.getElementById('searchResultTemplate');
            
            foods.forEach(food => {
                const clone = template.content.cloneNode(true);
                const item = clone.querySelector('.search-result-item');
                
                item.dataset.foodId = food.id;
                clone.querySelector('.food-name').textContent = food.nome;
                clone.querySelector('.food-calories').textContent = `${food.kcal} kcal`;
                searchResults.appendChild(clone);
            });
        }
        
        searchResults.classList.remove('hidden');
        
    } catch (error) {
 
        showToast('Errore nella ricerca', 'error');
    }
}

// Carica alimento per modifica
async function loadFood(id) {
    // Nascondi risultati ricerca
    document.getElementById('searchResults').classList.add('hidden');
    document.getElementById('foodSearch').value = '';
    
    // Se già caricato, non ricaricare
    if (loadedFoods.has(id)) {
        showToast('Alimento già caricato', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:3005/api/foods/${id}`);
        if (!response.ok) throw new Error('Errore caricamento');
        
        const food = await response.json();

        
        // Aggiungi alla mappa usando l'ID maiuscolo
        loadedFoods.set(food.id || id, { ...food });
        
        // Mostra nella UI
        displayLoadedFood(food);
        showToast(`${food.Nome} caricato per modifica`, 'success');
        
    } catch (error) {

        showToast('Errore nel caricamento dell\'alimento', 'error');
    }
}

// Mostra alimento caricato usando template
function displayLoadedFood(food) {
    const foodsList = document.getElementById('foodsList');
    const loadedTitle = document.getElementById('loadedTitle');
    const saveAllBtn = document.getElementById('saveAllBtn');
    
    // Mostra titolo e bottone salva
    loadedTitle.classList.remove('hidden');
    saveAllBtn.classList.remove('hidden');
    
    // Usa il template per creare la card
    const template = document.getElementById('foodCardTemplate');
    const clone = template.content.cloneNode(true);
    
    // Imposta ID e titolo
    const card = clone.querySelector('.food-card');
    card.id = `food-${food.id}`;
    card.dataset.foodId = food.id;
    clone.querySelector('.food-title').textContent = food.Nome || 'Senza nome';
    
    // Crea i campi del form
    const gridContainer = clone.querySelector('.food-card-grid');
    const fieldTemplate = document.getElementById('formFieldTemplate');
    
    NUTRIENT_FIELDS.forEach(fieldConfig => {
        const fieldClone = fieldTemplate.content.cloneNode(true);
        const formGroup = fieldClone.querySelector('.form-group');
        const label = fieldClone.querySelector('label');
        const input = fieldClone.querySelector('input');
        
        label.textContent = fieldConfig.label;
        input.type = fieldConfig.type;
        input.value = food[fieldConfig.key] || (fieldConfig.type === 'number' ? 0 : '');
        input.dataset.field = fieldConfig.field;
        
        if (fieldConfig.type === 'number') {
            input.step = fieldConfig.step;
        }
        
        gridContainer.appendChild(fieldClone);
    });
    
    foodsList.appendChild(clone);
}

// Marca come modificato
function markAsModified(id) {
    modifiedFoods.add(id);
    const card = document.getElementById(`food-${id}`);
    if (card) {
        card.classList.add('modified');
    }
}

// Rimuovi alimento caricato
function removeLoadedFood(id) {
    loadedFoods.delete(id);
    modifiedFoods.delete(id);
    
    const card = document.getElementById(`food-${id}`);
    if (card) {
        card.remove();
    }
    
    // Nascondi titolo e bottone se non ci sono più alimenti
    if (loadedFoods.size === 0) {
        document.getElementById('loadedTitle').classList.add('hidden');
        document.getElementById('saveAllBtn').classList.add('hidden');
    }
    
    showToast('Alimento rimosso', 'info');
}

// Salva singolo alimento
async function saveFood(id) {
    const card = document.getElementById(`food-${id}`);
    if (!card) return;
    
    // Raccogli dati dal form
    const foodData = {};
    card.querySelectorAll('input, select').forEach(input => {
        const field = input.dataset.field;
        if (field) {
            // Mappa i nomi dei campi dal formato UI al formato API
            let apiField = field.toLowerCase();
            
            // Gestisci casi speciali
            if (field === 'Vitamina_A') apiField = 'vitamina_a';
            else if (field === 'Vitamina_D') apiField = 'vitamina_d';
            else if (field === 'Vitamina_C') apiField = 'vitamina_c';
            else if (field === 'Vitamina_B1') apiField = 'vitamina_b1';
            else if (field === 'Vitamina_B12') apiField = 'vitamina_b12';
            else if (field === 'Lipidi') apiField = 'lipidi';  // Aggiunto caso per Lipidi
            foodData[apiField] = input.type === 'number' ? 
                parseFloat(input.value) || 0 : input.value;
        }
    });
    
    // Validazione
    if (!foodData.nome) {
        showToast('Nome obbligatorio', 'error');
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:3005/api/foods/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(foodData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore salvataggio');
        }
        
        // Aggiorna dati in memoria
        loadedFoods.set(id, { ID: id, ...foodData });
        modifiedFoods.delete(id);
        card.classList.remove('modified');
        
        showToast('✅ Alimento salvato con successo!', 'success');
        
    } catch (error) {

        showToast(`❌ ${error.message}`, 'error');
    }
}

// Salva tutte le modifiche
async function saveAllChanges() {
    const promises = [];
    
    modifiedFoods.forEach(id => {
        const card = document.getElementById(`food-${id}`);
        if (card) {
            // Raccogli dati
            const foodData = {};
            card.querySelectorAll('input, select').forEach(input => {
                const field = input.dataset.field;
                if (field) {
                    // Mappa i nomi dei campi dal formato UI al formato API
                    let apiField = field.toLowerCase();
                    
                    // Gestisci casi speciali
                    if (field === 'Vitamina_A1') apiField = 'vitamina_a';
                    else if (field === 'Vitamina_D') apiField = 'vitamina_d';
                    else if (field === 'Vitamina_C') apiField = 'vitamina_c';
                    else if (field === 'Vitamina_B1') apiField = 'vitamina_b1';
                    else if (field === 'Vitamina_B12') apiField = 'vitamina_b12';
                    else if (field === 'Lipidi') apiField = 'lipidi';  // Aggiunto caso per Lipidi
                    foodData[apiField] = input.type === 'number' ? 
                        parseFloat(input.value) || 0 : input.value;
                }
            });
            
            // Solo se i dati sono validi
            if (foodData.nome) {
                promises.push(
                    fetch(`http://localhost:3005/api/foods/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(foodData)
                    })
                );
            }
        }
    });
    
    if (promises.length === 0) {
        showToast('Nessuna modifica da salvare', 'info');
        return;
    }
    
    try {
        await Promise.all(promises);
        
        // Reset stato
        modifiedFoods.clear();
        document.querySelectorAll('.food-card.modified').forEach(card => {
            card.classList.remove('modified');
        });
        
        showToast(`✅ ${promises.length} alimenti salvati con successo!`, 'success');
        
    } catch (error) {

        showToast('❌ Errore nel salvataggio di alcuni alimenti', 'error');
    }
}

// Mostra form nuovo alimento
function showNewFoodForm() {
    const form = document.getElementById('newFoodForm');
    if (form) {
        form.classList.remove('hidden');
        document.getElementById('new-nome').focus();
    } else {
    }
}

// Nascondi form nuovo alimento
function hideNewFoodForm() {
    document.getElementById('newFoodForm').classList.add('hidden');
    document.getElementById('newFoodForm').querySelectorAll('input, select').forEach(input => {
        if (input.type === 'number') {
            input.value = '0';
        } else {
            input.value = '';
        }
    });
}

// Salva nuovo alimento
async function saveNewFood() {
    const foodData = {};
    
    // Raccogli dati
    document.getElementById('newFoodForm').querySelectorAll('input, select').forEach(input => {
        const field = input.id.replace('new-', '');
        foodData[field] = input.type === 'number' ? 
            parseFloat(input.value) || 0 : input.value;
    });
    
    try {
        const response = await fetch('http://localhost:3005/api/foods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(foodData)
        });
        
        if (!response.ok) throw new Error('Errore creazione');
        
        const result = await response.json();
        
        hideNewFoodForm();
        showToast('✅ Nuovo alimento creato con successo!', 'success');
        
        // Opzionale: carica automaticamente il nuovo alimento per eventuale modifica
        if (result.id) {
            setTimeout(() => loadFood(result.id), 500);
        }
        
    } catch (error) {

        showToast('❌ Errore nella creazione dell\'alimento', 'error');
    }
}

// Mostra toast
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Esporta tutte le funzioni globali necessarie per gli onclick nell'HTML
window.showNewFoodForm = showNewFoodForm;
window.hideNewFoodForm = hideNewFoodForm;
window.saveNewFood = saveNewFood;
window.saveAllChanges = saveAllChanges;
window.saveFood = saveFood;
window.removeLoadedFood = removeLoadedFood;
window.loadFood = loadFood;
window.searchFood = searchFood;
window.initializeAlimentiFunctions = initializeAlimentiFunctions;
// Esporta anche le funzioni di setup per essere accessibili da navigation.js
window.setupSearch = setupSearch;
window.setupEventDelegation = setupEventDelegation;
