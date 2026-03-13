import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const { collection } = req.query; // e.g. /api/cars?collection=ford-search
  const collectionName = collection || 'main';

  // The database URL is provided by Vercel automatically as POSTGRES_URL or DATABASE_URL
  const sql = neon(process.env.DATABASE_URL);

  try {
    // ── Table Initialization (Ensures table exists) ──
    // Note: In Neon, we call the function with the query string and params
    await sql(`
      CREATE TABLE IF NOT EXISTS cars (
        id SERIAL PRIMARY KEY,
        registration TEXT NOT NULL,
        make TEXT,
        colour TEXT,
        year TEXT,
        engine_capacity INTEGER,
        fuel_type TEXT,
        mot_status TEXT,
        mot_expiry DATE,
        tax_status TEXT,
        tax_due_date DATE,
        co2 INTEGER,
        price NUMERIC,
        mileage NUMERIC,
        url TEXT,
        notes TEXT,
        starred BOOLEAN DEFAULT FALSE,
        collection TEXT DEFAULT 'main',
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        month_of_first_registration TEXT
      );
    `);

    // ── GET: Fetch cars ──
    if (req.method === 'GET') {
      const rows = await sql('SELECT * FROM cars WHERE collection = $1 ORDER BY timestamp DESC', [collectionName]);
      return res.status(200).json(rows);
    }

    // ── POST: Create or Update ──
    if (req.method === 'POST') {
      const c = req.body;
      
      if (c.id) {
        // Update
        await sql(`
          UPDATE cars SET
            registration = $1,
            make = $2,
            colour = $3,
            year = $4,
            engine_capacity = $5,
            fuel_type = $6,
            mot_status = $7,
            mot_expiry = $8,
            tax_status = $9,
            tax_due_date = $10,
            co2 = $11,
            price = $12,
            mileage = $13,
            url = $14,
            notes = $15,
            starred = $16,
            month_of_first_registration = $17
          WHERE id = $18 AND collection = $19
        `, [
          c.registration, c.make, c.colour, c.year, c.engineCapacity, c.fuelType,
          c.motStatus, c.motExpiry || null, c.taxStatus, c.taxDueDate || null, c.co2,
          c.price, c.mileage, c.url, c.notes, c.starred || false, c.monthOfFirstRegistration,
          c.id, collectionName
        ]);
        return res.status(200).json({ success: true, id: c.id });
      } else {
        // Create
        const rows = await sql(`
          INSERT INTO cars (
            registration, make, colour, year, engine_capacity, fuel_type, 
            mot_status, mot_expiry, tax_status, tax_due_date, co2, 
            price, mileage, url, notes, starred, collection, 
            month_of_first_registration
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17,
            $18
          ) RETURNING id
        `, [
          c.registration, c.make, c.colour, c.year, c.engineCapacity, c.fuelType,
          c.motStatus, c.motExpiry || null, c.taxStatus, c.taxDueDate || null, c.co2,
          c.price, c.mileage, c.url, c.notes, c.starred || false, collectionName,
          c.month_of_first_registration
        ]);
        return res.status(201).json({ success: true, id: rows[0].id });
      }
    }

    // ── DELETE: Remove car ──
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID required' });
      
      await sql('DELETE FROM cars WHERE id = $1 AND collection = $2', [id, collectionName]);
      return res.status(200).json({ success: true });
    }

    // ── PATCH: Toggle Star ──
    if (req.method === 'PATCH') {
      const { id, starred } = req.body;
      await sql('UPDATE cars SET starred = $1 WHERE id = $2 AND collection = $3', [starred, id, collectionName]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
