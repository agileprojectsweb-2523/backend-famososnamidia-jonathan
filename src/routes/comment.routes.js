// src/routes/comment.routes.js
const express = require('express');
const commentController = require('../controllers/comment.controller');
// Removido authorizeRole daqui, pois authenticateToken é opcional
const { authenticateToken, authorizeRole, softAuthenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Usa softAuthenticateToken: tenta autenticar, mas permite continuar se não houver token
router.post('/post/:postId/comments', softAuthenticateToken, commentController.createComment);

router.get('/post/:postId/comments', commentController.getCommentsByPost);

// Para deletar, a autenticação é obrigatória
router.delete('/comments/:commentId', authenticateToken, authorizeRole(['admin', 'author']), commentController.deleteComment);

module.exports = router;