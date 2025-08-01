// === GESTIONE ALIMENTI ===

let searchTimeout

function addFoodToMeal(mealIndex, isAlternative = false) {

    
    const foodContainer = document.getElementById(`meal-${mealIndex}-foods`);
    if (!foodContainer) {

        return;
    }
    
    // Rimuovi placeholder se presente
    const placeholder = foodContainer.querySelector('p');
    if (placeholder) placeholder.remove();
    
    // Crea riga alimento
    const foodRow = document.createElement('div');
    foodRow.className = isAlternative ? 'food-item alternative' : 'food-item';
    foodRow.dataset.isAlternative = isAlternative.toString();
    
    const placeholderText = isAlternative ? 'Cerca alternativa...' : 'Cerca alimento...';
    
foodRow.innerHTML = `
    <div class="autocomplete-container">
        <input type="text" class="autocomplete-input" placeholder="${placeholderText}"
               oninput="searchFoods(this, ${mealIndex})" 
               onblur="hideAutocomplete(this)" 
               data-meal="${mealIndex}">
        <div class="autocomplete-dropdown hidden"></div>
    </div>
    <input type="number" min="1" disabled placeholder="gr">
    ${createNutritionPlaceholdersHTML()}
    <div class="food-actions">
        <button class="btn btn-danger" onclick="removeFoodAndRecalculate(this)" 
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

function addAlternativeFood(button, mealIndex) {
    const mainFoodItem = button.closest('.food-item');
    const foodContainer = document.getElementById(`meal-${mealIndex}-foods`);
    
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
                   oninput="searchFoods(this, ${mealIndex})" 
                   onblur="hideAutocomplete(this)" 
                   data-meal="${mealIndex}">
            <div class="autocomplete-dropdown hidden"></div>
        </div>
        <input type="number" min="1" disabled placeholder="gr">
        ${createNutritionPlaceholdersHTML()}
        <div class="food-actions">
            <button class="btn btn-danger" onclick="removeFoodAndRecalculate(this)" 
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
// === RICERCA ALIMENTI ===
async function searchFoods(input, mealIndex) {
    const query = input.value.trim();
    const dropdown = input.nextElementSibling;
    
    if (query.length < 2) {
        dropdown.classList.add('hidden');
        return;
    }
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            if (foodSearchCache[query]) {
                displayFoodResults(foodSearchCache[query], dropdown, input, mealIndex);
                return;
            }
            
            const foods = await apiCall(`/foods?search=${encodeURIComponent(query)}`);
            foodSearchCache[query] = foods;
            displayFoodResults(foods, dropdown, input, mealIndex);
            
        } catch (error) {

            dropdown.innerHTML = '<div class="autocomplete-item">Errore nella ricerca</div>';
            dropdown.classList.remove('hidden');
        }
    }, 300);
}

function displayFoodResults(foods, dropdown, input, mealIndex) {
    if (foods.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item">Nessun alimento trovato</div>';
    } else {
        dropdown.innerHTML = foods.map(food => {
            const foodData = {
                kcal: parseFloat(food.Kcal) || 0,
                proteine: parseFloat(food.Proteine) || 0,
                carboidrati: parseFloat(food.Carboidrati) || 0,
                grassi: parseFloat(food.Lipidi) || 0,
                sodio: parseFloat(food.Sodio) || 0,
                potassio: parseFloat(food.Potassio) || 0,
                calcio: parseFloat(food.Calcio) || 0,
                ferro: parseFloat(food.Ferro) || 0,
                vitaminaD: parseFloat(food.Vitamina_D) || 0,
                vitaminaA: parseFloat(food.Vitamia_A) || 0,
                vitaminaC: parseFloat(food.Vitamina_C) || 0,
                vitaminaB1: parseFloat(food.Vitamina_B1) || 0,
                vitaminaB12: parseFloat(food.Vitamina_B12) || 0,
                folati: parseFloat(food.Folati) || 0
            };
            
            return `
                <div class="autocomplete-item" 
                     data-food='${JSON.stringify(foodData)}'
                     onclick="selectFoodComplete('${food.ID}', '${food.Nome}', ${mealIndex}, this)">
                    <div class="food-name">${food.Nome}</div>
                    <div class="food-nutrition">
                        ${foodData.kcal} kcal | P: ${foodData.proteine}g | C: ${foodData.carboidrati}g | G: ${foodData.grassi}g (per 100g)
                    </div>
                </div>
            `;
        }).join('');
    }
    dropdown.classList.remove('hidden');
}

function selectFoodComplete(id, nome, mealIndex, element) {

    
    const foodItem = element.closest('.food-item');
    const isAlternative = foodItem.dataset.isAlternative === 'true';
    const quantityInput = foodItem.querySelector('input[type="number"]');
    const fullFoodData = JSON.parse(element.getAttribute('data-food'));
    
    // Sostituisci campo ricerca
    const autocompleteContainer = foodItem.querySelector('.autocomplete-container');
    const nameContainer = document.createElement('div');
    nameContainer.className = 'food-name-container';
    
    nameContainer.innerHTML = `
        <div class="food-name">${nome}</div>
    `;
    
    autocompleteContainer.replaceWith(nameContainer);
    
    // Abilita quantità
    quantityInput.disabled = false;
    quantityInput.value = 100;
    quantityInput.onchange = function() {
        updateAllFoodCalculations(this, fullFoodData, isAlternative);
    };
    
    // Calcolo iniziale
    updateAllFoodCalculations(quantityInput, fullFoodData, isAlternative);
    
    // Solo gli alimenti principali aggiornano i totali
    if (!isAlternative) {
        calculateMealTotals(mealIndex);
    }
}

function updateAllFoodCalculations(quantityInput, foodData, isAlternative = false) {
    const quantity = parseFloat(quantityInput.value) || 0;
    const foodItem = quantityInput.closest('.food-item');
    const factor = quantity / 100;
    const nome = foodItem.querySelector('.food-name')?.textContent || 'Alimento';
    
    const nutritionValues = [
        { value: foodData.kcal * factor, precision: 1, bg: '#ffe6e6', color: '#e74c3c', emoji: 'Kcal' },
        { value: foodData.proteine * factor, precision: 1, bg: '#fff4e6', color: '#e67e22', emoji: 'Prot', unit: 'g' },
        { value: foodData.carboidrati * factor, precision: 1, bg: '#fef9e7', color: '#f39c12', emoji: 'Carb', unit: 'g' },
        { value: foodData.grassi * factor, precision: 1, bg: '#e8f5e8', color: '#27ae60', emoji: 'Grassi', unit: 'g' },
        { value: foodData.sodio * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Sodio', unit: 'mg', small: true },
        { value: foodData.potassio * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Pot', unit: 'mg', small: true },
        { value: foodData.calcio * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Cal', unit: 'mg', small: true },
        { value: foodData.ferro * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'Fer', unit: 'mg', small: true },
        { value: foodData.vitaminaD * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'D', unit: 'μg', small: true },
        { value: foodData.vitaminaA * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'A', unit: 'μg', small: true },
        { value: foodData.vitaminaC * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'C', unit: 'mg', small: true },
        { value: foodData.vitaminaB1 * factor, precision: 2, bg: '#f8f9fa', color: '#666', emoji: 'B1', unit: 'mg', small: true },
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
    
    // Ottieni mealIndex dinamicamente
    const mealSection = foodItem.closest('.meal-section');
    const foodList = mealSection.querySelector('.food-list');
    const mealIndex = parseInt(foodList.id.split('-')[1]);
    
foodItem.innerHTML = `
    <div class="food-name-container">
        <div class="food-name">${nome}</div>
    </div>
    <input type="number" value="${quantity}" min="1" 
           onchange="updateAllFoodCalculations(this, ${JSON.stringify(foodData).replace(/"/g, '&quot;')}, ${isAlternative})">
    ${nutritionHTML}
    <div class="food-actions">
        ${!isAlternative ? `<button class="btn btn-secondary" onclick="addAlternativeFood(this, ${mealIndex})" 
                style="padding: 6px 10px; border-radius: 6px; font-size: 11px;">
            🔄 Alternativa
        </button>` : ''}
        <button class="btn btn-danger" onclick="removeFoodAndRecalculate(this)" 
                style="padding: 6px 10px; border-radius: 6px; font-size: 11px;">
            🗑️ Elimina
        </button>
    </div>
