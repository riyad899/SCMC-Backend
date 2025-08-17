const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

let client;
let db;

const connectDB = async () => {
  try {
    if (!client) {
      client = new MongoClient(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      await client.connect();
      console.log('✅ Connected to MongoDB');
    }
    
    if (!db) {
      db = client.db(process.env.DB_NAME);
    }
    
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('❌ Database not initialized. Call connectDB() first.');
  }
  return db;
};

module.exports = { connectDB, getDB };
