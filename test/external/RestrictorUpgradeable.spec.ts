import { expect } from "chai";
import hre, { deployments, waffle, ethers, network } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getRestrictor, getSafeWithOwners } from "../utils/setup";
import { parseEther } from "@ethersproject/units";
import { buildSafeTransaction, executeTx, safeApproveHash } from "../../src/utils/execution";

describe("RestrictorUpgradeable", async () => {
    const [user1, user2, user3] = waffle.provider.getWallets();
    const ETHAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const restrictor = await getRestrictor();
        return {
            safe: await getSafeWithOwners([user1.address], 1, AddressZero, restrictor.address),
            restrictor,
        };
    });

    describe("Sanity check", async () => {
        it("should register proxies by owner only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.connect(user3).registerProxies([safe.address])).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should remove proxies by owner only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.connect(user3).removeProxies([safe.address])).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should add whitelist addresses by owner only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.connect(user3).addWhitelistAddresses(safe.address, [user2.address])).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("should add whitelist addresses to the registerd proxy only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.addWhitelistAddresses(safe.address, [user2.address])).to.be.revertedWith("Not registered proxy");
        });

        it("should remove whitelist addresses by owner only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.connect(user3).removeWhitelistAddresses(safe.address, [user2.address])).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("should remove whitelist addresses in the registerd proxy only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.removeWhitelistAddresses(safe.address, [user2.address])).to.be.revertedWith("Not registered proxy");
        });

        it("should add whitelist methods by owner only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.connect(user3).addWhitelistMethods(safe.address, ["0x095ea7b3"])).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("should add whitelist methods to the registerd proxy only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.addWhitelistMethods(safe.address, ["0x095ea7b3"])).to.be.revertedWith("Not registered proxy");
        });

        it("should remove whitelist methods by owner only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.connect(user3).addWhitelistMethods(safe.address, ["0x095ea7b3"])).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("should remove whitelist methods in the registerd proxy only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(restrictor.addWhitelistMethods(safe.address, ["0x095ea7b3"])).to.be.revertedWith("Not registered proxy");
        });

        it("should set daily cap by owner only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(
                restrictor
                    .connect(user3)
                    .setDailyCap(safe.address, [user1.address], ["0x2791bca1f2de4661ed88a30c99a7a9449aa84174"], ["100"]),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should set daily cap to the registered proxy only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(
                restrictor.setDailyCap(safe.address, [user1.address], ["0x2791bca1f2de4661ed88a30c99a7a9449aa84174"], ["100"]),
            ).to.be.revertedWith("Not registered proxy");
        });

        it("should set monthly cap by owner only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(
                restrictor
                    .connect(user3)
                    .setMonthlyCap(safe.address, [user1.address], ["0x2791bca1f2de4661ed88a30c99a7a9449aa84174"], ["100"]),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should set monthly cap to the registered proxy only", async () => {
            const { safe, restrictor } = await setupTests();
            await expect(
                restrictor.setMonthlyCap(safe.address, [user1.address], ["0x2791bca1f2de4661ed88a30c99a7a9449aa84174"], ["100"]),
            ).to.be.revertedWith("Not registered proxy");
        });
    });

    describe("External function test", async () => {
        describe("Proxy test", async () => {
            let restrictor: any, safe: any;
            beforeEach(async () => {
                const res = await setupTests();
                restrictor = res.restrictor;
                safe = res.safe;
                await restrictor.registerProxies([safe.address]);
            });
            it("should register proxies correctly", async () => {
                expect(await restrictor.isRegisteredProxy(safe.address)).to.be.eq(true);
            });
            it("should remove proxies correctly", async () => {
                await restrictor.removeProxies([safe.address]);
                expect(await restrictor.isRegisteredProxy(safe.address)).to.be.eq(false);
            });
        });

        describe("Whitelist address test", async () => {
            let restrictor: any, safe: any;
            beforeEach(async () => {
                const res = await setupTests();
                restrictor = res.restrictor;
                safe = res.safe;
                await restrictor.registerProxies([safe.address]);
                await restrictor.addWhitelistAddresses(safe.address, [user3.address]);
            });
            it("should whitelist address correctly", async () => {
                expect(await restrictor.isAllowedAddress(safe.address, user3.address)).to.be.eq(true);
            });
            it("should remove address from whitelist correctly", async () => {
                await restrictor.removeWhitelistAddresses(safe.address, [user3.address]);
                expect(await restrictor.isAllowedAddress(safe.address, user3.address)).to.be.eq(false);
            });
        });

        describe("Whitelist method test", async () => {
            let restrictor: any, safe: any;
            beforeEach(async () => {
                const res = await setupTests();
                restrictor = res.restrictor;
                safe = res.safe;
                await restrictor.registerProxies([safe.address]);
                await restrictor.addWhitelistMethods(safe.address, ["0x095ea7b3"]);
            });
            it("should whitelist method correctly", async () => {
                expect(await restrictor.isAllowedMethod(safe.address, "0x095ea7b3")).to.be.eq(true);
            });
            it("should remove method from whitelist correctly", async () => {
                await restrictor.removeWhitelistMethods(safe.address, ["0x095ea7b3"]);
                expect(await restrictor.isAllowedMethod(safe.address, "0x095ea7b3")).to.be.eq(false);
            });
        });

        describe("Cap test", async () => {
            let restrictor: any, safe: any, token: any;
            beforeEach(async () => {
                const res = await setupTests();
                restrictor = res.restrictor;
                safe = res.safe;

                token = await (await ethers.getContractFactory("ERC20Token")).deploy();
                await token.deployed();
                await restrictor.registerProxies([safe.address]);
            });
            it("should set daily cap correctly", async () => {
                await restrictor.setDailyCap(safe.address, [user3.address], [token.address], [parseEther("100")]);
                expect(await restrictor.dailyCap(safe.address, user3.address, token.address)).to.be.eq(parseEther("100"));
            });
            it("should set monthly cap correctly", async () => {
                await restrictor.setMonthlyCap(safe.address, [user3.address], [token.address], [parseEther("100")]);
                expect(await restrictor.monthlyCap(safe.address, user3.address, token.address)).to.be.eq(parseEther("100"));
            });
        });
    });

    describe("Should restrict eth transfer", async () => {
        let safe: any, restrictor: any;

        beforeEach(async () => {
            const res = await setupTests();
            safe = res.safe;
            restrictor = res.restrictor;

            await user2.sendTransaction({
                to: safe.address,
                value: parseEther("1000"),
            });
            expect(await hre.ethers.provider.getBalance(safe.address)).to.be.deep.eq(parseEther("1000"));

            await restrictor.registerProxies([safe.address]);
        });

        it("should revert if recipient is not whitelisted", async () => {
            const tx = buildSafeTransaction({
                to: user3.address,
                value: parseEther("1"),
                operation: 0,
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Not allowed address");
        });

        it("should success after recipient is whitelisted and no cap is set", async () => {
            const tx = buildSafeTransaction({
                to: user3.address,
                value: parseEther("1"),
                operation: 0,
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Not allowed address");

            await restrictor.addWhitelistAddresses(safe.address, [user3.address]);
            const user3BalanceBefore = await user3.getBalance();

            const tx0 = await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            const { gasUsed } = await waffle.provider.getTransactionReceipt(tx0.hash);
            console.info("Sending ETH gas used", gasUsed.toString());

            expect(await user3.getBalance()).to.be.gt(user3BalanceBefore);
        });

        it("should set daily ETH transfer cap correctly", async () => {
            await restrictor.setDailyCap(safe.address, [user3.address], [ETHAddress], [parseEther("2")]);
            const tx = buildSafeTransaction({
                to: user3.address,
                value: parseEther("1.2"),
                operation: 0,
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });
            await restrictor.addWhitelistAddresses(safe.address, [user3.address]);

            const tx0 = await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            const { gasUsed } = await waffle.provider.getTransactionReceipt(tx0.hash);
            console.info("Sending ETH gas used", gasUsed.toString());

            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Daily amount exceeded");

            const user3BalanceBefore = await user3.getBalance();

            // Travel 1 day
            await network.provider.send("evm_increaseTime", [24 * 3600]);
            await network.provider.send("evm_mine");
            await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            expect(await user3.getBalance()).to.be.gt(user3BalanceBefore);
        });

        it("should set monthly ETH transfer cap correctly", async () => {
            await restrictor.setMonthlyCap(safe.address, [user3.address], [ETHAddress], [parseEther("20")]);
            const tx = buildSafeTransaction({
                to: user3.address,
                value: parseEther("12"),
                operation: 0,
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });
            await restrictor.addWhitelistAddresses(safe.address, [user3.address]);
            await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Monthly amount exceeded");

            const user3BalanceBefore = await user3.getBalance();
            // Travel 30 days
            await network.provider.send("evm_increaseTime", [24 * 3600 * 30]);
            await network.provider.send("evm_mine");
            await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            expect(await user3.getBalance()).to.be.gt(user3BalanceBefore);
        });
    });

    describe("Should restrict ERC20 token transfer", async () => {
        let safe: any, restrictor: any, token: any;

        beforeEach(async () => {
            const res = await setupTests();
            safe = res.safe;
            restrictor = res.restrictor;

            token = await (await ethers.getContractFactory("ERC20Token")).deploy();
            await token.deployed();
            await token.transfer(safe.address, parseEther("10000"));
            expect(await token.balanceOf(safe.address)).to.be.eq(parseEther("10000"));

            await restrictor.registerProxies([safe.address]);
        });

        it("should revert if recipient is not whitelisted", async () => {
            const tx = buildSafeTransaction({
                to: token.address,
                data: token.interface.encodeFunctionData("transfer", [user3.address, parseEther("100")]),
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });

            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Not allowed address");
        });

        it("should success after recipient is whitelisted and no cap is set", async () => {
            const tx = buildSafeTransaction({
                to: token.address,
                data: token.interface.encodeFunctionData("transfer", [user3.address, parseEther("100")]),
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Not allowed address");

            await restrictor.addWhitelistAddresses(safe.address, [user3.address]);
            const user3BalanceBefore = await token.balanceOf(user3.address);
            const tx0 = await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            const { gasUsed } = await waffle.provider.getTransactionReceipt(tx0.hash);
            console.info("Sending ERC20 Token gas used", gasUsed.toString());

            expect(await token.balanceOf(user3.address)).to.be.gt(user3BalanceBefore);
        });

        it("should set daily ERC20 token transfer cap correctly", async () => {
            await restrictor.setDailyCap(safe.address, [user3.address], [token.address], [parseEther("100")]);
            const tx = buildSafeTransaction({
                to: token.address,
                data: token.interface.encodeFunctionData("transfer", [user3.address, parseEther("51")]),
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });

            await restrictor.addWhitelistAddresses(safe.address, [user3.address]);

            const tx0 = await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            const { gasUsed } = await waffle.provider.getTransactionReceipt(tx0.hash);
            console.info("Sending ERC20 Token gas used", gasUsed.toString());

            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Daily amount exceeded");

            const user3BalanceBefore = await token.balanceOf(user3.address);
            // Travel 1 day
            await network.provider.send("evm_increaseTime", [24 * 3600]);
            await network.provider.send("evm_mine");
            await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            expect(await token.balanceOf(user3.address)).to.be.gt(user3BalanceBefore);
        });

        it("should set monthly ERC20 token transfer cap correctly", async () => {
            await restrictor.setMonthlyCap(safe.address, [user3.address], [token.address], [parseEther("100")]);
            const tx = buildSafeTransaction({
                to: token.address,
                data: token.interface.encodeFunctionData("transfer", [user3.address, parseEther("51")]),
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });

            await restrictor.addWhitelistAddresses(safe.address, [user3.address]);
            await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Monthly amount exceeded");

            const user3BalanceBefore = await token.balanceOf(user3.address);
            // Travel 30 days
            await network.provider.send("evm_increaseTime", [24 * 3600 * 30]);
            await network.provider.send("evm_mine");
            await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            expect(await token.balanceOf(user3.address)).to.be.gt(user3BalanceBefore);
        });
    });

    describe("Should restrict external methods call", async () => {
        let safe: any, restrictor: any, token: any;
        beforeEach(async () => {
            const res = await setupTests();
            safe = res.safe;
            restrictor = res.restrictor;

            token = await (await ethers.getContractFactory("ERC20Token")).deploy();
            await token.deployed();
            await token.transfer(safe.address, parseEther("10000"));
            expect(await token.balanceOf(safe.address)).to.be.eq(parseEther("10000"));

            await restrictor.registerProxies([safe.address]);
        });

        it("should revert if a method is not whitelisted", async () => {
            const tx = buildSafeTransaction({
                to: token.address,
                data: token.interface.encodeFunctionData("approve", [user3.address, parseEther("100")]),
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });

            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.be.revertedWith("Not allowed method");
        });

        it("should success if a method is whitelisted", async () => {
            const tx = buildSafeTransaction({
                to: token.address,
                data: token.interface.encodeFunctionData("approve", [user3.address, parseEther("100")]),
                safeTxGas: 1000000,
                nonce: await safe.nonce(),
            });
            await restrictor.addWhitelistMethods(safe.address, ["0x095ea7b3"]); // keccak(approve(address,uint256));

            await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
            expect(await token.allowance(safe.address, user3.address)).to.be.eq(parseEther("100"));
        });
    });
});
