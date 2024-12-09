const knex = require('knex');
const { Model, knexSnakeCaseMappers } = require('objection');
const getKnexFile = require('../../scripts/get-knexfile');
const Schema = require('../../scripts/asl-schema');

const snakeCase = str => str.replace(/[A-Z]/g, s => `_${s.toLowerCase()}`);

let knexInstance = null;

const initializeKnex = async () => {
  if (!knexInstance) {
    let dbConfig = await getKnexFile();
    dbConfig = {...dbConfig, ...knexSnakeCaseMappers()};
    // dbConfig = {...dbConfig, ...knexSnakeCaseMappers(), debug: true};
    knexInstance = knex(dbConfig);
  }
  Model.knex(knexInstance);
  return knexInstance;
};

module.exports = {
  init: async () => {
    const knex = await initializeKnex();
    return Schema(knex);
  },

  clean: async (schema) => {
    const knex = await initializeKnex();
    const tables = Object.keys(schema);

    for (const table of tables) {
      const { tableName } = schema[table];
      if (tableName) {
        await knex.raw(`TRUNCATE ${snakeCase(schema[table].tableName)} CASCADE;`);
      }
    }
  },

  getKnex: async () => initializeKnex()
};
