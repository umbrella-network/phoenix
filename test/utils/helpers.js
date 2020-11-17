const int64 = require('int64-buffer');

exports.hash2buffer = hash => Buffer.from(hash.slice(2), 'hex');

exports.string2buffer = str => Buffer.from(str);

exports.intToBuffer = i => {
  const hex = new int64.Int64BE(i).toBuffer().toString('hex');
  const hexInt = hex.replace(/^0+/g, '');
  return Buffer.from(`${hexInt.length % 2 === 0 ? '' : '0'}${hexInt}`, 'hex');
};
