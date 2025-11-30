const express = require('express');
const { auth } = require('../lib/firebase-admin');
const router = express.Router();

// Verify Firebase token and create session
router.post('/verify-token', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Here you can create a session or JWT token for your app
    // For simplicity, we'll just return user info
    res.json({
      success: true,
      user: {
        uid,
        email,
        name,
        picture
      }
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get user data by UID
router.get('/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await auth.getUser(uid);
    res.json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    });
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});

module.exports = router;