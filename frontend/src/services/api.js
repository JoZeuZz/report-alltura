import axios from 'axios';

// Create an axios instance with a base URL for the backend API
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

/*
  We will intercept requests to add the JWT token to the Authorization header.
  This is often done in a central place, like the AuthContext,
  or by using axios interceptors.
*/

export default api;