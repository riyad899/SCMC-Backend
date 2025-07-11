const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);
let db;

const connectDB = async () => {
  try {
    db = client.db(process.env.DB_NAME);

  } catch (error) {
    
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('❌ Database not initialized. Call connectDB() first.');
  }
  return db;
};

module.exports = { connectDB, getDB };
