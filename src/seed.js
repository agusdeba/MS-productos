const fs = require('fs');
const path = require('path');
const { connectDb, getCollection, closeDb } = require('./db');

async function populateSeedData() {
  const collection = getCollection();

  const seedFilePath = path.join(__dirname, '..', 'productos.json');
  if (!fs.existsSync(seedFilePath)) {
    throw new Error(`Archivo de semilla no encontrado en: ${seedFilePath}`);
  }

  const rawData = fs.readFileSync(seedFilePath, 'utf-8');
  const products = JSON.parse(rawData);

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('El archivo productos.json no contiene una lista válida de productos.');
  }

  console.log(`Leídos ${products.length} productos de productos.json`);

  // Crear índices
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ categoriaId: 1 });
  await collection.createIndex({ marca: 1 });
  await collection.createIndex({ precio: 1 });

  // Vaciar y reinsertar datos limpios para mantener id único y sin duplicados
  await collection.deleteMany({});
  const result = await collection.insertMany(products);

  console.log(`Carga completada exitosamente. Se insertaron ${result.insertedCount} documentos en la colección "productos".`);
  return result;
}

async function ensureSeed() {
  try {
    const collection = getCollection();
    const count = await collection.countDocuments({});
    if (count === 0) {
      console.log('Colección "productos" vacía. Ejecutando auto-seed inicial...');
      await populateSeedData();
    }
  } catch (error) {
    console.warn('Aviso al verificar auto-seed:', error.message);
  }
}

async function seed() {
  try {
    console.log('Iniciando carga manual de datos semilla (seed)...');
    await connectDb();
    await populateSeedData();
  } catch (error) {
    console.error('Error durante la ejecución del seed:', error);
    process.exit(1);
  } finally {
    if (require.main === module) {
      await closeDb();
    }
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, ensureSeed, populateSeedData };
