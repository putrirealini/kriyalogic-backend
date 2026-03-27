require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Import Auth Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const artisanRoutes = require('./routes/artisanRoutes');
const guideRoutes = require('./routes/guideRoutes');
const masterProductRoutes = require('./routes/masterProductRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const childProductRoutes = require('./routes/childProductRoutes');
const saleRoutes = require('./routes/saleRoutes')
const posRoutes = require('./routes/posRoutes');

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Connect to Database
connectDB();

// Routes
const apiRoutes = express.Router();

// Mount Auth Routes
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/artisans', artisanRoutes);
apiRoutes.use('/guides', guideRoutes);
apiRoutes.use('/master-products', masterProductRoutes);
apiRoutes.use('/categories', categoryRoutes);
apiRoutes.use('/child-items', childProductRoutes);
apiRoutes.use('/sales', saleRoutes);
apiRoutes.use('/pos', posRoutes);

apiRoutes.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to KriyaLogic API v1',
    version: '1.0.0'
  });
});

app.use('/api/v1', apiRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
