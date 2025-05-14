import { ethers, upgrades } from "hardhat";

async function main() {
  const initParams = {
    admin: "0x62007a126BAb6BD6C3CC56896aa59080a3e55334",
    minter: "0x62007a126BAb6BD6C3CC56896aa59080a3e55334",
    burner: "0x62007a126BAb6BD6C3CC56896aa59080a3e55334",
    upgrader: "0x62007a126BAb6BD6C3CC56896aa59080a3e55334",
    name: "Test Token",
    symbol: "TST",
    maxSupply: ethers.parseEther("1000000"),
  };

  const TestToken = await ethers.getContractFactory("TestToken");

  const proxy = await upgrades.deployProxy(TestToken, [initParams], {
    initializer: "initialize",
    kind: "uups",
  });

  await proxy.waitForDeployment();

  console.log("Proxy deployed to:", await proxy.getAddress());
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
