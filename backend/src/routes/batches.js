const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadBatchAttachments } = require('../middleware/uploadHandler');
const fileService = require('../services/fileService');
const qaAgencyService = require('../services/qaAgencyService');


router.post(
  '/',
  verifyToken,
  requireRole('user'),
  (req, res, next) => {
    // Check if it's a multipart/form-data (file upload) request
    if (req.is('multipart/form-data')) {
      // Let the file upload middleware process the request
      uploadBatchAttachments(req, res, function (err) {
        if (err) return next(err);
        next();
      });
    } else {
      next();
    }
  },
  async (req, res, next) => {
    // const client = await db.connect();
    try {
      const { productType, quantity, unit, destination, description } = req.body;

      if (!productType || !quantity) {
        return res.status(400).json({
          success: false,
          message: 'Product type and quantity are required'
        });
      }

      // client.query('BEGIN');
      // Create batch
      const batchResult = await db.query(
        `INSERT INTO batches (exporter_id, product_type, quantity, unit, destination, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [req.user.id, productType, quantity, unit || 'kg', destination, description]
      );
      const batch = batchResult.rows[0] || batchResult.rows;

      // If files exist, process
      const attachments = [];
      const extractions = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await fileService.processImage(file.path, file.filename);

            const attachmentResult = await db.query(
              `INSERT INTO batch_attachments
                (batch_id, file_name, file_url, file_type, file_size, original_name, uploaded_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`,
              [
                batch.id,
                file.filename,
                fileService.getFileUrl(file.filename),
                file.mimetype,
                file.size,
                file.originalname,
                req.user.id
              ]
            );
            const attachment = attachmentResult.rows[0];
            attachments.push(attachment);

            // Trigger AI extraction in background (don't wait for it)
            console.log(`Triggering AI extraction for ${file.originalname}`);
            const aiExtractionService = require('../services/aiExtraction');
            aiExtractionService.processFile(
              file.path,
              file.originalname,
              attachment.id,
              batch.id
            ).then(result => {
              console.log(`✅ AI extraction completed for ${file.originalname}:`, result.success);
              if (result.success) {
                extractions.push(result);
              }
            }).catch(err => {
              console.error(`❌ AI extraction failed for ${file.originalname}:`, err);
            });

          } catch (error) {
            console.error('Error storing attachment:', error);
          }
        }
      }

      await qaAgencyService.autoAssignBatch(batch);

      // await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        message: attachments.length
          ? 'Batch submitted successfully with attachments'
          : 'Batch created successfully',
        data: attachments.length
          ? { batch, attachments }
          : batch
      });

    } catch (err) {
      next(err);
    }
  }
);

// Get batch with all attachments
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const batchResult = await db.query(
      'SELECT * FROM batches WHERE id = $1',
      [req.params.id]
    );

    if (batchResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const batch = batchResult.rows;

    // Get all attachments for this batch
    const attachmentsResult = await db.query(
      'SELECT * FROM batch_attachments WHERE batch_id = $1 ORDER BY uploaded_at DESC',
      [batch.id]
    );

    res.json({
      success: true,
      data: {
        batch,
        attachments: attachmentsResult.rows
      }
    });

  } catch (err) {
    next(err);
  }
});

// Get all batches for exporter (with attachment count)
router.get('/', verifyToken, async (req, res, next) => {
  try {
    let query = `
      SELECT 
        b.*,
        COUNT(ba.id) as attachment_count
      FROM batches b
      LEFT JOIN batch_attachments ba ON b.id = ba.batch_id
      WHERE 1=1
    `;
    let params = [];

    if (req.user.role === 'exporter') {
      query += ' AND b.exporter_id = $1';
      params.push(req.user.id);
    }

    if (req.query.status) {
      query += ` AND b.status = $${params.length + 1}`;
      params.push(req.query.status);
    }

    query += ' GROUP BY b.id ORDER BY b.created_at DESC LIMIT 50';

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    next(err);
  }
});



// Delete an attachment
router.delete('/attachment/:attachmentId', verifyToken, async (req, res, next) => {
  try {
    const attachmentResult = await db.query(
      'SELECT * FROM batch_attachments WHERE id = $1',
      [req.params.attachmentId]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const attachment = attachmentResult.rows;

    // Verify user owns the batch
    const batchResult = await db.query(
      'SELECT exporter_id FROM batches WHERE id = $1',
      [attachment.batch_id]
    );

    if (batchResult.rows.exporter_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this attachment'
      });
    }

    // Delete file from disk
    await fileService.deleteFile(attachment.file_name);

    // Delete from database
    await db.query(
      'DELETE FROM batch_attachments WHERE id = $1',
      [req.params.attachmentId]
    );

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });

  } catch (err) {
    next(err);
  }
});

// Download attachment
router.get('/file/:filename', async (req, res, next) => {
  try {
    const filepath = path.join(__dirname, '../../uploads/batches', req.params.filename);

    // Security: prevent directory traversal
    if (!filepath.startsWith(path.join(__dirname, '../../uploads/batches'))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.download(filepath);

  } catch (err) {
    next(err);
  }
});

module.exports = router;
