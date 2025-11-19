// Security test file for Gemini 2.5 Pro review
const crypto = require('crypto');

// Weak password hashing (intentional security issue)
function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

// SQL injection vulnerability
function getUserByEmail(email) {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  return database.query(query);
}

// Hardcoded credentials (security issue)
const config = {
  apiKey: 'sk-1234567890abcdef',
  dbPassword: 'admin123',
  secretToken: 'my-secret-token'
};

// Missing authentication check
function deleteUser(userId) {
  return database.delete('users', { id: userId });
}

// Good: Proper async error handling
async function validateUser(userId) {
  try {
    const user = await database.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    console.error('Validation error:', error);
    throw error;
  }
}

module.exports = { 
  hashPassword, 
  getUserByEmail, 
  deleteUser, 
  validateUser 
};
