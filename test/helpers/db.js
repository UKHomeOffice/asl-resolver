const Schema = require('@asl/schema');
const settings = require('@asl/schema/knexfile').test;

const snakeCase = str => str.replace(/[A-Z]/g, s => `_${s.toLowerCase()}`);

module.exports = {
  init: () => Schema(settings.connection),
  clean: schema => {
    const tables = Object.keys(schema);

    return tables.reduce((p, table) => {
      return p.then(() => {
        if (schema[table].tableName) {
          return schema[table].knex().raw(`truncate ${snakeCase(schema[table].tableName)} cascade;`);
        }
      });
    }, Promise.resolve());
  }
};
