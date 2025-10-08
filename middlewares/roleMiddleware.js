function permit(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authenticated' });
    if (!allowedRoles.includes(user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

module.exports = { permit };
