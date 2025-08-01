

function loadDayConfig(day) {

    const config = dailyConfigs[day];

    
    // Aggiorna UI
    document.getElementById('config-day-name').textContent = day.charAt(0).toUpperCase() + day.slice(1);
    document.getElementById('meals-day-name').textContent = day.charAt(0).toUpperCase() + day.slice(1);
    document.getElementById('daily-kcal').value = config.dailyKcal;
    document.getElementById('protein-slider').value = config.proteinPercent;
    document.getElementById('carbs-slider').value = config.carbsPercent;
    document.getElementById('fats-slider').value = config.fatsPercent;
    
    // IMPORTANTE: Mapping corretto dei nomi dei pasti ai checkbox
    const mealToCheckboxMap = {
        'Colazione': 'meal-colazione',
        'Spuntino': 'meal-spuntino-mattina',  // Mapping per retrocompatibilità
        'Spuntino Mattina': 'meal-spuntino-mattina',
        'Pranzo': 'meal-pranzo',
        'Merenda': 'meal-merenda',
        'Cena': 'meal-cena',
        'Spuntino Serale': 'meal-spuntino-serale',
        'Spuntino Ser.': 'meal-spuntino-serale'  // Mapping per retrocompatibilità
    };
    
    // Prima deseleziona tutti i checkbox
    Object.values(mealToCheckboxMap).forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.checked = false;
        }
    });
    
    // Poi seleziona solo quelli salvati nella configurazione
    if (config.selectedMeals && Array.isArray(config.selectedMeals)) {

        
        config.selectedMeals.forEach(meal => {
            const checkboxId = mealToCheckboxMap[meal];
            if (checkboxId) {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.checked = true;

                } else {

                }
            } else {

            }
        });
    }
    
    // Aggiorna il contatore
    const selectedCount = document.querySelectorAll('#meals-selector input[type="checkbox"]:checked').length;
    document.getElementById('selected-meals-count').textContent = selectedCount;
    
    updateMacroChart();
    updateMealsDisplay();
}

function updateDayConfig() {
    const currentDay = document.getElementById('config-day-selector').value;
    
    dailyConfigs[currentDay] = {
        ...dailyConfigs[currentDay],
        dailyKcal: parseInt(document.getElementById('daily-kcal').value) || 2000,
        proteinPercent: parseInt(document.getElementById('protein-slider').value) || 30,
        carbsPercent: parseInt(document.getElementById('carbs-slider').value) || 40,
        fatsPercent: parseInt(document.getElementById('fats-slider').value) || 30
    };
    
    // Marca il tab come configurato
    const dayTab = document.querySelector(`[data-day="${currentDay}"]`);
    if (dayTab) dayTab.classList.add('configured');
}

function updateSelectedMeals() {
    const currentDay = document.getElementById('config-day-selector').value;
    const selectedMeals = [];
    
    // Mapping per assicurare nomi consistenti
    const checkboxToMealMap = {
        'meal-colazione': 'Colazione',
        'meal-spuntino-mattina': 'Spuntino Mattina',
        'meal-pranzo': 'Pranzo',
        'meal-merenda': 'Merenda',
        'meal-cena': 'Cena',
        'meal-spuntino-serale': 'Spuntino Serale'
    };
    
    const checkboxes = document.querySelectorAll('#meals-selector input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
        const mealName = checkboxToMealMap[cb.id] || cb.value;
        selectedMeals.push(mealName);
    });
    

    
    dailyConfigs[currentDay].selectedMeals = selectedMeals;
    dailyConfigs[currentDay].mealsCount = selectedMeals.length;
    
    // Aggiorna contatore
    document.getElementById('selected-meals-count').textContent = selectedMeals.length;
    
    updateDayConfig();

    saveDayConfigToDatabase(currentDay);
}

function copyConfigToAllDays() {
    const currentDay = document.getElementById('config-day-selector').value;
    const currentConfig = dailyConfigs[currentDay];
    
    if (confirm(`Vuoi copiare la configurazione di ${currentDay} a tutti gli altri giorni?`)) {
        Object.keys(dailyConfigs).forEach(day => {
            if (day !== currentDay) {
                dailyConfigs[day] = JSON.parse(JSON.stringify(currentConfig));
            }
        });
        
        // Marca tutti i tabs come configurati
        document.querySelectorAll('.day-tab').forEach(tab => {
            tab.classList.add('configured');
        });
        
        showMessage('✅ Configurazione copiata a tutti i giorni!', 'success', 3000);
    }
}

// === MACRO CHART ===

