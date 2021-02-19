const env = process.env.NODE_ENV || 'local';

const local = require('./local');
const dev = require('./dev');
const staging = require('./staging');
const production = require('./production');

const index = {dev, staging, production, local};

module.exports = index[env];
