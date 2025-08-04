// src/services/post.service.js
const { Post, User, Category, Comment, sequelize } = require('../models');
const { Op } = require('sequelize');

const createPost = async (postData, authorId) => {
  try {
    // <<< MUDANÇA: Validação para posts agendados
    if (postData.status === 'scheduled') {
      if (!postData.publishedAt || new Date(postData.publishedAt) <= new Date()) {
        throw new Error('Para agendar um post, a data de publicação (publishedAt) deve ser uma data futura.');
      }
    }

    const post = await Post.create({ ...postData, authorId });
    return post;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new Error('Um post com este título (ou slug gerado) já existe.');
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
        throw new Error('ID de autor ou categoria inválido.');
    }
    throw error;
  }
};

const getAllPosts = async ({ page = 1, limit = 10, search = '', categorySlug = null, status = 'published', sortBy = 'publishedAt', sortOrder = 'DESC' }) => {
  try {
    const offset = (page - 1) * limit;
    let whereClause = { status };
    
    // <<< SEM MUDANÇA: Esta lógica já suporta seu requisito para o dashboard
    if (status === 'all') { 
        delete whereClause.status;
    }


    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { excerpt: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } },
      ];
    }

    let includeOptions = [
      { model: User, as: 'author', attributes: ['id', 'name', 'profileImageUrl', 'profileUrl', 'bio'] },
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
    ];

    if (categorySlug) {
      const category = await Category.findOne({ where: { slug: categorySlug } });
      if (category) {
        whereClause.categoryId = category.id;
      } else {
        return { totalItems: 0, posts: [], totalPages: 0, currentPage: parseInt(page,10) };
      }
    }
    
    const validSortOrders = ['ASC', 'DESC'];
    const orderDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    let orderClause;
    
    if (sortBy === 'custom') {
      orderClause = [
        [sequelize.literal('CASE WHEN "sortOrder" IS NULL THEN 1 ELSE 0 END'), 'ASC'],
        ['sortOrder', 'ASC'],
        ['publishedAt', 'DESC'],
        ['id', 'DESC']
      ];
    } else {
      orderClause = [[sortBy, orderDirection]];
      if (sortBy === 'createdAt' && !['publishedAt', 'updatedAt'].includes(sortBy)) {
          orderClause.push(['id', orderDirection]);
      }
    }


    const { count, rows } = await Post.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: orderClause,
      distinct: true,
    });
    return { totalItems: count, posts: rows, totalPages: Math.ceil(count / limit), currentPage: parseInt(page, 10) };
  } catch (error) {
    throw error;
  }
};

const getPostById = async (id) => {
  try {
    const post = await Post.findByPk(id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'profileImageUrl', 'profileUrl', 'bio'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        {
          model: Comment,
          as: 'comments',
          include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
          order: [['createdAt', 'DESC']]
        }
      ]
    });
    if (!post) throw new Error('Post não encontrado.');
    return post;
  } catch (error) {
    throw error;
  }
};

const getPostBySlug = async (slug) => {
  try {
    const post = await Post.findOne({
      where: { slug, status: 'published' },
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'profileImageUrl', 'profileUrl', 'bio'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        {
          model: Comment,
          as: 'comments',
          include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
          order: [['createdAt', 'DESC']]
        }
      ]
    });
    if (!post) throw new Error('Post não encontrado.');
    return post;
  } catch (error) {
    throw error;
  }
};

const updatePost = async (id, updateData, userId, userRole) => {
  try {
    // <<< MUDANÇA: Validação para posts agendados
    if (updateData.status === 'scheduled') {
        if (!updateData.publishedAt || new Date(updateData.publishedAt) <= new Date()) {
            throw new Error('Para agendar um post, a data de publicação (publishedAt) deve ser uma data futura.');
        }
    }

    const post = await Post.findByPk(id);
    if (!post) throw new Error('Post não encontrado.');

    await post.update(updateData);
    return post;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new Error('Um post com este título (ou slug gerado) já existe.');
    }
    throw error;
  }
};

const deletePost = async (id, userId, userRole) => {
  try {
    const post = await Post.findByPk(id);
    if (!post) throw new Error('Post não encontrado.');
    
    await post.destroy();
    return { message: 'Post deletado com sucesso.' };
  } catch (error) {
    throw error;
  }
};

const reorderPosts = async (postOrders) => {
  const transaction = await sequelize.transaction();
  try {
    for (const { id, sortOrder } of postOrders) {
      await Post.update({ sortOrder }, { where: { id }, transaction });
    }
    await transaction.commit();
    return { message: 'Posts reordenados com sucesso.' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const movePostToPosition = async (postId, newPosition) => {
  const transaction = await sequelize.transaction();
  try {
    const postToMove = await Post.findByPk(postId, { transaction });
    if (!postToMove) throw new Error('Post não encontrado.');
    
    const allPosts = await Post.findAll({
      order: [
        [sequelize.literal('CASE WHEN "sortOrder" IS NULL THEN 1 ELSE 0 END'), 'ASC'],
        ['sortOrder', 'ASC'],
        ['publishedAt', 'DESC'],
        ['id', 'DESC']
      ],
      transaction
    });
    
    const filteredPosts = allPosts.filter(p => p.id !== postId);
    filteredPosts.splice(newPosition, 0, postToMove);
    
    for (let i = 0; i < filteredPosts.length; i++) {
      await Post.update({ sortOrder: i + 1 }, { where: { id: filteredPosts[i].id }, transaction });
    }
    
    await transaction.commit();
    return { message: 'Post movido com sucesso.' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// <<< MUDANÇA: Nova função para o agendador (cron job)
/**
 * Encontra e publica posts cujo status é 'scheduled' e a data de publicação já passou.
 * @returns {Promise<{message: string, count: number}>}
 */
const publishScheduledPosts = async () => {
  try {
    const [affectedCount] = await Post.update(
      { status: 'published' }, // O que atualizar
      { // Onde atualizar
        where: {
          status: 'scheduled',
          publishedAt: {
            [Op.lte]: new Date() // lte = Less Than or Equal to (menor ou igual a)
          }
        },
        returning: false // Não precisa retornar os registros atualizados
      }
    );

    if (affectedCount > 0) {
      console.log(`[Scheduler] Publicados ${affectedCount} posts agendados.`);
    }

    return { message: 'Verificação de posts agendados concluída.', count: affectedCount };
  } catch (error) {
    console.error('[Scheduler] Erro ao publicar posts agendados:', error);
    throw error;
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getPostById,
  getPostBySlug,
  updatePost,
  deletePost,
  reorderPosts,
  movePostToPosition,
  publishScheduledPosts, // <<< MUDANÇA: Exporta a nova função
};