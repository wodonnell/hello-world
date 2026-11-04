const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, seedSampleData } = require('./db');

function createApp(dbInstance) {
  const app = express();
  const db = dbInstance || initDb();

  // Seed sample data if db is newly initialized
  seedSampleData(db);

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // --- STATS ENDPOINT ---
  app.get('/api/stats', (req, res) => {
    try {
      const totalRow = db.prepare('SELECT COUNT(*) as total FROM medications').get();
      const lowStockRow = db.prepare('SELECT COUNT(*) as lowStock FROM medications WHERE current_stock <= reorder_threshold').get();
      const dosetteRow = db.prepare('SELECT COUNT(*) as dosetteCount FROM medications WHERE is_dosette = 1').get();

      res.json({
        totalMedications: totalRow.total,
        lowStockCount: lowStockRow.lowStock,
        dosetteCount: dosetteRow.dosetteCount
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // --- GET ALL MEDICATIONS ---
  app.get('/api/medications', (req, res) => {
    try {
      const { lowStockOnly, dosetteOnly, search } = req.query;
      let query = 'SELECT * FROM medications WHERE 1=1';
      const params = {};

      if (lowStockOnly === 'true' || lowStockOnly === '1') {
        query += ' AND current_stock <= reorder_threshold';
      }

      if (dosetteOnly === 'true' || dosetteOnly === '1') {
        query += ' AND is_dosette = 1';
      }

      if (search && search.trim() !== '') {
        query += ' AND (name LIKE @search OR dosage LIKE @search OR form LIKE @search)';
        params.search = `%${search.trim()}%`;
      }

      query += ' ORDER BY name COLLATE NOCASE ASC';

      const medications = db.prepare(query).all(params);
      res.json(medications);
    } catch (err) {
      console.error('Error fetching medications:', err);
      res.status(500).json({ error: 'Failed to fetch medications' });
    }
  });

  // --- GET SINGLE MEDICATION ---
  app.get('/api/medications/:id', (req, res) => {
    try {
      const med = db.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id);
      if (!med) {
        return res.status(404).json({ error: 'Medication not found' });
      }
      res.json(med);
    } catch (err) {
      console.error('Error fetching medication:', err);
      res.status(500).json({ error: 'Failed to fetch medication' });
    }
  });

  // --- CREATE MEDICATION ---
  app.post('/api/medications', (req, res) => {
    try {
      const {
        name,
        dosage,
        form = 'tablet',
        current_stock = 0,
        reorder_threshold = 10,
        pack_size = 28,
        schedule_notes = '',
        instructions = '',
        is_dosette = 0,
        dosette_morning = 0,
        dosette_noon = 0,
        dosette_evening = 0,
        dosette_bedtime = 0
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Medication name is required' });
      }
      if (!dosage || !dosage.trim()) {
        return res.status(400).json({ error: 'Medication dosage is required' });
      }

      const stmt = db.prepare(`
        INSERT INTO medications (
          name, dosage, form, current_stock, reorder_threshold, pack_size,
          schedule_notes, instructions, is_dosette,
          dosette_morning, dosette_noon, dosette_evening, dosette_bedtime
        ) VALUES (
          @name, @dosage, @form, @current_stock, @reorder_threshold, @pack_size,
          @schedule_notes, @instructions, @is_dosette,
          @dosette_morning, @dosette_noon, @dosette_evening, @dosette_bedtime
        )
      `);

      const result = stmt.run({
        name: name.trim(),
        dosage: dosage.trim(),
        form: form.trim() || 'tablet',
        current_stock: Math.max(0, parseInt(current_stock, 10) || 0),
        reorder_threshold: Math.max(0, parseInt(reorder_threshold, 10) || 0),
        pack_size: Math.max(1, parseInt(pack_size, 10) || 1),
        schedule_notes: (schedule_notes || '').trim(),
        instructions: (instructions || '').trim(),
        is_dosette: is_dosette ? 1 : 0,
        dosette_morning: dosette_morning ? 1 : 0,
        dosette_noon: dosette_noon ? 1 : 0,
        dosette_evening: dosette_evening ? 1 : 0,
        dosette_bedtime: dosette_bedtime ? 1 : 0
      });

      const newMed = db.prepare('SELECT * FROM medications WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(newMed);
    } catch (err) {
      console.error('Error creating medication:', err);
      res.status(500).json({ error: 'Failed to create medication' });
    }
  });

  // --- UPDATE MEDICATION ---
  app.put('/api/medications/:id', (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      const {
        name = existing.name,
        dosage = existing.dosage,
        form = existing.form,
        current_stock = existing.current_stock,
        reorder_threshold = existing.reorder_threshold,
        pack_size = existing.pack_size,
        schedule_notes = existing.schedule_notes,
        instructions = existing.instructions,
        is_dosette = existing.is_dosette,
        dosette_morning = existing.dosette_morning,
        dosette_noon = existing.dosette_noon,
        dosette_evening = existing.dosette_evening,
        dosette_bedtime = existing.dosette_bedtime
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Medication name cannot be empty' });
      }
      if (!dosage || !dosage.trim()) {
        return res.status(400).json({ error: 'Medication dosage cannot be empty' });
      }

      db.prepare(`
        UPDATE medications SET
          name = @name,
          dosage = @dosage,
          form = @form,
          current_stock = @current_stock,
          reorder_threshold = @reorder_threshold,
          pack_size = @pack_size,
          schedule_notes = @schedule_notes,
          instructions = @instructions,
          is_dosette = @is_dosette,
          dosette_morning = @dosette_morning,
          dosette_noon = @dosette_noon,
          dosette_evening = @dosette_evening,
          dosette_bedtime = @dosette_bedtime,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id: req.params.id,
        name: name.trim(),
        dosage: dosage.trim(),
        form: form.trim() || 'tablet',
        current_stock: Math.max(0, parseInt(current_stock, 10) || 0),
        reorder_threshold: Math.max(0, parseInt(reorder_threshold, 10) || 0),
        pack_size: Math.max(1, parseInt(pack_size, 10) || 1),
        schedule_notes: (schedule_notes || '').trim(),
        instructions: (instructions || '').trim(),
        is_dosette: is_dosette ? 1 : 0,
        dosette_morning: dosette_morning ? 1 : 0,
        dosette_noon: dosette_noon ? 1 : 0,
        dosette_evening: dosette_evening ? 1 : 0,
        dosette_bedtime: dosette_bedtime ? 1 : 0
      });

      const updated = db.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (err) {
      console.error('Error updating medication:', err);
      res.status(500).json({ error: 'Failed to update medication' });
    }
  });

  // --- DELETE MEDICATION ---
  app.delete('/api/medications/:id', (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      db.prepare('DELETE FROM medications WHERE id = ?').run(req.params.id);
      res.json({ message: 'Medication deleted successfully', id: Number(req.params.id) });
    } catch (err) {
      console.error('Error deleting medication:', err);
      res.status(500).json({ error: 'Failed to delete medication' });
    }
  });

  // --- QUICK ADJUST STOCK ---
  // action can be 'dose' (-1), 'pack' (+pack_size), or custom 'delta'
  app.post('/api/medications/:id/adjust-stock', (req, res) => {
    try {
      const med = db.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id);
      if (!med) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      const { action, amount, reason } = req.body;
      let delta = 0;
      let logReason = reason || '';

      if (action === 'subtract_dose' || action === 'dose') {
        delta = -1;
        logReason = logReason || 'Dose taken';
      } else if (action === 'add_pack' || action === 'pack') {
        delta = med.pack_size || 28;
        logReason = logReason || `Added pack (+${med.pack_size})`;
      } else if (action === 'custom' || typeof amount === 'number') {
        delta = parseInt(amount, 10) || 0;
        logReason = logReason || (delta >= 0 ? `Stock added (+${delta})` : `Stock reduced (${delta})`);
      } else {
        return res.status(400).json({ error: 'Invalid adjustment action or amount' });
      }

      const newStock = Math.max(0, med.current_stock + delta);

      // Run update and log in a transaction
      const updateTx = db.transaction(() => {
        db.prepare('UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newStock, med.id);

        db.prepare(`
          INSERT INTO stock_logs (medication_id, change_amount, reason, resulting_stock)
          VALUES (?, ?, ?, ?)
        `).run(med.id, delta, logReason, newStock);
      });

      updateTx();

      const updated = db.prepare('SELECT * FROM medications WHERE id = ?').get(med.id);
      res.json({
        medication: updated,
        change: delta,
        previousStock: med.current_stock,
        newStock: newStock,
        needsReorder: newStock <= updated.reorder_threshold
      });
    } catch (err) {
      console.error('Error adjusting stock:', err);
      res.status(500).json({ error: 'Failed to adjust stock' });
    }
  });

  // --- DOSETTE WEEKLY PACK DEDUCTION ---
  // Deduct one week's worth of pills for all dosette items (or specific item IDs)
  app.post('/api/dosette/pack-week', (req, res) => {
    try {
      const { medicationIds } = req.body || {};

      let query = 'SELECT * FROM medications WHERE is_dosette = 1';
      let meds;
      if (Array.isArray(medicationIds) && medicationIds.length > 0) {
        const placeholders = medicationIds.map(() => '?').join(',');
        meds = db.prepare(`SELECT * FROM medications WHERE is_dosette = 1 AND id IN (${placeholders})`).all(medicationIds);
      } else {
        meds = db.prepare(query).all();
      }

      const deductions = [];

      const tx = db.transaction(() => {
        for (const med of meds) {
          // Daily dose count = morning + noon + evening + bedtime
          const dailyDose = (med.dosette_morning ? 1 : 0) +
                            (med.dosette_noon ? 1 : 0) +
                            (med.dosette_evening ? 1 : 0) +
                            (med.dosette_bedtime ? 1 : 0);
          const weeklyDose = dailyDose * 7;
          if (weeklyDose > 0) {
            const newStock = Math.max(0, med.current_stock - weeklyDose);
            db.prepare('UPDATE medications SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(newStock, med.id);

            db.prepare(`
              INSERT INTO stock_logs (medication_id, change_amount, reason, resulting_stock)
              VALUES (?, ?, ?, ?)
            `).run(med.id, -weeklyDose, 'Packed 1 week dosette box', newStock);

            deductions.push({
              id: med.id,
              name: med.name,
              deducted: weeklyDose,
              newStock: newStock,
              needsReorder: newStock <= med.reorder_threshold
            });
          }
        }
      });

      tx();

      res.json({
        message: 'Weekly dosette packing recorded successfully',
        deductions
      });
    } catch (err) {
      console.error('Error recording dosette pack:', err);
      res.status(500).json({ error: 'Failed to record weekly dosette packing' });
    }
  });

  return app;
}

module.exports = { createApp };
