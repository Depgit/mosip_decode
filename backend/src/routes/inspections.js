const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');

// Submit inspection results (QA Agency only)
router.post('/', verifyToken, requireRole('qa_agency'), async (req, res, next) => {
  try {
    const { batchId, moistureLevel, pesticideContent, organicStatus, qualityRating, passFail, inspectionNotes } = req.body;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID is required'
      });
    }

    // Insert inspection
    const result = await db.query(
      `INSERT INTO inspections 
       (batch_id, qa_agency_id, moisture_level, pesticide_content, organic_status, quality_rating, pass_fail, inspection_notes, inspected_at, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [batchId, req.user.id, moistureLevel, pesticideContent, organicStatus, qualityRating, passFail, inspectionNotes, new Date(), 'completed']
    );

    // Update batch status
    const newStatus = passFail ? 'certified' : 'rejected';
    await db.query('UPDATE batches SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, batchId]);

    res.status(201).json({
      success: true,
      message: 'Inspection submitted successfully',
      data: result.rows
    });

  } catch (err) {
    next(err);
  }
});

// Get inspections for batch
router.get('/batch/:batchId', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM inspections WHERE batch_id = $1', [req.params.batchId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
