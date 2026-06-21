const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const { loadSecurityConfig } = require('./src/config/security');

const security = loadSecurityConfig();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', security.trustProxy);

app.use((req, res, next) => {
  if (security.enforceHttps && !req.secure) {
    return res.redirect(308, `https://${req.get('host')}${req.originalUrl}`);
  }
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: security.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || security.frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth',     require('./src/routes/auth'));
app.use('/api/patients', require('./src/routes/patients'));
app.use('/api/staff',    require('./src/routes/staff'));
app.use('/api/orders',   require('./src/routes/orders'));
app.use('/api/queues',   require('./src/routes/queues'));
app.use('/api/results',  require('./src/routes/results'));
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/exam-types', require('./src/routes/examTypes'));
app.use('/api/reports', require('./src/routes/reports'));


app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((error, _req, res, _next) => {
  if (error?.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'Origin not allowed' });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
