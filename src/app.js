const cors = require('cors');
const express = require('express');
const morgan = require('morgan');

const actionRoutes = require('./routes/action.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const deviceRoutes = require('./routes/device.routes');
const sensorRoutes = require('./routes/sensor.routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/actions', actionRoutes);
app.use('/api/v1/sensor-readings', sensorRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
