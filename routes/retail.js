const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @swagger
 * components:
 *   schemas:
 *     Retail:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         invoice_no:
 *           type: string
 *         stock_code:
 *           type: string
 *         description:
 *           type: string
 *         quantity:
 *           type: integer
 *         invoice_date:
 *           type: string
 *           format: date-time
 *         unit_price:
 *           type: number
 *         customer_id:
 *           type: integer
 *         country:
 *           type: string
 */

// =====================================================
// BASIC RETAIL CRUD OPERATIONS
// =====================================================

/**
 * @swagger
 * /api/retail:
 *   get:
 *     summary: Get all retail records
 *     responses:
 *       200:
 *         description: A list of retail records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Retail'
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM retail LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/monthly-sales:
 *   get:
 *     summary: Get total sales for a specific year and month
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Monthly sales total
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_sales:
 *                   type: number
 */
router.get('/monthly-sales', async (req, res) => {
  const { year, month } = req.query;

  // Ensure both values exist and are integers
  if (!year || !month || isNaN(year) || isNaN(month)) {
    return res.status(400).json({ error: 'Please provide valid year and month as integers in the query string.' });
  }

  try {
    const result = await db.query('SELECT get_monthly_sales($1, $2) AS total_sales', [
      parseInt(year),
      parseInt(month),
    ]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/{id}:
 *   get:
 *     summary: Get a retail record by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A single retail record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Retail'
 *       404:
 *         description: Record not found
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // Validate that id is a number
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  try {
    const result = await db.query('SELECT * FROM retail WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail:
 *   post:
 *     summary: Add a new retail record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Retail'
 *     responses:
 *       201:
 *         description: Retail record created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Retail'
 */
router.post('/', async (req, res) => {
  const { invoice_no, stock_code, description, quantity, invoice_date, unit_price, customer_id, country } = req.body;
  
  try {
    const result = await db.query(
      `INSERT INTO retail (invoice_no, stock_code, description, quantity, invoice_date, unit_price, customer_id, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [invoice_no, stock_code, description, quantity, invoice_date, unit_price, customer_id, country]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/{id}:
 *   put:
 *     summary: Update a retail record by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Retail'
 *     responses:
 *       200:
 *         description: Retail record updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Retail'
 *       404:
 *         description: Record not found
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { invoice_no, stock_code, description, quantity, invoice_date, unit_price, customer_id, country } = req.body;
  
  // Validate that id is a number
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  try {
    const result = await db.query(
      `UPDATE retail SET
        invoice_no=$1, stock_code=$2, description=$3, quantity=$4,
        invoice_date=$5, unit_price=$6, customer_id=$7, country=$8
       WHERE id=$9 RETURNING *`,
      [invoice_no, stock_code, description, quantity, invoice_date, unit_price, customer_id, country, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/{id}:
 *   delete:
 *     summary: Delete a retail record by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Record deleted
 *       404:
 *         description: Record not found
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  // Validate that id is a number
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  try {
    const result = await db.query('DELETE FROM retail WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// =====================================================
// INVENTORY & PERFORMANCE MONITORING ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/retail/performance/inventory-status:
 *   get:
 *     summary: Get current inventory status with stock levels
 *     responses:
 *       200:
 *         description: Inventory status with stock alerts
 */
router.get('/performance/inventory-status', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM get_inventory_status()');
    res.json({
      inventory: result.rows,
      summary: {
        total_items: result.rows.length,
        out_of_stock: result.rows.filter(item => item.status === 'OUT_OF_STOCK').length,
        low_stock: result.rows.filter(item => item.status === 'LOW_STOCK').length,
        in_stock: result.rows.filter(item => item.status === 'IN_STOCK').length
      }
    });
  } catch (err) {
    console.error('Error getting inventory status:', err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/performance/adjust-inventory:
 *   post:
 *     summary: Manually adjust inventory levels
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stock_code:
 *                 type: string
 *               adjustment:
 *                 type: integer
 *               reason:
 *                 type: string
 */
router.post('/performance/adjust-inventory', async (req, res) => {
  const { stock_code, adjustment, reason = 'Manual adjustment' } = req.body;
  
  if (!stock_code || adjustment === undefined) {
    return res.status(400).json({ 
      error: 'stock_code and adjustment are required' 
    });
  }
  
  try {
    await db.query(
      'SELECT adjust_inventory($1, $2, $3)',
      [stock_code, adjustment, reason]
    );
    
    // Get updated inventory status
    const result = await db.query(
      'SELECT * FROM inventory WHERE stock_code = $1',
      [stock_code]
    );
    
    res.json({
      message: 'Inventory adjusted successfully',
      updated_inventory: result.rows[0]
    });
  } catch (err) {
    console.error('Error adjusting inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/retail/performance/low-stock-alerts:
 *   get:
 *     summary: Get current low stock alerts
 */
router.get('/performance/low-stock-alerts', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        lsa.*,
        i.product_name,
        i.available_stock as current_available
      FROM low_stock_alerts lsa
      JOIN inventory i ON lsa.stock_code = i.stock_code
      ORDER BY lsa.alert_time DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting low stock alerts:', err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/performance/table-metrics:
 *   get:
 *     summary: Get performance metrics for database tables
 */
router.get('/performance/table-metrics', async (req, res) => {
  try {
    const tables = ['retail', 'inventory'];
    const metrics = {};
    
    for (const table of tables) {
      const result = await db.query(
        'SELECT * FROM get_table_performance_metrics($1)',
        [table]
      );
      metrics[table] = result.rows[0];
    }
    
    res.json(metrics);
  } catch (err) {
    console.error('Error getting table metrics:', err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/performance/query-analysis:
 *   post:
 *     summary: Analyze query performance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *               analyze:
 *                 type: boolean
 */
router.post('/performance/query-analysis', async (req, res) => {
  const { query, analyze = false } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  // Security: Only allow SELECT statements for safety
  if (!query.trim().toLowerCase().startsWith('select')) {
    return res.status(400).json({ 
      error: 'Only SELECT queries are allowed for analysis' 
    });
  }
  
  try {
    const explainQuery = analyze 
      ? `EXPLAIN (ANALYZE, BUFFERS, TIMING, FORMAT JSON) ${query}`
      : `EXPLAIN (BUFFERS, FORMAT JSON) ${query}`;
    
    const startTime = Date.now();
    const result = await db.query(explainQuery);
    const endTime = Date.now();
    
    res.json({
      query: query,
      execution_plan: result.rows[0]['QUERY PLAN'],
      analysis_time_ms: endTime - startTime,
      analyzed: analyze
    });
  } catch (err) {
    console.error('Error analyzing query:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/retail/performance/index-usage:
 *   get:
 *     summary: Get index usage statistics
 */
router.get('/performance/index-usage', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        CASE 
          WHEN idx_tup_read = 0 AND idx_tup_fetch = 0 THEN 'UNUSED'
          WHEN idx_tup_read > 0 THEN 'ACTIVE'
          ELSE 'LOW_USAGE'
        END as usage_status
      FROM pg_stat_user_indexes 
      WHERE tablename IN ('retail', 'inventory')
      ORDER BY idx_tup_read DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting index usage:', err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/performance/slow-queries:
 *   get:
 *     summary: Get slow query statistics (requires pg_stat_statements extension)
 */
router.get('/performance/slow-queries', async (req, res) => {
  try {
    // Check if pg_stat_statements extension exists
    const extensionCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
      ) as has_extension
    `);
    
    if (!extensionCheck.rows[0].has_extension) {
      return res.json({
        message: 'pg_stat_statements extension not available',
        suggestion: 'Enable pg_stat_statements extension for query statistics'
      });
    }
    
    const result = await db.query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        min_time,
        max_time,
        rows
      FROM pg_stat_statements 
      WHERE query LIKE '%retail%' OR query LIKE '%inventory%'
      ORDER BY total_time DESC
      LIMIT 20
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting slow queries:', err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/performance/database-stats:
 *   get:
 *     summary: Get overall database performance statistics
 */
router.get('/performance/database-stats', async (req, res) => {
  try {
    const tableStats = await db.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables 
      WHERE tablename IN ('retail', 'inventory')
    `);

    const cacheStats = await db.query(`
      SELECT 
        SUM(heap_blks_read) as disk_reads,
        SUM(heap_blks_hit) as cache_hits,
        ROUND(
          SUM(heap_blks_hit) * 100.0 / 
          NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 2
        ) as cache_hit_ratio
      FROM pg_stat_user_tables 
      WHERE tablename IN ('retail', 'inventory')
    `);

    const connectionStats = await db.query(`
      SELECT 
        state,
        COUNT(*) as connection_count
      FROM pg_stat_activity 
      WHERE datname = current_database()
      GROUP BY state
    `);

    res.json({
      table_statistics: tableStats.rows,
      cache_performance: cacheStats.rows[0],
      connection_stats: connectionStats.rows,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error getting database stats:', err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/performance/sales-analytics:
 *   get:
 *     summary: Get sales analytics with performance insights
 */
router.get('/performance/sales-analytics', async (req, res) => {
  const { days = 30 } = req.query;
  
  try {
    const analyticsQuery = `
      WITH sales_data AS (
        SELECT 
          DATE(invoice_date) as sale_date,
          country,
          COUNT(*) as order_count,
          SUM(quantity) as total_quantity,
          SUM(quantity * unit_price) as total_sales,
          AVG(unit_price) as avg_price
        FROM retail 
        WHERE invoice_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        GROUP BY DATE(invoice_date), country
      ),
      inventory_impact AS (
        SELECT 
          r.stock_code,
          COUNT(*) as times_ordered,
          SUM(r.quantity) as total_ordered,
          i.current_stock,
          i.available_stock,
          CASE 
            WHEN i.available_stock <= i.reorder_level THEN 'LOW_STOCK'
            WHEN i.available_stock <= 0 THEN 'OUT_OF_STOCK'
            ELSE 'OK'
          END as stock_status
        FROM retail r
        LEFT JOIN inventory i ON r.stock_code = i.stock_code
        WHERE r.invoice_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        GROUP BY r.stock_code, i.current_stock, i.available_stock, i.reorder_level
      )
      SELECT 
        'sales_by_country' as metric_type,
        json_agg(json_build_object(
          'country', country,
          'total_sales', total_sales,
          'order_count', order_count
        )) as data
      FROM (
        SELECT country, SUM(total_sales) as total_sales, SUM(order_count) as order_count
        FROM sales_data 
        GROUP BY country 
        ORDER BY total_sales DESC
      ) country_sales
      
      UNION ALL
      
      SELECT 
        'inventory_impact' as metric_type,
        json_agg(json_build_object(
          'stock_code', stock_code,
          'times_ordered', times_ordered,
          'total_ordered', total_ordered,
          'current_stock', current_stock,
          'available_stock', available_stock,
          'stock_status', stock_status
        )) as data
      FROM inventory_impact
      WHERE stock_status != 'OK'
      ORDER BY total_ordered DESC
    `;
    
    const result = await db.query(analyticsQuery);
    
    // Transform the result into a more usable format
    const analytics = {};
    result.rows.forEach(row => {
      analytics[row.metric_type] = row.data;
    });
    
    res.json({
      period_days: parseInt(days),
      analytics,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error getting sales analytics:', err);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

/**
 * @swagger
 * /api/retail/performance/trigger-test:
 *   post:
 *     summary: Test inventory triggers with a sample order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stock_code:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               test_mode:
 *                 type: boolean
 */
router.post('/performance/trigger-test', async (req, res) => {
  const { stock_code, quantity, test_mode = true } = req.body;
  
  if (!stock_code || !quantity) {
    return res.status(400).json({
      error: 'stock_code and quantity are required'
    });
  }
  
  try {
    // Get current inventory before test
    const beforeResult = await db.query(
      'SELECT * FROM inventory WHERE stock_code = $1',
      [stock_code]
    );
    
    if (beforeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Stock code not found in inventory'
      });
    }
    
    const beforeInventory = beforeResult.rows[0];
    
    if (test_mode) {
      // Start transaction for test mode
      await db.query('BEGIN');
    }
    
    try {
      // Create a test order to trigger inventory update
      const orderResult = await db.query(`
        INSERT INTO retail (
          invoice_no, stock_code, description, quantity, 
          invoice_date, unit_price, customer_id, country
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
      `, [
        `TEST-${Date.now()}`,
        stock_code,
        'Test order for trigger',
        quantity,
        new Date(),
        10.00,
        99999,
        'Test'
      ]);
      
      // Get inventory after trigger execution
      const afterResult = await db.query(
        'SELECT * FROM inventory WHERE stock_code = $1',
        [stock_code]
      );
      
      const afterInventory = afterResult.rows[0];
      
      // Check for low stock alerts
      const alertsResult = await db.query(`
        SELECT * FROM low_stock_alerts WHERE stock_code = $1
      `, [stock_code]);
      
      if (test_mode) {
        // Rollback transaction in test mode
        await db.query('ROLLBACK');
      } else {
        // Commit transaction if not in test mode
        await db.query('COMMIT');
      }
      
      res.json({
        test_mode,
        order_created: orderResult.rows[0],
        inventory_changes: {
          before: {
            current_stock: beforeInventory.current_stock,
            available_stock: beforeInventory.available_stock
          },
          after: {
            current_stock: afterInventory.current_stock,
            available_stock: afterInventory.available_stock
          },
          change: afterInventory.current_stock - beforeInventory.current_stock
        },
        low_stock_alert: alertsResult.rows.length > 0 ? alertsResult.rows[0] : null,
        trigger_success: true
      });
      
    } catch (triggerError) {
      if (test_mode) {
        await db.query('ROLLBACK');
      }
      throw triggerError;
    }
    
  } catch (err) {
    console.error('Error testing triggers:', err);
    res.status(500).json({ 
      error: err.message,
      trigger_success: false
    });
  }
});

module.exports = router;