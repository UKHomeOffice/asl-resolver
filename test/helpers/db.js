const Schema = require('../../scripts/asl-schema');
const getKnexFile = require('../../scripts/get-knexfile');

const snakeCase = str => str.replace(/[A-Z]/g, s => `_${s.toLowerCase()}`);

module.exports = {
  init: async () => {
    const testConfig = await getKnexFile();
    const schema = await Schema(testConfig);
    console.log('schema:--', schema);
    return schema;
  },

  clean: async schema => {
    const tables = Object.keys(schema);

    for (const table of tables) {
      if (schema[table].tableName) {
        await schema[table]
          .knex()
          .raw(`TRUNCATE ${snakeCase(schema[table].tableName)} CASCADE;`);
        console.log(`${schema[table].tableName} TRUNCATED`);
      }
    }
  }
};
