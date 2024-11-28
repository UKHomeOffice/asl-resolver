/**
 * @return - asl-schema/schema/index.js, returning SCHEMA and Knex Instance to query DB.
 *
 * asl-schema is ECMA module and not compatible with commonJs.
 * .eslintignore overrides the eslint check.
 * */
async function getKnexFile() {
  try {
    const {test} = await import('@asl/schema/knexfile.js');
    return test;
  } catch (error) {
    console.error('Error initializing DB:', error);
    throw error;
  }
}
getKnexFile();

module.exports = getKnexFile;
