// hash-password.js
const bcrypt = require('bcryptjs'); // Use bcryptjs instead of bcrypt

// The password you want to hash
const password = process.argv[2] || 'default-admin-password';

// Generate the hash with a salt round of 10
bcrypt.hash(password, 10, function(err, hash) {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }
  
  console.log('\nHashed Password:');
  console.log(hash);
  console.log('\nAdd this to your .env file as:');
  console.log(`VITE_ADMIN_HASHED_PASSWORD=${hash}`);
  // Or for create-react-app
  console.log(`REACT_APP_ADMIN_HASHED_PASSWORD=${hash}`);
});