// === MACRO CHART ===
// === MACRO CHART ===
function updateMacroChart() {
    const protein = parseInt(document.getElementById('protein-slider')?.value || 30);
    const carbs = parseInt(document.getElementById('carbs-slider')?.value || 40);
    const fats = parseInt(document.getElementById('fats-slider')?.value || 30);
    const dailyKcal = parseInt(document.getElementById('daily-kcal')?.value || 2000);
    
    // Calcola totale
    const total = protein + carbs + fats;
    
    // Mostra/nascondi avviso
    const warning = document.getElementById('macro-warning');
    if (warning) {
        if (total > 100) {
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    }
    
    // Aggiorna display dei valori
    document.getElementById('protein-value').textContent = protein;
    document.getElementById('carbs-value').textContent = carbs;
    document.getElementById('fats-value').textContent = fats;
    
    // IMPORTANTE: Ottieni il giorno corrente dal selettore
    const currentDaySelector = document.getElementById('config-day-selector');
    const currentConfigDay = currentDaySelector ? currentDaySelector.value : 'lunedi';
    
    // Se il totale è <= 100, aggiorna il grafico E la configurazione
    if (total <= 100) {
        // Aggiorna percentuali nel display
        document.getElementById('protein-kcal').textContent = protein;
        document.getElementById('carbs-kcal').textContent = carbs;
        document.getElementById('fats-kcal').textContent = fats;
        
        // IMPORTANTE: Aggiorna la configurazione giornaliera
        if (dailyConfigs[currentConfigDay]) {
            dailyConfigs[currentConfigDay].proteinPercent = protein;
            dailyConfigs[currentConfigDay].carbsPercent = carbs;
            dailyConfigs[currentConfigDay].fatsPercent = fats;
            dailyConfigs[currentConfigDay].dailyKcal = dailyKcal;
            
            
            // SALVA NEL DATABASE IMMEDIATAMENTE
            saveDayConfigToDatabase(currentConfigDay);
        }
        
        // Aggiorna grafico a torta
        const proteinDeg = (protein / 100) * 360;
        const carbsDeg = proteinDeg + (carbs / 100) * 360;
        
        const pieChart = document.getElementById('pie-chart');
        if (pieChart) {
            pieChart.style.setProperty('--protein-deg', proteinDeg + 'deg');
            pieChart.style.setProperty('--carbs-deg', carbsDeg + 'deg');
        }
        
        // Calcola calorie e grammi
        const macroCalories = {
            protein: Math.round((dailyKcal * protein) / 100),
            carbs: Math.round((dailyKcal * carbs) / 100),
            fats: Math.round((dailyKcal * fats) / 100)
        };
        
        const macroGrams = {
            protein: Math.round(macroCalories.protein / 4),
            carbs: Math.round(macroCalories.carbs / 4),
            fats: Math.round(macroCalories.fats / 9)
        };
        
        // Aggiorna display calorie e grammi
        document.getElementById('protein-kcal').textContent = macroCalories.protein;
        document.getElementById('carbs-kcal').textContent = macroCalories.carbs;
        document.getElementById('fats-kcal').textContent = macroCalories.fats;
        document.getElementById('protein-grams').textContent = macroGrams.protein + 'g';
        document.getElementById('carbs-grams').textContent = macroGrams.carbs + 'g';
        document.getElementById('fats-grams').textContent = macroGrams.fats + 'g';
    }
}
// === CONFIGURAZIONE PASTI === 
function updateMealsDisplay() {
    // Questa funzione ora mostra solo il riepilogo, non i checkbox
    // I checkbox sono gestiti da loadDayConfig
    
    const container = document.getElementById('meals-list');
    if (!container) return;
    
    // Ottieni la configurazione del giorno corrente dal selettore
    const currentDaySelector = document.getElementById('config-day-selector');
    const currentDay = currentDaySelector ? currentDaySelector.value : 'lunedi';
    const dayConfig = dailyConfigs[currentDay];
    
    container.innerHTML = '';
    
    // Mostra solo i pasti selezionati per il giorno corrente
    dayConfig.selectedMeals.forEach((mealName, i) => {
        const mealDiv = document.createElement('div');
        mealDiv.style.cssText = 'background: white; padding: 10px; border-radius: 8px; text-align: center; border: 2px solid #667eea;';
        mealDiv.innerHTML = `
            <div style="font-weight: bold; color: #333;">${i + 1}</div>
            <div style="font-size: 0.9em; color: #667eea;">${mealName}</div>
        `;
        container.appendChild(mealDiv);
    });
}

function getMealNames(mealsCount) {
    const mealConfigs = {
        3: ['Colazione', 'Pranzo', 'Cena'],
        4: ['Colazione', 'Spuntino', 'Pranzo', 'Cena'],
        5: ['Colazione', 'Spuntino', 'Pranzo', 'Spuntino', 'Cena'],
        6: ['Colazione', 'Spuntino', 'Pranzo', 'Spuntino', 'Cena', 'Spuntino']
    };
    
    return mealConfigs[mealsCount] || mealConfigs[3];
}

function showExistingPlanIndicator(dataAggiornamento) {
    const saveButton = document.getElementById('save-planning-btn');
    if (saveButton && dataAggiornamento) {
        const dataFormatted = new Date(dataAggiornamento).toLocaleDateString('it-IT');
        saveButton.innerHTML = `📝 Aggiorna Pianificazione (${dataFormatted})`;
        saveButton.style.background = 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)';
    }
}

// === AGGIUNGI QUESTA FUNZIONE PER DEBUG ===
function debugCheckboxes() {

    const checkboxes = document.querySelectorAll('#meals-selector input[type="checkbox"]');
    checkboxes.forEach(cb => {

    });

}

function updateUIFromPianificazione(pianificazione) {
    // ... codice esistente ...
    
    // Carica i limiti dei micronutrienti se salvati
    if (pianificazione.micronutrient_limits) {
        try {
            const limits = JSON.parse(pianificazione.micronutrient_limits);
            
            Object.keys(limits).forEach(nutrient => {
                const inputId = `limit-${nutrient.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = limits[nutrient];
                }
            });
            
            micronutrientLimits = limits;
        } catch (error) {

        }
    }
}