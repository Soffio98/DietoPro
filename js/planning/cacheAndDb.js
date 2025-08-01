// === CARICAMENTO PIANIFICAZIONE ESISTENTE ===
async function loadPianificazioneFromDatabase(currentDietId) {

    console.log(currentDietId)
    try {

        const response = await apiCall(`/pianificazioni/dieta/${currentDietId}/completa`);
        
        if (response && response.pianificazione) {
            const pianificazione = response.pianificazione;

            
            // Verifica appartenenza al cliente
            if (pianificazione.cliente_id !== currentClientId) {

                return;
            }
            
            // CARICA DATI DAL DB NELLA CACHE
            if (pianificazione.dati_settimanali) {
                weeklyPlanData = JSON.parse(JSON.stringify(pianificazione.dati_settimanali));

            }
            
            // IMPORTANTE: Carica configurazioni giornaliere se salvate
            if (pianificazione.configurazioni_giornaliere) {

                dailyConfigs = JSON.parse(JSON.stringify(pianificazione.configurazioni_giornaliere));
                
                // Marca i giorni configurati
                Object.keys(dailyConfigs).forEach(day => {
                    const dayTab = document.querySelector(`[data-day="${day}"]`);
                    if (dayTab && dailyConfigs[day].mealsCount > 0) {
                        dayTab.classList.add('configured');
                    }
                });
            } else {

                
                // FALLBACK: Se non ci sono configurazioni giornaliere ma ci sono dati settimanali,
                // prova a ricostruire le configurazioni dai dati
                if (weeklyPlanData) {
 
                    Object.keys(weeklyPlanData).forEach(giorno => {
                        const dayData = weeklyPlanData[giorno];
                        if (dayData && dayData.length > 0) {
                            // Estrai i nomi dei pasti unici
                            const mealNames = [...new Set(dayData.map(meal => meal.mealName))];
 
                            
                            // Aggiorna la configurazione del giorno
                            dailyConfigs[giorno] = {
                                ...dailyConfigs[giorno],
                                mealsCount: mealNames.length,
                                selectedMeals: mealNames
                            };
                            
                            // Se ci sono informazioni su calorie/macro dal primo giorno con dati
                            if (pianificazione.calorie_target_giorno) {
                                dailyConfigs[giorno].dailyKcal = pianificazione.calorie_target_giorno;
                            }
                            if (pianificazione.percentuale_proteine) {
                                dailyConfigs[giorno].proteinPercent = pianificazione.percentuale_proteine;
                            }
                            if (pianificazione.percentuale_carboidrati) {
                                dailyConfigs[giorno].carbsPercent = pianificazione.percentuale_carboidrati;
                            }
                            if (pianificazione.percentuale_grassi) {
                                dailyConfigs[giorno].fatsPercent = pianificazione.percentuale_grassi;
                            }
                        }
                    });
                }
            }
            
            // Carica configurazione globale
            planningConfig = {
                dietId: currentDietId,
                clientId: currentClientId,
                micronutrientLimits: pianificazione.limiti_micronutrienti || {},
                dailyConfigs: dailyConfigs
            };
            
            // IMPORTANTE: Aggiorna i limiti globali
            if (pianificazione.limiti_micronutrienti) {
                micronutrientLimits = pianificazione.limiti_micronutrienti;
                
                // Aggiorna i campi input con i valori salvati
                Object.keys(micronutrientLimits).forEach(nutrient => {
                    let inputId = 'limit-' + nutrient;
                    
                    // Gestisci nomi speciali
                    if (nutrient === 'vitaminaD') inputId = 'limit-vitamina-d';
                    if (nutrient === 'vitaminaA') inputId = 'limit-vitamina-a';
                    if (nutrient === 'vitaminaC') inputId = 'limit-vitamina-c';
                    if (nutrient === 'vitaminaB1') inputId = 'limit-vitamina-b1';
                    if (nutrient === 'vitaminaB12') inputId = 'limit-vitamina-b12';
                    
                    const input = document.getElementById(inputId);
                    if (input) {
                        input.value = micronutrientLimits[nutrient];
                    }
                });
            }
            
            updateUIFromPianificazione(pianificazione);
            updateMealsDisplay();
            

            showMessage('📋 Pianificazione esistente caricata', 'info', 3000);
        } else {

        }
        
    } catch (error) {
    }
}

