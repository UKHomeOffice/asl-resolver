const path = require('path');
const knex = require('knex');

const getKnexFile = require('./get-knexfile');

/**
 * @return void - run latest migration.
 * */
async function latestMigration() {

  const testConfig = await getKnexFile();
  const knexInstance = knex(testConfig);
  try {
    await knexInstance.migrate.latest({
      directory: path.resolve(__dirname, '../../../node_modules/@asl/schema/migrations') // Ensure migration dir points to dependency
    });
    console.log('Migrations completed.');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    // Destroy the Knex instance to free up connections
    await knexInstance.destroy();
  }
}
latestMigration();
module.exports = latestMigration;
