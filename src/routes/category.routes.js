// src/routes/category.routes.js
const express = require('express');
const categoryController = require('../controllers/category.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Rotas públicas para visualização
router.get('/', categoryController.getAllCategories);
router.get('/:identifier', categoryController.getCategory); // Pode ser ID ou Slug

// Rotas protegidas para admin/author para gerenciar categorias
router.post('/', authenticateToken, authorizeRole(['admin', 'author']), categoryController.createCategory);
router.put('/:id', authenticateToken, authorizeRole(['admin', 'author']), categoryController.updateCategory);
router.delete('/:id', authenticateToken, authorizeRole('admin'), categoryController.deleteCategory); // Apenas admin pode deletar

module.exports = router;