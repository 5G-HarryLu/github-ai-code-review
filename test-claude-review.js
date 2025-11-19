// Test file for Claude API code review validation
// This file intentionally contains various code issues

// Issue 1: Hardcoded credentials (Security)
const API_KEY = 'sk-1234567890abcdef';
const DATABASE_PASSWORD = 'admin123';

// Issue 2: SQL Injection vulnerability
function getUserData(username) {
  const query = `SELECT * FROM users WHERE username = '${username}'`;
  return database.query(query);
}

// Issue 3: No input validation
function processPayment(amount) {
  return amount * 1.1; // No validation if amount is negative or invalid
}

// Issue 4: Empty catch block
async function loadConfig() {
  try {
    const config = await fetch('/api/config');
    return config.json();
  } catch (error) {
    // Empty catch - bad practice
  }
}

// Issue 5: Using var instead of const/let
function calculateTotal(items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
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

// Issue 6: Missing null check
function formatUserName(user) {
  return user.firstName + ' ' + user.lastName; // No null check on user
}

module.exports = {
  getUserData,
  processPayment,
  loadConfig,
  calculateTotal,
  fetchUserProfile,
  formatUserName
};
