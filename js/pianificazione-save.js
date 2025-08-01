// === PIANIFICAZIONE-SAVE.JS - GESTIONE SALVATAGGIO PIANIFICAZIONI ===

const database = require("mime-db");

// === VARIABILI GLOBALI ===
let isSaving = false;



function collectCurrentDayData() {
    
    const dayData = [];
    
    if (!planningConfig.mealNames) {
        return dayData;
    }
    
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
    
    return dayData;
}
// === CONTROLLO PIANIFICAZIONE ESISTENTE ===
async function checkExistingAndConfirm() {
    try {
        const existing = await apiCall(`/pianificazioni/dieta/${currentDietId}/completa`);
        if (existing && existing.pianificazione) {
            return await showConfirmDialog(
                'Pianificazione Esistente',
                'Esiste già una pianificazione salvata per questa dieta. Vuoi sostituirla?',
                'Sostituisci',
                'Annulla'
            );
        }
        return true;
    } catch (error) {
        // Se è 404, va bene, significa che non esiste
        if (error.message.includes('404')) {
            return true;
        }
        throw error;
    }
}

// === CALCOLO TOTALI SETTIMANALI ===
function calculateWeeklyTotals() {
    const totali = {
        kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
        sodio: 0, potassio: 0, calcio: 0, ferro: 0,
        vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
        vitamina_b1: 0, vitamina_b12: 0, folati: 0
    };
    
    Object.values(weeklyPlanData).forEach(giornoData => {
        giornoData.forEach(mealData => {
            mealData.foods.forEach(food => {
                totali.kcal += food.kcal || 0;
                totali.proteine += food.proteine || 0;
                totali.carboidrati += food.carboidrati || 0;
                totali.grassi += food.grassi || 0;
                totali.sodio += food.sodio || 0;
                totali.potassio += food.potassio || 0;
                totali.calcio += food.calcio || 0;
                totali.ferro += food.ferro || 0;
                totali.vitamina_d += food.vitaminaD || 0;
                totali.vitamina_a += food.vitaminaA || 0;
                totali.vitamina_c += food.vitaminaC || 0;
                totali.vitamina_b1 += food.vitaminaB1 || 0;
                totali.vitamina_b12 += food.vitaminaB12 || 0;
                totali.folati += food.folati || 0;
            });
        });
    });
    
    return totali;
}

// === UI STATE MANAGEMENT ===
function updateSaveButtonState(isSaving) {
    const saveButton = document.querySelector('button[onclick*="savePianificazioneSettimanale"]') || 
                      document.getElementById('save-planning-btn');
    
    if (saveButton) {
        if (isSaving) {
            saveButton.disabled = true;
            saveButton.innerHTML = '⏳ Salvataggio...';
            saveButton.style.opacity = '0.6';
        } else {
            saveButton.disabled = false;
            saveButton.innerHTML = '💾 Salva Piano Settimanale';
            saveButton.style.opacity = '1';
        }
    }
}

function updateSaveButtonSuccess() {
    const saveButton = document.getElementById('save-planning-btn');
    if (saveButton) {
        saveButton.innerHTML = '📝 Pianificazione Salvata ✓';
        saveButton.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
    }
}

// === DIALOG CONFERMA ===
async function showConfirmDialog(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); z-index: 10001; display: flex;
            align-items: center; justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 15px; padding: 30px; max-width: 500px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
                <h3 style="margin-bottom: 20px; color: #333; font-size: 1.4em;">${title}</h3>
                <p style="margin-bottom: 30px; color: #666; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="confirm-btn" style="padding: 12px 24px; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: transform 0.2s;">
                        ${confirmText}
                    </button>
                    <button id="cancel-btn" style="padding: 12px 24px; background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: transform 0.2s;">
                        ${cancelText}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Aggiungi effetti hover
        const buttons = modal.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.onmouseenter = () => btn.style.transform = 'translateY(-2px)';
            btn.onmouseleave = () => btn.style.transform = 'translateY(0)';
        });
        
        modal.querySelector('#confirm-btn').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
        
        modal.querySelector('#cancel-btn').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(false);
            }
        };
        
        // Gestione tasto ESC
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEsc);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// === BANNER PIANIFICAZIONE ESISTENTE ===
function showExistingPlanBanner(dataSalvataggio) {
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) return;
    
    // Rimuovi banner esistente se presente
    const existingBanner = modalBody.querySelector('#existing-plan-banner');
    if (existingBanner) {
        existingBanner.remove();
    }
    
    const banner = document.createElement('div');
    banner.id = 'existing-plan-banner';
    banner.style.cssText = `
        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
        color: white; padding: 15px; border-radius: 10px; margin-bottom: 20px;
        text-align: center; font-weight: bold; position: relative;
        box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
        animation: slideInDown 0.3s ease-out;
    `;
    
    const dataFormatted = new Date(dataSalvataggio).toLocaleDateString('it-IT');
    const oraFormatted = new Date(dataSalvataggio).toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    banner.innerHTML = `
        ℹ️ Pianificazione esistente caricata
        <br>
        <small style="opacity: 0.9;">Salvata il ${dataFormatted} alle ${oraFormatted}</small>
        <button onclick="this.parentElement.remove()" 
                style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: white; font-size: 1.2em; cursor: pointer; opacity: 0.7; transition: opacity 0.3s;"
                onmouseover="this.style.opacity='1'" 
                onmouseout="this.style.opacity='0.7'">×</button>
    `;
    
    // Aggiungi animazione CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInDown {
            from {
                transform: translateY(-20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    modalBody.insertBefore(banner, modalBody.firstChild);
}

// === UTILITY FUNCTIONS ===
async function findAlimentoIdByName(nomeAlimento) {
    try {
        const response = await apiCall(`/foods/search-exact?nome=${encodeURIComponent(nomeAlimento)}`);
        return response.alimento?.ID || null;
    } catch (error) {
        return null;
    }
}

function displayPianificazioneSummary(pianificazione) {
    
    const totali = calculateWeeklyTotals();
    
    // Puoi estendere questa funzione per mostrare un summary più dettagliato
    const giorni = Object.keys(pianificazione.dati_settimanali || {}).filter(
        giorno => pianificazione.dati_settimanali[giorno].length > 0
    );
    

}

// === VALIDAZIONE DATI ===
function validatePlanningData() {
    if (!currentDietId) {
        throw new Error('ID dieta mancante');
    }
    
    if (!currentClientId) {
        throw new Error('ID cliente mancante');
    }
    
    if (!planningConfig || !planningConfig.mealsCount) {
        throw new Error('Configurazione pianificazione mancante');
    }
    
    const hasValidData = Object.values(weeklyPlanData).some(dayData => 
        dayData && dayData.length > 0 && dayData.some(meal => 
            meal.foods && meal.foods.length > 0
        )
    );
    
    if (!hasValidData) {
        throw new Error('Nessun dato valido da salvare');
    }
    
    return true;
}

// === EXPORT FUNCTIONS (se necessario) ===
function exportPlanningToJSON() {
    try {
        validatePlanningData();
        
        const exportData = {
            dieta_id: currentDietId,
            configurazione: planningConfig,
            dati_settimanali: weeklyPlanData,
            totali_settimanali: calculateWeeklyTotals(),
            exported_at: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pianificazione_dieta_${currentDietId}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('📁 Pianificazione esportata con successo!', 'success');
        
    } catch (error) {
        showMessage('Errore nell\'esportazione: ' + error.message, 'error');
    }
}

