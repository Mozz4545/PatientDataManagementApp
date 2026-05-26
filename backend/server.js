const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
app.use('/api/auth',     require('./src/routes/auth'));
app.use('/api/patients', require('./src/routes/patients'));
app.use('/api/staff',    require('./src/routes/staff'));
app.use('/api/orders',   require('./src/routes/orders'));
app.use('/api/queues',   require('./src/routes/queues'));
app.use('/api/results',  require('./src/routes/results'));
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/exam-types', require('./src/routes/examTypes'));


app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