// === SALVA CONFIGURAZIONE GIORNO NEL DATABASE ===
async function saveDayConfigToDatabase(day) {
    try {
        const dayConfig = dailyConfigs[day];
        
        if (!dayConfig || !currentDietId) {

            return;
        }
        
        const configData = {
            dieta_id: currentDietId,
            giorno: day,
            calorie_target: dayConfig.dailyKcal,
            percentuale_proteine: dayConfig.proteinPercent,
            percentuale_carboidrati: dayConfig.carbsPercent,
            percentuale_grassi: dayConfig.fatsPercent,
            pasti_configurati: dayConfig.selectedMeals
        };

    
        
    } catch (error) {

    }
}

async function loadDayDataFromDB(day) {
    try {

        
        // Carica l'intera pianificazione dal DB
        const response = await apiCall(`/pianificazioni/dieta/${currentDietId}/completa`);
        
        if (!response || !response.pianificazione) {

            return [];
        }
        
        const pianificazione = response.pianificazione;
        
        // Verifica che appartenga al cliente corrente
        if (pianificazione.cliente_id !== currentClientId) {

            return [];
        }
        
        // Estrai i dati del giorno specifico
        const dayData = pianificazione.dati_settimanali[day] || [];

        
        return dayData;
        
    } catch (error) {
        // Se è un 404, è normale - significa che non esiste ancora una pianificazione
        if (error.message && error.message.includes('404')) {
            return [];
        }
        
        // Altri errori vanno segnalati

        return [];
    }
}

async function savePianificazioneSettimanale() {
    if (!currentDietId || !currentClientId) {
        showMessage('Errore: dati mancanti', 'error');
        return;
    }
    
    try {
        
        const saveButton = document.getElementById('save-planning-btn');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '⏳ Salvataggio in corso...';
        }
        
        // Salva il giorno corrente nella cache
        saveDayToCache(currentDay);
        
        // Verifica che ci siano dati
        const hasData = Object.values(weeklyPlanData).some(dayData => dayData.length > 0);
        if (!hasData) {
            showMessage('⚠️ Nessun dato da salvare!', 'warning');
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = '💾 Salva Piano Settimanale';
            }
            return;
        }
        
        // Prepara dati per il DB
        const dataToSave = {
            dieta_id: currentDietId,
            cliente_id: currentClientId,
            dati_settimanali: weeklyPlanData,
            limiti_micronutrienti: micronutrientLimits,
            configurazioni_giornaliere: dailyConfigs,
            configurazione: {
                mealsCount: planningConfig.mealsCount || 3,
                dailyKcal: planningConfig.dailyKcal || 2000,
                proteinPercent: planningConfig.proteinPercent || 30,
                carbsPercent: planningConfig.carbsPercent || 40,
                fatsPercent: planningConfig.fatsPercent || 30,
                micronutrientLimits: micronutrientLimits
            }
        };

        
        // Salva nel DB
        await apiCall('/pianificazioni', {
            method: 'POST',
            body: JSON.stringify(dataToSave)
        });
        
        showMessage('✅ Pianificazione salvata nel database!', 'success');
        
        // PULISCI LA CACHE DOPO IL SALVATAGGIO
        
        // Ricarica dal DB per conferma
        await loadPianificazioneFromDatabase(currentDietId);
        
        // Aggiorna UI
        if (saveButton) {
            saveButton.innerHTML = '✅ Salvato!';
            saveButton.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
            
            setTimeout(() => {
                saveButton.disabled = false;
                saveButton.innerHTML = '💾 Salva Piano Settimanale';
                saveButton.style.background = '';
            }, 3000);
        }
        
    } catch (error) {
        
        
        const saveButton = document.getElementById('save-planning-btn');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '💾 Salva Piano Settimanale';
        }
    }
}

// Aggiungi questa funzione in cacheAndDb.js prima della funzione saveDayToCache

function extractFoodDataFromItem(foodItem) {
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

        return null;
    }
}

// Aggiungi anche questa funzione helper se non esiste già in cacheAndDb.js
function extractNutritionalValue(foodItem, cellIndex, key = null) {
    try {
        const cell = foodItem.children[cellIndex];
        if (!cell) return 0;
        
        const rawText = cell.textContent;
        let value;
        
        // Gestione speciale per vitamine B1 e B12
        if (key === 'vitaminaB1' || key === 'vitaminaB12') {
            // Prova diverse regex per capire il formato
            const match1 = rawText.match(/B\d+\s+([\d.]+)/);  // "B1 0.160"
            const match2 = rawText.match(/(\d+\.?\d*)/);      // primo numero
            
            // Usa il match che funziona
            value = match1 ? parseFloat(match1[1]) : (match2 ? parseFloat(match2[1]) : 0);
        } else {
            // Per tutti gli altri nutrienti
            value = parseFloat(rawText.replace(/[^0-9.]/g, '')) || 0;
        }
        
        return value;
        
    } catch (error) {

        return 0;
    }
}

