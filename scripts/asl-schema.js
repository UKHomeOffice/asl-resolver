let db = null;

/**
 * @return - asl-schema/schema/index.js, returning SCHEMA and Knex Instance to query DB.
 *
 * asl-schema is ECMA module and not compatible with commonJs.
 * .eslintignore overrides the eslint check.
 * */
async function aslSchema(dbConfig) {
  try {
    const schemaModule = await import('@asl/schema');
    db = schemaModule.default;
    const aslSchema = db(dbConfig)
    return aslSchema;
  } catch (error) {
    console.error('Error initializing DB:', error);
    throw error;
  }
}

module.exports = aslSchema;
