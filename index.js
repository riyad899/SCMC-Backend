const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB, getDB } = require('./config/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Start Server
const startServer = async () => {
  try {
    await connectDB();

    const db = getDB();

    // Sample route
    app.get('/', (req, res) => {
      res.send('🏀 Sports Club Management System API Running');
    });




    // Optional DB test route
    app.get('/test-db', async (req, res) => {
      try {
        const collections = await db.listCollections().toArray();
        res.json({ collections });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Error starting server:', error.message);
  }
};

startServer();
