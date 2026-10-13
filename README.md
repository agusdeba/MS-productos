# Microservicio de Productos

Microservicio de solo lectura para el catálogo de productos a la venta, implementado en **Node.js** y **Express** con persistencia en **MongoDB**, siguiendo estrictamente la especificación **OpenAPI 3.0** provista en [`productos.yaml`](./productos.yaml).

---

## 📋 Endpoints Implementados

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/health` | Estado del servicio y conectividad con la base de datos |
| `GET` | `/items` | Lista de productos ordenados por `id` asc, con filtros y paginación (`limit`, `offset`) |
| `GET` | `/items/:id` | Detalle de un producto individual por identificador (ej. `PRD001`) |
| `GET` | `/docs` | Documentación interactiva Swagger UI generada a partir de `productos.yaml` |

---

## 🛠️ Tecnologías y Características

- **Node.js** (v18+) & **Express**
- **MongoDB** (Driver oficial nativo `mongodb`)
- **Swagger UI** (`swagger-ui-express` + `yaml`)
- **Tests Automatizados** (`node:test` + `supertest`)
- **Reglas del Contrato OpenAPI cumplidas**:
  - Parámetros de consulta para `GET /items`:
    - `categoriaId`: Valida formato con regex `^CAT[0-9]+$` (devuelve `400 bad_request` si no coincide).
    - `marca`: Coincidencia exacta sin distinguir mayúsculas ni minúsculas.
    - `precioMin` y `precioMax`: Filtros numéricos >= 0. Valida tipos y que `precioMin <= precioMax`.
    - `limit`: Entero entre 1 y 100 (por defecto 20).
    - `offset`: Entero >= 0 (por defecto 0).
  - Paginación y total: `total` refleja la cantidad de elementos que coinciden con los filtros sin limitar por la página.
  - Orden ascendente por `id`.
  - Exclusión del campo interno `_id` de MongoDB para mantener la fidelidad exacta a los datos de la semilla.
  - Errores estandarizados en formato `{ "error": "<codigo>", "message": "<detalle>" }`.

---

## 📁 Estructura del Proyecto

```text
actividad-microservicio/
├── src/
│   ├── app.js         # Configuración de Express, middlewares y rutas
│   ├── db.js          # Conexión y health check de MongoDB (con fallback local/Atlas)
│   ├── seed.js        # Script de carga inicial de datos desde productos.json
│   └── server.js      # Punto de entrada y arranque del servidor HTTP
├── tests/
│   └── app.test.js    # Suite de pruebas unitarias y de integración
├── productos.json     # Datos semilla (30 productos)
├── productos.yaml     # Especificación OpenAPI 3.0 del microservicio
├── .env.example       # Plantilla de variables de entorno
├── .gitignore         # Exclusión de archivos sensibles y node_modules
├── package.json       # Dependencias y scripts
└── README.md          # Documentación del proyecto
```

---

## ⚙️ Configuración y Variables de Entorno

Creá un archivo `.env` en la raíz del proyecto (podés copiarlo desde `.env.example`):

```bash
cp .env.example .env
```

Contenido de ejemplo para `.env`:

```env
PORT=3000

# Conexión local:
MONGODB_URI=mongodb://127.0.0.1:27017/productos_db

# Conexión Atlas (para producción / Render):
# MONGODB_URI=mongodb+srv://<usuario>:<password>@cluster0.zwmn9yp.mongodb.net/?retryWrites=true&w=majority

DB_NAME=productos_db
COLLECTION_NAME=productos
SERVICE_NAME=grupo-03-productos
VERSION=1.0.0
```

> **Nota sobre MongoDB Atlas:**  
> Si usás un clúster de MongoDB Atlas, asegurate de permitir el acceso de red en la consola de Atlas:  
> **Network Access** → **Add IP Address** → **Allow Access from Anywhere (`0.0.0.0/0`)** para que tanto tu máquina como plataformas como Render puedan conectarse sin bloqueos de firewall.

---

## 🚀 Instalación y Ejecución Local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Cargar los datos semilla (Seed)
Ejecutá el script de carga para poblar la colección `productos` en MongoDB con el archivo `productos.json`:
```bash
npm run seed
```

### 3. Iniciar el microservicio
Modo producción / normal:
```bash
npm start
```

Modo desarrollo (con recarga automática ante cambios):
```bash
npm run dev
```

El servicio estará disponible en:
- API & Swagger Docs: [http://localhost:3000/docs](http://localhost:3000/docs)
- Health Check: [http://localhost:3000/health](http://localhost:3000/health)
- Catálogo de productos: [http://localhost:3000/items](http://localhost:3000/items)

---

## 🧪 Pruebas Automatizadas

El proyecto incluye 15 pruebas de integración que validan exhaustivamente cada una de las reglas del contrato OpenAPI (`GET /health`, filtros de `GET /items`, validaciones de parámetros `400`, `GET /items/:id`, no existencia `404`, Swagger UI):

```bash
npm test
```

---

## ☁️ Despliegue en Render

1. Subí este código al repositorio de GitHub (ver sección siguiente).
2. Entrá en [Render.com](https://render.com) y creá un **New Web Service**.
3. Conectá el repositorio `MS-productos`.
4. Configurá las opciones del servicio:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
5. En la sección **Environment Variables**, configurá:
   - `MONGODB_URI`: la cadena de conexión de MongoDB Atlas.
   - `DB_NAME`: `productos_db`
   - `COLLECTION_NAME`: `productos`
   - `SERVICE_NAME`: `grupo-03-productos`
   - `VERSION`: `1.0.0`
6. Para poblar la base de datos de Atlas por única vez:
   - Podés ejecutar localmente `npm run seed` con la variable `MONGODB_URI` apuntando a tu Atlas, o
   - En la consola (Shell) de Render ejecutar `npm run seed`.
