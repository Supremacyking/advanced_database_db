const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'online_retail_db',
    password: process.env.DB_PASSWORD || '424pus@Kamuiru',
    port: process.env.DB_PORT || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Validation middleware
const validateProduct = (req, res, next) => {
    const { stock_code, description, unit_price } = req.body;

    if (!stock_code || !description) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['stock_code', 'description']
        });
    }

    if (typeof stock_code !== 'string' || stock_code.length > 20) {
        return res.status(400).json({
            error: 'stock_code must be a string with maximum 20 characters'
        });
    }

    if (unit_price !== undefined && (isNaN(unit_price) || unit_price <= 0)) {
        return res.status(400).json({
            error: 'unit_price must be a positive number'
        });
    }

    next();
};

// Error handling middleware
const handleDatabaseError = (error, res) => {
    console.error('Database error:', error);

    if (error.code === '23505') { // Unique violation
        return res.status(409).json({
            error: 'Product with this stock_code already exists'
        });
    }

    if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({
            error: 'Referenced record does not exist'
        });
    }

    if (error.code === '23514') { // Check constraint violation
        return res.status(400).json({
            error: 'Data violates database constraints (e.g., negative stock or zero price)'
        });
    }

    return res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Database operation failed'
    });
};

// CRUD API Endpoints

// 1. GET /api/products - Get all products 
app.get('/api/products', async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            sort_by = 'stock_code',
            sort_order = 'ASC',
            category_id = null,
            is_active = null
        } = req.query;

        const offset = (page - 1) * limit;
        const validSortColumns = [
            'product_id', 'stock_code', 'description', 'unit_price', 
            'stock_quantity', 'created_at', 'updated_at'
        ];
        const validSortOrders = ['ASC', 'DESC'];

        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'stock_code';
        const sortOrderValue = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';

        // Build dynamic WHERE conditions
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Search condition
        if (search) {
            whereConditions.push(`(description ILIKE $${paramIndex} OR stock_code ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        // Category filter
        if (category_id) {
            whereConditions.push(`category_id = $${paramIndex}`);
            queryParams.push(category_id);
            paramIndex++;
        }

        // Active status filter
        if (is_active !== null) {
            whereConditions.push(`is_active = $${paramIndex}`);
            queryParams.push(is_active === 'true');
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Main query with pagination and sorting
        const query = `
            SELECT 
                product_id,
                stock_code,
                description,
                category_id,
                unit_price,
                stock_quantity,
                reorder_level,
                supplier_info,
                is_active,
                weight,
                dimensions,
                created_at,
                updated_at
            FROM products 
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrderValue}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM products 
            ${whereClause}
        `;

        queryParams.push(limit, offset);

        const [productsResult, countResult] = await Promise.all([
            client.query(query, queryParams),
            client.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
        ]);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: productsResult.rows,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_records: total,
                limit: parseInt(limit),
                has_next: page < totalPages,
                has_prev: page > 1
            }
        });

    } catch (error) {
        handleDatabaseError(error, res);
    } finally {
        client.release();
    }
});

// 2. GET /api/products/:id - Get a specific product by product_id or stock_code
app.get('/api/products/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        
        // Check if id is numeric (product_id) or string (stock_code)
        const isNumeric = !isNaN(id) && !isNaN(parseFloat(id));
        const searchField = isNumeric ? 'product_id' : 'stock_code';
        const searchValue = isNumeric ? parseInt(id) : id;

        const query = `
            SELECT 
                product_id,
                stock_code,
                description,
                category_id,
                unit_price,
                stock_quantity,
                reorder_level,
                supplier_info,
                is_active,
                weight,
                dimensions,
                created_at,
                updated_at
            FROM products 
            WHERE ${searchField} = $1
        `;

        const result = await client.query(query, [searchValue]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Get additional analytics for this product (if order_items table exists)
        const analyticsQuery = `
            SELECT 
                COUNT(*) as order_count,
                SUM(oi.quantity) as total_sold,
                AVG(oi.unit_price) as avg_selling_price,
                MIN(o.created_at) as first_sold,
                MAX(o.created_at) as last_sold
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = $1
        `;

        let analyticsData = null;
        try {
            const analyticsResult = await client.query(analyticsQuery, [result.rows[0].product_id]);
            analyticsData = analyticsResult.rows[0];
        } catch (analyticsError) {
            // If analytics tables don't exist, just skip analytics
            console.log('Analytics data not available:', analyticsError.message);
        }

        res.json({
            success: true,
            data: {
                ...result.rows[0],
                analytics: analyticsData
            }
        });

    } catch (error) {
        handleDatabaseError(error, res);
    } finally {
        client.release();
    }
});

// 3. POST /api/products - Add a new product
app.post('/api/products', validateProduct, async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            stock_code,
            description,
            category_id = null,
            unit_price,
            stock_quantity = 0,
            reorder_level = 10,
            supplier_info = null,
            is_active = true,
            weight = null,
            dimensions = null
        } = req.body;

        const query = `
            INSERT INTO products (
                stock_code, description, category_id, unit_price, 
                stock_quantity, reorder_level, supplier_info, 
                is_active, weight, dimensions
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;

        const result = await client.query(query, [
            stock_code, description, category_id, unit_price,
            stock_quantity, reorder_level, supplier_info,
            is_active, weight, dimensions
        ]);

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: result.rows[0]
        });

    } catch (error) {
        handleDatabaseError(error, res);
    } finally {
        client.release();
    }
});

