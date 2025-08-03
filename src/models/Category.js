'use strict';
const { Model } = require('sequelize');

// ... (Sua função generateSlug pode ficar aqui fora)
const generateSlug = (name) => { if (!name) return ''; return name.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, ''); };

module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      Category.hasMany(models.Post, { foreignKey: 'categoryId', as: 'posts', onUpdate: 'CASCADE' });
    }
  }
  Category.init({
    // ... (COLE TODO O CONTEÚDO DO SEU Category.init AQUI)
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { notEmpty: { msg: 'O nome da categoria não pode estar vazio.' }, len: { args: [2, 100], msg: 'O nome da categoria deve ter entre 2 e 100 caracteres.' } } },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true }
  }, {
    sequelize,
    modelName: 'Category',
    tableName: 'categories',
    // ... (COLE O RESTO DAS OPÇÕES DO SEU MODELO AQUI)
    timestamps: true,
    comment: 'Representa as categorias dos posts do blog',
    hooks: {
      beforeValidate: (category) => { if (category.name && !category.slug) category.slug = generateSlug(category.name); else if (category.slug) category.slug = generateSlug(category.slug); },
      beforeUpdate: (category) => { if (category.changed('name') && !category.changed('slug')) category.slug = generateSlug(category.name); else if (category.changed('slug') && category.slug) category.slug = generateSlug(category.slug); }
    },
    indexes: [{ unique: true, fields: ['name'] }, { unique: true, fields: ['slug'] }]
  });
  return Category;
};