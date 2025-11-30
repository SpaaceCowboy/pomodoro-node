const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/user') 
const { hashToken, rotateRefreshToken } = require('../utils/token')


const router = express.Router()

//Register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password} = req.body

        const existingUser = await User.findOne({ email })
        if (existingUser) return res.status(400).json({message: 'User already exists'})

        const hashedpassword = await bcrypt.hash(password, 10)

        const newUser = new User({ username, email, password: hashedpassword})
        await newUser.save()

        res.status(201).json({ message: 'User created successfully'})
    }catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'server error', error: err.message})
    }
})

//Login 
router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: 'JWT_SECRET is not configured' });
      }
  
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
  
      const payload = { id: user._id, email: user.email };
  
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  
      res.json({ token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

//reads the refresh cookie, verifies it, checks the database entry, 
// and rotates it. If all checks pass, 
// it returns a new access token and sets a new refresh cookie.

router.post('/refresh', async (req, res) => {
    try {
      const token = req.cookies?.refresh_token;
      if (!token) return res.status(401).json({ message: 'No refresh token' });
  
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
      }
  
      const tokenHash = hashToken(token);
      const doc = await RefreshToken.findOne({ tokenHash, jti: decoded.jti }).populate('user');
  
      if (!doc) {
        return res.status(401).json({ message: 'Refresh token not recognized' });
      }
      if (doc.revokedAt) {
        return res.status(401).json({ message: 'Refresh token revoked' });
      }
      if (doc.expiresAt < new Date()) {
        return res.status(401).json({ message: 'Refresh token expired' });
      }
  
      const result = await rotateRefreshToken(doc, doc.user, req, res);
      return res.json({ accessToken: result.accessToken });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

//logout
router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.refresh_token
        if (token) {
            const tokenHash = hashToken(token)
            const doc = await RefreshToken.findOne({ tokenHash })
            if (doc && !doc.recokedAt) {
                doc.revokedAt = new Date()
                await doc.save()
            }
        }
        res.clearCookie('refresh_token', { path: '/api/auth/refresh'})
        res.json({
            message: 'Logged out'
        })
    } catch (err) {
        res.status(500).json({
            message: 'Server error'
        })
    }
})

module.exports = router