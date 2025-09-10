import axios from 'axios';


const API_URL =
  process.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const login = async (email: string, password: string) => {
  const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const login = async (email: string, password: string) => {
  const response = await axios.post(`${API_URL}/auth/login`, { email, password });

  return response.data.token;
};

export const register = async (name: string, email: string, password: string) => {

  await axios.post(`${API_URL}/api/auth/register`, { name, email, password });

  await axios.post(`${API_URL}/auth/register`, { name, email, password });

};
