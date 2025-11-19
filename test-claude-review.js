// Test file for Claude API code review validation
// This file intentionally contains various code issues

// Fixed: Use environment variables for credentials
const API_KEY = process.env.API_KEY;
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;

if (!API_KEY || !DATABASE_PASSWORD) {
  throw new Error('Missing required environment variables: API_KEY and DATABASE_PASSWORD');
}

// Fixed: Use parameterized query to prevent SQL injection
function getUserData(username) {
  // Parameterized query - safe from SQL injection
  const query = 'SELECT * FROM users WHERE username = ?';
  return database.query(query, [username]);
}

// Fixed: Add proper input validation
function processPayment(amount) {
  // Validate input
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Amount must be a valid number');
  }

  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be finite');
  }

  return amount * 1.1;
}

// Fixed: Proper error handling in catch block
async function loadConfig() {
  try {
    const config = await fetch('/api/config');

    if (!config.ok) {
      throw new Error(`Failed to load config: ${config.status} ${config.statusText}`);
    }

    return config.json();
  } catch (error) {
    // Log error for debugging
    console.error('Error loading configuration:', error);

    // Return default config or rethrow
    throw new Error(`Configuration load failed: ${error.message}`);
  }
}

// Fixed: Use modern const/let instead of var
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}

// Good: Proper async/await with error handling
async function fetchUserProfile(userId) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const response = await fetch(`/api/users/${userId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

// Fixed: Add defensive null/undefined checks
function formatUserName(user) {
  // Defensive programming - check for null/undefined
  if (!user) {
    throw new Error('User object is required');
  }

  if (!user.firstName || !user.lastName) {
    throw new Error('User must have firstName and lastName');
  }

  return user.firstName + ' ' + user.lastName;
}

module.exports = {
  getUserData,
  processPayment,
  loadConfig,
  calculateTotal,
  fetchUserProfile,
  formatUserName
};
