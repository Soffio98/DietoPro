// === APERTURA MODAL PIANIFICAZIONE ===
async function openWeeklyPlanner(dietId) {

    
    // Reset cache prima di iniziare
    resetPlanningCache();
    
    currentDietId = dietId;
    
    if (currentClient && currentClient.id) {
        currentClientId = currentClient.id;
    } else {

        showMessage('Errore: cliente non caricato correttamente', 'error');
        return;
    }
    
    const modal = document.getElementById('planning-modal');
    if (!modal) {

        return;
    }
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Reset UI
    const planningSection = document.getElementById('planning-section');
    if (planningSection) planningSection.style.display = 'none';
    
    // IMPORTANTE: Prima carica i dati dal database
    await loadPianificazioneFromDatabase(dietId);
    
    // POI carica la configurazione del lunedì (o del primo giorno)
    // Questo assicura che i checkbox riflettano i dati salvati
    const configDaySelector = document.getElementById('config-day-selector');
    if (configDaySelector) {
        configDaySelector.value = 'lunedi';
    }
    loadDayConfig('lunedi');
    
    // Aggiorna display
    updateMealsDisplay();
    updateMacroChart();
}

function closePlanningModal() {

    currentDietId = null;
    // Salva il giorno corrente prima di chiudere
    if (currentDay) {
        saveDayToCache(currentDay);
    }
    
    const modal = document.getElementById('planning-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
    
    // NON resettare qui - mantieni i dati finché non cambi cliente
}

// === NAVIGAZIONE PIANIFICAZIONE ===
function proceedToPlanning() {
    // Carica i limiti dei micronutrienti
    const microLimits = loadMicronutrientLimits();
    
    // Salva configurazione globale con i limiti
    planningConfig = {
        dietId: currentDietId,
        clientId: currentClientId,
        micronutrientLimits: microLimits,
        dailyConfigs: dailyConfigs  // Salva tutte le configurazioni giornaliere
    };
    
    const planningSection = document.getElementById('planning-section');
    if (planningSection) {
        planningSection.style.display = 'block';
        planningSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Mostra il giorno corrente
    showDayPlanning(currentDay || 'lunedi');
}

// === PIANIFICAZIONE GIORNI ===
function showDayPlanning(day) {

    
    // Salva il giorno corrente nella cache prima di cambiare
    if (currentDay && currentDay !== day) {
        saveDayToCache(currentDay);
    }
    
    currentDay = day;
    
    // Carica la configurazione specifica del giorno
    const dayConfig = dailyConfigs[day];
    
    // IMPORTANTE: Controlla se la configurazione è cambiata
    const oldMealNames = planningConfig.mealNames ? [...planningConfig.mealNames] : [];
    
    planningConfig.mealNames = dayConfig.selectedMeals;
    planningConfig.mealsCount = dayConfig.mealsCount;
    planningConfig.dailyKcal = dayConfig.dailyKcal;
    planningConfig.proteinPercent = dayConfig.proteinPercent;
    planningConfig.carbsPercent = dayConfig.carbsPercent;
    planningConfig.fatsPercent = dayConfig.fatsPercent;
    
    // Se i pasti sono cambiati, log per debug
    if (JSON.stringify(oldMealNames) !== JSON.stringify(dayConfig.selectedMeals)) {
    }
    
    // Aggiorna UI
    document.querySelectorAll('.day-tab').forEach(tab => tab.classList.remove('active'));
    const currentTab = document.querySelector(`[data-day="${day}"]`);
    if (currentTab) currentTab.classList.add('active');
    
    const dayNames = {
        lunedi: 'Lunedì', martedi: 'Martedì', mercoledi: 'Mercoledì',
        giovedi: 'Giovedì', venerdi: 'Venerdì', sabato: 'Sabato', domenica: 'Domenica'
    };
    
    const titleElement = document.getElementById('current-day-title');
    if (titleElement) titleElement.textContent = `📅 ${dayNames[day]}`;
    
    // Genera struttura vuota
    generateMealsForDay();
    
    // Carica dati dalla CACHE usando i nomi dei pasti
    loadDayFromCache(day);
}

// AGGIUNGI controllo anche in generateMealsForDay
function generateMealsForDay() {
    const container = document.getElementById('meals-planning');
    
    if (!container) {

        return;
    }
    
    if (!planningConfig.mealNames || !planningConfig.mealNames.length) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <p style="font-size: 1.2em; margin-bottom: 20px;">
                    ⚠️ Configurazione pasti non completata
                </p>
                <button class="btn btn-primary" onclick="backToConfig()">
                    ⬅️ Torna alla Configurazione
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    // Genera sezioni pasti
    planningConfig.mealNames.forEach((mealName, index) => {
        const mealDiv = document.createElement('div');
        mealDiv.className = 'meal-section';
        mealDiv.innerHTML = createMealSectionHTML(mealName, index);
        container.appendChild(mealDiv);
    });
    
    // Aggiungi totali giornalieri
    const dailyTotalDiv = document.createElement('div');
    dailyTotalDiv.innerHTML = createDailyTotalsHTML();
    container.appendChild(dailyTotalDiv);
    

}

// Rimappa i pasti quando cambia la configurazione
function remapMealsData(oldConfig, newConfig) {

    
    // Salva prima il giorno corrente
    if (currentDay) {
        saveDayToCache(currentDay);
    }
    
    // Crea una copia temporanea dei dati attuali
    const tempData = JSON.parse(JSON.stringify(weeklyPlanData));
    
    // Crea nuova struttura vuota
    const newWeeklyData = {
        lunedi: [], martedi: [], mercoledi: [], giovedi: [],
        venerdi: [], sabato: [], domenica: []
    };
    
    // Per ogni giorno
    Object.keys(tempData).forEach(giorno => {
        const dayData = tempData[giorno];
        if (!dayData || !Array.isArray(dayData)) {
            newWeeklyData[giorno] = [];
            return;
        }
        
        // Crea una mappa dei vecchi pasti per nome
        const oldMealsByName = {};
        dayData.forEach(meal => {
            if (meal && meal.mealName) {
                const normalizedName = normalizeMealName(meal.mealName);
                oldMealsByName[normalizedName] = meal;
            }
        });
        
        // Costruisci il nuovo array di pasti
        const newDayData = [];
        
        newConfig.mealNames.forEach((newMealName, newIndex) => {
            const normalizedNewName = normalizeMealName(newMealName);
            
            // Cerca se esistono dati per questo pasto
            const existingMeal = oldMealsByName[normalizedNewName];
            
            if (existingMeal && existingMeal.foods && existingMeal.foods.length > 0) {
                // Pasto trovato con dati - copialo con il nuovo indice
                newDayData.push({
                    mealName: newMealName,
                    mealIndex: newIndex,
                    foods: [...existingMeal.foods]
                });

            } else {
                // Pasto nuovo o vuoto - crea vuoto
                newDayData.push({
                    mealName: newMealName,
                    mealIndex: newIndex,
                    foods: []
                });
            }
        });
        
        newWeeklyData[giorno] = newDayData;
    });
    
    // Sostituisci completamente i dati
    weeklyPlanData = newWeeklyData;

}

function generateMealsForDay() {
    const container = document.getElementById('meals-planning');
    
    if (!container) {
  
        return;
    }
    
    if (!planningConfig.mealNames) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Errore: configurazione mancante</p>';
        return;
    }
    
    container.innerHTML = '';
    
    // Genera sezioni pasti
    planningConfig.mealNames.forEach((mealName, index) => {
        const mealDiv = document.createElement('div');
        mealDiv.className = 'meal-section';
        mealDiv.innerHTML = createMealSectionHTML(mealName, index);
        container.appendChild(mealDiv);
    });
    
    // Aggiungi totali giornalieri
    const dailyTotalDiv = document.createElement('div');
    dailyTotalDiv.innerHTML = createDailyTotalsHTML();
    container.appendChild(dailyTotalDiv);
}

// Aggiungi listener per aggiornare i limiti quando cambiano
document.addEventListener('DOMContentLoaded', function() {
    // Aggiungi listener ai campi dei limiti
    const microInputs = document.querySelectorAll('.micro-input');
    microInputs.forEach(input => {
        input.addEventListener('change', function() {
            loadMicronutrientLimits();
            calculateDailyTotals(); // Ricalcola con i nuovi limiti
        });
    });
});
