const express = require('express')
const auth = require('../middleware/auth')
const User = require('../models/user')


const router = express.Router()


//returns the current user. Add
router.get('/me', auth, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message: 'User not authenticated'
            })
        }

        const user = await User.findById(req.user.id).select('-password')
        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            })
        }
        res.json({ user })
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({
            message: 'Server error',
            error: err.message
        })
    }
})

module.exports = router