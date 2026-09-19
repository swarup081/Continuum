import api from './api';

export function isAuthenticated() {
  return !!localStorage.getItem('continuum_token');
}

export function getToken() {
  return localStorage.getItem('continuum_token') || '';
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('continuum_user') || 'null');
  } catch {
    return null;
  }
}

export async function login(email, password) {
  return api.login(email, password);
}

export async function register(email, password, name) {
  return api.register(email, password, name);
}

export function logout() {
  localStorage.removeItem('continuum_token');
  localStorage.removeItem('continuum_user');
}
