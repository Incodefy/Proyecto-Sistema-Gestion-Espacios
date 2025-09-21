// middleware/requireAuth.js
const requireAuth = (req, res, next) => {
  if (!req.session.user || !req.session.user.idToken) {
    req.flash('error', 'Debes iniciar sesión para acceder a esta página');
    return res.redirect('/login');
  }
  next();
};

module.exports = requireAuth;