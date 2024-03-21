import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners, getRestrictor } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";
import { getSafeTemplate } from "../utils/setup";

describe("RestrictionManager", async () => {
    const [user1, user2] = waffle.provider.getWallets();

    const setupWithTemplate = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeTemplate(),
        };
    });

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const restrictor = await getRestrictor();
        return {
            safe: await getSafeWithOwners([user1.address], 1, AddressZero, restrictor.address),
            restrictor,
        };
    });

    describe("setupRestrictor", async () => {
        it("should setup restrictor when setup safe", async () => {
            const { safe } = await setupWithTemplate();
            const restrictor = await getRestrictor();

            await safe.setup(
                [user1.address, user2.address],
                1,
                AddressZero,
                "0x",
                AddressZero,
                AddressZero,
                0,
                AddressZero,
                restrictor.address,
            );

            expect(await safe.getRestrictor()).to.be.eq(restrictor.address);
        });
    });

    describe("changeRestrictor", async () => {
        it("can only be called from Safe itself", async () => {
            const { safe } = await setupTests();
            const restrictor2 = await getRestrictor();
            await expect(safe.changeRestrictor(restrictor2.address)).to.be.revertedWith("GS031");
        });

        it("emits event for removed owner and threshold if changed", async () => {
            const { safe, restrictor } = await setupTests();
            const restrictor2 = await getRestrictor();

            expect(await safe.getRestrictor()).to.be.eq(restrictor.address);
            await expect(executeContractCallWithSigners(safe, safe, "changeRestrictor", [restrictor2.address], [user1]))
                .to.emit(safe, "ChangeManager")
                .withArgs(restrictor2.address);
            expect(await safe.getRestrictor()).to.be.eq(restrictor2.address);
        });
    });
});
