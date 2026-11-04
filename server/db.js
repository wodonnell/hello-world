const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.NODE_ENV === 'test'
  ? ':memory:'
  : path.join(__dirname, '..', 'data', 'medications.db');

function initDb(dbPath = DB_PATH) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create medications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      form TEXT NOT NULL DEFAULT 'tablet',
      current_stock INTEGER NOT NULL DEFAULT 0,
      reorder_threshold INTEGER NOT NULL DEFAULT 10,
      pack_size INTEGER NOT NULL DEFAULT 28,
      schedule_notes TEXT DEFAULT '',
      instructions TEXT DEFAULT '',
      is_dosette INTEGER NOT NULL DEFAULT 0,
      dosette_morning INTEGER NOT NULL DEFAULT 0,
      dosette_noon INTEGER NOT NULL DEFAULT 0,
      dosette_evening INTEGER NOT NULL DEFAULT 0,
      dosette_bedtime INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      change_amount INTEGER NOT NULL,
      reason TEXT,
      resulting_stock INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(medication_id) REFERENCES medications(id) ON DELETE CASCADE
    );
  `);

  return db;
}

function seedSampleData(db) {
  const count = db.prepare('SELECT COUNT(*) as count FROM medications').get().count;
  if (count > 0) return;

  const insert = db.prepare(`
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

  const sampleMedications = [
    {
      name: 'Atorvastatin',
      dosage: '20 mg',
      form: 'tablet',
      current_stock: 6, // Low stock alert!
      reorder_threshold: 14,
      pack_size: 28,
      schedule_notes: '1 tablet nightly at bedtime',
      instructions: 'Take with or without food. Low stock alert active.',
      is_dosette: 1,
      dosette_morning: 0,
      dosette_noon: 0,
      dosette_evening: 0,
      dosette_bedtime: 1
    },
    {
      name: 'Metformin HCl',
      dosage: '500 mg',
      form: 'tablet',
      current_stock: 45,
      reorder_threshold: 20,
      pack_size: 60,
      schedule_notes: '1 tablet morning and evening with meals',
      instructions: 'Take with food to minimize GI upset.',
      is_dosette: 1,
      dosette_morning: 1,
      dosette_noon: 0,
      dosette_evening: 1,
      dosette_bedtime: 0
    },
    {
      name: 'Lisinopril',
      dosage: '10 mg',
      form: 'tablet',
      current_stock: 12, // Low stock alert!
      reorder_threshold: 14,
      pack_size: 30,
      schedule_notes: '1 tablet once daily in the morning',
      instructions: 'Monitor blood pressure regularly.',
      is_dosette: 1,
      dosette_morning: 1,
      dosette_noon: 0,
      dosette_evening: 0,
      dosette_bedtime: 0
    },
    {
      name: 'Salbutamol / Albuterol',
      dosage: '100 mcg/puff',
      form: 'inhaler',
      current_stock: 1, // Low stock (e.g. threshold 2)
      reorder_threshold: 2,
      pack_size: 1,
      schedule_notes: '1-2 puffs as needed for shortness of breath',
      instructions: 'Shake well before each actuation.',
      is_dosette: 0,
      dosette_morning: 0,
      dosette_noon: 0,
      dosette_evening: 0,
      dosette_bedtime: 0
    },
    {
      name: 'Vitamin D3 (Cholecalciferol)',
      dosage: '1000 IU',
      form: 'capsule',
      current_stock: 75,
      reorder_threshold: 15,
      pack_size: 90,
      schedule_notes: '1 capsule daily with noon meal',
      instructions: 'Take with fat-containing meal for absorption.',
      is_dosette: 1,
      dosette_morning: 0,
      dosette_noon: 1,
      dosette_evening: 0,
      dosette_bedtime: 0
    },
    {
      name: 'Omeprazole',
      dosage: '20 mg',
      form: 'capsule',
      current_stock: 35,
      reorder_threshold: 14,
      pack_size: 28,
      schedule_notes: '1 capsule morning 30 mins before breakfast',
      instructions: 'Swallow whole with a glass of water.',
      is_dosette: 1,
      dosette_morning: 1,
      dosette_noon: 0,
      dosette_evening: 0,
      dosette_bedtime: 0
    },
    {
      name: 'Fluticasone Propionate',
      dosage: '50 mcg/actuation',
      form: 'nasal spray',
      current_stock: 3,
      reorder_threshold: 2,
      pack_size: 1,
      schedule_notes: '2 sprays in each nostril once daily',
      instructions: 'Prime before first use.',
      is_dosette: 0,
      dosette_morning: 0,
      dosette_noon: 0,
      dosette_evening: 0,
      dosette_bedtime: 0
    }
  ];

  const insertMany = db.transaction((meds) => {
    for (const med of meds) {
      insert.run(med);
    }
  });

  insertMany(sampleMedications);
}

module.exports = {
  initDb,
  seedSampleData,
  DB_PATH
};
