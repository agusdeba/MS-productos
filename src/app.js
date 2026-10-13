const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');
const { getCollection, checkHealth } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// Exponer la documentación interactiva OpenAPI en /docs
try {
  const yamlContent = fs.readFileSync(path.join(__dirname, '..', 'productos.yaml'), 'utf8');
  const openApiDocument = YAML.parse(yamlContent);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
} catch (err) {
  console.warn('No se pudo cargar productos.yaml para Swagger UI:', err.message);
}

// Función auxiliar para escapar caracteres especiales en expresiones regulares
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * GET /health
 * Estado del servicio
 */
app.get('/health', async (req, res) => {
  try {
    const isDbOk = await checkHealth();
    if (!isDbOk) {
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'La base de datos no está operativa.',
      });
    }

    return res.status(200).json({
      status: 'ok',
      service: process.env.SERVICE_NAME || 'grupo-03-productos',
      collection: 'productos',
      version: process.env.VERSION || '1.0.0',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'internal_server_error',
      message: error.message || 'Error al verificar estado del servicio.',
    });
  }
});

/**
 * GET /items
 * Lista de productos con filtros y paginación
 */
app.get('/items', async (req, res) => {
  try {
    const { categoriaId, marca, precioMin, precioMax, limit: limitQuery, offset: offsetQuery } = req.query;

    const query = {};

    // Validación de categoriaId: ^CAT[0-9]+$
    if (categoriaId !== undefined) {
      const catRegex = /^CAT[0-9]+$/;
      if (!catRegex.test(categoriaId)) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'El parámetro categoriaId debe cumplir con el patrón ^CAT[0-9]+$.',
        });
      }
      query.categoriaId = categoriaId;
    }

    // Validación y filtro de marca (coincidencia exacta sin distinguir mayúsculas)
    if (marca !== undefined) {
      if (typeof marca !== 'string' || marca.trim() === '') {
        return res.status(400).json({
          error: 'bad_request',
          message: 'El parámetro marca no puede estar vacío.',
        });
      }
      query.marca = { $regex: new RegExp(`^${escapeRegex(marca)}$`, 'i') };
    }

    // Validación de precioMin: number >= 0
    let minPrice;
    if (precioMin !== undefined) {
      minPrice = Number(precioMin);
      if (isNaN(minPrice) || minPrice < 0) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'El parámetro precioMin debe ser un número mayor o igual a 0.',
        });
      }
    }

    // Validación de precioMax: number >= 0
    let maxPrice;
    if (precioMax !== undefined) {
      maxPrice = Number(precioMax);
      if (isNaN(maxPrice) || maxPrice < 0) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'El parámetro precioMax debe ser un número mayor o igual a 0.',
        });
      }
    }

    // Rango coherente de precio
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'El parámetro precioMin no puede ser mayor que precioMax.',
      });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.precio = {};
      if (minPrice !== undefined) query.precio.$gte = minPrice;
      if (maxPrice !== undefined) query.precio.$lte = maxPrice;
    }

    // Validación de limit: integer entre 1 y 100 (default 20)
    let limit = 20;
    if (limitQuery !== undefined) {
      const parsedLimit = Number(limitQuery);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'El parámetro limit debe estar entre 1 y 100.',
        });
      }
      limit = parsedLimit;
    }

    // Validación de offset: integer >= 0 (default 0)
    let offset = 0;
    if (offsetQuery !== undefined) {
      const parsedOffset = Number(offsetQuery);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'El parámetro offset debe ser un entero mayor o igual a 0.',
        });
      }
      offset = parsedOffset;
    }

    const collection = getCollection();

    // Contar total que cumple los filtros sin considerar paginación
    const total = await collection.countDocuments(query);

    // Obtener elementos ordenados por id ascendente con paginación limit/offset
    const items = await collection
      .find(query, { projection: { _id: 0 } })
      .sort({ id: 1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      items,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'internal_server_error',
      message: error.message || 'Error al obtener la lista de productos.',
    });
  }
});

/**
 * GET /items/:id
 * Detalle de un producto por id
 */
app.get('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const collection = getCollection();
    const item = await collection.findOne({ id }, { projection: { _id: 0 } });

    if (!item) {
      return res.status(404).json({
        error: 'not_found',
        message: `No existe ${id}.`,
      });
    }

    return res.status(200).json(item);
  } catch (error) {
    return res.status(500).json({
      error: 'internal_server_error',
      message: error.message || 'Error al obtener el producto.',
    });
  }
});

// Redirección o página principal
app.get('/', (req, res) => {
  res.redirect('/docs');
});

// Manejo de rutas inexistentes (404)
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
  });
});

// Manejador general de errores
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    error: 'internal_server_error',
    message: err.message || 'Error interno del servidor.',
  });
});

module.exports = app;
