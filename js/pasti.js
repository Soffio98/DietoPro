// === GESTIONE PASTI PRE-FATTI ===

// Variabili globali per i pasti
let currentPresetMealId = null;
let presetMealFoods = [];
let isEditingMeal = false;
let pastiSearchTimeout = null;

// === NAVIGAZIONE ===
function showPastiManagement() {
    // Nascondi tutte le sezioni
    document.getElementById('homepage').classList.add('hidden');
    document.getElementById('new-client-section').classList.add('hidden');
    document.getElementById('client-list-section').classList.add('hidden');
    document.getElementById('client-detail-section').classList.add('hidden');
    
    // Mostra gestione pasti - CORRETTO ID
    const pastiSection = document.getElementById('pasti-management-section');
    if (pastiSection) {
        pastiSection.classList.remove('hidden');
        document.querySelector('.back-btn').classList.remove('hidden');
        loadPresetMeals();
    }
}

async function loadPresetMeals() {
    try {
        const container = document.getElementById('pasti-list');
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Caricamento pasti...</p></div>';
        
        console.log('🔍 Caricando pasti pre-fatti...');
        
        // Aggiungi /api/ al percorso se non c'è già
        const pasti = await apiCall('/pasti-prefatti');
        
        console.log('📋 Pasti caricati:', pasti);
        
        if (!pasti || pasti.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">
                    <p style="font-size: 1.2em; margin-bottom: 20px;">
                        📭 Nessun pasto pre-fatto ancora creato
                    </p>
                    <button class="btn btn-primary" onclick="openNewMealModal()">
                        ➕ Crea il tuo primo pasto
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = pasti.map(pasto => createMealCardHTML(pasto)).join('');
        
    } catch (error) {
        console.error('❌ Errore caricamento pasti:', error);
        console.error('📝 Dettagli errore:', {
            message: error.message,
            status: error.status || 'N/A'
        });
        
        const container = document.getElementById('pasti-list');
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #e74c3c;">
                <p style="font-size: 1.2em; margin-bottom: 20px;">
                    ❌ Errore nel caricamento dei pasti
                </p>
                <p style="font-size: 0.9em; opacity: 0.8;">
                    ${error.message}
                </p>
                <button class="btn btn-primary" onclick="loadPresetMeals()" style="margin-top: 15px;">
                    🔄 Riprova
                </button>
            </div>
        `;
    }
}

// === API CALL HELPER CON MIGLIORE GESTIONE ERRORI ===
async function apiCallWithBetterErrors(endpoint, options = {}) {
    try {
        console.log(`🌐 API Call: ${endpoint}`, options);
        
        const baseUrl = window.location.origin;
        const fullUrl = `${baseUrl}${endpoint}`;
        
        console.log(`🔗 Full URL: ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        console.log(`📡 Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HTTP Error ${response.status}:`, errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📨 Response data:', data);
        
        return data;
        
    } catch (error) {
        console.error('🚨 API Call failed:', error);
        throw error;
    }
}
// === CREAZIONE CARD PASTO ===
function createMealCardHTML(pasto) {
    const categoryColors = {
        colazione: '#11998e',
        spuntino: '#667eea',
        pranzo: '#f39c12',
        merenda: '#e74c3c',
        cena: '#e67e22',
        generico: '#95a5a6'
    };
    
    const categoryColor = categoryColors[pasto.categoria] || categoryColors.generico;
    
    // Calcola totali
    const totals = calculateMealTotalsFromData(pasto.alimenti || []);
    
    return `
        <div class="meal-card" data-meal-id="${pasto.id}">
            <div class="meal-card-header">
                <div>
                    <div class="meal-card-title">${pasto.nome}</div>
                    <span class="meal-category-badge" style="background: ${categoryColor}">
                        ${pasto.categoria.charAt(0).toUpperCase() + pasto.categoria.slice(1)}
                    </span>
                </div>
            </div>
            
            ${pasto.descrizione ? `<div class="meal-card-description">${pasto.descrizione}</div>` : ''}
            
            <div class="meal-card-foods">
                ${pasto.alimenti.map(food => `
                    <div class="meal-food-item">
                        <span>${food.nome}</span>
                        <span>${food.quantita}g</span>
                    </div>
                `).join('')}
            </div>
            
            <div class="meal-card-totals">
                <div class="meal-total-item">
                    <div class="meal-total-value">${totals.kcal.toFixed(0)}</div>
                    <div class="meal-total-label">Kcal</div>
                </div>
                <div class="meal-total-item">
                    <div class="meal-total-value">${totals.proteine.toFixed(1)}g</div>
                    <div class="meal-total-label">Proteine</div>
                </div>
                <div class="meal-total-item">
                    <div class="meal-total-value">${totals.carboidrati.toFixed(1)}g</div>
                    <div class="meal-total-label">Carboidrati</div>
                </div>
                <div class="meal-total-item">
                    <div class="meal-total-value">${totals.grassi.toFixed(1)}g</div>
                    <div class="meal-total-label">Grassi</div>
                </div>
            </div>
            
            <div class="meal-card-actions">
                <button class="btn btn-secondary btn-small" onclick="duplicatePresetMeal(${pasto.id})">
                    📋 Duplica
                </button>
                <button class="btn btn-primary btn-small" onclick="editPresetMeal(${pasto.id})">
                    ✏️ Modifica
                </button>
                <button class="btn btn-danger btn-small" onclick="deletePresetMeal(${pasto.id})">
                    🗑️ Elimina
                </button>
            </div>
        </div>
    `;
}

// === MODAL FUNCTIONS ===
function openNewMealModal() {
    currentPresetMealId = null;
    isEditingMeal = false;
    presetMealFoods = [];
    
    // Reset form
    document.getElementById('meal-modal-title').textContent = '🍽️ Crea Nuovo Pasto';
    document.getElementById('meal-name').value = '';
    document.getElementById('meal-category').value = 'generico';
    document.getElementById('meal-description').value = '';
    document.getElementById('meal-foods-container').innerHTML = `
        <p style="color: #999; text-align: center; padding: 20px; font-style: italic;">
            Clicca "Aggiungi Alimento" per iniziare a comporre il pasto
        </p>
    `;
    
    updatePresetMealTotals();
    
    document.getElementById('meal-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeMealModal() {
    document.getElementById('meal-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    
    // Reset variabili
    currentPresetMealId = null;
    isEditingMeal = false;
    presetMealFoods = [];
}

// === GESTIONE ALIMENTI NEL PASTO ===
function addFoodToPresetMeal(isAlternative = false) {
    const foodContainer = document.getElementById('meal-foods-container');
    
    // Rimuovi placeholder se presente
    const placeholder = foodContainer.querySelector('p');
    if (placeholder) placeholder.remove();
    
    // Crea riga alimento (stessa logica della pianificazione)
    const foodRow = document.createElement('div');
    foodRow.className = isAlternative ? 'food-item alternative' : 'food-item';
    foodRow.dataset.isAlternative = isAlternative.toString();
    
    const placeholderText = isAlternative ? 'Cerca alternativa...' : 'Cerca alimento...';
    
    foodRow.innerHTML = `
        <div class="autocomplete-container">
            <input type="text" class="autocomplete-input" placeholder="${placeholderText}"
                   oninput="searchFoodsForPreset(this)" 
                   onblur="hideAutocomplete(this)">
            <div class="autocomplete-dropdown hidden"></div>
        </div>
        <input type="number" min="1" disabled placeholder="gr">
        ${createNutritionPlaceholdersHTML()}
        <div class="food-actions">
            <button class="btn btn-danger" onclick="removePresetFood(this)" 
                    style="padding: 6px 10px; border-radius: 6px; font-size: 11px;">
                ❌ Elimina
            </button>
        </div>
    `;
    
    foodContainer.appendChild(foodRow);
    
    // Focus input
    const input = foodRow.querySelector('.autocomplete-input');
    if (input) input.focus();
}

// === RICERCA ALIMENTI PER PASTI PRE-FATTI ===
async function searchFoodsForPreset(input) {
    const query = input.value.trim();
    const dropdown = input.nextElementSibling;
    
    if (query.length < 2) {
        dropdown.classList.add('hidden');
        return;
    }
    
    clearTimeout(pastiSearchTimeout);
    pastiSearchTimeout = setTimeout(async () => {
        try {
            const foods = await apiCall(`/foods?search=${encodeURIComponent(query)}`);
            displayFoodResultsForPreset(foods, dropdown, input);
        } catch (error) {
            console.error('Errore ricerca alimenti:', error);
            dropdown.innerHTML = '<div class="autocomplete-item">Errore nella ricerca</div>';
            dropdown.classList.remove('hidden');
        }
    }, 300);
}

function displayFoodResultsForPreset(foods, dropdown, input) {
    if (foods.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item">Nessun alimento trovato</div>';
    } else {
        dropdown.innerHTML = foods.map(food => {
            // Normalizza i dati come in food.js
            const foodData = {
                id: food.ID || food.id,
                nome: food.Nome || food.nome,
                kcal: parseFloat(food.Kcal || food.kcal) || 0,
                proteine: parseFloat(food.Proteine || food.proteine) || 0,
                carboidrati: parseFloat(food.Carboidrati || food.carboidrati) || 0,
                grassi: parseFloat(food.Lipidi || food.lipidi || food.Grassi || food.grassi) || 0,
                sodio: parseFloat(food.Sodio || food.sodio) || 0,
                potassio: parseFloat(food.Potassio || food.potassio) || 0,
                calcio: parseFloat(food.Calcio || food.calcio) || 0,
                ferro: parseFloat(food.Ferro || food.ferro) || 0,
                vitaminaD: parseFloat(food.Vitamina_D || food.vitamina_d || food.Vitamina_d) || 0,
                vitaminaA: parseFloat(food.Vitamina_A || food.vitamina_a || food.Vitamina_a) || 0,
                vitaminaC: parseFloat(food.Vitamina_C || food.vitamina_c || food.Vitamina_c) || 0,
                vitaminaB1: parseFloat(food.Vitamina_B1 || food.vitamina_b1 || food.Vitamina_b1) || 0,
                vitaminaB12: parseFloat(food.Vitamina_B12 || food.vitamina_b12 || food.Vitamina_b12) || 0,
                folati: parseFloat(food.Folati || food.folati) || 0,
                sale: parseFloat(food.Sale || food.sale) || 0
            };
            
            return `
                <div class="autocomplete-item" 
                     data-food='${JSON.stringify(foodData)}'
                     onclick="selectFoodForPreset(this)">
                    <div class="food-name">${foodData.nome}</div>
                    <div class="food-nutrition">
                        ${foodData.kcal} kcal | P: ${foodData.proteine}g | C: ${foodData.carboidrati}g | G: ${foodData.grassi}g (per 100g)
                    </div>
                </div>
            `;
        }).join('');
    }
    dropdown.classList.remove('hidden');
}


function selectFoodForPreset(element) {
    const foodItem = element.closest('.food-item');
    const isAlternative = foodItem.dataset.isAlternative === 'true';
    const quantityInput = foodItem.querySelector('input[type="number"]');
    const fullFoodData = JSON.parse(element.getAttribute('data-food'));
    
    // Sostituisci campo ricerca con nome alimento
    const autocompleteContainer = foodItem.querySelector('.autocomplete-container');
    const nameContainer = document.createElement('div');
    nameContainer.className = 'food-name-container';
    nameContainer.innerHTML = `<div class="food-name">${fullFoodData.nome}</div>`;
    
    autocompleteContainer.replaceWith(nameContainer);
    
    // Abilita quantità
    quantityInput.disabled = false;
    quantityInput.value = 100;
    quantityInput.onchange = function() {
        updatePresetFoodCalculations(this, fullFoodData, isAlternative);
    };
    
    // Calcolo iniziale
    updatePresetFoodCalculations(quantityInput, fullFoodData, isAlternative);
}

function updatePresetFoodCalculations(quantityInput, foodData, isAlternative = false) {
    const quantity = parseFloat(quantityInput.value) || 0;
    const foodItem = quantityInput.closest('.food-item');
    const factor = quantity / 100;
    
    // Crea array dei valori nutrizionali calcolati
    const nutritionValues = [
        { value: (foodData.kcal || 0) * factor, precision: 1, bg: '#ffe6e6', color: '#e74c3c', emoji: 'Kcal' },
        { value: (foodData.proteine || 0) * factor, precision: 1, bg: '#fff4e6', color: '#e67e22', emoji: 'Prot', unit: 'g' },
        { value: (foodData.carboidrati || 0) * factor, precision: 1, bg: '#fef9e7', color: '#f39c12', emoji: 'Carb', unit: 'g' },
        { value: (foodData.grassi || 0) * factor, precision: 1, bg: '#e8f5e8', color: '#27ae60', emoji: 'Grassi', unit: 'g' },
        { value: (foodData.sodio || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Sodio', unit: 'mg', small: true },
        { value: (foodData.potassio || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Pot', unit: 'mg', small: true },
        { value: (foodData.calcio || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Cal', unit: 'mg', small: true },
        { value: (foodData.ferro || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Fer', unit: 'mg', small: true },
        { value: (foodData.vitaminaD || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'D', unit: 'μg', small: true },
        { value: (foodData.vitaminaA || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'A', unit: 'μg', small: true },
        { value: (foodData.vitaminaC || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'C', unit: 'mg', small: true },
        { value: (foodData.vitaminaB1 || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'B1', unit: 'mg', small: true },
        { value: (foodData.vitaminaB12 || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'B12', unit: 'μg', small: true },
        { value: (foodData.folati || 0) * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Fol', unit: 'μg', small: true }
    ];
    
    const nutritionHTML = nutritionValues.map(nutrition => {
        const fontSize = nutrition.small ? '0.85em' : '1em';
        const padding = nutrition.small ? '6px' : '8px';
        return `
            <div style="background: ${nutrition.bg}; color: ${nutrition.color}; font-weight: bold; padding: ${padding}; border-radius: 6px; font-size: ${fontSize};">
                ${nutrition.emoji} <br> ${nutrition.value.toFixed(nutrition.precision)}${nutrition.unit || ''}
            </div>
        `;
    }).join('');
    
    // Ricostruisci la riga con i valori aggiornati
    foodItem.innerHTML = `
        <div class="food-name-container">
            <div class="food-name">${foodData.nome}</div>
        </div>
        <input type="number" value="${quantity}" min="1" 
               onchange="updatePresetFoodCalculations(this, ${JSON.stringify(foodData).replace(/"/g, '&quot;')}, ${isAlternative})">
        ${nutritionHTML}
        <div class="food-actions">
            ${!isAlternative ? `<button class="btn btn-secondary" onclick="addAlternativeToPresetFood(this)" 
                    style="padding: 6px 10px; border-radius: 6px; font-size: 11px; margin-right: 5px;">
                🔄 Alternativa
            </button>` : ''}
            <button class="btn btn-danger" onclick="removePresetFood(this)" 
                    style="padding: 6px 10px; border-radius: 6px; font-size: 11px;">
                🗑️ Elimina
            </button>
        </div>
    `;
    
    // Aggiorna totali del pasto (solo se non è alternativa)
    if (!isAlternative) {
        updatePresetMealTotals();
    }
}

function extractNutritionalValue(foodItem, cellIndex, key = null) {
    try {
        const cell = foodItem.children[cellIndex];
        if (!cell) return 0;
        
        const rawText = cell.textContent;
        let value;
        
        // Gestione speciale per vitamine B1 e B12
        if (key === 'vitaminaB1' || key === 'vitaminaB12') {
            const match1 = rawText.match(/B\d+\s+([\d.]+)/);
            const match2 = rawText.match(/(\d+\.?\d*)/);
            value = match1 ? parseFloat(match1[1]) : (match2 ? parseFloat(match2[1]) : 0);
        } else {
            value = parseFloat(rawText.replace(/[^0-9.]/g, '')) || 0;
        }
        
        return value;
        
    } catch (error) {
        console.error('Errore estrazione valore:', error);
        return 0;
    }
}


function hideAutocomplete(input) {
    setTimeout(() => {
        const dropdown = input.nextElementSibling;
        if (dropdown) dropdown.classList.add('hidden');
    }, 200);
}


function removePresetFood(button) {
    const foodItem = button.closest('.food-item');
    foodItem.remove();
    
    // Mostra placeholder se necessario
    const foodContainer = document.getElementById('meal-foods-container');
    if (!foodContainer.querySelector('.food-item')) {
        foodContainer.innerHTML = `
            <p style="color: #999; text-align: center; padding: 20px; font-style: italic;">
                Clicca "Aggiungi Alimento" per iniziare a comporre il pasto
            </p>
        `;
    }
    
    updatePresetMealTotals();
}

// === CALCOLO TOTALI ===
function updatePresetMealTotals() {
    const foodContainer = document.getElementById('meal-foods-container');
    const mainFoodItems = foodContainer.querySelectorAll('.food-item:not(.alternative)');
    
    const totals = {
        kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
        sodio: 0, potassio: 0, calcio: 0, ferro: 0,
        vitaminaD: 0, vitaminaA: 0, vitaminaC: 0, 
        vitaminaB1: 0, vitaminaB12: 0, folati: 0
    };
    
    // Somma valori solo degli alimenti principali
    mainFoodItems.forEach((foodItem) => {
        try {
            const cells = foodItem.children;
            const nutritionData = [
                { key: 'kcal', pos: 2 },
                { key: 'proteine', pos: 3 },
                { key: 'carboidrati', pos: 4 },
                { key: 'grassi', pos: 5 },
                { key: 'sodio', pos: 6 },
                { key: 'potassio', pos: 7 },
                { key: 'calcio', pos: 8 },
                { key: 'ferro', pos: 9 },
                { key: 'vitaminaD', pos: 10 },
                { key: 'vitaminaA', pos: 11 },
                { key: 'vitaminaC', pos: 12 },
                { key: 'vitaminaB1', pos: 13 },
                { key: 'vitaminaB12', pos: 14 },
                { key: 'folati', pos: 15 }
            ];
            
            nutritionData.forEach(({ key, pos }) => {
                if (cells[pos]) {
                    const rawText = cells[pos].textContent;
                    let value;
                    
                    if (key === 'vitaminaB1' || key === 'vitaminaB12') {
                        const match1 = rawText.match(/B\d+\s+([\d.]+)/);
                        const match2 = rawText.match(/(\d+\.?\d*)/);
                        value = match1 ? parseFloat(match1[1]) : (match2 ? parseFloat(match2[1]) : 0);
                    } else {
                        value = parseFloat(rawText.replace(/[^0-9.]/g, '')) || 0;
                    }
                    
                    totals[key] += value;
                }
            });
        } catch (error) {
            console.error('Errore calcolo totali:', error);
        }
    });
    
    // Aggiorna display totali
    const totalsContainer = document.getElementById('preset-meal-totals');
    totalsContainer.innerHTML = createPresetMealTotalsHTML(totals);
}

function createPresetMealTotalsHTML(totals) {
    const items = [
        { label: 'Calorie', value: totals.kcal.toFixed(0), unit: 'kcal', emoji: '🔥' },
        { label: 'Proteine', value: totals.proteine.toFixed(1), unit: 'g', emoji: '🥩' },
        { label: 'Carboidrati', value: totals.carboidrati.toFixed(1), unit: 'g', emoji: '🍞' },
        { label: 'Grassi', value: totals.grassi.toFixed(1), unit: 'g', emoji: '🥑' },
        { label: 'Sodio', value: totals.sodio.toFixed(0), unit: 'mg', emoji: '🧂' },
        { label: 'Potassio', value: totals.potassio.toFixed(0), unit: 'mg', emoji: '🍌' },
        { label: 'Calcio', value: totals.calcio.toFixed(0), unit: 'mg', emoji: '🦴' },
        { label: 'Ferro', value: totals.ferro.toFixed(1), unit: 'mg', emoji: '⚡' },
        { label: 'Vit_D', value: totals.vitaminaD.toFixed(0),unit: 'μg', emoji: '☀️'},
        { label: 'Vit_A',value: totals.vitaminaD.toFixed(0), unit: 'μg',  emoji: '🥕 '},
        { label: 'Vit_C',value: totals.vitaminaD.toFixed(0), unit: 'mg', emoji: '🍊'},
        { label: 'Vit_B1',value: totals.vitaminaD.toFixed(0),unit: 'mg',  emoji: '🌾'},
        { label: 'Vit_B12',value: totals.vitaminaD.toFixed(0),unit: 'μg',  emoji: '🧬'},
        { label: 'Folati',value: totals.vitaminaD.toFixed(0),unit: 'μg',  emoji: '🍃'}


    ];
    
    return items.map(item => `
        <div style="text-align: center;">
            <div style="font-size: 1.5em;">${item.emoji}</div>
            <div style="font-size: 1.2em; font-weight: bold;">${item.value}${item.unit}</div>
            <div style="font-size: 0.9em; opacity: 0.8;">${item.label}</div>
        </div>
    `).join('');
}

function calculateMealTotalsFromData(alimenti) {
    const totals = {
        kcal: 0, proteine: 0, carboidrati: 0, grassi: 0
    };
    
    alimenti.forEach(food => {
        totals.kcal += food.kcal || 0;
        totals.proteine += food.proteine || 0;
        totals.carboidrati += food.carboidrati || 0;
        totals.grassi += food.grassi || 0;
    });
    
    return totals;
}

// === SALVATAGGIO PASTO ===
async function savePresetMeal() {
    try {
        const nome = document.getElementById('meal-name').value.trim();
        const categoria = document.getElementById('meal-category').value;
        const descrizione = document.getElementById('meal-description').value.trim();
        
        if (!nome) {
            showMessage('⚠️ Inserisci un nome per il pasto', 'warning');
            return;
        }
        
        // Raccogli dati alimenti
        const foodContainer = document.getElementById('meal-foods-container');
        const mainFoodItems = foodContainer.querySelectorAll('.food-item:not(.alternative)');
        
        if (mainFoodItems.length === 0) {
            showMessage('⚠️ Aggiungi almeno un alimento al pasto', 'warning');
            return;
        }
        
        const alimenti = [];
        const alternative = [];
        
        // Raccogli tutti gli alimenti con il loro ordine
        const allFoodItems = foodContainer.querySelectorAll('.food-item');
        let globalOrder = 0;
        
        allFoodItems.forEach((foodItem) => {
            const foodData = extractFoodDataFromPresetItem(foodItem);
            if (foodData) {
                foodData.globalOrder = globalOrder++;
                
                if (foodItem.classList.contains('alternative')) {
                    alternative.push(foodData);
                } else {
                    alimenti.push(foodData);
                }
            }
        });
        
        const pastoData = {
            nome: nome,
            categoria: categoria,
            descrizione: descrizione,
            alimenti: alimenti,
            alternative: alternative
        };
        
        console.log('🔍 Dati pasto da salvare:', pastoData); // Debug log
        
        let response;
        if (isEditingMeal && currentPresetMealId) {
            // Modifica pasto esistente
            console.log(`🔄 Modificando pasto ID: ${currentPresetMealId}`);
            response = await apiCall(`/pasti-prefatti/${currentPresetMealId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pastoData)
            });
            showMessage('✅ Pasto modificato con successo!', 'success');
        } else {
            // Crea nuovo pasto
            console.log('➕ Creando nuovo pasto');
            response = await apiCall('/pasti-prefatti', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pastoData)
            });
            showMessage('✅ Pasto creato con successo!', 'success');
        }
        
        console.log('✅ Risposta server:', response);
        
        closeMealModal();
        loadPresetMeals();
        
    } catch (error) {
        console.error('❌ Errore salvataggio pasto:', error);
        console.error('📝 Dettagli errore:', {
            message: error.message,
            stack: error.stack
        });
        showMessage('❌ Errore nel salvataggio del pasto', 'error');
    }
}

// === ESTRAZIONE DATI ALIMENTO ===
function extractFoodDataFromPresetItem(foodItem) {
    try {
        const foodNameElement = foodItem.querySelector('.food-name');
        const quantityInput = foodItem.querySelector('input[type="number"]');
        
        if (!foodNameElement || !quantityInput) {
            return null;
        }
        
        const foodData = {
            nome: foodNameElement.textContent,
            quantita: parseFloat(quantityInput.value) || 100,
            kcal: extractNutritionalValue(foodItem, 2),
            proteine: extractNutritionalValue(foodItem, 3),
            carboidrati: extractNutritionalValue(foodItem, 4),
            grassi: extractNutritionalValue(foodItem, 5),
            sodio: extractNutritionalValue(foodItem, 6),
            potassio: extractNutritionalValue(foodItem, 7),
            calcio: extractNutritionalValue(foodItem, 8),
            ferro: extractNutritionalValue(foodItem, 9),
            vitaminaD: extractNutritionalValue(foodItem, 10),
            vitaminaA: extractNutritionalValue(foodItem, 11),
            vitaminaC: extractNutritionalValue(foodItem, 12),
            vitaminaB1: extractNutritionalValue(foodItem, 13, 'vitaminaB1'),
            vitaminaB12: extractNutritionalValue(foodItem, 14, 'vitaminaB12'),
            folati: extractNutritionalValue(foodItem, 15)
        };
        
        return foodData;
        
    } catch (error) {
        console.error('Errore estrazione dati alimento:', error);
        return null;
    }
}

// === MODIFICA PASTO ESISTENTE ===
async function editPresetMeal(mealId) {
    try {
        currentPresetMealId = mealId;
        isEditingMeal = true;
        
        // Carica dati pasto
        const pasto = await apiCall(`/pasti-prefatti/${mealId}`);
        
        // Popola form
        document.getElementById('meal-modal-title').textContent = '✏️ Modifica Pasto';
        document.getElementById('meal-name').value = pasto.nome;
        document.getElementById('meal-category').value = pasto.categoria;
        document.getElementById('meal-description').value = pasto.descrizione || '';
        
        // Popola alimenti
        const foodContainer = document.getElementById('meal-foods-container');
        foodContainer.innerHTML = '';
        
        // Combina alimenti principali e alternative mantenendo l'ordine
        const allItems = [];
        
        pasto.alimenti.forEach(food => {
            allItems.push({
                ...food,
                isAlternative: false,
                order: food.globalOrder !== undefined ? food.globalOrder : 999
            });
        });
        
        if (pasto.alternative && pasto.alternative.length > 0) {
            pasto.alternative.forEach(alt => {
                allItems.push({
                    ...alt,
                    isAlternative: true,
                    order: alt.globalOrder !== undefined ? alt.globalOrder : 999
                });
            });
        }
        
        // Ordina per globalOrder
        allItems.sort((a, b) => a.order - b.order);
        
        // Aggiungi gli elementi nell'ordine corretto
        allItems.forEach(item => {
            const foodRow = document.createElement('div');
            foodRow.className = item.isAlternative ? 'food-item alternative' : 'food-item';
            foodRow.dataset.isAlternative = item.isAlternative ? 'true' : 'false';
            foodRow.innerHTML = createPresetFoodRowHTML(item, item.isAlternative);
            foodContainer.appendChild(foodRow);
        });
        
        updatePresetMealTotals();
        
        document.getElementById('meal-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Errore caricamento pasto:', error);
        showMessage('❌ Errore nel caricamento del pasto', 'error');
    }
}

// === CREAZIONE HTML RIGA ALIMENTO PER MODIFICA ===
// === CREAZIONE HTML RIGA ALIMENTO PER MODIFICA ===
function createPresetFoodRowHTML(foodData, isAlternative = false) {
    const nutritionData = [
        { value: parseFloat(foodData.kcal) || 0, precision: 1, bg: '#ffe6e6', color: '#e74c3c', emoji: 'Kcal' },
        { value: parseFloat(foodData.proteine) || 0, precision: 1, bg: '#fff4e6', color: '#e67e22', emoji: 'Prot', unit: 'g' },
        { value: parseFloat(foodData.carboidrati) || 0, precision: 1, bg: '#fef9e7', color: '#f39c12', emoji: 'Carb', unit: 'g' },
        { value: parseFloat(foodData.grassi) || 0, precision: 1, bg: '#e8f5e8', color: '#27ae60', emoji: 'Grassi', unit: 'g' },
        { value: parseFloat(foodData.sodio) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Sale', unit: 'mg', small: true },
        { value: parseFloat(foodData.potassio) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Pot', unit: 'mg', small: true },
        { value: parseFloat(foodData.calcio) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Cal', unit: 'mg', small: true },
        { value: parseFloat(foodData.ferro) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Fer', unit: 'mg', small: true },
        { value: parseFloat(foodData.vitaminaD) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'D', unit: 'μg', small: true },
        { value: parseFloat(foodData.vitaminaA) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'A', unit: 'μg', small: true },
        { value: parseFloat(foodData.vitaminaC) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'C', unit: 'mg', small: true },
        { value: parseFloat(foodData.vitaminaB1) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'B1', unit: 'mg', small: true },
        { value: parseFloat(foodData.vitaminaB12) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'B12', unit: 'μg', small: true },
        { value: parseFloat(foodData.folati) || 0, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Fol', unit: 'μg', small: true }
    ];
    
    const nutritionHTML = nutritionData.map(nutrition => {
        const fontSize = nutrition.small ? '0.85em' : '1em';
        const padding = nutrition.small ? '6px' : '8px';
        const value = Number(nutrition.value) || 0; // Assicurati che sia un numero
        return `
            <div style="background: ${nutrition.bg}; color: ${nutrition.color}; font-weight: bold; padding: ${padding}; border-radius: 6px; font-size: ${fontSize};">
                ${nutrition.emoji} <br> ${value.toFixed(nutrition.precision)}${nutrition.unit || ''}
            </div>
        `;
    }).join('');
    
    return `
        <div class="food-name-container">
            <div class="food-name">${foodData.nome}</div>
        </div>
        <input type="number" value="${foodData.quantita || 100}" min="1" 
               onchange="updatePresetFoodFromSavedData(this, ${JSON.stringify(foodData).replace(/"/g, '&quot;')}, ${isAlternative})">
        ${nutritionHTML}
        <div class="food-actions">
            ${!isAlternative ? `<button class="btn btn-secondary" onclick="addAlternativeToPresetFood(this)" 
                    style="padding: 6px 10px; border-radius: 6px; font-size: 11px; margin-right: 5px;">
                🔄 Alternativa
            </button>` : ''}
            <button class="btn btn-danger" onclick="removePresetFood(this)" 
                    style="padding: 6px 10px; border-radius: 6px; font-size: 11px;">
                🗑️ Elimina
            </button>
        </div>
    `;
}

// === AGGIORNAMENTO ALIMENTO DA DATI SALVATI ===
function updatePresetFoodFromSavedData(quantityInput, originalFoodData, isAlternative) {
    const newQuantity = parseFloat(quantityInput.value) || 0;
    const factor = newQuantity / (originalFoodData.quantita || 100);
    
    // Crea nuovi dati proporzionali
    const updatedFoodData = { ...originalFoodData };
    const nutritionKeys = [
        'kcal', 'proteine', 'carboidrati', 'grassi', 'sodio', 'potassio',
        'calcio', 'ferro', 'vitaminaD', 'vitaminaA', 'vitaminaC', 
        'vitaminaB1', 'vitaminaB12', 'folati'
    ];
    
    nutritionKeys.forEach(key => {
        updatedFoodData[key] = (originalFoodData[key] || 0) * factor;
    });
    
    updatedFoodData.quantita = newQuantity;
    
    // Riaggiorna la riga
    updateAllFoodCalculations(quantityInput, updatedFoodData, isAlternative);
    updatePresetMealTotals();
}

// === AGGIUNGI ALTERNATIVA A PASTO PRE-FATTO ===
function addAlternativeToPresetFood(button) {
    const mainFoodItem = button.closest('.food-item');
    const foodContainer = document.getElementById('meal-foods-container');
    
    if (!mainFoodItem || !foodContainer) {
        return;
    }
    
    // Crea l'alternativa
    const alternativeRow = document.createElement('div');
    alternativeRow.className = 'food-item alternative';
    alternativeRow.dataset.isAlternative = 'true';
    
    alternativeRow.innerHTML = `
        <div class="autocomplete-container">
            <input type="text" class="autocomplete-input" placeholder="Cerca alternativa..."
                   oninput="searchFoodsForPreset(this)" 
                   onblur="hideAutocomplete(this)">
            <div class="autocomplete-dropdown hidden"></div>
        </div>
        <input type="number" min="1" disabled placeholder="gr">
        ${createNutritionPlaceholdersHTML()}
        <div class="food-actions">
            <button class="btn btn-danger" onclick="removePresetFood(this)" 
                    style="padding: 6px 10px; border-radius: 6px; font-size: 11px;">
                ❌ Elimina
            </button>
        </div>
    `;
    
    // Inserisce l'alternativa subito dopo l'alimento principale
    mainFoodItem.insertAdjacentElement('afterend', alternativeRow);
    
    // Focus sull'input dell'alternativa
    const input = alternativeRow.querySelector('.autocomplete-input');
    if (input) input.focus();
}

// === DUPLICA PASTO ===
async function duplicatePresetMeal(mealId) {
    try {
        const pasto = await apiCall(`/pasti-prefatti/${mealId}`);
        
        const nuovoPasto = {
            nome: `${pasto.nome} (Copia)`,
            categoria: pasto.categoria,
            descrizione: pasto.descrizione,
            alimenti: pasto.alimenti,
            alternative: pasto.alternative || []
        };
        
        await apiCall('/pasti-prefatti', {
            method: 'POST',
            body: JSON.stringify(nuovoPasto)
        });
        
        showMessage('✅ Pasto duplicato con successo!', 'success');
        loadPresetMeals();
        
    } catch (error) {
        console.error('Errore duplicazione pasto:', error);
        showMessage('❌ Errore nella duplicazione del pasto', 'error');
    }
}

// === ELIMINA PASTO ===
async function deletePresetMeal(mealId) {
    if (confirm('Sei sicuro di voler eliminare questo pasto?')) {
        try {
            await apiCall(`/pasti-prefatti/${mealId}`, {
                method: 'DELETE'
            });
            
            showMessage('✅ Pasto eliminato con successo!', 'success');
            loadPresetMeals();
            
        } catch (error) {
            console.error('Errore eliminazione pasto:', error);
            showMessage('❌ Errore nell\'eliminazione del pasto', 'error');
        }
    }
}

// === FUNZIONE PER IMPORTARE PASTI NELLA PIANIFICAZIONE ===
async function showPresetMealsSelector(mealIndex) {
    try {
        const pasti = await apiCall('/pasti-prefatti');
        
        if (!pasti || pasti.length === 0) {
            showMessage('ℹ️ Nessun pasto pre-fatto disponibile', 'info');
            return;
        }
        
        // Crea modal per selezione pasto
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>🍽️ Seleziona Pasto Pre-fatto</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="pasti-selector-grid">
                        ${pasti.map(pasto => `
                            <div class="pasto-selector-card" onclick="importPresetMeal(${mealIndex}, ${pasto.id})">
                                <div class="pasto-selector-title">${pasto.nome}</div>
                                <div class="pasto-selector-category">${pasto.categoria}</div>
                                <div class="pasto-selector-info">
                                    ${calculateMealTotalsFromData(pasto.alimenti).kcal.toFixed(0)} kcal
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Errore caricamento pasti:', error);
        showMessage('❌ Errore nel caricamento dei pasti', 'error');
    }
}

// === IMPORTA PASTO NELLA PIANIFICAZIONE ===
async function importPresetMeal(mealIndex, mealId) {
    try {
        const pasto = await apiCall(`/pasti-prefatti/${mealId}`);
        const foodContainer = document.getElementById(`meal-${mealIndex}-foods`);
        
        if (!foodContainer) return;
        
        // Rimuovi placeholder
        const placeholder = foodContainer.querySelector('p');
        if (placeholder) placeholder.remove();
        
        // Aggiungi tutti gli alimenti del pasto
        const allItems = [];
        
        pasto.alimenti.forEach(food => {
            allItems.push({
                ...food,
                isAlternative: false,
                order: food.globalOrder !== undefined ? food.globalOrder : 999
            });
        });
        
        if (pasto.alternative && pasto.alternative.length > 0) {
            pasto.alternative.forEach(alt => {
                allItems.push({
                    ...alt,
                    isAlternative: true,
                    order: alt.globalOrder !== undefined ? alt.globalOrder : 999
                });
            });
        }
        
        // Ordina per globalOrder
        allItems.sort((a, b) => a.order - b.order);
        
        // Aggiungi gli elementi
        allItems.forEach(item => {
            const foodRow = document.createElement('div');
            foodRow.className = item.isAlternative ? 'food-item alternative' : 'food-item';
            foodRow.dataset.isAlternative = item.isAlternative ? 'true' : 'false';
            foodRow.innerHTML = createFoodRowHTML(item, item.isAlternative);
            foodContainer.appendChild(foodRow);
        });
        
        // Calcola totali
        calculateMealTotals(mealIndex);
        
        // Chiudi modal
        document.querySelector('.modal').remove();
        
        showMessage(`✅ Pasto "${pasto.nome}" importato con successo!`, 'success');
        
    } catch (error) {
        console.error('Errore importazione pasto:', error);
        showMessage('❌ Errore nell\'importazione del pasto', 'error');
    }
}

// === FUNZIONE DA AGGIUNGERE: HELPER PER CREARE PLACEHOLDER NUTRIENTI ===
function createNutritionPlaceholdersHTML() {
    const nutritionData = [
        { label: 'Kcal', bg: '#ffe6e6', color: '#e74c3c' },
        { label: 'Prot', bg: '#fff4e6', color: '#e67e22' },
        { label: 'Carb', bg: '#fef9e7', color: '#f39c12' },
        { label: 'Grassi', bg: '#e8f5e8', color: '#27ae60' },
        { label: 'Sale', bg: '#f8f9fa', color: '#666' },
        { label: 'Pot', bg: '#f8f9fa', color: '#666' },
        { label: 'Cal', bg: '#f8f9fa', color: '#666' },
        { label: 'Fer', bg: '#f8f9fa', color: '#666' },
        { label: 'D', bg: '#f8f9fa', color: '#666' },
        { label: 'A', bg: '#f8f9fa', color: '#666' },
        { label: 'C', bg: '#f8f9fa', color: '#666' },
        { label: 'B1', bg: '#f8f9fa', color: '#666' },
        { label: 'B12', bg: '#f8f9fa', color: '#666' },
        { label: 'Fol', bg: '#f8f9fa', color: '#666' }
    ];
    
    return nutritionData.map(item => 
        `<div style="background: ${item.bg}; color: ${item.color}; font-weight: bold; padding: 8px; border-radius: 6px; text-align: center;">
            ${item.label}
        </div>`
    ).join('');
}

// Aggiungi questo alla fine del file pasti.js

// === ESPOSIZIONE GLOBALE DELLE FUNZIONI ===
// Esponi le funzioni principali a livello globale per renderle accessibili dal DOM
window.showPastiManagement = showPastiManagement;
window.openNewMealModal = openNewMealModal;
window.closeMealModal = closeMealModal;
window.addFoodToPresetMeal = addFoodToPresetMeal;
window.searchFoodsForPreset = searchFoodsForPreset;
window.selectFoodForPreset = selectFoodForPreset;
window.removePresetFood = removePresetFood;
window.savePresetMeal = savePresetMeal;
window.editPresetMeal = editPresetMeal;
window.duplicatePresetMeal = duplicatePresetMeal;
window.deletePresetMeal = deletePresetMeal;
window.updatePresetFoodCalculations = updatePresetFoodCalculations;
window.updatePresetMealTotals = updatePresetMealTotals;
window.updatePresetFoodFromSavedData = updatePresetFoodFromSavedData;
window.addAlternativeToPresetFood = addAlternativeToPresetFood;
window.hideAutocomplete = hideAutocomplete;
window.importPresetMeal = importPresetMeal;
window.showPresetMealsSelector = showPresetMealsSelector;
window.createNutritionPlaceholdersHTML = createNutritionPlaceholdersHTML;
window.extractNutritionalValue = extractNutritionalValue;