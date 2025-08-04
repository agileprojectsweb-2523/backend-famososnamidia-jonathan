'use strict';
const { Model } = require('sequelize');
const validator = require('validator');

// ... (Sua função generateSlug pode ficar aqui fora)
const generateSlug = (title) => { if (!title) return ''; return title.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, ''); };

module.exports = (sequelize, DataTypes) => {
  class Post extends Model {
    static associate(models) {
      Post.belongsTo(models.User, { foreignKey: { name: 'authorId', allowNull: true }, as: 'author', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
      Post.belongsTo(models.Category, { foreignKey: { name: 'categoryId', allowNull: false }, as: 'category', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
      Post.hasMany(models.Comment, { foreignKey: 'postId', as: 'comments', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  }
  Post.init({
    // ... (COLE TODO O CONTEÚDO DO SEU Post.init AQUI)
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: { msg: 'O título do post não pode estar vazio.' }, len: { args: [5, 255], msg: 'O título deve ter entre 5 e 255 caracteres.'} } },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    excerpt: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: { msg: 'O excerto (resumo) não pode estar vazio.' } } },
    content: { type: DataTypes.TEXT('long'), allowNull: false, validate: { notEmpty: { msg: 'O conteúdo do post não pode estar vazio.' } } },
    imageUrl: { type: DataTypes.STRING, allowNull: true, validate: { isUrlOrNull(value) { if (value && value !== '' && !validator.isURL(value)) throw new Error('Forneça uma URL de imagem válida ou deixe o campo vazio.'); } } },
    // <<< MUDANÇA: Adicionado o status 'scheduled'
    status: { type: DataTypes.ENUM('published', 'draft', 'archived', 'scheduled'), defaultValue: 'draft', allowNull: false },
    publishedAt: { type: DataTypes.DATE, allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null, comment: 'Ordem personalizada para exibição dos posts' },
    focalPointX: { type: DataTypes.DECIMAL(5, 2), allowNull: true, defaultValue: 50.00, validate: { min: 0, max: 100 }, comment: 'Posição X do ponto focal da imagem em porcentagem (0-100)' },
    focalPointY: { type: DataTypes.DECIMAL(5, 2), allowNull: true, defaultValue: 50.00, validate: { min: 0, max: 100 }, comment: 'Posição Y do ponto focal da imagem em porcentagem (0-100)' },
  }, {
    sequelize,
    modelName: 'Post',
    tableName: 'posts',
    // ... (COLE O RESTO DAS OPÇÕES DO SEU MODELO AQUI)
    timestamps: true,
    comment: 'Representa os artigos do blog',
    hooks: {
      beforeValidate: (post) => { if (post.title && !post.slug) post.slug = generateSlug(post.title); else if (post.slug) post.slug = generateSlug(post.slug); if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date(); },
      beforeUpdate: (post) => { if (post.changed('title') && !post.changed('slug')) post.slug = generateSlug(post.title); else if (post.changed('slug') && post.slug) post.slug = generateSlug(post.slug); if (post.changed('status') && post.status === 'published' && !post.publishedAt) post.publishedAt = new Date(); }
    },
    indexes: [{ unique: true, fields: ['slug'] }, { fields: ['status'] }, { fields: ['publishedAt'] }, { fields: ['sortOrder'] }]
  });
  return Post;
};