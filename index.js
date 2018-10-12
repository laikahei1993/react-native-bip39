var unorm = require("unorm");
var assert = require("assert");
var createHash = require("create-hash");
var randomBytes = require("react-native-randombytes").randomBytes;
var CryptoJS = require("crypto-js");

var DEFAULT_WORDLIST = require("./wordlists/en.json");

function mnemonicToSeed(mnemonic) {
  var mnemonicNormalized = normalizeString(mnemonic);
  var salt = "mnemonic";
  var key512Bits = CryptoJS.PBKDF2(mnemonicNormalized, salt, {
    hasher: CryptoJS.algo.SHA512
    keySize: 512 / 32,
    iterations: 2048
  });
  return key512Bits;
}

function mnemonicToSeedHex(mnemonic) {
  var seed = mnemonicToSeed(mnemonic);
  return seed.toString(CryptoJS.enc.Hex);
}

function mnemonicToEntropy(mnemonic, wordlist) {
  wordlist = wordlist || DEFAULT_WORDLIST;

  var words = mnemonic.split(" ");
  assert(words.length % 3 === 0, "Invalid mnemonic");

  var belongToList = words.every(function(word) {
    return wordlist.indexOf(word) > -1;
  });

  assert(belongToList, "Invalid mnemonic");

  // convert word indices to 11 bit binary strings
  var bits = words
    .map(function(word) {
      var index = wordlist.indexOf(word);
      return lpad(index.toString(2), "0", 11);
    })
    .join("");

  // split the binary string into ENT/CS
  var dividerIndex = Math.floor(bits.length / 33) * 32;
  var entropy = bits.slice(0, dividerIndex);
  var checksum = bits.slice(dividerIndex);

  // calculate the checksum and compare
  var entropyBytes = entropy.match(/(.{1,8})/g).map(function(bin) {
    return parseInt(bin, 2);
  });
  var entropyBuffer = new Buffer(entropyBytes);
  var newChecksum = checksumBits(entropyBuffer);

  assert(newChecksum === checksum, "Invalid mnemonic checksum");

  return entropyBuffer.toString("hex");
}

function entropyToMnemonic(entropy, wordlist) {
  wordlist = wordlist || DEFAULT_WORDLIST;

  var entropyBuffer = new Buffer(entropy, "hex");
  var entropyBits = bytesToBinary([].slice.call(entropyBuffer));
  var checksum = checksumBits(entropyBuffer);

  var bits = entropyBits + checksum;
  var chunks = bits.match(/(.{1,11})/g);

  var words = chunks.map(function(binary) {
    var index = parseInt(binary, 2);

    return wordlist[index];
  });

  return words.join(" ");
}

function generateMnemonic(strength, rng, wordlist) {
  return new Promise((resolve, reject) => {
    strength = strength || 128;
    rng = rng || randomBytes;

    rng(strength / 8, (error, randomBytesBuffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(entropyToMnemonic(randomBytesBuffer.toString("hex"), wordlist));
      }
    });
  });
}

function validateMnemonic(mnemonic, wordlist) {
  try {
    mnemonicToEntropy(mnemonic, wordlist);
  } catch (e) {
    return false;
  }

  return true;
}

function checksumBits(entropyBuffer) {
  var hash = createHash("sha256")
    .update(entropyBuffer)
    .digest();

  // Calculated constants from BIP39
  var ENT = entropyBuffer.length * 8;
  var CS = ENT / 32;

  return bytesToBinary([].slice.call(hash)).slice(0, CS);
}

function normalizeString(str) {
  return unorm.nfkd(str);
}

//=========== helper methods from bitcoinjs-lib ========

function bytesToBinary(bytes) {
  return bytes
    .map(function(x) {
      return lpad(x.toString(2), "0", 8);
    })
    .join("");
}

function lpad(str, padString, length) {
  while (str.length < length) str = padString + str;
  return str;
}

module.exports = {
  mnemonicToSeed: mnemonicToSeed,
  mnemonicToSeedHex: mnemonicToSeedHex,
  mnemonicToEntropy: mnemonicToEntropy,
  entropyToMnemonic: entropyToMnemonic,
  generateMnemonic: generateMnemonic,
  validateMnemonic: validateMnemonic,
  wordlists: {
    EN: DEFAULT_WORDLIST
  }
};
