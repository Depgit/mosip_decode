const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const qaAgencyService = require('../services/qaAgencyService');

// Get pending inspection requests (for QA agency)
router.get('/requests/pending', 
  verifyToken, 
  requireRole('qa_agency'), 
  async (req, res, next) => {
    try {
      // Get QA agency record for this user
      const qaResult = await db.query(
        'SELECT * FROM qa_agencies WHERE user_id = $1',
        [req.user.id]
      );

      if (qaResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'QA agency profile not found'
        });
      }

      const qaAgency = qaResult.rows[0];

      // Get pending requests
      const requests = await qaAgencyService.getPendingRequests(qaAgency.id);

      res.json({
        success: true,
        data: {
          qaAgency,
          requests,
          count: requests.length
        }
      });

    } catch (err) {
      next(err);
    }
  }
);

// Accept inspection request
router.post('/requests/:requestId/accept', 
  verifyToken, 
  requireRole('qa_agency'), 
  async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { scheduledDate, notes } = req.body;

      // Get QA agency record
      const qaResult = await db.query(
        'SELECT id FROM qa_agencies WHERE user_id = $1',
        [req.user.id]
      );

      if (qaResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'QA agency profile not found'
        });
      }

      const qaAgencyId = qaResult.rows[0].id;

      // Accept request
      const request = await qaAgencyService.acceptRequest(
        requestId, 
        qaAgencyId, 
        scheduledDate
      );

      res.json({
        success: true,
        message: 'Inspection request accepted',
        data: request
      });

    } catch (err) {
      next(err);
    }
  }
);

// Reject inspection request
router.post('/requests/:requestId/reject', 
  verifyToken, 
  requireRole('qa_agency'), 
  async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
      }

      // Get QA agency record
      const qaResult = await db.query(
        'SELECT id FROM qa_agencies WHERE user_id = $1',
        [req.user.id]
      );

      if (qaResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'QA agency profile not found'
        });
      }

      const qaAgencyId = qaResult.rows.id;

      // Reject request
      const request = await qaAgencyService.rejectRequest(
        requestId, 
        qaAgencyId, 
        reason
      );

      res.json({
        success: true,
        message: 'Inspection request rejected',
        data: request
      });

    } catch (err) {
      next(err);
    }
  }
);

// Get my assigned batches (for QA agency)
router.get('/batches', 
  verifyToken, 
  requireRole('qa_agency'), 
  async (req, res, next) => {
    try {
      const qaResult = await db.query(
        'SELECT id FROM qa_agencies WHERE user_id = $1',
        [req.user.id]
      );

      if (qaResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'QA agency profile not found'
        });
      }

      const qaAgencyId = qaResult.rows.id;

      // Get all batches assigned to this QA
      const result = await db.query(`
        SELECT 
          b.*,
          ir.status as request_status,
          ir.scheduled_date,
          ir.accepted_at,
          u.full_name as exporter_name,
          u.email as exporter_email
        FROM batches b
        JOIN inspection_requests ir ON b.id = ir.batch_id
        JOIN users u ON b.exporter_id = u.id
        WHERE ir.qa_agency_id = $1
          AND ir.status IN ('pending', 'accepted')
        ORDER BY b.created_at DESC
      `, [qaAgencyId]);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });

    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
