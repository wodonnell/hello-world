const request = require('supertest');
const assert = require('assert');
const Database = require('better-sqlite3');
const { initDb, seedSampleData } = require('../server/db');
const { createApp } = require('../server/app');

describe('Medication & Health Stock API Tests', () => {
  let app;
  let db;

  beforeEach(() => {
    // In-memory isolated db for each test run
    db = initDb(':memory:');
    seedSampleData(db);
    app = createApp(db);
  });

  it('GET /api/stats should return correct summary counters', async () => {
    const res = await request(app).get('/api/stats');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body.totalMedications, 'number');
    assert.strictEqual(typeof res.body.lowStockCount, 'number');
    assert.strictEqual(typeof res.body.dosetteCount, 'number');
    assert(res.body.totalMedications >= 7);
    assert(res.body.lowStockCount >= 1);
  });

  it('GET /api/medications should return all medications sorted by name', async () => {
    const res = await request(app).get('/api/medications');
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body));
    assert(res.body.length >= 7);
    assert.strictEqual(res.body[0].name, 'Atorvastatin');
  });

  it('GET /api/medications?lowStockOnly=true should filter low stock items', async () => {
    const res = await request(app).get('/api/medications?lowStockOnly=true');
    assert.strictEqual(res.status, 200);
    for (const item of res.body) {
      assert(item.current_stock <= item.reorder_threshold);
    }
  });

  it('GET /api/medications?dosetteOnly=true should filter dosette items', async () => {
    const res = await request(app).get('/api/medications?dosetteOnly=true');
    assert.strictEqual(res.status, 200);
    for (const item of res.body) {
      assert.strictEqual(item.is_dosette, 1);
    }
  });

  it('POST /api/medications should create a new medication', async () => {
    const newMed = {
      name: 'Amoxicillin',
      dosage: '500 mg',
      form: 'capsule',
      current_stock: 21,
      reorder_threshold: 7,
      pack_size: 21,
      schedule_notes: '1 capsule 3 times daily with food',
      instructions: 'Complete full course',
      is_dosette: 1,
      dosette_morning: 1,
      dosette_noon: 1,
      dosette_evening: 1,
      dosette_bedtime: 0
    };

    const res = await request(app).post('/api/medications').send(newMed);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.name, 'Amoxicillin');
    assert.strictEqual(res.body.current_stock, 21);
    assert.strictEqual(res.body.dosette_morning, 1);
  });

  it('PUT /api/medications/:id should update medication details', async () => {
    const res = await request(app)
      .put('/api/medications/1')
      .send({
        name: 'Atorvastatin Calcium',
        dosage: '40 mg',
        current_stock: 15
      });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'Atorvastatin Calcium');
    assert.strictEqual(res.body.dosage, '40 mg');
    assert.strictEqual(res.body.current_stock, 15);
  });

  it('POST /api/medications/:id/adjust-stock should handle -1 dose and +pack', async () => {
    // Current stock for id 2 (Metformin) is 45
    const doseRes = await request(app)
      .post('/api/medications/2/adjust-stock')
      .send({ action: 'dose' });
    assert.strictEqual(doseRes.status, 200);
    assert.strictEqual(doseRes.body.newStock, 44);

    // Now add pack (+60)
    const packRes = await request(app)
      .post('/api/medications/2/adjust-stock')
      .send({ action: 'pack' });
    assert.strictEqual(packRes.status, 200);
    assert.strictEqual(packRes.body.newStock, 104);
  });

  it('POST /api/medications/:id/adjust-stock should handle custom adjustment', async () => {
    const res = await request(app)
      .post('/api/medications/2/adjust-stock')
      .send({ action: 'custom', amount: -10, reason: 'Lost tablet strip' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.newStock, 35);
  });

  it('DELETE /api/medications/:id should delete medication', async () => {
    const res = await request(app).delete('/api/medications/1');
    assert.strictEqual(res.status, 200);

    const getRes = await request(app).get('/api/medications/1');
    assert.strictEqual(getRes.status, 404);
  });

  it('POST /api/dosette/pack-week should deduct 7 days worth of dosette pills', async () => {
    // Metformin (id 2) has morning: 1, evening: 1 => 2 per day * 7 = 14 pills
    const initialMed = db.prepare('SELECT current_stock FROM medications WHERE id = 2').get();
    const initialStock = initialMed.current_stock;

    const res = await request(app)
      .post('/api/dosette/pack-week')
      .send({ medicationIds: [2] });

    assert.strictEqual(res.status, 200);
    const updatedMed = db.prepare('SELECT current_stock FROM medications WHERE id = 2').get();
    assert.strictEqual(updatedMed.current_stock, initialStock - 14);
  });
});
