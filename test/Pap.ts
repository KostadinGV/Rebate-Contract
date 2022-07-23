import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("Pap", function () {

  async function deploy() {
    const [owner, addr1] = await ethers.getSigners();

    const blockNumber = await ethers.provider.getBlockNumber();
    const {timestamp} = await ethers.provider.getBlock(blockNumber);

    const Pbl = await ethers.getContractFactory("pbl");
    const pbl = await Pbl.deploy("Pebble","Pbl",timestamp,addr1.address,addr1.address);

    //use the same contract for weth
    const weth = await Pbl.deploy("Weth","weth",timestamp,addr1.address,addr1.address);

    const PblOracle = await ethers.getContractFactory("pblOracle");
    const pblOracle = await PblOracle.deploy();

    const WethOracle = await ethers.getContractFactory("wethOracle");
    const wethOracle = await WethOracle.deploy();

    const Pap = await ethers.getContractFactory("PAP");
    const pap = await Pap.deploy(pbl.address,pblOracle.address);

    await pap.setAsset(weth.address, true, 1000000, wethOracle.address, false, weth.address );

    //fund contract with 1000 pbl
    await pbl.mint(pap.address, "1000000000000000000000");
    //mint 1000 weth to wallet
    await weth.mint(owner.address, "1000000000000000000000");
    //approve weth to contract
    await weth.approve(pap.address,"1000000000000000000000");

    return { pbl, pap, pblOracle, weth, wethOracle, owner, addr1 };
  }

  it("should be unable to bond when 0.5 twap", async function () {
    const { pblOracle, weth, pap } = await loadFixture(deploy);
    await pblOracle.set("500000000000000000");

    await expect(pap.bond(weth.address,"1000000000000000000")).to.be.revertedWith(
      "PAP: insufficient limit"
    );
  });

  it("should print when 1 twap", async function () {
    const { pap, weth, pblOracle, owner } = await loadFixture(deploy);

    await pblOracle.set("1000000000000000000");
    await expect(pap.bond(weth.address,"1000000000000000000")).not.to.be.reverted;
    await network.provider.send("evm_increaseTime", [7*24*3600]);
    await network.provider.send("evm_mine");
    expect(await pap.claimablePbl(owner.address)).to.eq("1100000000000000000");

  });

  it("should be unable to bond 35 weth when 1 twap", async function () {
    const { pap, weth, pblOracle } = await loadFixture(deploy);

    await pblOracle.set("1000000000000000000");
    await expect(pap.bond(weth.address,"35000000000000000000")).to.be.revertedWith(
      "PAP: insufficient limit"
    );
  });

  it("should be able to bond 34 weth when 1 twap", async function () {
    const { pap, weth, pblOracle } = await loadFixture(deploy);
    
    await pblOracle.set("1000000000000000000");
    await pap.updateTier();
    await expect(pap.bond(weth.address,"34000000000000000000")).not.to.be.reverted;
  });

  it("getPblReturn should return right value", async function () {
    const { pap, weth, pblOracle } = await loadFixture(deploy);

    await pblOracle.set(2e18.toString());
    expect(await pap.getPblReturn(weth.address, "1000")).to.equal("550");
  });

  it("should be unable to bond 136 pbl when 2 twap", async function () {
    const { pap, weth, pblOracle } = await loadFixture(deploy);

    await pblOracle.set(2e18.toString());
    await expect(pap.bond(weth.address,136e18.toString())).to.be.revertedWith(
      "PAP: insufficient limit"
    );
  });
});
