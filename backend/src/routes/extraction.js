const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const aiExtractionService = require('../services/aiExtraction');

/**
 * Get extracted data for a specific attachment
 * GET /api/extraction/:attachmentId
 */
router.get('/:attachmentId', verifyToken, async (req, res, next) => {
    try {
        const extractedData = await aiExtractionService.getExtractedData(req.params.attachmentId);

        if (!extractedData) {
            return res.status(404).json({
                success: false,
                message: 'No extraction data found for this attachment'
            });
        }

        res.json({
            success: true,
            data: extractedData
        });

    } catch (err) {
        next(err);
    }
});

/**
 * Get all extracted data for a batch
 * GET /api/extraction/batch/:batchId
 */
router.get('/batch/:batchId', verifyToken, async (req, res, next) => {
    try {
        const extractedData = await aiExtractionService.getBatchExtractedData(req.params.batchId);

        res.json({
            success: true,
            data: extractedData,
            count: extractedData.length
        });

    } catch (err) {
        next(err);
    }
});

/**
 * Retry extraction for a specific attachment
 * POST /api/extraction/retry/:attachmentId
 */
router.post('/retry/:attachmentId', verifyToken, async (req, res, next) => {
    try {
        // Verify user owns the attachment
        const attachmentQuery = `
      SELECT ba.*, b.exporter_id 
      FROM batch_attachments ba
      JOIN batches b ON ba.batch_id = b.id
      WHERE ba.id = $1
    `;
        const attachmentResult = await db.query(attachmentQuery, [req.params.attachmentId]);

        if (attachmentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Attachment not found'
            });
        }

        const attachment = attachmentResult.rows[0];

        // Check if user owns the batch (or is admin/qa)
        if (attachment.exporter_id !== req.user.id &&
            !['admin', 'qa_agency'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to retry extraction for this attachment'
            });
        }

        // Retry extraction
        const result = await aiExtractionService.retryExtraction(req.params.attachmentId);

        res.json({
            success: result.success,
            message: result.success ? 'Extraction completed successfully' : 'Extraction failed',
            data: result
        });

    } catch (err) {
        next(err);
    }
});

/**
 * Get extraction statistics
 * GET /api/extraction/stats
 */
router.get('/stats/overview', verifyToken, async (req, res, next) => {
    try {
        const stats = await aiExtractionService.getExtractionStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (err) {
        next(err);
    }
});

/**
 * Manual trigger extraction for an attachment
 * POST /api/extraction/process/:attachmentId
 */
router.post('/process/:attachmentId', verifyToken, async (req, res, next) => {
    try {
        const path = require('path');

        // Get attachment details
        const attachmentQuery = `
      SELECT ba.*, b.exporter_id 
      FROM batch_attachments ba
      JOIN batches b ON ba.batch_id = b.id
      WHERE ba.id = $1
    `;
        const attachmentResult = await db.query(attachmentQuery, [req.params.attachmentId]);

        if (attachmentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Attachment not found'
            });
        }

        const attachment = attachmentResult.rows[0];

        // Check permissions
        if (attachment.exporter_id !== req.user.id &&
            !['admin', 'qa_agency'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to process this attachment'
            });
        }

        const filePath = path.join(__dirname, '../../uploads/batches', attachment.file_name);

        // Process file
        const result = await aiExtractionService.processFile(
            filePath,
            attachment.original_name,
            attachment.id,
            attachment.batch_id
        );

        res.json({
            success: result.success,
            message: result.success ? 'Extraction completed successfully' : 'Extraction failed',
            data: result
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
