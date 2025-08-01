const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3005;

// === MIDDLEWARE ===
app.use(cors());
// Aumenta il limite per supportare immagini Base64 (50MB dovrebbe bastare)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));


// === CONFIGURAZIONE DATABASE ===
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'dietapp_db',
  charset: 'utf8mb4'
};

let connection;

//#region INIZIALIZZAZIONE DB
// === INIZIALIZZAZIONE DATABASE ===
async function initDatabase() {
  try {
    console.log('🔄 Connessione a MySQL...');
    
    // Connetti senza database per crearlo
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await tempConnection.end();

    // Connetti al database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connesso a MySQL!');
    console.log(`📊 Database: ${dbConfig.database}`);
    
    // Test connessione
    const [result] = await connection.execute('SELECT 1 + 1 as test');
    console.log('🧪 Test connessione OK');

  } catch (error) {
    console.error('❌ Errore connessione database:', error.message);
    console.error('💡 Verifica:');
    console.error('   - MySQL è in esecuzione?');
    console.error('   - Credenziali corrette?');
    process.exit(1);
  }
}
//#endregion

//#region UTILITY FUNCTIONS
// === UTILITY FUNCTIONS ===
function calculateBMI(peso, altezza) {
  return Math.round((peso / Math.pow(altezza / 100, 2)) * 10) / 10;
}

function getBMICategory(bmi) {
  if (bmi < 18.5) return 'Sottopeso';
  if (bmi <= 24.9) return 'Normale';
  if (bmi <= 29.9) return 'Sovrappeso';
  return 'Obesità';
}
//#endregion




// === API ROUTES ===

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const [result] = await connection.execute('SELECT NOW() as current_time');
    res.json({ 
      status: 'OK', 
      database: 'connected',
      server_time: result[0].current_time 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'disconnected',
      error: error.message 
    });
  }
});


//#region API CLIENTS
// === CLIENTI API ===

