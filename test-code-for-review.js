/**
 * Test file for Claude AI Code Review
 * This file contains intentional issues for Claude to review
 */

// TODO: This is a test to see if Claude catches TODO comments
function calculateTotal(items) {
  var total = 0; // Using var instead of const/let

  // No input validation
  for (var i = 0; i < items.length; i++) {
    total = total + items[i].price;
  }

  return total;
}

// Function with security vulnerability
function getUserData(userId) {
  // SQL injection vulnerability - not using parameterized queries
  const query = "SELECT * FROM users WHERE id = " + userId;
  return database.query(query);
}

// Missing error handling
async function fetchData(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// Unused variable
const unusedVariable = "This variable is never used";

// Magic numbers without explanation
function calculateDiscount(price) {
  if (price > 100) {
    return price * 0.15; // What does 0.15 represent?
  }
  return price * 0.05;
}

module.exports = {
  calculateTotal,
  getUserData,
  fetchData,
  calculateDiscount
};
