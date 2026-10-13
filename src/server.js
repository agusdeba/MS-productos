require('dotenv').config();
const app = require('./app');
const { connectDb, closeDb } = require('./db');
const { ensureSeed } = require('./seed');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDb();
    await ensureSeed();
    const server = app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`Microservicio de Productos ejecutándose`);
      console.log(`Puerto: http://localhost:${PORT}`);
      console.log(`Documentación OpenAPI (Swagger): http://localhost:${PORT}/docs`);
      console.log(`Health Check: http://localhost:${PORT}/health`);
      console.log(`===============================================`);
    });

    const gracefulShutdown = async () => {
      console.log('\nCerrando servidor y conexión a base de datos...');
      server.close(async () => {
        await closeDb();
        console.log('Servidor finalizado limpiamente.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
