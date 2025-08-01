// === PLANNING.JS - PIANIFICAZIONE SETTIMANALE ===

// === VARIABILI GLOBALI ===
let currentDietId = null;
let currentClientId = null;
let planningConfig = {};
let currentDay = 'lunedi';
let foodSearchCache = {};

// Cache locale per le modifiche temporanee
let weeklyPlanData = {
    lunedi: [], martedi: [], mercoledi: [], giovedi: [],
    venerdi: [], sabato: [], domenica: []
};

const MEAL_NAMES_MAP = {
    'Colazione': 'Colazione',
    'Spuntino': 'Spuntino',
    'Spuntino Mattina': 'Spuntino',
    'Pranzo': 'Pranzo',
    'Merenda': 'Merenda',
    'Cena': 'Cena',
    'Spuntino Ser.': 'Spuntino Serale',
    'Spuntino Serale': 'Spuntino Serale'
};

// Oggetto per memorizzare i limiti dei micronutrienti
let micronutrientLimits = {
    sodio: 2300,      // mg
    potassio: 3500,   // mg
    calcio: 1000,     // mg
    ferro: 18,        // mg
    vitaminaD: 15,    // μg
    vitaminaA: 900,   // μg
    vitaminaC: 90,    // mg
    vitaminaB1: 1.2,  // mg
    vitaminaB12: 2.4, // μg
    folati: 400       // μg
};

let dailyConfigs = {
    lunedi: { mealsCount: 6, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
    martedi: { mealsCount: 6, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
    mercoledi: { mealsCount: 6, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
    giovedi: { mealsCount: 6, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
    venerdi: { mealsCount: 6, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
    sabato: { mealsCount: 6, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
    domenica: { mealsCount: 6, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] }
};

// === RESET CACHE - Da chiamare quando esci dal cliente ===
function resetPlanningCache() {
    // Reset tutte le variabili
    //currentDietId = null;
    currentClientId = null;
    planningConfig = {};
    currentDay = 'lunedi';
    foodSearchCache = {};
    
    // RESET CACHE
    weeklyPlanData = {
        lunedi: [], martedi: [], mercoledi: [], giovedi: [],
        venerdi: [], sabato: [], domenica: []
    };
    
    // RESET CONFIGURAZIONI GIORNALIERE
    dailyConfigs = {
        lunedi: { mealsCount: 3, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
        martedi: { mealsCount: 3, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
        mercoledi: { mealsCount: 3, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
        giovedi: { mealsCount: 3, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
        venerdi: { mealsCount: 3, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
        sabato: { mealsCount: 3, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] },
        domenica: { mealsCount: 3, dailyKcal: 2000, proteinPercent: 30, carbsPercent: 40, fatsPercent: 30, selectedMeals: ['Colazione', 'Pranzo', 'Cena'] }
    };
}

function resetPlanningState() {

    
    // Reset variabili globali
    currentDietId = null;
    currentClientId = null;
    planningConfig = {};
    currentDay = 'lunedi';
    foodSearchCache = {};
    
    // Reset UI
    const planningSection = document.getElementById('planning-section');
    if (planningSection) {
        planningSection.style.display = 'none';
    }
    
    // Reset form configurazione
    const mealsCount = document.getElementById('meals-count');
    if (mealsCount) mealsCount.value = '3';
    
    const dailyKcal = document.getElementById('daily-kcal');
    if (dailyKcal) dailyKcal.value = '2000';
    
    // Reset sliders
    const sliders = [
        { id: 'protein-slider', value: 30 },
        { id: 'carbs-slider', value: 40 },
        { id: 'fats-slider', value: 30 }
    ];
    
    sliders.forEach(slider => {
        const element = document.getElementById(slider.id);
        if (element) element.value = slider.value;
    });
    
    // Reset tabs
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const luneTab = document.querySelector('[data-day="lunedi"]');
    if (luneTab) luneTab.classList.add('active');
    

}

function normalizeMealName(name) {
    return MEAL_NAMES_MAP[name] || name;
}

// Carica i limiti dei micronutrienti dall'interfaccia
function loadMicronutrientLimits() {
    const limits = {
        sodio: parseFloat(document.getElementById('limit-sodio')?.value) || 2300,
        potassio: parseFloat(document.getElementById('limit-potassio')?.value) || 3500,
        calcio: parseFloat(document.getElementById('limit-calcio')?.value) || 1000,
        ferro: parseFloat(document.getElementById('limit-ferro')?.value) || 18,
        vitaminaD: parseFloat(document.getElementById('limit-vitamina-d')?.value) || 15,
        vitaminaA: parseFloat(document.getElementById('limit-vitamina-a')?.value) || 900,
        vitaminaC: parseFloat(document.getElementById('limit-vitamina-c')?.value) || 90,
        vitaminaB1: parseFloat(document.getElementById('limit-vitamina-b1')?.value) || 1.2,
        vitaminaB12: parseFloat(document.getElementById('limit-vitamina-b12')?.value) || 2.4,
        folati: parseFloat(document.getElementById('limit-folati')?.value) || 400
    };
    
    micronutrientLimits = limits;

    
    // Salva nella configurazione
    if (planningConfig) {
        planningConfig.micronutrientLimits = limits;
    }
    
    return limits;
}

function normalizeMealName(name) {
    return MEAL_NAMES_MAP[name] || name;
}

