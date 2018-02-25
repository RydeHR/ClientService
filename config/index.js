require('dotenv').config();

module.exports = {
  serverPort: process.env.PORT,
  newRelicKey: process.env.NEW_RELIC_LICENSE_KEY,
  database_url: process.env.DATABASE_URL,
  database_keyspace: process.env.DATABASE_KEYSPACE
};