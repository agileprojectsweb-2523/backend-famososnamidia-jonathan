// src/routes/upload.routes.js
const express = require('express');
const router = express.Router();
const upload = require('../config/multer.config'); // Nossa configuração do Multer
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

// POST /api/v1/upload/image
// Rota para fazer upload de uma única imagem
router.post(
    '/image',
    authenticateToken, // Garante que o usuário está logado
    authorizeRole(['admin', 'author']), // Apenas admin ou author podem fazer upload
    upload.single('imageFile'), // 'imageFile' deve ser o nome do campo no FormData do frontend
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo foi enviado ou o arquivo foi rejeitado pelo filtro.' });
        }

        // O arquivo foi salvo com sucesso pelo multer.
        // req.file contém informações sobre o arquivo salvo, como req.file.filename
        
        // Construir a URL pública da imagem
        // Se app.use(express.static(path.join(__dirname, 'public'))) foi usado sem prefixo:
        const imageUrl = `/uploads/images/${req.file.filename}`;
        // Se app.use('/static', express.static(path.join(__dirname, 'public'))) foi usado:
        // const imageUrl = `/static/uploads/images/${req.file.filename}`;

        res.status(201).json({
            message: 'Upload da imagem realizado com sucesso!',
            imageUrl: imageUrl, // URL para acessar a imagem
            filename: req.file.filename // Nome do arquivo salvo no servidor
        });
    },
    // Middleware de tratamento de erro específico para esta rota, se o multer jogar um erro ANTES do controller
    (error, req, res, next) => {
        if (error instanceof multer.MulterError) {
            // Erros conhecidos do Multer (ex: limite de tamanho)
            return res.status(400).json({ message: `Erro de Upload Multer: ${error.message} (Código: ${error.code})` });
        } else if (error) {
            // Outros erros (ex: tipo de arquivo inválido do nosso fileFilter)
            return res.status(400).json({ message: error.message });
        }
        // Se não houver erro, mas nenhum arquivo (já tratado no controller), apenas passa para o próximo
        next();
    }
);

module.exports = router;