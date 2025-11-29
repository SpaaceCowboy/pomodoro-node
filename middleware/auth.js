const jwt = require('jsonwebtoken')

function auth(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ 
            message: 'JWT_SECRET is not configured'
        })
    }

    const header = req.headers.authorization || '';
    const [scheme, tokenFromHeader] = header.split(' ');
    const tokenFromCookie = req.cookies?.access_token;
  
    const token = scheme === 'Bearer' && tokenFromHeader ? tokenFromHeader : tokenFromCookie;
  
    if (!token) return res.status(401).json({ message: 'No token provided' });
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id, email: decoded.email };
      next();
    } catch (err) {
      const msg = err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid token';
      return res.status(401).json({ message: msg });
    }
  }

module.exports = auth