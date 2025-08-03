// src/routes/index.routes.js
const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const categoryRoutes = require('./category.routes');
const postRoutes = require('./post.routes');
const commentRoutes = require('./comment.routes');
const uploadRoutes = require('./upload.routes'); // <<< IMPORTAR ROTAS DE UPLOAD

const router = express.Router();

const apiBasePath = '/api/v1'; // Prefixo para todas as rotas da API

router.use(`${apiBasePath}/auth`, authRoutes);
router.use(`${apiBasePath}/users`, userRoutes);
router.use(`${apiBasePath}/categories`, categoryRoutes);
router.use(`${apiBasePath}/posts`, postRoutes);
// As rotas de comentários já incluem /post/:postId, então não precisam de prefixo posts aqui
// ou podem ser aninhadas de forma diferente. Por simplicidade:
router.use(`${apiBasePath}`, commentRoutes); // commentRoutes já tem /post/:postId/comments
router.use(`${apiBasePath}/upload`, uploadRoutes); // <<< ADICIONAR ROTAS DE UPLOAD

router.get(apiBasePath, (req, res) => {
  res.json({ message: 'Bem-vindo à API do Famosos na Mídia!' });
});

module.exports = router;