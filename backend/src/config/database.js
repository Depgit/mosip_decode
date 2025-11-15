const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'agri_qcert_db',
  max: 20,                          // Maximum 20 connections
  idleTimeoutMillis: 30000,         // 30 seconds idle timeout
  connectionTimeoutMillis: 2000,    // 2 seconds connection timeout
});

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Test database connection
 */
async function connect() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully at:', result.rows.now);
    client.release();
    
    // Initialize tables after connection
    await initializeTables();
    
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('Connection details:', {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'agri_qcert_db',
      user: process.env.DB_USER || 'postgres'
    });
    throw err;
  }
}

/**
 * Execute query
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (performance monitoring)
    if (duration > 1000) {
      console.warn(`⚠️ Slow query detected (${duration}ms):\n${text.substring(0, 100)}...`);
    }
    
    return result;
  } catch (err) {
    console.error('❌ Query error:', err.message);
    console.error('Query:', text);
    throw err;
  }
}

/**
 * Initialize database tables
 */
async function initializeTables() {
  console.log('🔧 Initializing database tables...');
  
  try {
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'exporter',
        organization VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table ready');

    // Create batches table
    await query(`
      CREATE TABLE IF NOT EXISTS batches (
        id SERIAL PRIMARY KEY,
        exporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_type VARCHAR(100) NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(20) DEFAULT 'kg',
        destination VARCHAR(100),
        status VARCHAR(50) DEFAULT 'submitted',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Batches table ready');

    // Create batch attachments table
    await query(`
      CREATE TABLE IF NOT EXISTS batch_attachments (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        file_name VARCHAR(255),
        file_url VARCHAR(500),
        file_type VARCHAR(50),
        file_size BIGINT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Batch attachments table ready');

    // Create inspections table
    await query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        qa_agency_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        moisture_level DECIMAL(5, 2),
        pesticide_content DECIMAL(5, 2),
        organic_status BOOLEAN,
        quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
        pass_fail BOOLEAN,
        inspection_notes TEXT,
        inspected_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Inspections table ready');

    // Create verifiable credentials table
    await query(`
      CREATE TABLE IF NOT EXISTS verifiable_credentials (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        inspection_id INTEGER REFERENCES inspections(id) ON DELETE SET NULL,
        vc_json JSONB,
        qr_code_url TEXT,
        issuer_did VARCHAR(255),
        issued_at TIMESTAMP,
        expires_at TIMESTAMP,
        revoked BOOLEAN DEFAULT FALSE,
        revoke_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Verifiable credentials table ready');

    // Create audit logs table
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(50),
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Audit logs table ready');

    // Create indexes for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_batches_exporter ON batches(exporter_id);
      CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
      CREATE INDEX IF NOT EXISTS idx_inspections_batch ON inspections(batch_id);
      CREATE INDEX IF NOT EXISTS idx_vc_batch ON verifiable_credentials(batch_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    `);
    console.log('✅ Database indexes created');

    console.log('🎉 Database initialization complete!');

  } catch (err) {
    console.error('❌ Error initializing tables:', err.message);
    throw err;
  }
}

/**
 * Close all connections
 */
async function close() {
  await pool.end();
  console.log('🔌 Database connection pool closed');
}

// Export functions
module.exports = {
  connect,
  query,
  pool,
  close
};
