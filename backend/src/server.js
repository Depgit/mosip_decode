const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('🚀 Starting AgriQCert Backend Server...\n');
    
    // Connect to database and initialize tables
    await db.connect();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🔗 API URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health\n`);
    });

  } catch (err) {
    console.error('\n❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

// Start the server
startServer();