// GET /api/clients - Ottieni tutti i clienti
app.get('/api/clients', async (req, res) => {
  try {
    const [clients] = await connection.execute(`
      SELECT 
        c.id, c.nome, c.cognome,
        CONCAT(c.nome, ' ', c.cognome) as nome_completo,
        c.peso, c.altezza,
        ROUND(c.peso / POWER(c.altezza/100, 2), 1) as bmi,
        CASE 
          WHEN ROUND(c.peso / POWER(c.altezza/100, 2), 1) < 18.5 THEN 'Sottopeso'
          WHEN ROUND(c.peso / POWER(c.altezza/100, 2), 1) BETWEEN 18.5 AND 24.9 THEN 'Normale'
          WHEN ROUND(c.peso / POWER(c.altezza/100, 2), 1) BETWEEN 25.0 AND 29.9 THEN 'Sovrappeso'
          ELSE 'Obesità'
        END as categoria_bmi,
        COALESCE(ar_count.num_riquadri, 0) as num_riquadri_anamnesi,
        c.data_nascita, c.telefono, c.email, c.note_generali,
        c.created_at as data_creazione,
        c.updated_at as ultimo_aggiornamento
      FROM clienti c
      LEFT JOIN (
        SELECT cliente_id, COUNT(*) as num_riquadri 
        FROM anamnesi_riquadri 
        GROUP BY cliente_id
      ) ar_count ON c.id = ar_count.cliente_id
      ORDER BY c.updated_at DESC
    `);

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clients/:id - Ottieni dettagli cliente
app.get('/api/clients/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [clients] = await connection.execute(`
      SELECT 
        c.*,
        CONCAT(c.nome, ' ', c.cognome) as nome_completo,
        ROUND(c.peso / POWER(c.altezza/100, 2), 1) as bmi
      FROM clienti c 
      WHERE c.id = ?
    `, [id]);

    if (clients.length === 0) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }

    res.json(clients[0]);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clients - Crea nuovo cliente
app.post('/api/clients', async (req, res) => {
  const { nome, cognome, peso, altezza, data_nascita, telefono, email, note_generali } = req.body;

  if (!nome || !cognome || !peso || !altezza) {
    return res.status(400).json({ error: 'Nome, cognome, peso e altezza sono obbligatori' });
  }

  try {
    const [result] = await connection.execute(`
      INSERT INTO clienti (nome, cognome, peso, altezza, data_nascita, telefono, email, note_generali)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [nome, cognome, peso, altezza, data_nascita, telefono, email, note_generali]);

    res.json({ 
      message: 'Cliente creato con successo',
      clientId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/clients/:id - Aggiorna cliente
app.put('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, cognome, peso, altezza, data_nascita, telefono, email, note_generali } = req.body;

  try {
    const [result] = await connection.execute(`
      UPDATE clienti 
      SET nome = ?, cognome = ?, peso = ?, altezza = ?, 
          data_nascita = ?, telefono = ?, email = ?, note_generali = ?
      WHERE id = ?
    `, [nome, cognome, peso, altezza, data_nascita, telefono, email, note_generali, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }

    res.json({ message: 'Cliente aggiornato con successo' });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/clients/:id/weight - Aggiorna peso cliente
app.put('/api/clients/:id/weight', async (req, res) => {
  const { id } = req.params;
  const { peso, note } = req.body;

  if (!peso || isNaN(peso) || peso < 30 || peso > 300) {
    return res.status(400).json({ error: 'Peso valido richiesto (30-300 kg)' });
  }

  try {
    const [result] = await connection.execute(`
      UPDATE clienti SET peso = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [peso, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }

    // Aggiorna dieta attiva se presente
    const [activeDiet] = await connection.execute(`
      SELECT id FROM diete WHERE cliente_id = ? AND stato = 'attiva' 
      ORDER BY created_at DESC LIMIT 1
    `, [id]);

    if (activeDiet.length > 0) {
      await connection.execute(`
        UPDATE diete SET peso_attuale = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [peso, activeDiet[0].id]);

      await connection.execute(`
        INSERT INTO progressi_peso (dieta_id, peso, data_misurazione, note)
        VALUES (?, ?, CURDATE(), ?)
      `, [activeDiet[0].id, peso, note || 'Aggiornamento manuale']);
    }

    res.json({ message: 'Peso aggiornato con successo', nuovo_peso: peso });

  } catch (error) {
    console.error('Error updating client weight:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clients/:id/weight-history - Storico peso
app.get('/api/clients/:id/weight-history', async (req, res) => {
  const { id } = req.params;
  const { limit = 10 } = req.query;

  try {
    const [history] = await connection.execute(`
      SELECT 
        pp.peso, pp.data_misurazione, pp.note,
        d.titolo as dieta_titolo,
        ROUND(pp.peso / POWER(c.altezza/100, 2), 1) as bmi
      FROM progressi_peso pp
      JOIN diete d ON pp.dieta_id = d.id
      JOIN clienti c ON d.cliente_id = c.id
      WHERE d.cliente_id = ?
      ORDER BY pp.data_misurazione DESC
      LIMIT ?
    `, [id, parseInt(limit)]);

    res.json(history);
  } catch (error) {
    console.error('Error fetching weight history:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/clients/:id - Elimina cliente
app.delete('/api/clients/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await connection.execute('DELETE FROM clienti WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }

    res.json({ message: 'Cliente eliminato con successo' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: error.message });
  }
});

//#endregion

//#region PIANIFICAZIONE NON COMMENTATA
// POST /api/pianificazioni - Salva pianificazione completa
app.post('/api/pianificazioni', async (req, res) => {
  const { dieta_id, configurazione, dati_settimanali, configurazioni_giornaliere, limiti_micronutrienti, cliente_id } = req.body;
  
  try {

    
    // Ottieni cliente_id dalla dieta
    const [dietaInfo] = await connection.query(
      'SELECT cliente_id FROM diete WHERE id = ?',
      [dieta_id]
    );
    
    if (dietaInfo.length === 0) {
      return res.status(404).json({ error: 'Dieta non trovata' });
    }
    
    const cliente_id = dietaInfo[0].cliente_id;

    
    // Elimina pianificazione esistente per questa dieta E cliente
    await connection.query(
      'DELETE FROM pianificazioni_settimanali WHERE dieta_id = ? AND cliente_id = ?', 
      [dieta_id, cliente_id]
    );
    
    // Calcola totali settimanali
    let totaliSettimana = {
      kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
      sodio: 0, potassio: 0, calcio: 0, ferro: 0,
      vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
      vitamina_b1: 0, vitamina_b12: 0, folati: 0
    };
    
    Object.values(dati_settimanali).forEach(giornoData => {
      giornoData.forEach(mealData => {
        mealData.foods.forEach(food => {
          totaliSettimana.kcal += food.kcal || 0;
          totaliSettimana.proteine += food.proteine || 0;
          totaliSettimana.carboidrati += food.carboidrati || 0;
          totaliSettimana.grassi += food.grassi || 0;
          totaliSettimana.sodio += food.sodio || 0;
          totaliSettimana.potassio += food.potassio || 0;
          totaliSettimana.calcio += food.calcio || 0;
          totaliSettimana.ferro += food.ferro || 0;
          totaliSettimana.vitamina_d += food.vitaminaD || 0;
          totaliSettimana.vitamina_a += food.vitaminaA || 0;
          totaliSettimana.vitamina_c += food.vitaminaC || 0;
          totaliSettimana.vitamina_b1 += food.vitaminaB1 || 0;
          totaliSettimana.vitamina_b12 += food.vitaminaB12 || 0;
          totaliSettimana.folati += food.folati || 0;
        });
      });
    });
    
    // Crea pianificazione principale CON cliente_id
    // Crea pianificazione principale CON limiti micronutrienti
    const [pianificazioneResult] = await connection.query(
      `INSERT INTO pianificazioni_settimanali 
       (dieta_id, cliente_id, numero_pasti_giorno, calorie_target_giorno, 
        percentuale_proteine, percentuale_carboidrati, percentuale_grassi,
        limiti_micronutrienti,
        totale_kcal_settimana, totale_proteine_settimana, totale_carboidrati_settimana, totale_grassi_settimana,
        totale_sodio_settimana, totale_potassio_settimana, totale_calcio_settimana, totale_ferro_settimana,
        totale_vitamina_d_settimana, totale_vitamina_a_settimana, totale_vitamina_c_settimana,
        totale_vitamina_b1_settimana, totale_vitamina_b12_settimana, totale_folati_settimana) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dieta_id, 
        cliente_id, 
        configurazione.mealsCount,
        configurazione.dailyKcal,
        configurazione.proteinPercent,
        configurazione.carbsPercent,
        configurazione.fatsPercent,
        JSON.stringify(configurazione.micronutrientLimits || {}), // NUOVO: salva i limiti
        totaliSettimana.kcal, 
        totaliSettimana.proteine, 
        totaliSettimana.carboidrati, 
        totaliSettimana.grassi,
        totaliSettimana.sodio, 
        totaliSettimana.potassio, 
        totaliSettimana.calcio, 
        totaliSettimana.ferro,
        totaliSettimana.vitamina_d, 
        totaliSettimana.vitamina_a, 
        totaliSettimana.vitamina_c,
        totaliSettimana.vitamina_b1, 
        totaliSettimana.vitamina_b12, 
        totaliSettimana.folati
      ]
    );
    const pianificazioneId = pianificazioneResult.insertId;
    
    // Salva giorni, pasti e alimenti
    for (const [nomeGiorno, giornoData] of Object.entries(dati_settimanali)) {
      if (giornoData.length === 0) continue;
      
      // Calcola totali del giorno
      let totaliGiorno = {
        kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
        sodio: 0, potassio: 0, calcio: 0, ferro: 0,
        vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
        vitamina_b1: 0, vitamina_b12: 0, folati: 0
      };
      
      giornoData.forEach(mealData => {
        mealData.foods.forEach(food => {
          totaliGiorno.kcal += food.kcal || 0;
          totaliGiorno.proteine += food.proteine || 0;
          totaliGiorno.carboidrati += food.carboidrati || 0;
          totaliGiorno.grassi += food.grassi || 0;
          totaliGiorno.sodio += food.sodio || 0;
          totaliGiorno.potassio += food.potassio || 0;
          totaliGiorno.calcio += food.calcio || 0;
          totaliGiorno.ferro += food.ferro || 0;
          totaliGiorno.vitamina_d += food.vitaminaD || 0;
          totaliGiorno.vitamina_a += food.vitaminaA || 0;
          totaliGiorno.vitamina_c += food.vitaminaC || 0;
          totaliGiorno.vitamina_b1 += food.vitaminaB1 || 0;
          totaliGiorno.vitamina_b12 += food.vitaminaB12 || 0;
          totaliGiorno.folati += food.folati || 0;
        });
      });
      
      // NUOVO: Recupera le configurazioni del giorno specifico
      let configGiorno = {
        calorie_target: configurazione.dailyKcal || 2000, // Usa i valori dalla configurazione generale come fallback
        percentuale_proteine: configurazione.proteinPercent || 30,
        percentuale_carboidrati: configurazione.carbsPercent || 40,
        percentuale_grassi: configurazione.fatsPercent || 30
      };
      
      // Se esistono configurazioni specifiche per il giorno, usale
      if (configurazioni_giornaliere && configurazioni_giornaliere[nomeGiorno]) {
        const config = configurazioni_giornaliere[nomeGiorno];
        configGiorno.calorie_target = config.dailyKcal || configGiorno.calorie_target;
        configGiorno.percentuale_proteine = config.proteinPercent || configGiorno.percentuale_proteine;
        configGiorno.percentuale_carboidrati = config.carbsPercent || configGiorno.percentuale_carboidrati;
        configGiorno.percentuale_grassi = config.fatsPercent || configGiorno.percentuale_grassi;
      }
      
      // Crea giorno con configurazioni (senza pasti_configurati)
      const [giornoResult] = await connection.query(
        `INSERT INTO pianificazioni_giorni 
         (pianificazione_id, giorno_settimana, 
          calorie_target, percentuale_proteine, percentuale_carboidrati, percentuale_grassi,
          totale_kcal_giorno, totale_proteine_giorno, totale_carboidrati_giorno, totale_grassi_giorno,
          totale_sodio_giorno, totale_potassio_giorno, totale_calcio_giorno, totale_ferro_giorno,
          totale_vitamina_d_giorno, totale_vitamina_a_giorno, totale_vitamina_c_giorno,
          totale_vitamina_b1_giorno, totale_vitamina_b12_giorno, totale_folati_giorno) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pianificazioneId, nomeGiorno,
          configGiorno.calorie_target,
          configGiorno.percentuale_proteine,
          configGiorno.percentuale_carboidrati,
          configGiorno.percentuale_grassi,
          totaliGiorno.kcal, totaliGiorno.proteine, totaliGiorno.carboidrati, totaliGiorno.grassi,
          totaliGiorno.sodio, totaliGiorno.potassio, totaliGiorno.calcio, totaliGiorno.ferro,
          totaliGiorno.vitamina_d, totaliGiorno.vitamina_a, totaliGiorno.vitamina_c,
          totaliGiorno.vitamina_b1, totaliGiorno.vitamina_b12, totaliGiorno.folati
        ]
      );
      const giornoId = giornoResult.insertId;
      
      // Salva pasti del giorno
      for (const mealData of giornoData) {
        // Calcola totali del pasto
        let totaliPasto = {
          kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
          sodio: 0, potassio: 0, calcio: 0, ferro: 0,
          vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
          vitamina_b1: 0, vitamina_b12: 0, folati: 0
        };
        
        mealData.foods.forEach(food => {
          totaliPasto.kcal += food.kcal || 0;
          totaliPasto.proteine += food.proteine || 0;
          totaliPasto.carboidrati += food.carboidrati || 0;
          totaliPasto.grassi += food.grassi || 0;
          totaliPasto.sodio += food.sodio || 0;
          totaliPasto.potassio += food.potassio || 0;
          totaliPasto.calcio += food.calcio || 0;
          totaliPasto.ferro += food.ferro || 0;
          totaliPasto.vitamina_d += food.vitaminaD || 0;
          totaliPasto.vitamina_a += food.vitaminaA || 0;
          totaliPasto.vitamina_c += food.vitaminaC || 0;
          totaliPasto.vitamina_b1 += food.vitaminaB1 || 0;
          totaliPasto.vitamina_b12 += food.vitaminaB12 || 0;
          totaliPasto.folati += food.folati || 0;
        });
        
        // Crea pasto
        const [pastoResult] = await connection.query(
          `INSERT INTO pianificazioni_pasti 
           (giorno_id, nome_pasto, ordine_pasto, totale_kcal_pasto, totale_proteine_pasto, totale_carboidrati_pasto, totale_grassi_pasto,
            totale_sodio_pasto, totale_potassio_pasto, totale_calcio_pasto, totale_ferro_pasto,
            totale_vitamina_d_pasto, totale_vitamina_a_pasto, totale_vitamina_c_pasto,
            totale_vitamina_b1_pasto, totale_vitamina_b12_pasto, totale_folati_pasto) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            giornoId, mealData.mealName, mealData.mealIndex,
            totaliPasto.kcal, totaliPasto.proteine, totaliPasto.carboidrati, totaliPasto.grassi,
            totaliPasto.sodio, totaliPasto.potassio, totaliPasto.calcio, totaliPasto.ferro,
            totaliPasto.vitamina_d, totaliPasto.vitamina_a, totaliPasto.vitamina_c,
            totaliPasto.vitamina_b1, totaliPasto.vitamina_b12, totaliPasto.folati
          ]
        );
        const pastoId = pastoResult.insertId;
        
        // Salva alimenti del pasto
// Salva alimenti principali del pasto
// Salva alimenti del pasto (principali e alternative insieme)
let ordineGlobale = 0; // Contatore unico per l'ordine

// Prima salva tutti gli alimenti principali
// Combina tutti gli alimenti (principali + alternative) in un unico array
const allFoods = [];

// Aggiungi alimenti principali
mealData.foods.forEach((food, index) => {
  allFoods.push({
    ...food,
    is_alternative: false,
    orderIndex: food.globalOrder !== undefined ? food.globalOrder : index
  });
});

// Aggiungi alternative
if (mealData.alternatives && mealData.alternatives.length > 0) {
  mealData.alternatives.forEach((alt, index) => {
    allFoods.push({
      ...alt,
      is_alternative: true,
      orderIndex: alt.globalOrder !== undefined ? alt.globalOrder : mealData.foods.length + index
    });
  });
}

// Ordina per orderIndex per mantenere l'ordine corretto
allFoods.sort((a, b) => a.orderIndex - b.orderIndex);

// Salva tutti gli alimenti in un unico ciclo
for (let i = 0; i < allFoods.length; i++) {
  const food = allFoods[i];
  
  const [alimentoResult] = await connection.query(
    'SELECT ID FROM alimenti WHERE Nome = ? LIMIT 1',
    [food.nome]
  );
  const alimentoId = alimentoResult.length > 0 ? alimentoResult[0].ID : null;
  
  await connection.query(
    `INSERT INTO pianificazioni_alimenti 
     (pasto_id, alimento_id, nome_alimento, quantita, ordine_alimento, is_alternative,
      kcal_calcolate, proteine_calcolate, carboidrati_calcolati, grassi_calcolati,
      sodio_calcolato, potassio_calcolato, calcio_calcolato, ferro_calcolato,
      vitamina_d_calcolata, vitamina_a_calcolata, vitamina_c_calcolata,
      vitamina_b1_calcolata, vitamina_b12_calcolata, folati_calcolati)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pastoId, alimentoId, food.nome, food.quantita, 
      i, // Usa l'indice del ciclo come ordine_alimento
      food.is_alternative,
      food.kcal || 0, food.proteine || 0, food.carboidrati || 0, food.grassi || 0,
      food.sodio || 0, food.potassio || 0, food.calcio || 0, food.ferro || 0,
      food.vitaminaD || 0, food.vitaminaA || 0, food.vitaminaC || 0,
      food.vitaminaB1 || 0, food.vitaminaB12 || 0, food.folati || 0
    ]
  );
}
      }
    }
    

    res.json({ success: true, pianificazione_id: pianificazioneId, cliente_id: cliente_id });
    
  } catch (error) {
    console.error('❌ Errore salvataggio pianificazione:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pianificazioni/dieta/:dietaId/completa - Carica pianificazione completa
app.get('/api/pianificazioni/dieta/:dietaId/completa', async (req, res) => {
  const { dietaId } = req.params;
  
  try {
    console.log(`🔍 Caricamento pianificazione per dieta ${dietaId}`);
    
    // Prima ottieni il cliente_id dalla dieta
    const [dietaInfo] = await connection.query(
      'SELECT cliente_id FROM diete WHERE id = ?',
      [dietaId]
    );
    
    if (dietaInfo.length === 0) {
      return res.status(404).json({ message: 'Dieta non trovata' });
    }
    
    const cliente_id = dietaInfo[0].cliente_id;
    
    // Carica pianificazione principale con controllo cliente_id
    const [pianificazioni] = await connection.query(
      'SELECT * FROM pianificazioni_settimanali WHERE dieta_id = ? AND cliente_id = ?',
      [dietaId, cliente_id]
    );
    
    if (pianificazioni.length === 0) {
      return res.status(404).json({ message: 'Nessuna pianificazione trovata' });
    }
    
    const pianificazione = pianificazioni[0];
    
    // Carica dati completi degli alimenti PRIMA
    const [datiCompleti] = await connection.query(`
      SELECT 
        g.giorno_settimana,
        p.nome_pasto, p.ordine_pasto,
        a.nome_alimento, a.quantita, a.ordine_alimento, a.is_alternative,
        a.kcal_calcolate, a.proteine_calcolate, a.carboidrati_calcolati, a.grassi_calcolati,
        a.sodio_calcolato, a.potassio_calcolato, a.calcio_calcolato, a.ferro_calcolato,
        a.vitamina_d_calcolata, a.vitamina_a_calcolata, a.vitamina_c_calcolata,
        a.vitamina_b1_calcolata, a.vitamina_b12_calcolata, a.folati_calcolati
      FROM pianificazioni_giorni g
      INNER JOIN pianificazioni_pasti p ON g.id = p.giorno_id
      INNER JOIN pianificazioni_alimenti a ON p.id = a.pasto_id
      WHERE g.pianificazione_id = ?
      ORDER BY 
        CASE g.giorno_settimana 
          WHEN 'lunedi' THEN 1 WHEN 'martedi' THEN 2 WHEN 'mercoledi' THEN 3 
          WHEN 'giovedi' THEN 4 WHEN 'venerdi' THEN 5 WHEN 'sabato' THEN 6 
          WHEN 'domenica' THEN 7 
        END,
        p.ordine_pasto, 
        a.ordine_alimento
    `, [pianificazione.id]);

    // DOPO carica le configurazioni giornaliere dalla tabella pianificazioni_giorni
    const [configurazioniGiornaliere] = await connection.query(`
      SELECT 
        giorno_settimana,
        calorie_target,
        percentuale_proteine,
        percentuale_carboidrati,
        percentuale_grassi
      FROM pianificazioni_giorni 
      WHERE pianificazione_id = ?
      ORDER BY 
        CASE giorno_settimana 
          WHEN 'lunedi' THEN 1 WHEN 'martedi' THEN 2 WHEN 'mercoledi' THEN 3 
          WHEN 'giovedi' THEN 4 WHEN 'venerdi' THEN 5 WHEN 'sabato' THEN 6 
          WHEN 'domenica' THEN 7 
        END
    `, [pianificazione.id]);
    
    // Organizza le configurazioni giornaliere
    const configurazioni_giornaliere = {};
    configurazioniGiornaliere.forEach(config => {
      // Ora posso usare datiCompleti perché è già definito
      const pasti = datiCompleti.filter(row => row.giorno_settimana === config.giorno_settimana);
      const pastiUnici = [...new Set(pasti.map(row => row.nome_pasto))];
      
      configurazioni_giornaliere[config.giorno_settimana] = {
        dailyKcal: parseInt(config.calorie_target) || 2000,
        proteinPercent: parseInt(config.percentuale_proteine) || 30,
        carbsPercent: parseInt(config.percentuale_carboidrati) || 40,
        fatsPercent: parseInt(config.percentuale_grassi) || 30,
        mealsCount: pastiUnici.length,
        selectedMeals: pastiUnici
      };
    });

    // Organizza i dati degli alimenti
    const giorniOrganizzati = {
      lunedi: [], martedi: [], mercoledi: [], giovedi: [],
      venerdi: [], sabato: [], domenica: []
    };

    const pastiMap = new Map();

    datiCompleti.forEach(row => {
      const chiavePasto = `${row.giorno_settimana}_${row.nome_pasto}_${row.ordine_pasto}`;
      
      if (!pastiMap.has(chiavePasto)) {
        pastiMap.set(chiavePasto, {
          giorno: row.giorno_settimana,
          mealName: row.nome_pasto,
          mealIndex: row.ordine_pasto,
          foods: [],
          alternatives: []
        });
      }
      
      const pasto = pastiMap.get(chiavePasto);
      const foodData = {
        nome: row.nome_alimento,
        quantita: parseFloat(row.quantita),
        kcal: parseFloat(row.kcal_calcolate) || 0,
        proteine: parseFloat(row.proteine_calcolate) || 0,
        carboidrati: parseFloat(row.carboidrati_calcolati) || 0,
        grassi: parseFloat(row.grassi_calcolati) || 0,
        sodio: parseFloat(row.sodio_calcolato) || 0,
        potassio: parseFloat(row.potassio_calcolato) || 0,
        calcio: parseFloat(row.calcio_calcolato) || 0,
        ferro: parseFloat(row.ferro_calcolato) || 0,
        vitaminaD: parseFloat(row.vitamina_d_calcolata) || 0,
        vitaminaA: parseFloat(row.vitamina_a_calcolata) || 0,
        vitaminaC: parseFloat(row.vitamina_c_calcolata) || 0,
        vitaminaB1: parseFloat(row.vitamina_b1_calcolata) || 0,
        vitaminaB12: parseFloat(row.vitamina_b12_calcolata) || 0,
        folati: parseFloat(row.folati_calcolati) || 0,
        globalOrder: row.ordine_alimento
      };
      
      // Distingui tra alimenti principali e alternative
      if (row.is_alternative) {
        pasto.alternatives.push(foodData);
      } else {
        pasto.foods.push(foodData);
      }
    });

    // Organizza i pasti per giorno
    pastiMap.forEach(pasto => {
      if (giorniOrganizzati[pasto.giorno]) {
        giorniOrganizzati[pasto.giorno].push({
          mealName: pasto.mealName,
          mealIndex: pasto.mealIndex,
          foods: pasto.foods,
          alternatives: pasto.alternatives
        });
      }
    });
    
    // Aggiungi i dati organizzati alla pianificazione
    pianificazione.dati_settimanali = giorniOrganizzati;
    
    // NUOVO: Aggiungi le configurazioni giornaliere
    pianificazione.configurazioni_giornaliere = configurazioni_giornaliere;
    
    // Gestisci i limiti micronutrienti
    if (pianificazione.limiti_micronutrienti) {
        if (typeof pianificazione.limiti_micronutrienti === 'string') {
            try {
                pianificazione.limiti_micronutrienti = JSON.parse(pianificazione.limiti_micronutrienti);
            } catch (e) {
                console.error('Errore parsing limiti micronutrienti:', e);
                pianificazione.limiti_micronutrienti = {};
            }
        }
    } else {
        pianificazione.limiti_micronutrienti = {};
    }
    
    console.log(`✅ Pianificazione caricata con configurazioni giornaliere:`, configurazioni_giornaliere);
    
    res.json({ pianificazione });
    
  } catch (error) {
    console.error('❌ Errore ricerca pianificazione:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pianificazioni/dieta/:dietaId - Pianificazione base
app.get('/api/pianificazioni/dieta/:dietaId', async (req, res) => {
  const { dietaId } = req.params;
  
  try {
    const [pianificazioni] = await connection.query(
      'SELECT * FROM pianificazioni_settimanali WHERE dieta_id = ?',
      [dietaId]
    );
    
    if (pianificazioni.length === 0) {
      return res.status(404).json({ message: 'Nessuna pianificazione trovata' });
    }
    
    res.json({ pianificazione: pianificazioni[0] });
    
  } catch (error) {
    console.error('❌ Errore ricerca pianificazione:', error);
    res.status(500).json({ error: error.message });
  }
});

//#endregion


//#region === ANAMNESI API ===


// GET /api/clients/:id/anamnesis - Anamnesi cliente
app.get('/api/clients/:id/anamnesis', async (req, res) => {
  const { id } = req.params;

  try {
    const [anamnesis] = await connection.execute(`
      SELECT * FROM anamnesi_riquadri 
      WHERE cliente_id = ? 
      ORDER BY ordine ASC, id ASC
    `, [id]);

    res.json(anamnesis);
  } catch (error) {
    console.error('Error fetching anamnesis:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clients/:id/anamnesis - Crea riquadro anamnesi
app.post('/api/clients/:id/anamnesis', async (req, res) => {
  const { id } = req.params;
  const { titolo, contenuto, ordine = 0, template_id = null } = req.body;

  if (!titolo) {
    return res.status(400).json({ error: 'Titolo è obbligatorio' });
  }

  try {
    const [result] = await connection.execute(`
      INSERT INTO anamnesi_riquadri (cliente_id, titolo, contenuto, ordine, template_id)
      VALUES (?, ?, ?, ?, ?)
    `, [id, titolo, contenuto, ordine, template_id]);

    res.json({ 
      message: 'Riquadro anamnesi creato con successo',
      riquadroId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating anamnesis:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/anamnesis/:id - Aggiorna riquadro anamnesi
app.put('/api/anamnesis/:id', async (req, res) => {
  const { id } = req.params;
  const { titolo, contenuto, ordine } = req.body;

  try {
    const [result] = await connection.execute(`
      UPDATE anamnesi_riquadri 
      SET titolo = ?, contenuto = ?, ordine = ?
      WHERE id = ?
    `, [titolo, contenuto, ordine, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Riquadro anamnesi non trovato' });
    }

    res.json({ message: 'Riquadro anamnesi aggiornato con successo' });
  } catch (error) {
    console.error('Error updating anamnesis:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/anamnesis/:id - Elimina riquadro anamnesi
app.delete('/api/anamnesis/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await connection.execute('DELETE FROM anamnesi_riquadri WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Riquadro anamnesi non trovato' });
    }

    res.json({ message: 'Riquadro anamnesi eliminato con successo' });
  } catch (error) {
    console.error('Error deleting anamnesis:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/templates - Template anamnesi
app.get('/api/templates', async (req, res) => {
  try {
    const [templates] = await connection.execute(`
      SELECT * FROM template_riquadri 
      WHERE is_active = TRUE 
      ORDER BY nome_template, ordine_default
    `);

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});




// GET /api/anamnesis/:riquadroId/images - Ottieni immagini di un riquadro
app.get('/api/anamnesis/:riquadroId/images', async (req, res) => {
  const { riquadroId } = req.params;
  
  try {
    const [images] = await connection.execute(`
      SELECT id, nome_file, tipo_mime, dimensione_kb, immagine_base64
      FROM anamnesi_immagini
      WHERE riquadro_id = ?
      ORDER BY created_at DESC
    `, [riquadroId]);
    
    res.json(images);
  } catch (error) {
    console.error('Error fetching anamnesis images:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/anamnesis/:riquadroId/images - Aggiungi immagine
app.post('/api/anamnesis/:riquadroId/images', async (req, res) => {
  const { riquadroId } = req.params;
  const { nome_file, tipo_mime, dimensione_kb, immagine_base64 } = req.body;
  
  if (!nome_file || !immagine_base64) {
    return res.status(400).json({ error: 'Nome file e immagine sono obbligatori' });
  }
  
  try {
    // Verifica che il riquadro esista
    const [riquadro] = await connection.execute(
      'SELECT id FROM anamnesi_riquadri WHERE id = ?',
      [riquadroId]
    );
    
    if (riquadro.length === 0) {
      return res.status(404).json({ error: 'Riquadro anamnesi non trovato' });
    }
    
    // Opzionale: crea thumbnail (richiede libreria come sharp)
    // const thumbnail_base64 = await createThumbnail(immagine_base64);
    
    const [result] = await connection.execute(`
      INSERT INTO anamnesi_immagini 
      (riquadro_id, nome_file, tipo_mime, dimensione_kb, immagine_base64)
      VALUES (?, ?, ?, ?, ?)
    `, [riquadroId, nome_file, tipo_mime, dimensione_kb, immagine_base64]);
    
    res.json({ 
      message: 'Immagine salvata con successo',
      imageId: result.insertId 
    });
  } catch (error) {
    console.error('Error saving anamnesis image:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/anamnesis/images/:imageId - Elimina immagine
app.delete('/api/anamnesis/images/:imageId', async (req, res) => {
  const { imageId } = req.params;
  
  try {
    const [result] = await connection.execute(
      'DELETE FROM anamnesi_immagini WHERE id = ?',
      [imageId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Immagine non trovata' });
    }
    
    res.json({ message: 'Immagine eliminata con successo' });
  } catch (error) {
    console.error('Error deleting anamnesis image:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/anamnesis/images/:imageId - Ottieni singola immagine
app.get('/api/anamnesis/images/:imageId', async (req, res) => {
  const { imageId } = req.params;
  
  try {
    const [images] = await connection.execute(
      'SELECT * FROM anamnesi_immagini WHERE id = ?',
      [imageId]
    );
    
    if (images.length === 0) {
      return res.status(404).json({ error: 'Immagine non trovata' });
    }
    
    res.json(images[0]);
  } catch (error) {
    console.error('Error fetching anamnesis image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Opzionale: endpoint per servire solo il base64 dell'immagine
app.get('/api/anamnesis/images/:imageId/data', async (req, res) => {
  const { imageId } = req.params;
  
  try {
    const [images] = await connection.execute(
      'SELECT immagine_base64, tipo_mime FROM anamnesi_immagini WHERE id = ?',
      [imageId]
    );
    
    if (images.length === 0) {
      return res.status(404).json({ error: 'Immagine non trovata' });
    }
    
    // Converti base64 in buffer e invia come immagine
    const base64Data = images[0].immagine_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', images[0].tipo_mime || 'image/jpeg');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving anamnesis image:', error);
    res.status(500).json({ error: error.message });
  }
});

//#endregion

//#region DIETE API
// === DIETE API ===

// GET /api/clients/:id/diets - Diete cliente
app.get('/api/clients/:id/diets', async (req, res) => {
  const { id } = req.params;

  try {
    const [diets] = await connection.execute(`
      SELECT 
        d.*,
        ROUND(d.peso_iniziale / POWER(d.altezza/100, 2), 1) as bmi_iniziale,
        ROUND(COALESCE(d.peso_attuale, d.peso_iniziale) / POWER(d.altezza/100, 2), 1) as bmi_attuale,
        ROUND(COALESCE(d.peso_obiettivo, d.peso_iniziale) / POWER(d.altezza/100, 2), 1) as bmi_obiettivo,
        COALESCE(d.peso_iniziale - d.peso_attuale, 0) as peso_perso,
        DATEDIFF(COALESCE(d.data_fine, CURDATE()), d.data_inizio) as giorni_dieta,
        CASE 
          WHEN d.stato = 'attiva' AND d.data_fine IS NOT NULL AND CURDATE() > d.data_fine THEN 'scaduta'
          ELSE d.stato
        END as stato_effettivo
      FROM diete d 
      WHERE d.cliente_id = ? 
      ORDER BY d.created_at DESC
    `, [id]);

    res.json(diets);
  } catch (error) {
    console.error('Error fetching diets:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diets/:id - Dettagli dieta
app.get('/api/diets/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [diets] = await connection.execute(`
      SELECT 
        d.*, c.nome, c.cognome,
        CONCAT(c.nome, ' ', c.cognome) as nome_cliente,
        ROUND(d.peso_iniziale / POWER(d.altezza/100, 2), 1) as bmi_iniziale,
        ROUND(COALESCE(d.peso_attuale, d.peso_iniziale) / POWER(d.altezza/100, 2), 1) as bmi_attuale,
        ROUND(COALESCE(d.peso_obiettivo, d.peso_iniziale) / POWER(d.altezza/100, 2), 1) as bmi_obiettivo,
        COALESCE(d.peso_iniziale - d.peso_attuale, 0) as peso_perso,
        DATEDIFF(COALESCE(d.data_fine, CURDATE()), d.data_inizio) as giorni_dieta
      FROM diete d
      JOIN clienti c ON d.cliente_id = c.id
      WHERE d.id = ?
    `, [id]);

    if (diets.length === 0) {
      return res.status(404).json({ error: 'Dieta non trovata' });
    }

    res.json(diets[0]);
  } catch (error) {
    console.error('Error fetching diet:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clients/:id/diets - Crea nuova dieta
app.post('/api/clients/:id/diets', async (req, res) => {
  const { id } = req.params;
  const { 
    titolo, descrizione, peso_iniziale, peso_obiettivo, altezza,
    data_inizio, data_fine, durata_mesi, note_generali 
  } = req.body;

  if (!titolo || !peso_iniziale || !altezza || !data_inizio) {
    return res.status(400).json({ 
      error: 'Titolo, peso iniziale, altezza e data inizio sono obbligatori' 
    });
  }

  try {
    // Disattiva diete esistenti
    await connection.execute(`
      UPDATE diete SET stato = 'completata' 
      WHERE cliente_id = ? AND stato = 'attiva'
    `, [id]);

    // Crea nuova dieta
    const [result] = await connection.execute(`
      INSERT INTO diete (
        cliente_id, titolo, descrizione, peso_iniziale, peso_obiettivo, peso_attuale,
        altezza, data_inizio, data_fine, durata_mesi, stato, note_generali
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'attiva', ?)
    `, [
      id, titolo, descrizione, peso_iniziale, peso_obiettivo, peso_iniziale,
      altezza, data_inizio, data_fine, durata_mesi, note_generali
    ]);

    // Primo progresso peso
    await connection.execute(`
      INSERT INTO progressi_peso (dieta_id, peso, data_misurazione, note)
      VALUES (?, ?, ?, ?)
    `, [result.insertId, peso_iniziale, data_inizio, 'Peso iniziale']);

    // Aggiorna peso cliente
    await connection.execute(`
      UPDATE clienti SET peso = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [peso_iniziale, id]);

  

    res.json({ 
      message: 'Dieta creata con successo',
      dietId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating diet:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/diets/:id - Aggiorna dieta
app.put('/api/diets/:id', async (req, res) => {
  const { id } = req.params;
  const { peso_attuale, bmi_attuale, peso_perso } = req.body;
  
  try {
    const [result] = await connection.query(
      `UPDATE diete SET 
       peso_attuale = ?, 
       bmi_attuale = ?, 
       peso_perso = ?
       WHERE id = ?`,
      [peso_attuale, bmi_attuale, peso_perso, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dieta non trovata' });
    }
    
    res.json({ message: 'Dieta aggiornata con successo' });
    
  } catch (error) {
    console.error('Error updating diet:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/diets/:id/weight - Aggiorna peso dieta
app.put('/api/diets/:id/weight', async (req, res) => {
  const { id } = req.params;
  const { peso_attuale, note } = req.body;

  if (!peso_attuale) {
    return res.status(400).json({ error: 'Peso attuale è obbligatorio' });
  }

  try {
    const [result] = await connection.execute(`
      UPDATE diete SET peso_attuale = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [peso_attuale, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dieta non trovata' });
    }

    await connection.execute(`
      INSERT INTO progressi_peso (dieta_id, peso, data_misurazione, note)
      VALUES (?, ?, CURDATE(), ?)
    `, [id, peso_attuale, note || 'Aggiornamento peso']);

    // Aggiorna peso cliente se dieta attiva
    const [dietInfo] = await connection.execute(`
      SELECT cliente_id FROM diete WHERE id = ? AND stato = 'attiva'
    `, [id]);

    if (dietInfo.length > 0) {
      await connection.execute(`
        UPDATE clienti SET peso = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [peso_attuale, dietInfo[0].cliente_id]);
    }

    res.json({ message: 'Peso aggiornato con successo' });
  } catch (error) {
    console.error('Error updating weight:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/diets/:id/status - Cambia stato dieta
app.put('/api/diets/:id/status', async (req, res) => {
  const { id } = req.params;
  const { stato } = req.body;

  const statiValidi = ['attiva', 'completata', 'sospesa', 'annullata'];
  if (!stato || !statiValidi.includes(stato)) {
    return res.status(400).json({ 
      error: 'Stato richiesto. Valori validi: ' + statiValidi.join(', ') 
    });
  }

  try {
    const [result] = await connection.execute(`
      UPDATE diete SET stato = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [stato, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dieta non trovata' });
    }

    res.json({ message: 'Stato dieta aggiornato con successo' });
  } catch (error) {
    console.error('Error updating diet status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diets/:id/progress - Progressi peso dieta
app.get('/api/diets/:id/progress', async (req, res) => {
  const { id } = req.params;

  try {
    const [progress] = await connection.execute(`
      SELECT * FROM progressi_peso 
      WHERE dieta_id = ? 
      ORDER BY data_misurazione ASC
    `, [id]);

    res.json(progress);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/diets/:id - Elimina dieta
app.delete('/api/diets/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await connection.execute('DELETE FROM diete WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dieta non trovata' });
    }

    res.json({ message: 'Dieta eliminata con successo' });
  } catch (error) {
    console.error('Error deleting diet:', error);
    res.status(500).json({ error: error.message });
  }
});

//#endregion


//#region ALIMENTI API


// 1. CERCA ALIMENTI - Deve essere PRIMA di /api/foods/:id
app.get('/api/foods/search/:term', async (req, res) => {
  const { term } = req.params;
  
  if (!term || term.length < 2) {
    return res.json([]);
  }
  
  try {
    const searchTerm = `%${term}%`;
    
    const [results] = await connection.query(
      `SELECT id, nome, kcal, proteine, carboidrati, lipidi,
              sodio, potassio, calcio, ferro, vitamina_d, vitamina_a,
              vitamina_c, vitamina_b1, vitamina_b12, folati, sale
       FROM alimenti 
       WHERE nome LIKE ?
       ORDER BY nome ASC
       LIMIT 20`,
      [searchTerm, searchTerm]
    );
    

    res.json(results);
    
  } catch (error) {
    console.error('Errore ricerca alimenti:', error);
    res.status(500).json({ error: 'Errore nella ricerca', details: error.message });
  }
});

// 3. OTTIENI SINGOLO ALIMENTO
app.get('/api/foods/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [results] = await connection.query(
      'SELECT * FROM alimenti WHERE id = ?',
      [id]
      
    );
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Alimento non trovato' });
    }
    
    res.json(results[0]);

    
  } catch (error) {
    console.error('Errore recupero alimento:', error);
    res.status(500).json({ error: 'Errore nel recupero dell\'alimento' });
  }
});

// 4. CREA NUOVO ALIMENTO
app.post('/api/foods', async (req, res) => {
  const {
    nome, kcal = 0, proteine = 0, carboidrati = 0, grassi = 0,
    sodio = 0, potassio = 0, calcio = 0, ferro = 0, vitamina_d = 0, 
    vitamina_a = 0, vitamina_c = 0, vitamina_b1 = 0, vitamina_b12 = 0, folati = 0, sale = 0
  } = req.body;
  
  // Validazione
  if (!nome || nome.trim() === '') {
    return res.status(400).json({ error: 'Il nome è obbligatorio' });
  }
  
  
  try {
    // Verifica se esiste già
    const [existing] = await connection.query(
      'SELECT id FROM alimenti WHERE LOWER(nome) = LOWER(?)',
      [nome.trim()]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'Esiste già un alimento con questo nome',
        existingId: existing[0].id 
      });
    }
    
    // Inserisci nuovo alimento
    const [result] = await connection.execute(
      `INSERT INTO alimenti (
  Nome, Kcal, Proteine, Carboidrati, Lipidi,
  Sodio, Potassio, Calcio, Ferro, Vitamina_d, Vitamina_a,
  Vitamina_c, Vitamina_b1, Vitamina_b12, Folati, Sale
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome.trim(), kcal, proteine, carboidrati, grassi,
        sodio, potassio, calcio, ferro, vitamina_d, vitamina_a,
        vitamina_c, vitamina_b1, vitamina_b12, folati, sale
      ]
    );
    
    res.status(201).json({
      id: result.insertId,
      message: 'Alimento creato con successo'
    });
    
  } catch (error) {
    console.error('Errore creazione alimento:', error);
    res.status(500).json({ error: 'Errore nella creazione dell\'alimento' });
  }
});

// 5. AGGIORNA ALIMENTO
app.put('/api/foods/:id', async (req, res) => {
  const { id } = req.params;
  const {
    nome, kcal = 0, proteine = 0, carboidrati = 0, lipidi = 0,
    sodio = 0, potassio = 0, calcio = 0, ferro = 0, vitamina_d = 0, 
    vitamina_a = 0, vitamina_c = 0, vitamina_b1 = 0, vitamina_b12 = 0, 
    folati = 0, sale = 0
  } = req.body;
  
  // Validazione
  if (!nome || nome.trim() === '') {
    return res.status(400).json({ error: 'Il nome è obbligatorio' });
  }
  
  try {
    // Verifica che l'alimento esista
    const [existing] = await connection.query(
      'SELECT id FROM alimenti WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Alimento non trovato' });
    }
    
    // Aggiorna
    await connection.execute(
      `UPDATE alimenti SET
        nome = ?, kcal = ?, proteine = ?, carboidrati = ?, 
        lipidi = ?, sodio = ?, potassio = ?, calcio = ?, 
        ferro = ?, vitamina_d = ?, vitamina_a = ?, vitamina_c = ?,
        vitamina_b1 = ?, vitamina_b12 = ?, folati = ?, sale = ?
      WHERE id = ?`,
      [
        nome.trim(), kcal, proteine, carboidrati, lipidi, 
        sodio, potassio, calcio, ferro, vitamina_d, vitamina_a,
        vitamina_c, vitamina_b1, vitamina_b12, folati, sale, id
      ]
    );
    
    res.json({ message: 'Alimento aggiornato con successo' });
    
  } catch (error) {
    console.error('Errore aggiornamento alimento:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'alimento' });
  }
});

/*
// 6. ELIMINA ALIMENTO
app.delete('/api/foods/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verifica se è utilizzato in diete
    const [usage] = await connection.query(
      `SELECT COUNT(*) as count 
       FROM alimenti 
       WHERE id = ?`,
      [id]
    );
    
    if (usage[0].count > 0) {
      return res.status(409).json({ 
        error: `Impossibile eliminare: l'alimento è utilizzato in ${usage[0].count} diete`,
        dietCount: usage[0].count
      });
    }
    
    // Elimina
    const [result] = await connection.execute(
      'DELETE FROM alimenti WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alimento non trovato' });
    }
    
    res.json({ message: 'Alimento eliminato con successo' });
    
  } catch (error) {
    console.error('Errore eliminazione alimento:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione dell\'alimento' });
  }
});

*/ 


// === ALIMENTI API ===

// GET /api/foods - Ricerca alimenti
app.get('/api/foods', async (req, res) => {
  const { search = '' } = req.query;
  
  try {
    let query = 'SELECT * FROM alimenti';
    let queryParams = [];
    
    if (search.trim()) {
      query += ' WHERE Nome LIKE ?';
      queryParams = [`%${search.trim()}%`];
    }
    
    query += ' ORDER BY Nome';
    
    const [foods] = await connection.query(query, queryParams);
    res.json(foods);
    
  } catch (error) {
    console.error('Error searching foods:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/foods/:id - Dettaglio alimento
app.get('/api/foods/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [foods] = await connection.query('SELECT * FROM alimenti WHERE ID = ?', [id]);
    
    if (foods.length === 0) {
      return res.status(404).json({ error: 'Alimento non trovato' });
    }
    
    res.json(foods[0]);
  } catch (error) {
    console.error('Error fetching food:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/foods/search-exact - Ricerca esatta
app.get('/api/foods/search-exact', async (req, res) => {
  const { nome } = req.query;
  
  try {
    const [alimenti] = await connection.query(
      'SELECT * FROM alimenti WHERE Nome = ? LIMIT 1',
      [nome]
    );
    
    if (alimenti.length === 0) {
      return res.status(404).json({ message: 'Alimento non trovato' });
    }
    
    res.json({ alimento: alimenti[0] });
  } catch (error) {
    console.error('Error fetching food:', error);
    res.status(500).json({ error: error.message });
  }
});

//#endregion


//#region API PLICOMETRIA

// GET /api/clients/:id/plicometria - Ottieni misurazioni plicometriche
app.get('/api/clients/:id/plicometria', async (req, res) => {
  const { id } = req.params;
  const { limit } = req.query;
  
  try {
    let query = `
      SELECT * FROM plicometria 
      WHERE cliente_id = ? 
      ORDER BY data_misurazione DESC
    `;
    
    const params = [id];
    
    // Aggiungi LIMIT solo se specificato
    if (limit && !isNaN(parseInt(limit))) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    
    // Usa query invece di execute per evitare problemi con LIMIT
    const [misurazioni] = await connection.query(query, params);
    
    res.json(misurazioni);
  } catch (error) {
    console.error('Error fetching plicometria:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clients/:id/plicometria - Salva nuova misurazione
app.post('/api/clients/:id/plicometria', async (req, res) => {
  const { id } = req.params;
  const {
    data_misurazione,
    tricipite,
    addome,
    soprailiaca,
    sottoscapolare,
    ascellare,
    pettorale,
    coscia,
    peso,
    bmi,
    note
  } = req.body;
  
  if (!data_misurazione) {
    return res.status(400).json({ error: 'Data misurazione obbligatoria' });
  }
  
  try {
    // Calcola percentuale grasso se possibile (formula Jackson-Pollock 7 pliche)
    let percentuale_grasso = null;
    
    // Se abbiamo tutte le 7 pliche, calcola la percentuale
    if (tricipite && addome && soprailiaca && sottoscapolare && ascellare && pettorale && coscia) {
      const sommaPliche = tricipite + addome + soprailiaca + sottoscapolare + ascellare + pettorale + coscia;
      
      // Formula semplificata - da sostituire con formule più precise per sesso/età
      // Questa è una stima approssimativa
      percentuale_grasso = Math.round((sommaPliche * 0.15 + 5) * 10) / 10;
    }
    
    const [result] = await connection.execute(`
      INSERT INTO plicometria 
      (cliente_id, data_misurazione, tricipite, addome, soprailiaca, 
       sottoscapolare, ascellare, pettorale, coscia, peso, bmi, percentuale_grasso, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data_misurazione, tricipite, addome, soprailiaca,
      sottoscapolare, ascellare, pettorale, coscia, peso, bmi, percentuale_grasso, note
    ]);
    
    res.json({
      message: 'Misurazione salvata con successo',
      id: result.insertId,
      percentuale_grasso
    });
  } catch (error) {
    console.error('Error saving plicometria:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/plicometria/:id - Aggiorna misurazione
app.put('/api/plicometria/:id', async (req, res) => {
  const { id } = req.params;
  const {
    data_misurazione,
    tricipite,
    addome,
    soprailiaca,
    sottoscapolare,
    ascellare,
    pettorale,
    coscia,
    peso,
    bmi,
    note
  } = req.body;
  
  try {
    const [result] = await connection.execute(`
      UPDATE plicometria 
      SET data_misurazione = ?, tricipite = ?, addome = ?, soprailiaca = ?,
          sottoscapolare = ?, ascellare = ?, pettorale = ?, coscia = ?, peso = ?, bmi = ?, note = ?
      WHERE id = ?
    `, [
      data_misurazione, tricipite, addome, soprailiaca,
      sottoscapolare, ascellare, pettorale, coscia, peso, bmi, note, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Misurazione non trovata' });
    }
    
    res.json({ message: 'Misurazione aggiornata con successo' });
  } catch (error) {
    console.error('Error updating plicometria:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/plicometria/:id - Elimina misurazione
app.delete('/api/plicometria/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [result] = await connection.execute(
      'DELETE FROM plicometria WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Misurazione non trovata' });
    }
    
    res.json({ message: 'Misurazione eliminata con successo' });
  } catch (error) {
    console.error('Error deleting plicometria:', error);
    res.status(500).json({ error: error.message });
  }
});


//#endregion

//#region API PASTI PREFATTI

// === API PASTI PRE-FATTI ===

// GET /api/pasti-prefatti - Recupera tutti i pasti pre-fatti
app.get('/api/pasti-prefatti', async (req, res) => {
  try {
    // Query semplificata senza ORDER BY dentro JSON_ARRAYAGG
    const [pasti] = await connection.query(`
      SELECT 
        p.*,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', pa.id,
            'nome', pa.nome_alimento,
            'quantita', pa.quantita,
            'is_alternative', pa.is_alternative,
            'ordine', pa.ordine_alimento,
            'kcal', pa.kcal_calcolate,
            'proteine', pa.proteine_calcolate,
            'carboidrati', pa.carboidrati_calcolati,
            'grassi', pa.grassi_calcolati,
            'sodio', pa.sodio_calcolato,
            'potassio', pa.potassio_calcolato,
            'calcio', pa.calcio_calcolato,
            'ferro', pa.ferro_calcolato,
            'vitaminaD', pa.vitamina_d_calcolata,
            'vitaminaA', pa.vitamina_a_calcolata,
            'vitaminaC', pa.vitamina_c_calcolata,
            'vitaminaB1', pa.vitamina_b1_calcolata,
            'vitaminaB12', pa.vitamina_b12_calcolata,
            'folati', pa.folati_calcolati
          )
        ) as alimenti_raw
      FROM pasti_prefatti p
      LEFT JOIN pasti_prefatti_alimenti pa ON p.id = pa.pasto_id
      GROUP BY p.id
      ORDER BY p.id DESC
    `);
    
    // Processa i risultati per separare alimenti principali e alternative
    const pastiProcessati = pasti.map(pasto => {
      let alimenti = [];
      let alternative = [];
      
      if (pasto.alimenti_raw) {
        let allAlimenti = [];
        
        // Gestisci sia stringhe JSON che oggetti già parsati
        if (typeof pasto.alimenti_raw === 'string') {
          try {
            allAlimenti = JSON.parse(pasto.alimenti_raw);
          } catch (e) {
            console.error('Errore parsing JSON string:', e);
            allAlimenti = [];
          }
        } else if (Array.isArray(pasto.alimenti_raw)) {
          // È già un array
          allAlimenti = pasto.alimenti_raw;
        } else {
          console.warn('Formato alimenti_raw non riconosciuto:', typeof pasto.alimenti_raw);
          allAlimenti = [];
        }
        
        // Filtra eventuali valori null
        allAlimenti = allAlimenti.filter(a => a !== null);
        
        // Ordina per ordine_alimento
        allAlimenti.sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
        
        alimenti = allAlimenti.filter(a => !a.is_alternative);
        alternative = allAlimenti.filter(a => a.is_alternative);
      }
      
      delete pasto.alimenti_raw;
      
      return {
        ...pasto,
        alimenti,
        alternative
      };
    });
    
    res.json(pastiProcessati);
    
  } catch (error) {
    console.error('❌ Errore recupero pasti pre-fatti:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pasti-prefatti/:id - Recupera un singolo pasto pre-fatto
app.get('/api/pasti-prefatti/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Query per il pasto specifico
    const [pasti] = await connection.query(
      'SELECT * FROM pasti_prefatti WHERE id = ?',
      [id]
    );
    
    if (pasti.length === 0) {
      return res.status(404).json({ error: 'Pasto non trovato' });
    }
    
    const pasto = pasti[0];
    
    // Query per gli alimenti del pasto
    const [alimenti] = await connection.query(
      `SELECT 
        id,
        nome_alimento as nome,
        quantita,
        is_alternative,
        ordine_alimento as globalOrder,
        kcal_calcolate as kcal,
        proteine_calcolate as proteine,
        carboidrati_calcolati as carboidrati,
        grassi_calcolati as grassi,
        sodio_calcolato as sodio,
        potassio_calcolato as potassio,
        calcio_calcolato as calcio,
        ferro_calcolato as ferro,
        vitamina_d_calcolata as vitaminaD,
        vitamina_a_calcolata as vitaminaA,
        vitamina_c_calcolata as vitaminaC,
        vitamina_b1_calcolata as vitaminaB1,
        vitamina_b12_calcolata as vitaminaB12,
        folati_calcolati as folati
      FROM pasti_prefatti_alimenti 
      WHERE pasto_id = ?
      ORDER BY ordine_alimento`,
      [id]
    );
    
    // Separa alimenti principali e alternative
    pasto.alimenti = alimenti.filter(a => !a.is_alternative);
    pasto.alternative = alimenti.filter(a => a.is_alternative);
    
    res.json(pasto);
    
  } catch (error) {
    console.error('❌ Errore recupero pasto:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pasti-prefatti - Crea un nuovo pasto pre-fatto
app.post('/api/pasti-prefatti', async (req, res) => {
  const { nome, categoria, descrizione, alimenti, alternative } = req.body;
  
  try {
    await connection.beginTransaction();
    
    // Calcola i totali nutrizionali del pasto (solo alimenti principali)
    let totali = {
      kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
      sodio: 0, potassio: 0, calcio: 0, ferro: 0,
      vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
      vitamina_b1: 0, vitamina_b12: 0, folati: 0
    };
    
    alimenti.forEach(food => {
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
    
    // Inserisci il pasto
    const [pastoResult] = await connection.query(
      `INSERT INTO pasti_prefatti 
       (nome, categoria, descrizione, 
        totale_kcal, totale_proteine, totale_carboidrati, totale_grassi,
        totale_sodio, totale_potassio, totale_calcio, totale_ferro,
        totale_vitamina_d, totale_vitamina_a, totale_vitamina_c,
        totale_vitamina_b1, totale_vitamina_b12, totale_folati) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome, categoria || 'generico', descrizione || null,
        totali.kcal, totali.proteine, totali.carboidrati, totali.grassi,
        totali.sodio, totali.potassio, totali.calcio, totali.ferro,
        totali.vitamina_d, totali.vitamina_a, totali.vitamina_c,
        totali.vitamina_b1, totali.vitamina_b12, totali.folati
      ]
    );
    
    const pastoId = pastoResult.insertId;
    
    // Inserisci gli alimenti principali e le alternative
    const allFoods = [];
    
    // Aggiungi alimenti principali
    alimenti.forEach((food, index) => {
      allFoods.push({
        ...food,
        is_alternative: false,
        ordine: food.globalOrder !== undefined ? food.globalOrder : index
      });
    });
    
    // Aggiungi alternative
    if (alternative && alternative.length > 0) {
      alternative.forEach((alt, index) => {
        allFoods.push({
          ...alt,
          is_alternative: true,
          ordine: alt.globalOrder !== undefined ? alt.globalOrder : alimenti.length + index
        });
      });
    }
    
    // Ordina per mantenere l'ordine corretto
    allFoods.sort((a, b) => a.ordine - b.ordine);
    
    // Inserisci tutti gli alimenti
    for (let i = 0; i < allFoods.length; i++) {
      const food = allFoods[i];
      
      // Cerca l'ID dell'alimento nella tabella alimenti
      const [alimentoResult] = await connection.query(
        'SELECT ID FROM alimenti WHERE Nome = ? LIMIT 1',
        [food.nome]
      );
      const alimentoId = alimentoResult.length > 0 ? alimentoResult[0].ID : null;
      
      await connection.query(
        `INSERT INTO pasti_prefatti_alimenti 
         (pasto_id, alimento_id, nome_alimento, quantita, is_alternative, ordine_alimento,
          kcal_calcolate, proteine_calcolate, carboidrati_calcolati, grassi_calcolati,
          sodio_calcolato, potassio_calcolato, calcio_calcolato, ferro_calcolato,
          vitamina_d_calcolata, vitamina_a_calcolata, vitamina_c_calcolata,
          vitamina_b1_calcolata, vitamina_b12_calcolata, folati_calcolati)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pastoId, alimentoId, food.nome, food.quantita || 100, food.is_alternative, i,
          food.kcal || 0, food.proteine || 0, food.carboidrati || 0, food.grassi || 0,
          food.sodio || 0, food.potassio || 0, food.calcio || 0, food.ferro || 0,
          food.vitaminaD || 0, food.vitaminaA || 0, food.vitaminaC || 0,
          food.vitaminaB1 || 0, food.vitaminaB12 || 0, food.folati || 0
        ]
      );
    }
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      id: pastoId,
      message: 'Pasto pre-fatto creato con successo' 
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Errore creazione pasto:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/pasti-prefatti/:id - Modifica un pasto pre-fatto
app.put('/api/pasti-prefatti/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, categoria, descrizione, alimenti, alternative } = req.body;
  
  try {
    await connection.beginTransaction();
    
    // Verifica che il pasto esista
    const [checkPasto] = await connection.query(
      'SELECT id FROM pasti_prefatti WHERE id = ?',
      [id]
    );
    
    if (checkPasto.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Pasto non trovato' });
    }
    
    // Calcola i nuovi totali nutrizionali
    let totali = {
      kcal: 0, proteine: 0, carboidrati: 0, grassi: 0,
      sodio: 0, potassio: 0, calcio: 0, ferro: 0,
      vitamina_d: 0, vitamina_a: 0, vitamina_c: 0,
      vitamina_b1: 0, vitamina_b12: 0, folati: 0
    };
    
    alimenti.forEach(food => {
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
    
    // Aggiorna il pasto
    await connection.query(
      `UPDATE pasti_prefatti 
       SET nome = ?, categoria = ?, descrizione = ?,
           totale_kcal = ?, totale_proteine = ?, totale_carboidrati = ?, totale_grassi = ?,
           totale_sodio = ?, totale_potassio = ?, totale_calcio = ?, totale_ferro = ?,
           totale_vitamina_d = ?, totale_vitamina_a = ?, totale_vitamina_c = ?,
           totale_vitamina_b1 = ?, totale_vitamina_b12 = ?, totale_folati = ?
       WHERE id = ?`,
      [
        nome, categoria || 'generico', descrizione || null,
        totali.kcal, totali.proteine, totali.carboidrati, totali.grassi,
        totali.sodio, totali.potassio, totali.calcio, totali.ferro,
        totali.vitamina_d, totali.vitamina_a, totali.vitamina_c,
        totali.vitamina_b1, totali.vitamina_b12, totali.folati,
        id
      ]
    );
    
    // Elimina gli alimenti esistenti
    await connection.query(
      'DELETE FROM pasti_prefatti_alimenti WHERE pasto_id = ?',
      [id]
    );
    
    // Inserisci i nuovi alimenti
    const allFoods = [];
    
    // Aggiungi alimenti principali
    alimenti.forEach((food, index) => {
      allFoods.push({
        ...food,
        is_alternative: false,
        ordine: food.globalOrder !== undefined ? food.globalOrder : index
      });
    });
    
    // Aggiungi alternative
    if (alternative && alternative.length > 0) {
      alternative.forEach((alt, index) => {
        allFoods.push({
          ...alt,
          is_alternative: true,
          ordine: alt.globalOrder !== undefined ? alt.globalOrder : alimenti.length + index
        });
      });
    }
    
    // Ordina per mantenere l'ordine corretto
    allFoods.sort((a, b) => a.ordine - b.ordine);
    
    // Inserisci tutti gli alimenti
    for (let i = 0; i < allFoods.length; i++) {
      const food = allFoods[i];
      
      // Cerca l'ID dell'alimento
      const [alimentoResult] = await connection.query(
        'SELECT ID FROM alimenti WHERE Nome = ? LIMIT 1',
        [food.nome]
      );
      const alimentoId = alimentoResult.length > 0 ? alimentoResult[0].ID : null;
      
      await connection.query(
        `INSERT INTO pasti_prefatti_alimenti 
         (pasto_id, alimento_id, nome_alimento, quantita, is_alternative, ordine_alimento,
          kcal_calcolate, proteine_calcolate, carboidrati_calcolati, grassi_calcolati,
          sodio_calcolato, potassio_calcolato, calcio_calcolato, ferro_calcolato,
          vitamina_d_calcolata, vitamina_a_calcolata, vitamina_c_calcolata,
          vitamina_b1_calcolata, vitamina_b12_calcolata, folati_calcolati)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, alimentoId, food.nome, food.quantita || 100, food.is_alternative, i,
          food.kcal || 0, food.proteine || 0, food.carboidrati || 0, food.grassi || 0,
          food.sodio || 0, food.potassio || 0, food.calcio || 0, food.ferro || 0,
          food.vitaminaD || 0, food.vitaminaA || 0, food.vitaminaC || 0,
          food.vitaminaB1 || 0, food.vitaminaB12 || 0, food.folati || 0
        ]
      );
    }
    
    await connection.commit();
    
    res.json({ 
      success: true,
      message: 'Pasto pre-fatto aggiornato con successo' 
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Errore aggiornamento pasto:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/pasti-prefatti/:id - Elimina un pasto pre-fatto
app.delete('/api/pasti-prefatti/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verifica che il pasto esista
    const [checkPasto] = await connection.query(
      'SELECT id FROM pasti_prefatti WHERE id = ?',
      [id]
    );
    
    if (checkPasto.length === 0) {
      return res.status(404).json({ error: 'Pasto non trovato' });
    }
    
    // Elimina il pasto (gli alimenti vengono eliminati automaticamente per CASCADE)
    await connection.query(
      'DELETE FROM pasti_prefatti WHERE id = ?',
      [id]
    );
    
    res.json({ 
      success: true,
      message: 'Pasto pre-fatto eliminato con successo' 
    });
    
  } catch (error) {
    console.error('❌ Errore eliminazione pasto:', error);
    res.status(500).json({ error: error.message });
  }
});

//#endregion



// === STATIC FILES ===

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === AVVIO SERVER ===
async function startServer() {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server avviato su http://localhost:${PORT}`);
    console.log(`📊 Database MySQL: ${dbConfig.database}`);
    console.log('📁 File frontend: index.html');
    console.log(`\n🎯 Apri il browser e vai su: http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

// Gestione chiusura graceful
process.on('SIGINT', async () => {
  console.log('\n⏹️  Chiusura server...');
  if (connection) {
    await connection.end();
  }
  process.exit(0);
});





