// src/routes/user.routes.js
const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Rotas para usuários - a maioria deve ser protegida e/ou restrita a admins
router.post('/', authenticateToken, authorizeRole('admin'), userController.createUser); // Admin cria usuários
router.get('/', authenticateToken, authorizeRole('admin'), userController.getAllUsers); // Admin vê todos usuários
router.get('/:id', userController.getUserById); // Usuário logado pode ver seu perfil, ou admin pode ver qualquer um
router.put('/:id', authenticateToken, userController.updateUser); // Usuário logado atualiza seu perfil, ou admin atualiza qualquer um
router.delete('/:id', authenticateToken, authorizeRole('admin'), userController.deleteUser); // Admin deleta usuários

module.exports = router;