const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// Get user notifications
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.id]);

    // Count unread
    const unreadResult = await db.query(`
      SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE user_id = $1 AND read = FALSE
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        unreadCount: parseInt(unreadResult.rows.unread_count)
      }
    });

  } catch (err) {
    next(err);
  }
});

// Mark notification as read
router.put('/:id/read', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      UPDATE notifications
      SET read = TRUE, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    next(err);
  }
});

// Mark all as read
router.put('/read-all', verifyToken, async (req, res, next) => {
  try {
    await db.query(`
      UPDATE notifications
      SET read = TRUE, read_at = NOW()
      WHERE user_id = $1 AND read = FALSE
    `, [req.user.id]);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
