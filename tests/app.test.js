const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { connectDb, closeDb } = require('../src/db');
const { seed } = require('../src/seed');

describe('Microservicio de Productos - Tests de Contrato OpenAPI', () => {
  before(async () => {
    await connectDb();
    await seed();
  });

  after(async () => {
    await closeDb();
  });

  describe('GET /health', () => {
    test('Debe responder 200 con el estado del servicio y colección productos', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.collection, 'productos');
      assert.ok(res.body.service);
      assert.ok(res.body.version);
    });
  });

  describe('GET /items', () => {
    test('Debe devolver la lista de productos por defecto (ordenados por id asc, limit 20)', async () => {
      const res = await request(app).get('/items');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
      assert.equal(res.body.limit, 20);
      assert.equal(res.body.offset, 0);
      assert.equal(res.body.total, 30);
      assert.equal(res.body.items.length, 20);

      // Verificar orden ascendente por id
      assert.equal(res.body.items[0].id, 'PRD001');
      assert.equal(res.body.items[1].id, 'PRD002');

      // Verificar que ningún item expone _id de MongoDB
      res.body.items.forEach((item) => {
        assert.equal(item._id, undefined);
        assert.ok(item.id);
        assert.ok(item.nombre);
        assert.ok(item.categoriaId);
        assert.ok(item.marca);
        assert.equal(typeof item.precio, 'number');
        assert.equal(item.moneda, 'ARS');
        assert.equal(typeof item.activo, 'boolean');
      });
    });

    test('Debe soportar paginación con limit y offset', async () => {
      const res = await request(app).get('/items?limit=5&offset=5');
      assert.equal(res.status, 200);
      assert.equal(res.body.limit, 5);
      assert.equal(res.body.offset, 5);
      assert.equal(res.body.items.length, 5);
      assert.equal(res.body.items[0].id, 'PRD006');
    });

    test('Debe filtrar por categoriaId exacta', async () => {
      const res = await request(app).get('/items?categoriaId=CAT02');
      assert.equal(res.status, 200);
      assert.ok(res.body.items.length > 0);
      res.body.items.forEach((item) => {
        assert.equal(item.categoriaId, 'CAT02');
      });
    });

    test('Debe responder 400 si categoriaId tiene formato inválido', async () => {
      const res = await request(app).get('/items?categoriaId=INVALIDA');
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'bad_request');
      assert.ok(res.body.message);
    });

    test('Debe filtrar por marca sin distinguir mayúsculas/minúsculas', async () => {
      const res = await request(app).get('/items?marca=nova');
      assert.equal(res.status, 200);
      assert.ok(res.body.items.length > 0);
      res.body.items.forEach((item) => {
        assert.equal(item.marca.toLowerCase(), 'nova');
      });
    });

    test('Debe filtrar por rango de precio (precioMin y precioMax)', async () => {
      const res = await request(app).get('/items?precioMin=50000&precioMax=150000');
      assert.equal(res.status, 200);
      assert.ok(res.body.items.length > 0);
      res.body.items.forEach((item) => {
        assert.ok(item.precio >= 50000 && item.precio <= 150000);
      });
    });

    test('Debe responder 400 si precioMin > precioMax', async () => {
      const res = await request(app).get('/items?precioMin=200000&precioMax=100000');
      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'bad_request');
    });

    test('Debe responder 400 si limit es inválido (fuera de 1..100)', async () => {
      const resZero = await request(app).get('/items?limit=0');
      assert.equal(resZero.status, 400);
      assert.equal(resZero.body.error, 'bad_request');

      const resTooBig = await request(app).get('/items?limit=101');
      assert.equal(resTooBig.status, 400);
      assert.equal(resTooBig.body.error, 'bad_request');

      const resNotNum = await request(app).get('/items?limit=abc');
      assert.equal(resNotNum.status, 400);
      assert.equal(resNotNum.body.error, 'bad_request');
    });

    test('Debe responder 400 si offset es inválido (< 0 o no número)', async () => {
      const resNeg = await request(app).get('/items?offset=-1');
      assert.equal(resNeg.status, 400);
      assert.equal(resNeg.body.error, 'bad_request');

      const resNotNum = await request(app).get('/items?offset=abc');
      assert.equal(resNotNum.status, 400);
      assert.equal(resNotNum.body.error, 'bad_request');
    });
  });

  describe('GET /items/:id', () => {
    test('Debe devolver el detalle del producto cuando existe', async () => {
      const res = await request(app).get('/items/PRD001');
      assert.equal(res.status, 200);
      assert.equal(res.body.id, 'PRD001');
      assert.equal(res.body.nombre, 'Smartphone Nova X1 128GB');
      assert.equal(res.body._id, undefined);
    });

    test('Debe devolver 404 con formato de error si el id no existe', async () => {
      const res = await request(app).get('/items/PRD999');
      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'not_found');
      assert.equal(res.body.message, 'No existe PRD999.');
    });
  });

  describe('Documentación y navegación', () => {
    test('Debe redirigir / hacia /docs', async () => {
      const res = await request(app).get('/');
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, '/docs');
    });

    test('Debe servir Swagger UI en /docs/', async () => {
      const res = await request(app).get('/docs/');
      assert.equal(res.status, 200);
      assert.ok(res.text.includes('swagger-ui') || res.text.includes('Swagger UI'));
    });
  });

  describe('Rutas inexistentes', () => {
    test('Debe devolver 404 en rutas no registradas', async () => {
      const res = await request(app).get('/ruta-inexistente');
      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'not_found');
    });
  });
});
