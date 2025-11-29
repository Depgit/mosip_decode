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
        original_name VARCHAR(255),
        uploaded_by INTEGER REFERENCES users(id),
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


    await query(`
      CREATE TABLE IF NOT EXISTS qa_agencies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agency_name VARCHAR(255) NOT NULL,
        certification_number VARCHAR(100) UNIQUE,
        specialization TEXT[], -- Array of product types they handle
        max_capacity INTEGER DEFAULT 10, -- Max concurrent inspections
        current_load INTEGER DEFAULT 0, -- Current active inspections
        rating DECIMAL(3, 2) DEFAULT 5.00,
        status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended
        address TEXT,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS inspection_requests (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        qa_agency_id INTEGER NOT NULL REFERENCES qa_agencies(id),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, rejected, completed
        accepted_at TIMESTAMP,
        rejected_at TIMESTAMP,
        rejection_reason TEXT,
        priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
        scheduled_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(batch_id, qa_agency_id) -- Prevent duplicate requests
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info', -- info, warning, success, error
        reference_type VARCHAR(50), -- batch, inspection, request
        reference_id INTEGER,
        read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS extracted_data (
        id SERIAL PRIMARY KEY,
        attachment_id INTEGER REFERENCES batch_attachments(id) ON DELETE CASCADE,
        batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE,
        document_type VARCHAR(50),
        moisture_level DECIMAL(5,2),
        pesticide_content DECIMAL(8,3),
        pesticide_unit VARCHAR(20),
        organic_status BOOLEAN,
        iso_codes TEXT[],
        lab_name VARCHAR(255),
        test_date DATE,
        batch_number VARCHAR(100),
        certificate_number VARCHAR(100),
        expiry_date DATE,
        raw_extracted_text TEXT,
        extracted_entities JSONB,
        confidence_score DECIMAL(3,2),
        extraction_method VARCHAR(50),
        status VARCHAR(50) DEFAULT 'completed',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Extracted data table ready');

    await query(`
      CREATE TABLE IF NOT EXISTS verifiable_credentials (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        qa_agency_id INTEGER NOT NULL REFERENCES qa_agencies(id),
        vc_data JSONB NOT NULL,
        qr_code_url TEXT,
        qr_code_image TEXT,
        status VARCHAR(50) DEFAULT 'active',
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_batches_exporter ON batches(exporter_id);
      CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
      CREATE INDEX IF NOT EXISTS idx_inspections_batch ON inspections(batch_id);
      CREATE INDEX IF NOT EXISTS idx_vc_batch ON verifiable_credentials(batch_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_inspection_requests_batch ON inspection_requests(batch_id);
      CREATE INDEX IF NOT EXISTS idx_inspection_requests_qa ON inspection_requests(qa_agency_id);
      CREATE INDEX IF NOT EXISTS idx_inspection_requests_status ON inspection_requests(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
      CREATE INDEX IF NOT EXISTS idx_qa_agencies_status ON qa_agencies(status);
      CREATE INDEX IF NOT EXISTS idx_extracted_data_attachment ON extracted_data(attachment_id);
      CREATE INDEX IF NOT EXISTS idx_extracted_data_batch ON extracted_data(batch_id);
    `);
    console.log('✅ Database indexes created');


    console.log('✅ Quality check tables ready');

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

// // Export functions
module.exports = {
  connect,
  query,
  pool,
  close
};

// module.exports = {
//   query: (text, params) => pool.query(text, params),
//   connect: () => pool.connect(),
//   pool: pool
// };