// === SALVA GIORNO CORRENTE NELLA CACHE ===
function saveDayToCache(day) {
    if (!planningConfig.mealNames || !planningConfig.mealNames.length) {
        console.warn('⚠️ Nessun pasto configurato');
        return;
    }
    
    const dayData = [];
    
    planningConfig.mealNames.forEach((mealName, mealIndex) => {
        const foodContainer = document.getElementById(`meal-${mealIndex}-foods`);
        if (!foodContainer) {
            console.warn(`⚠️ Container non trovato per pasto ${mealIndex}`);
            return;
        }
        
        const mealData = {
            mealName: mealName,
            mealIndex: mealIndex,
            foods: [],
            alternatives: []
        };
        
        // Raccogli TUTTI gli alimenti con il loro ordine globale
        const allFoodItems = foodContainer.querySelectorAll('.food-item');
        let globalOrder = 0;
        
        allFoodItems.forEach((foodItem) => {
            try {
                const foodData = extractFoodDataFromItem(foodItem);
                if (foodData) {
                    // IMPORTANTE: Aggiungi l'ordine globale
                    foodData.globalOrder = globalOrder++;
                    
                    if (foodItem.classList.contains('alternative')) {
                        mealData.alternatives.push(foodData);
                        console.log(`  [${foodData.globalOrder}] 🔄 Alternativa: ${foodData.nome}`);
                    } else {
                        mealData.foods.push(foodData);
                        console.log(`  [${foodData.globalOrder}] ✅ Principale: ${foodData.nome}`);
                    }
                }
            } catch (error) {
                console.error('❌ Errore raccolta dati alimento:', error);
            }
        });
        
        dayData.push(mealData);
    });
    
    weeklyPlanData[day] = dayData;
    
    // DEBUG: Verifica che globalOrder sia salvato
    console.log('📊 Dati salvati con globalOrder:', weeklyPlanData[day]);
}

// === CARICA GIORNO DALLA CACHE ===
// === CARICA GIORNO DALLA CACHE ===
function loadDayFromCache(day) {
    const dayData = weeklyPlanData[day] || [];
    
    if (dayData.length === 0) {
        console.log('ℹ️ Nessun dato in cache per questo giorno');
        return;
    }
    
    // Crea una mappa nome pasto -> indice attuale
    const currentMealIndexMap = {};
    planningConfig.mealNames.forEach((mealName, index) => {
        currentMealIndexMap[mealName] = index;
    });
    
    console.log('🗺️ Mappa pasti attuali:', currentMealIndexMap);
    
    dayData.forEach(mealData => {
        const currentMealIndex = currentMealIndexMap[mealData.mealName];
        
        if (currentMealIndex === undefined) {
            console.warn(`⚠️ Pasto "${mealData.mealName}" non più presente nella configurazione`);
            return;
        }
        
        console.log(`📍 Carico pasto "${mealData.mealName}" nell'indice ${currentMealIndex}`);
        
        const foodContainer = document.getElementById(`meal-${currentMealIndex}-foods`);
        if (!foodContainer) {
            console.error(`❌ Container non trovato per meal-${currentMealIndex}-foods`);
            return;
        }
        
        // Rimuovi placeholder
        const placeholder = foodContainer.querySelector('p');
        if (placeholder) placeholder.remove();
        
        // Combina foods e alternatives mantenendo l'ordine globale
        const allItems = [];
        
        // Aggiungi alimenti principali con il loro ordine
        mealData.foods.forEach(food => {
            allItems.push({
                ...food,
                isAlternative: false,
                order: food.globalOrder !== undefined ? food.globalOrder : 999
            });
        });
        
        // Aggiungi alternative con il loro ordine
        if (mealData.alternatives && mealData.alternatives.length > 0) {
            mealData.alternatives.forEach(alt => {
                allItems.push({
                    ...alt,
                    isAlternative: true,
                    order: alt.globalOrder !== undefined ? alt.globalOrder : 999
                });
            });
        }
        
        // Ordina per globalOrder
        allItems.sort((a, b) => a.order - b.order);
        
        console.log(`📊 Alimenti ordinati per ${mealData.mealName}:`, allItems.map(item => `[${item.order}] ${item.nome}`));
        
        // Aggiungi gli elementi nell'ordine corretto
        allItems.forEach(item => {
            const foodRow = document.createElement('div');
            foodRow.className = item.isAlternative ? 'food-item alternative' : 'food-item';
            foodRow.dataset.isAlternative = item.isAlternative ? 'true' : 'false';
            foodRow.innerHTML = createFoodRowHTML(item, item.isAlternative);
            foodContainer.appendChild(foodRow);
            console.log(`  ${item.isAlternative ? '🔄' : '✅'} Aggiunto: ${item.nome}`);
        });
        
        calculateMealTotals(currentMealIndex);
    });
}

