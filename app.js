// app.js
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
require('dotenv').config();

// Create Express app
const app = express();

// Serve static files from /public (e.g. public/dashboard.html)
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Swagger setup
const swaggerUi   = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Retail API',
      version: '1.0.0',
      description: 'API for Online Retail II Dataset',
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 3000}` }],
  },
  apis: ['./routes/*.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount your retail routes
const retailRoutes = require('./routes/retail');
app.use('/api/retail', retailRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
