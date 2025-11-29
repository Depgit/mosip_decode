const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

router.post('/register', async (req, res, next) => {
  const client = await db.connect();
  try {

    const { email, password, fullName, role, organization, specialization } = req.body;
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Check if user exists
    const checkResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    await client.query('BEGIN');

    // Insert user
    const userResult = await client.query(
      'INSERT INTO users (email, password, full_name, role, organization) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role',
      [email, hashedPassword, fullName, role || 'user', organization || '']
    );
    const user = userResult.rows[0];

    if (role === 'qa_agency') {
      const qaSpecialization = specialization || ['ALL'];
      await client.query(
        `INSERT INTO qa_agencies (
          user_id,
          agency_name,
          certification_number,
          specialization,
          max_capacity,
          current_load,
          contact_email,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
        [
          user.id,
          organization || fullName,
          `QA-${Date.now()}`,
          qaSpecialization,
          10,
          0,
          email,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ User and (if QA) agency profile created for user ${user.id}`);
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during registration, rolling back:', err);
    res.status(500).json({
      success: false,
      message: 'Registration failed, no data saved.',
      error: err.message,
    });
  } finally {
    client.release();
  }

});

// Login user
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const result = await db.query('SELECT id, email, password, role FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (result.rowCount.length === 0) {
      throw new Error('User not found');
    }
    const user = result.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
