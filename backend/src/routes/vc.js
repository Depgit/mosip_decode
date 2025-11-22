const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const injiService = require('../services/injiService');

// Issue Verifiable Credential
router.post('/issue', verifyToken, requireRole('qa_agency', 'admin'), async (req, res, next) => {
  try {
    const { batchId, inspectionId } = req.body;

    if (!batchId || !inspectionId) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID and Inspection ID are required'
      });
    }

    // Get batch and inspection data
    const batchResult = await db.query('SELECT * FROM batches WHERE id = $1', [batchId]);
    const inspectionResult = await db.query('SELECT * FROM inspections WHERE id = $1', [inspectionId]);

    if (batchResult.rows.length === 0 || inspectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Batch or inspection not found'
      });
    }

    const batch = batchResult.rows[0];
    const inspection = inspectionResult.rows[0];

    // Issue VC using Inji service
    const vcResult = await injiService.issueCredential(batch, inspection);

    // Generate QR code
    const qrResult = await injiService.generateQRCode(vcResult.vc);

    // Store VC in database
    const dbResult = await db.query(
      `INSERT INTO verifiable_credentials 
       (batch_id, inspection_id, vc_json, qr_code_url, issuer_did, issued_at, expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        batchId,
        inspectionId,
        JSON.stringify(vcResult.vc),
        qrResult.qrImage,
        process.env.INJI_ISSUER_DID,
        new Date(),
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
      ]
    );

    // Update batch status to verified
    await db.query('UPDATE batches SET status = $1, updated_at = NOW() WHERE id = $2', ['verified', batchId]);

    res.status(201).json({
      success: true,
      message: 'Verifiable Credential issued successfully',
      data: {
        vcId: dbResult.rows[0].id,
        batchId,
        qrCode: qrResult.qrImage,
        issuedAt: dbResult.rows.issued_at,
        expiresAt: dbResult.rows.expires_at
      }
    });

  } catch (err) {
    next(err);
  }
});

// Verify Verifiable Credential
router.post('/verify', async (req, res, next) => {
  try {
    const { vc } = req.body;

    if (!vc) {
      return res.status(400).json({
        success: false,
        message: 'Verifiable Credential is required'
      });
    }

    const verifyResult = await injiService.verifyCredential(vc);

    res.json({
      success: true,
      data: verifyResult
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