async function saveDayData(day) {

    
    // Raccogli i dati del giorno corrente dall'interfaccia
    const dayData = [];
    
    planningConfig.mealNames.forEach((mealName, mealIndex) => {
        const foodContainer = document.getElementById(`meal-${mealIndex}-foods`);
        if (!foodContainer) return;
        
        const foodItems = foodContainer.querySelectorAll('.food-item');
        const mealData = {
            mealName: mealName,
            mealIndex: mealIndex,
            foods: []
        };
        
        foodItems.forEach(foodItem => {
            try {
                const foodNameElement = foodItem.querySelector('.food-name');
                const quantityInput = foodItem.querySelector('input[type="number"]');
                
                if (foodNameElement && quantityInput) {
                    const nutritionPositions = [
                        'kcal', 'proteine', 'carboidrati', 'grassi', 'sodio', 'potassio',
                        'calcio', 'ferro', 'vitaminaD', 'vitaminaA', 'vitaminaC', 
                        'vitaminaB1', 'vitaminaB12', 'folati'
                    ];
                    
                    const foodData = {
                        nome: foodNameElement.textContent,
                        quantita: parseFloat(quantityInput.value) || 100
                    };
                    
                    // Estrai valori nutrizionali
                    nutritionPositions.forEach((nutrient, index) => {
                        foodData[nutrient] = extractNutritionalValue(foodItem, index + 2);

                    });
                    
                    mealData.foods.push(foodData);
                }
            } catch (error) {

            }
        });
        
        if (mealData.foods.length > 0) {
            dayData.push(mealData);
        }
    });
    
    // Salva nel database tramite API temporanea
    try {
        await apiCall('/pianificazioni/aggiorna-giorno', {
            method: 'POST',
            body: JSON.stringify({
                dieta_id: currentDietId,
                cliente_id: currentClientId,
                giorno: day,
                dati_giorno: dayData
            })
        });
        
    
    } catch (error) {

        // In caso di errore, mantieni i dati localmente per non perderli
        if (!window.tempDayStorage) window.tempDayStorage = {};
        window.tempDayStorage[day] = dayData;
    }
}

// Aggiungi anche questa funzione se manca
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
    updateAllFoodCalculations(quantityInput, updatedFoodData, false);
    

}

function displayDayData(dayData) {

    
    if (!dayData || dayData.length === 0) {

        return;
    }
    
    dayData.forEach(mealData => {
        const foodContainer = document.getElementById(`meal-${mealData.mealIndex}-foods`);
        if (!foodContainer) {

            return;
        }
        
        // Rimuovi placeholder
        const placeholder = foodContainer.querySelector('p');
        if (placeholder) placeholder.remove();
        
        // Aggiungi ogni alimento
        mealData.foods.forEach(foodData => {
            const foodRow = document.createElement('div');
            foodRow.className = 'food-item';
            foodRow.innerHTML = createFoodRowHTML(foodData);
            foodContainer.appendChild(foodRow);
        });
        
        // Calcola totali
        calculateMealTotals(mealData.mealIndex);
    });
}

function cleanExtraMealsFromCache() {
    const maxMeals = planningConfig.mealsCount || 3;
    
    Object.keys(weeklyPlanData).forEach(giorno => {
        if (weeklyPlanData[giorno] && Array.isArray(weeklyPlanData[giorno])) {
            // Filtra solo i pasti con indice < maxMeals
            weeklyPlanData[giorno] = weeklyPlanData[giorno].filter(meal => 
                meal.mealIndex < maxMeals
            );
        }
    });
    
}




