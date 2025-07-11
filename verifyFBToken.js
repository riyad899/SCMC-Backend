const admin = require('./firebaseAdmin');

const verifyFBToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(authHeader)
  console.log('Authorization header:', authHeader);

  if (!authHeader) {
    return res.status(401).send({ message: 'unauthorized access - no authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access - no token provided' });
  }

  console.log('Token received:', token.substring(0, 20) + '...');

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('Token verified successfully for user:', decoded.email);
    req.decoded = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(403).send({ message: 'forbidden access - invalid token' });
  }
};

module.exports = verifyFBToken;
