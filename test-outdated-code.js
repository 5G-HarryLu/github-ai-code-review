// Test file with intentionally outdated 2015-era code patterns
// This will test the enhanced 2025 standards review

// Outdated #1: Using var instead of const/let
var userName = 'admin';
var userAge = 25;

// Outdated #2: Using CommonJS instead of ESM
const express = require('express');
const bcrypt = require('bcrypt');
const moment = require('moment');

// Outdated #3: Old-style callbacks instead of async/await
function fetchUserData(userId, callback) {
  database.query('SELECT * FROM users WHERE id = ' + userId, function(err, result) {
    if (err) {
      callback(err);
    } else {
      callback(null, result);
    }
  });
}

// Outdated #4: Using bcrypt (2015 standard) instead of Argon2id (2025 standard)
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Outdated #5: jQuery-style DOM manipulation
function updateUserProfile() {
  $('#username').text(userName);
  $('.user-age').html(userAge);
  $('#profile-card').show();
}

// Outdated #6: Using moment.js instead of Temporal API
function formatDate(date) {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
}

// Outdated #7: Traditional Promise chains instead of async/await
function loadUserProfile(userId) {
  fetchUserData(userId)
    .then(function(user) {
      return validateUser(user);
    })
    .then(function(validUser) {
      return enrichUserData(validUser);
    })
    .then(function(enrichedUser) {
      displayUser(enrichedUser);
    })
    .catch(function(error) {
      console.log(error);
    });
}

// Outdated #8: Using MD5 for hashing (security issue)
const crypto = require('crypto');
function quickHash(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

// Outdated #9: Class component pattern (React)
class UserProfile extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null,
      loading: true
    };
  }

  componentDidMount() {
    this.loadUser();
  }

  loadUser() {
    fetch('/api/user')
      .then(res => res.json())
      .then(user => this.setState({ user, loading: false }));
  }

  render() {
    return (
      <div>
        {this.state.loading ? 'Loading...' : this.state.user.name}
      </div>
    );
  }
}

// Outdated #10: Traditional switch statement instead of switch expression
function getUserRole(roleId) {
  switch(roleId) {
    case 1:
      return 'admin';
    case 2:
      return 'moderator';
    case 3:
      return 'user';
    default:
      return 'guest';
  }
}

// Outdated #11: Using any type in TypeScript (if this were TS)
// function processData(data: any): any {
//   return data.value;
// }

// Outdated #12: Not using optional chaining
function getUserEmail(user) {
  if (user && user.profile && user.profile.contact && user.profile.contact.email) {
    return user.profile.contact.email;
  }
  return null;
}

// Outdated #13: Using XMLHttpRequest instead of fetch
function legacyAjaxCall() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/data', true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var data = JSON.parse(xhr.responseText);
      console.log(data);
    }
  };
  xhr.send();
}

module.exports = {
  fetchUserData,
  hashPassword,
  updateUserProfile,
  formatDate,
  loadUserProfile,
  quickHash,
  UserProfile,
  getUserRole,
  getUserEmail,
  legacyAjaxCall
};
