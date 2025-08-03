// src/controllers/post.controller.js
const postService = require('../services/post.service');

const createPost = async (req, res) => {
  try {
    const authorId = req.user.id; // Assumindo que o ID do autor vem do usuário autenticado
    const post = await postService.createPost(req.body, authorId);
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllPosts = async (req, res) => {
  try {
    const { page, limit, search, categorySlug, status, sortBy, sortOrder } = req.query;
    // Para rotas públicas, geralmente queremos apenas 'published'
    // Para dashboard, o admin pode querer ver 'all' status
    const postStatus = req.path.includes('/dashboard') ? status : 'published';

    const result = await postService.getAllPosts({ page, limit, search, categorySlug, status: postStatus, sortBy, sortOrder });
    res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar posts:", error);
    res.status(500).json({ message: "Erro ao buscar posts." });
  }
};

const getPost = async (req, res) => {
  try {
    const { identifier } = req.params;
    // Tenta buscar por ID numérico ou por slug
    // O serviço já trata de mostrar apenas publicados para getPostBySlug
    const post = isNaN(parseInt(identifier))
      ? await postService.getPostBySlug(identifier)
      : await postService.getPostById(parseInt(identifier));
    
    // Se for getPostById, e o post não for publicado, apenas admin/autor pode ver
    if (post.status !== 'published' && (!req.user || (req.user.role !== 'admin' && req.user.id !== post.authorId))) {
        return res.status(404).json({message: "Post não encontrado ou não publicado."});
    }

    res.status(200).json(post);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const updatePost = async (req, res) => {
  try {
    // Adicionar lógica de autorização (req.user.id, req.user.role) no serviço
    const post = await postService.updatePost(req.params.id, req.body, req.user.id, req.user.role);
    res.status(200).json(post);
  } catch (error) {
    res.status(error.message.includes('não encontrado') ? 404 : 400).json({ message: error.message });
  }
};

const deletePost = async (req, res) => {
  try {
    // Adicionar lógica de autorização no serviço
    await postService.deletePost(req.params.id, req.user.id, req.user.role);
    res.status(200).json({ message: 'Post deletado com sucesso.' });
  } catch (error) {
    res.status(error.message.includes('não encontrado') ? 404 : 500).json({ message: error.message });
  }
};

const reorderPosts = async (req, res) => {
  try {
    const { postOrders } = req.body; // Array de { id, sortOrder }
    if (!Array.isArray(postOrders)) {
      return res.status(400).json({ message: 'postOrders deve ser um array.' });
    }
    
    const result = await postService.reorderPosts(postOrders);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const movePostToPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { position } = req.body;
    
    if (typeof position !== 'number' || position < 0) {
      return res.status(400).json({ message: 'Posição deve ser um número não negativo.' });
    }
    
    const result = await postService.movePostToPosition(parseInt(id), position);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.message.includes('não encontrado') ? 404 : 500).json({ message: error.message });
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getPost,
  updatePost,
  deletePost,
  reorderPosts,
  movePostToPosition,
};