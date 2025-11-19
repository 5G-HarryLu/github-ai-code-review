// Example function with some issues for AI to review
function processUserData(data) {
  // Missing input validation
  const result = {
    name: data.name.toUpperCase(),
    email: data.email,
    age: parseInt(data.age)
  };
  
  // No error handling for database operation
  database.save(result);
  
  return result;
}

// Good: Using const and proper naming
const API_ENDPOINT = 'https://api.example.com';

async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

module.exports = { processUserData, fetchData };