// 4. PUT /api/products/:id - Update an existing product
app.put('/api/products/:id', validateProduct, async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const {
            stock_code,
            description,
            category_id,
            unit_price,
            stock_quantity,
            reorder_level,
            supplier_info,
            is_active,
            weight,
            dimensions
        } = req.body;

        // Check if id is numeric (product_id) or string (stock_code)
        const isNumeric = !isNaN(id) && !isNaN(parseFloat(id));
        const searchField = isNumeric ? 'product_id' : 'stock_code';
        const searchValue = isNumeric ? parseInt(id) : id;

        // Check if product exists
        const checkQuery = `SELECT product_id FROM products WHERE ${searchField} = $1`;
        const checkResult = await client.query(checkQuery, [searchValue]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        const productId = checkResult.rows[0].product_id;

        const query = `
            UPDATE products 
            SET 
                stock_code = $1,
                description = $2,
                category_id = $3,
                unit_price = $4,
                stock_quantity = $5,
                reorder_level = $6,
                supplier_info = $7,
                is_active = $8,
                weight = $9,
                dimensions = $10,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_id = $11
            RETURNING *
        `;

        const result = await client.query(query, [
            stock_code, description, category_id, unit_price,
            stock_quantity, reorder_level, supplier_info,
            is_active, weight, dimensions, productId
        ]);

        res.json({
            success: true,
            message: 'Product updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        handleDatabaseError(error, res);
    } finally {
        client.release();
    }
});

// 5. DELETE /api/products/:id - Delete a product
app.delete('/api/products/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        // Check if id is numeric (product_id) or string (stock_code)
        const isNumeric = !isNaN(id) && !isNaN(parseFloat(id));
        const searchField = isNumeric ? 'product_id' : 'stock_code';
        const searchValue = isNumeric ? parseInt(id) : id;

        // Check if product exists and has associated records
        const checkQuery = `
            SELECT 
                p.product_id,
                p.stock_code,
                COUNT(oi.id) as order_items_count,
                COUNT(im.id) as inventory_movements_count
            FROM products p
            LEFT JOIN order_items oi ON p.product_id = oi.product_id
            LEFT JOIN inventory_movements im ON p.product_id = im.product_id
            WHERE p.${searchField} = $1
            GROUP BY p.product_id, p.stock_code
        `;

        const checkResult = await client.query(checkQuery, [searchValue]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        const product = checkResult.rows[0];
        const totalRelatedRecords = parseInt(product.order_items_count) + parseInt(product.inventory_movements_count);

        if (totalRelatedRecords > 0) {
            return res.status(409).json({
                success: false,
                error: 'Cannot delete product with existing related records',
                related_records: {
                    order_items: parseInt(product.order_items_count),
                    inventory_movements: parseInt(product.inventory_movements_count)
                }
            });
        }

        const deleteQuery = 'DELETE FROM products WHERE product_id = $1 RETURNING *';
        const result = await client.query(deleteQuery, [product.product_id]);

        res.json({
            success: true,
            message: 'Product deleted successfully',
            deleted_product: result.rows[0]
        });

    } catch (error) {
        handleDatabaseError(error, res);
    } finally {
        client.release();
    }
});

// Additional utility endpoints

// GET /api/products/analytics/summary - Get products analytics summary
app.get('/api/products/analytics/summary', async (req, res) => {
    const client = await pool.connect();

    try {
        const query = `
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
                COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_products,
                AVG(unit_price) as avg_product_price,
                SUM(stock_quantity) as total_stock_quantity,
                COUNT(CASE WHEN stock_quantity <= reorder_level THEN 1 END) as low_stock_products,
                MIN(unit_price) as min_price,
                MAX(unit_price) as max_price,
                AVG(stock_quantity) as avg_stock_quantity
            FROM products
            WHERE unit_price IS NOT NULL
        `;

        const result = await client.query(query);

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        handleDatabaseError(error, res);
    } finally {
        client.release();
    }
});

// GET /api/products/low-stock - Get products with low stock
app.get('/api/products/low-stock', async (req, res) => {
    const client = await pool.connect();

    try {
        const query = `
            SELECT 
                product_id,
                stock_code,
                description,
                stock_quantity,
                reorder_level,
                unit_price
            FROM products 
            WHERE stock_quantity <= reorder_level 
            AND is_active = true
            ORDER BY stock_quantity ASC
        `;

        const result = await client.query(query);

        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        handleDatabaseError(error, res);
    } finally {
        client.release();
    }
});

// GET /api/health - Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();

        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Online Retail Products API',
        version: '2.0.0',
        endpoints: {
            'GET /api/products': 'Get all products with pagination, search, and filters',
            'GET /api/products/:id': 'Get specific product by product_id or stock_code',
            'POST /api/products': 'Create new product',
            'PUT /api/products/:id': 'Update existing product',
            'DELETE /api/products/:id': 'Delete product',
            'GET /api/products/analytics/summary': 'Get products analytics summary',
            'GET /api/products/low-stock': 'Get products with low stock levels',
            'GET /api/health': 'API health check'
        },
        database_schema: {
            primary_key: 'product_id (auto-increment)',
            unique_key: 'stock_code',
            price_field: 'unit_price',
            stock_field: 'stock_quantity'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
            'GET /',
            'GET /api/products',
            'GET /api/products/:id',
            'POST /api/products',
            'PUT /api/products/:id',
            'DELETE /api/products/:id',
            'GET /api/products/analytics/summary',
            'GET /api/products/low-stock',
            'GET /api/health'
        ]
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down server gracefully...');
    await pool.end();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Online Retail API server running on port ${PORT}`);
    console.log(`📖 API Documentation available at http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Analytics: http://localhost:${PORT}/api/products/analytics/summary`);
    console.log(`⚠️  Low Stock: http://localhost:${PORT}/api/products/low-stock`);
});

module.exports = app;