`;
    
    // Solo gli alimenti principali aggiornano i totali
    if (!isAlternative) {
        calculateMealTotals(mealIndex);
    }
}
function removeFoodAndRecalculate(button) {
    try {
        const foodItem = button.closest('.food-item');
        const mealSection = button.closest('.meal-section');
        
        if (!foodItem || !mealSection) {
  
            return;
        }
        
        const foodList = mealSection.querySelector('.food-list');
        const mealIndex = parseInt(foodList.id.split('-')[1]);

        
        foodItem.remove();
        calculateMealTotals(mealIndex);
        
        // Mostra placeholder se necessario
        const foodContainer = document.getElementById(`meal-${mealIndex}-foods`);
        if (foodContainer && !foodContainer.querySelector('.food-item')) {
            foodContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 20px; font-style: italic;">Clicca "Aggiungi Alimento" per iniziare a pianificare questo pasto</p>';
        }
        
 
        
    } catch (error) {

    }
}

// === CALCOLI TOTALI ===
function calculateMealTotals(mealIndex) {
    try {
        const foodContainer = document.getElementById(`meal-${mealIndex}-foods`);
        if (!foodContainer) return;
        
        // Solo alimenti principali (non alternative)
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
                const cells = foodItem.children; // Accesso diretto ai figli
                const nutritionData = [
                    { key: 'kcal', pos: 2, unit: 'kcal' },
                    { key: 'proteine', pos: 3, unit: 'g' },
                    { key: 'carboidrati', pos: 4, unit: 'g' },
                    { key: 'grassi', pos: 5, unit: 'g' },
                    { key: 'sodio', pos: 6, unit: 'mg' },
                    { key: 'potassio', pos: 7, unit: 'mg' },
                    { key: 'calcio', pos: 8, unit: 'mg' },
                    { key: 'ferro', pos: 9, unit: 'mg' },
                    { key: 'vitaminaD', pos: 10, unit: 'μg' },
                    { key: 'vitaminaA', pos: 11, unit: 'μg' },
                    { key: 'vitaminaC', pos: 12, unit: 'mg' },
                    { key: 'vitaminaB1', pos: 13, unit: 'mg' },
                    { key: 'vitaminaB12', pos: 14, unit: 'μg' },
                    { key: 'folati', pos: 15, unit: 'μg' }
                ];
                
                nutritionData.forEach(({ key, pos }) => {                  
                    if (cells[pos]) {
                        const raw1 = cells[pos].textContent;
                        let value;
                        if (key === 'vitaminaB1' || key === 'vitaminaB12') {
                            const match1 = raw1.match(/B\d+\s+([\d.]+)/);
                            const match2 = raw1.match(/(\d+\.?\d*)/);
                            value = match1 ? parseFloat(match1[1]) : (match2 ? parseFloat(match2[1]) : 0);
                        } else {
                            value = parseFloat(raw1.replace(/[^0-9.]/g, '')) || 0;
                        }
                        totals[key] = (parseFloat(totals[key]) || 0) + value;
                    }
                });
                
            } catch (error) {
      
            }
        });
        
        // Aggiorna display totali
        const totalMappings = [
            { key: 'kcal', id: 'kcal', precision: 1 },
            { key: 'proteine', id: 'proteine', precision: 1 },
            { key: 'carboidrati', id: 'carbo', precision: 1 },
            { key: 'grassi', id: 'grassi', precision: 1 },
            { key: 'sodio', id: 'sodio', precision: 2 },
            { key: 'potassio', id: 'potassio', precision: 2 },
            { key: 'calcio', id: 'calcio', precision: 2 },
            { key: 'ferro', id: 'ferro', precision: 2 },
            { key: 'vitaminaD', id: 'vitD', precision: 2 },
            { key: 'vitaminaA', id: 'vitA', precision: 2 },
            { key: 'vitaminaC', id: 'vitC', precision: 2 },
            { key: 'vitaminaB1', id: 'vitB1', precision: 2 },
            { key: 'vitaminaB12', id: 'vitB12', precision: 2 },
            { key: 'folati', id: 'folati', precision: 2 }
        ];
        
        totalMappings.forEach(({ key, id, precision }) => {
            const element = document.getElementById(`total-${id}-${mealIndex}`);
            if (element) {
                element.textContent = totals[key].toFixed(precision).replace('.', ',');
            }
        });

        calculateDailyTotals();
        
    } catch (error) {

    }
}

function calculateDailyTotals() {
    const dailyTotals = {
        kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
        sodio: 0, potassio: 0, calcio: 0, ferro: 0,
        vitaminaD: 0, vitaminaA: 0, vitaminaC: 0, vitaminaB1: 0,
        vitaminaB12: 0, folati: 0
    };
    
    // Somma totali di tutti i pasti - SOLO ALIMENTI PRINCIPALI
    planningConfig.mealNames.forEach((mealName, mealIndex) => {
        const foodContainer = document.getElementById(`meal-${mealIndex}-foods`);
        if (!foodContainer) return;
        
        // IMPORTANTE: Solo alimenti principali (non alternative)
        const mainFoodItems = foodContainer.querySelectorAll('.food-item:not(.alternative)');
        
        mainFoodItems.forEach(foodItem => {
            try {
                const cells = foodItem.children;
                const nutritionData = [
                    { key: 'kcal', pos: 2 }, { key: 'proteine', pos: 3 }, 
                    { key: 'carboidrati', pos: 4 }, { key: 'grassi', pos: 5 },
                    { key: 'sodio', pos: 6 }, { key: 'potassio', pos: 7 }, 
                    { key: 'calcio', pos: 8 }, { key: 'ferro', pos: 9 },
                    { key: 'vitaminaD', pos: 10 }, { key: 'vitaminaA', pos: 11 }, 
                    { key: 'vitaminaC', pos: 12 }, { key: 'vitaminaB1', pos: 13 },
                    { key: 'vitaminaB12', pos: 14 }, { key: 'folati', pos: 15 }
                ];
                
                nutritionData.forEach(({ key, pos }) => {                  
                    if (cells[pos]) {
                        const raw1 = cells[pos].textContent;
                        let value;
                        if (key === 'vitaminaB1' || key === 'vitaminaB12') {
                            // Prova diverse regex per capire il formato
                            const match1 = raw1.match(/B\d+\s+([\d.]+)/);  // "B1 0.160"
                            const match2 = raw1.match(/(\d+\.?\d*)/);      // primo numero
                            // Usa il match che funziona
                            value = match1 ? parseFloat(match1[1]) : (match2 ? parseFloat(match2[1]) : 0);
                        } else {
                            value = parseFloat(raw1.replace(/[^0-9.]/g, '')) || 0;
                        }
                        dailyTotals[key] = (parseFloat(dailyTotals[key]) || 0) + value;
                    }
                });
                
            } catch (error) {
 
            }
        });
    });
    
    // Aggiorna display totali giornalieri con controllo limiti
    const dailyMappings = [
        { key: 'kcal', precision: 1 }, 
        { key: 'proteine', precision: 1 },
        { key: 'carboidrati', id: 'carbo', precision: 1 }, 
        { key: 'grassi', precision: 1 },
        { key: 'sodio', precision: 2, limit: micronutrientLimits.sodio }, 
        { key: 'potassio', precision: 2, limit: micronutrientLimits.potassio },
        { key: 'calcio', precision: 2, limit: micronutrientLimits.calcio }, 
        { key: 'ferro', precision: 2, limit: micronutrientLimits.ferro },
        { key: 'vitaminaD', id: 'vitD', precision: 2, limit: micronutrientLimits.vitaminaD }, 
        { key: 'vitaminaA', id: 'vitA', precision: 2, limit: micronutrientLimits.vitaminaA },
        { key: 'vitaminaC', id: 'vitC', precision: 2, limit: micronutrientLimits.vitaminaC }, 
        { key: 'vitaminaB1', id: 'vitB1', precision: 2, limit: micronutrientLimits.vitaminaB1 },
        { key: 'vitaminaB12', id: 'vitB12', precision: 2, limit: micronutrientLimits.vitaminaB12 }, 
        { key: 'folati', precision: 2, limit: micronutrientLimits.folati }
    ];
    
    dailyMappings.forEach(({ key, id, precision, limit }) => {
        const elementId = id || key;
        const element = document.getElementById(`daily-total-${elementId}`);
        if (element) {
            const value = dailyTotals[key];
            element.textContent = value.toFixed(precision).replace('.', ',');
            
            // Controlla se supera il limite
            if (limit && value > limit) {
                element.classList.add('micro-exceeded');
                element.title = `Limite superato! Max: ${limit}`;
                
                // Aggiungi indicatore visivo
                if (!element.parentElement.querySelector('.limit-indicator')) {
                    const indicator = document.createElement('span');
                    indicator.className = 'limit-indicator exceeded';
                    indicator.textContent = `⚠️ >${limit}`;
                    element.parentElement.appendChild(indicator);
                }
            } else {
                element.classList.remove('micro-exceeded');
                element.title = '';
                
                // Rimuovi indicatore se presente
                const indicator = element.parentElement.querySelector('.limit-indicator');
                if (indicator) indicator.remove();
            }
        }
    });
}
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
function createMealSectionHTML(mealName, index) {
    return `
        <div class="meal-section">
            <div class="meal-header">
                <div class="meal-title">${mealName}</div>
                <div class="meal-totals-container">
                    <div class="meal-totals-header">
                        ${createMealTotalsHeaderHTML(index)}
                    </div>
                </div>
            </div>
            
            <div class="food-list" id="meal-${index}-foods">
                <p style="color: #999; text-align: center; font-style: italic;">
                    Clicca "Aggiungi Alimento" o "Importa Pasto" per iniziare
                </p>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button class="add-food-btn" onclick="addFoodToMeal(${index})" style="flex: 1;">
                    ➕ Aggiungi Alimento
                </button>
                <button class="btn btn-secondary" onclick="showPresetMealsSelector(${index})" style="flex: 1;">
                    📥 Importa Pasto Pre-fatto
                </button>
            </div>
        </div>
    `;
}

function createMealTotalsHeaderHTML(index) {
    const totals = [
        { emoji: 'Kcal', id: 'kcal', bg: '#ffe6e6', color: '#e74c3c' },
        { emoji: 'Prot', id: 'proteine', bg: '#fff4e6', color: '#e67e22', unit: 'g' },
        { emoji: 'Carb', id: 'carbo', bg: '#fef9e7', color: '#f39c12', unit: 'g' },
        { emoji: 'Grassi', id: 'grassi', bg: '#e8f5e8', color: '#27ae60', unit: 'g' },
        { emoji: 'Sale', id: 'sodio', bg: '#f8f9fa', color: '#666', unit: 'mg', small: true },
        { emoji: 'Pot', id: 'potassio', bg: '#f8f9fa', color: '#666', unit: 'mg', small: true },
        { emoji: 'Cal', id: 'calcio', bg: '#f8f9fa', color: '#666', unit: 'mg', small: true },
        { emoji: 'Fer', id: 'ferro', bg: '#f8f9fa', color: '#666', unit: 'mg', small: true },
        { emoji: 'D', id: 'vitD', bg: '#f8f9fa', color: '#666', unit: 'μg', small: true },
        { emoji: 'A', id: 'vitA', bg: '#f8f9fa', color: '#666', unit: 'μg', small: true },
        { emoji: 'C', id: 'vitC', bg: '#f8f9fa', color: '#666', unit: 'mg', small: true },
        { emoji: 'B1', id: 'vitB1', bg: '#f8f9fa', color: '#666', unit: 'mg', small: true },
        { emoji: 'B12', id: 'vitB12', bg: '#f8f9fa', color: '#666', unit: 'μg', small: true },
        { emoji: 'Fol', id: 'folati', bg: '#f8f9fa', color: '#666', unit: 'μg', small: true }
    ];
    
    return totals.map(total => {
        const fontSize = total.small ? '0.85em' : '1em';
        const padding = total.small ? '6px' : '8px';
        return `
            <div style="background: ${total.bg}; color: ${total.color}; font-weight: bold; padding: ${padding}; border-radius: 6px; font-size: ${fontSize};">
                ${total.emoji} <br> <span id="total-${total.id}-${index}">0</span>${total.unit || ''}
            </div>
        `;
    }).join('');
}

function createDailyTotalsHTML() {
    const totals = [
        { id: 'kcal', emoji: '🔥', label: 'Kcal', bg: 'rgba(255, 102, 102, 0.9)' },
        { id: 'proteine', emoji: '🥩', label: 'Proteine (g)', bg: 'rgba(255, 165, 0, 0.9)' },
        { id: 'carbo', emoji: '🍞', label: 'Carboidrati (g)', bg: 'rgba(255, 193, 7, 0.9)' },
        { id: 'grassi', emoji: '🥑', label: 'Grassi (g)', bg: 'rgba(40, 167, 69, 0.9)' },
        { id: 'sodio', emoji: '🧂', label: 'Sodio (mg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'potassio', emoji: '🍌', label: 'Potassio (mg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'calcio', emoji: '🦴', label: 'Calcio (mg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'ferro', emoji: '⚡', label: 'Ferro (mg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'vitD', emoji: '☀️', label: 'Vitam D (μg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'vitA', emoji: '🥕 ', label: 'Vitam A (μg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'vitC', emoji: '🍊', label: 'Vitam C (mg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'vitB1', emoji: '🌾', label: 'Vitam B1 (mg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'vitB12', emoji: '🧬', label: 'Vitam B12 (μg)', bg: 'rgba(108, 117, 125, 0.8)' },
        { id: 'folati', emoji: '🍃', label: 'Folati (μg)', bg: 'rgba(108, 117, 125, 0.8)' }
    ];
    
    const totalsHTML = totals.map(total => {
        const fontSize = ['kcal', 'proteine', 'carbo', 'grassi'].includes(total.id) ? '1.4em' : '1.2em';
        const labelSize = ['kcal', 'proteine', 'carbo', 'grassi'].includes(total.id) ? '0.9em' : '0.8em';
        
        return `
            <div style="background: ${total.bg}; padding: 12px; border-radius: 10px;">
                <div style="font-size: ${fontSize}; font-weight: bold;" id="daily-total-${total.id}">0</div>
                <div style="font-size: ${labelSize}; margin-top: 5px;">${total.emoji} ${total.label}</div>
            </div>
        `;
    }).join('');
    
    return `
        <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; border-radius: 15px; padding: 20px; margin: 30px 0; box-shadow: 0 8px 25px rgba(0,0,0,0.2);">
            <h3 style="text-align: center; margin-bottom: 20px; font-size: 1.3em;">📊 TOTALE GIORNALIERO</h3>
            <div style="display: grid; grid-template-columns: repeat(14, 1fr); gap: 15px; text-align: center;">
                ${totalsHTML}
            </div>
        </div>
    `;
}

function hideAutocomplete(input) {
    setTimeout(() => {
        const dropdown = input.nextElementSibling;
        if (dropdown) dropdown.classList.add('hidden');
    }, 200);
}

// === UTILITY FUNCTIONS ===
function extractNutritionalValue(foodItem, cellIndex, key = null) {
    try {
        const cell = foodItem.children[cellIndex];
        if (!cell) return 0;
        
        const raw1 = cell.textContent;
        let value;
        
        // Gestione speciale per vitamine B1 e B12
        if (key === 'vitaminaB1' || key === 'vitaminaB12') {
            // Prova diverse regex per capire il formato
            const match1 = raw1.match(/B\d+\s+([\d.]+)/);  // "B1 0.160"
            const match2 = raw1.match(/(\d+\.?\d*)/);      // primo numero
            
            // Usa il match che funziona
            value = match1 ? parseFloat(match1[1]) : (match2 ? parseFloat(match2[1]) : 0);
        } else {
            // Per tutti gli altri nutrienti
            value = parseFloat(raw1.replace(/[^0-9.]/g, '')) || 0;
        }
        
        return value;
        
    } catch (error) {

        return 0;
    }
}

function createFoodRowHTML(foodData, isAlternative = false) {
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
    
    // Ottieni il mealIndex dal contesto se possibile
    const mealIndex = foodData.mealIndex || 0;
    
    return `
        <div class="food-name-container">
            <div class="food-name">${foodData.nome}</div>
        </div>
        <input type="number" value="${foodData.quantita || 100}" min="1" 
               onchange="updateFoodFromSavedData(this, ${JSON.stringify(foodData).replace(/"/g, '&quot;')}, ${isAlternative})">
        ${nutritionHTML}
        <div class="food-actions">
            ${!isAlternative ? `<button class="btn btn-secondary" onclick="addAlternativeFood(this, ${mealIndex})" 
                    style="padding: 6px 10px; border-radius: 6px; font-size: 11px; margin-right: 5px;">
                🔄 Alternativa
            </button>` : ''}
            <button class="btn btn-danger" onclick="removeFoodAndRecalculate(this)" 
                    style="padding: 6px 10px; border-radius: 6px; font-size: 11px;">
                🗑️ Elimina
            </button>
        </div>
    `;
}

function updateFoodFromSavedData(quantityInput, originalFoodData) {
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
    
    // Riaggiorna la riga usando updateAllFoodCalculations
    updateAllFoodCalculations(quantityInput, updatedFoodData);
    

}