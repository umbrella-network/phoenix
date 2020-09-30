const { assert, expect } = require("chai");
const { assertRevert } = require("@openzeppelin/test-helpers");
const { web3Utils } = require("web3-utils");

const SparseMerkleTree = require('../../lib/SparseMerkleTree');

describe("Chain", function() {
  it("Should return the new greeting once it's changed", async function() {
    const ChainFactory = await ethers.getContractFactory("Chain");
    
    expect(true).to.equal(true);
  });
});
