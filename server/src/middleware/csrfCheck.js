const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

// Phong CSRF nhe: cookie session da sameSite=strict la lop chinh, day la lop bo sung —
// kiem tra Origin/Referer khop domain cho moi request lam thay doi du lieu.
export default function csrfCheck(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const source = req.get('origin') || req.get('referer');
  if (!source) {
    return res.status(403).json({ error: 'Thiếu Origin/Referer, từ chối yêu cầu.' });
  }

  let sourceHost;
  try {
    sourceHost = new URL(source).host;
  } catch {
    return res.status(403).json({ error: 'Origin/Referer không hợp lệ.' });
  }

  if (sourceHost !== req.get('host')) {
    return res.status(403).json({ error: 'Origin/Referer không khớp — từ chối yêu cầu (chống CSRF).' });
  }

  next();
}
