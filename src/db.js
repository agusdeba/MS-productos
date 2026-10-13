const { MongoClient } = require('mongodb');
require('dotenv').config();

const configuredUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/productos_db';
const dbName = process.env.DB_NAME || 'productos_db';
const collectionName = process.env.COLLECTION_NAME || 'productos';

let client = null;
let db = null;

async function connectDb() {
  if (db) return db;

  try {
    client = new MongoClient(configuredUri, {
      serverSelectionTimeoutMS: 4000,
    });
    await client.connect();
    db = client.db(dbName);
    console.log(`Conectado a MongoDB: base de datos "${dbName}"`);
    return db;
  } catch (error) {
    // Si la URI configurada era Atlas y falló, intentar fallback a MongoDB local si está disponible
    if (configuredUri.startsWith('mongodb+srv://')) {
      console.warn(
        `[AVISO] No se pudo conectar a MongoDB Atlas (${error.message}).\n` +
        `Revisá si la IP actual está autorizada en MongoDB Atlas (Network Access -> Add 0.0.0.0/0).\n` +
        `Intentando conectar a instancia local en mongodb://127.0.0.1:27017...`
      );
      try {
        const localUri = 'mongodb://127.0.0.1:27017';
        client = new MongoClient(localUri, {
          serverSelectionTimeoutMS: 2000,
        });
        await client.connect();
        db = client.db(dbName);
        console.log(`[OK] Conectado exitosamente a MongoDB local: base de datos "${dbName}"`);
        return db;
      } catch (localError) {
        throw new Error(
          `No se pudo conectar ni a Atlas ni a MongoDB local:\n` +
          `Atlas: ${error.message}\n` +
          `Local: ${localError.message}`
        );
      }
    }
    throw error;
  }
}

function getDb() {
  if (!db) {
    throw new Error('Base de datos no inicializada. Llame a connectDb() primero.');
  }
  return db;
}

function getCollection(name = collectionName) {
  return getDb().collection(name);
}

async function checkHealth() {
  try {
    if (!client || !db) {
      await connectDb();
    }
    const pingResult = await db.command({ ping: 1 });
    return pingResult && pingResult.ok === 1;
  } catch (error) {
    console.error('Error al verificar la salud de MongoDB:', error.message);
    return false;
  }
}

async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connectDb,
  getDb,
  getCollection,
  checkHealth,
  closeDb,
  collectionName,
};
