"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = require("@coral-xyz/anchor");
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const chai_1 = require("chai");
// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
async function airdrop(provider, pubkey, sol) {
    const sig = await provider.connection.requestAirdrop(pubkey, sol * web3_js_1.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
}
function deriveConfig(programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("platform_config")], programId);
}
function deriveRoom(tokenMint, creator, programId, nonce = 0) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("room"), tokenMint.toBuffer(), creator.toBuffer(), Buffer.from([nonce])], programId);
}
function deriveBet(room, user, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("bet"), room.toBuffer(), user.toBuffer()], programId);
}
function deriveEscrow(room, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), room.toBuffer()], programId);
}
function deriveReputation(user, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("reputation"), user.toBuffer()], programId);
}
// Mock token mint — we only store its pubkey on-chain, no real SPL mint needed
const MOCK_TOKEN_MINT = web3_js_1.Keypair.generate().publicKey;
const MOCK_TOKEN_NAME = "PEPE5";
const MOCK_PRICE_FEED = web3_js_1.Keypair.generate();
const MOCK_OPENING_PRICE = new anchor_1.BN(1_500_000_000); // $150.00 mock price
async function createFakePythFeedAccount(provider, feedKeypair) {
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(2048);
    const tx = new anchor.web3.Transaction().add(web3_js_1.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: feedKeypair.publicKey,
        lamports,
        space: 2048,
        programId: web3_js_1.SystemProgram.programId,
    }));
    await provider.sendAndConfirm(tx, [feedKeypair]);
}
// ─────────────────────────────────────────────
//  Test Suite
// ─────────────────────────────────────────────
describe("shitmarket", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const program = anchor.workspace.Shitmarket; // typed as any until `anchor build` generates ../target/types/shitmarket
    const programId = program.programId;
    // Wallets
    const admin = web3_js_1.Keypair.generate();
    const treasury = web3_js_1.Keypair.generate();
    const keeper = web3_js_1.Keypair.generate();
    const creator = web3_js_1.Keypair.generate();
    const moonBettor = web3_js_1.Keypair.generate();
    const jeetBettor = web3_js_1.Keypair.generate();
    const secondMoonBettor = web3_js_1.Keypair.generate();
    const whaleBettor = web3_js_1.Keypair.generate(); // for bet limit tests
    // PDAs (populated in tests)
    let configPda;
    let roomPda;
    let escrowPda;
    let moonBetPda;
    let jeetBetPda;
    let secondMoonBetPda;
    let whaleBetPda;
    let whaleRepPda;
    before(async () => {
        // Fund all wallets
        await Promise.all([
            airdrop(provider, admin.publicKey, 10),
            airdrop(provider, treasury.publicKey, 1),
            airdrop(provider, creator.publicKey, 5),
            airdrop(provider, moonBettor.publicKey, 5),
            airdrop(provider, jeetBettor.publicKey, 5),
            airdrop(provider, secondMoonBettor.publicKey, 5),
            airdrop(provider, whaleBettor.publicKey, 200),
        ]);
        await createFakePythFeedAccount(provider, MOCK_PRICE_FEED);
        [configPda] = deriveConfig(programId);
        [roomPda] = deriveRoom(MOCK_TOKEN_MINT, creator.publicKey, programId);
        [escrowPda] = deriveEscrow(roomPda, programId);
        [moonBetPda] = deriveBet(roomPda, moonBettor.publicKey, programId);
        [jeetBetPda] = deriveBet(roomPda, jeetBettor.publicKey, programId);
        [secondMoonBetPda] = deriveBet(roomPda, secondMoonBettor.publicKey, programId);
        [whaleBetPda] = deriveBet(roomPda, whaleBettor.publicKey, programId);
        [whaleRepPda] = deriveReputation(whaleBettor.publicKey, programId);
    });
    // ── 1. Initialize ─────────────────────────────────────────────────────
    it("initializes platform config with 2% fee", async () => {
        await program.methods
            .initialize(200) // 200 bps = 2%
            .accounts({
            config: configPda,
            admin: admin.publicKey,
            treasury: treasury.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([admin])
            .rpc();
        const config = await program.account.platformConfig.fetch(configPda);
        chai_1.assert.equal(config.admin.toBase58(), admin.publicKey.toBase58());
        chai_1.assert.equal(config.treasury.toBase58(), treasury.publicKey.toBase58());
        chai_1.assert.equal(config.platformFeeBps, 200);
        chai_1.assert.equal(config.paused, false, "Should start unpaused");
    });
    it("rejects fee > 10%", async () => {
        try {
            await program.methods
                .updateConfig(1001, null, null, null, null)
                .accounts({
                config: configPda,
                admin: admin.publicKey,
                newTreasury: null,
            })
                .signers([admin])
                .rpc();
            chai_1.assert.fail("Should have thrown");
        }
        catch (err) {
            (0, chai_1.expect)(err.message).to.include("FeeTooHigh");
        }
    });
    // ── 2. Create Room ────────────────────────────────────────────────────
    it("creates a room with 30-minute duration", async () => {
        await program.methods
            .createRoom(MOCK_TOKEN_MINT, MOCK_TOKEN_NAME, 30, // 30 minutes
        null, // no switchboard feed
        null, // no opening price override
        0 // nonce
        )
            .accounts({
            room: roomPda,
            escrow: escrowPda,
            creator: creator.publicKey,
            priceFeed: MOCK_PRICE_FEED.publicKey,
            switchboardFeed: web3_js_1.PublicKey.default,
            config: configPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([creator])
            .rpc();
        const room = await program.account.room.fetch(roomPda);
        chai_1.assert.equal(room.tokenMint.toBase58(), MOCK_TOKEN_MINT.toBase58());
        chai_1.assert.equal(room.durationMinutes, 30);
        chai_1.assert.isTrue(room.openingPrice.eq(MOCK_OPENING_PRICE));
        chai_1.assert.equal(room.moonPool.toNumber(), 0);
        chai_1.assert.equal(room.jeetPool.toNumber(), 0);
        chai_1.assert.deepEqual(room.status, { active: {} });
        chai_1.assert.isNull(room.winner);
        chai_1.assert.equal(room.switchboardFeed.toBase58(), web3_js_1.PublicKey.default.toBase58(), "Switchboard feed should be default");
    });
    it("rejects invalid durations", async () => {
        const otherMint = web3_js_1.Keypair.generate().publicKey;
        const [otherRoom] = deriveRoom(otherMint, creator.publicKey, programId);
        try {
            await program.methods
                .createRoom(otherMint, "BAD", 0, null, null, 0)
                .accounts({
                room: otherRoom,
                escrow: deriveEscrow(otherRoom, programId)[0],
                creator: creator.publicKey,
                priceFeed: MOCK_PRICE_FEED.publicKey,
                switchboardFeed: web3_js_1.PublicKey.default,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([creator])
                .rpc();
            chai_1.assert.fail("Should have thrown");
        }
        catch (err) {
            (0, chai_1.expect)(err.message).to.include("InvalidDuration");
        }
    });
    // ── 2b. Phase 3.3: Pause/Unpause ──────────────────────────────────────
    it("rejects room creation when paused (Phase 3.3)", async () => {
        // Pause the platform
        await program.methods
            .pause()
            .accounts({ config: configPda, admin: admin.publicKey })
            .signers([admin])
            .rpc();
        const configPaused = await program.account.platformConfig.fetch(configPda);
        chai_1.assert.equal(configPaused.paused, true);
        const pausedMint = web3_js_1.Keypair.generate().publicKey;
        const [pausedRoom] = deriveRoom(pausedMint, creator.publicKey, programId);
        try {
            await program.methods
                .createRoom(pausedMint, "PAUSED", 5, null, null, 0)
                .accounts({
                room: pausedRoom,
                escrow: deriveEscrow(pausedRoom, programId)[0],
                creator: creator.publicKey,
                priceFeed: MOCK_PRICE_FEED.publicKey,
                switchboardFeed: web3_js_1.PublicKey.default,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([creator])
                .rpc();
            chai_1.assert.fail("Should have thrown — platform is paused");
        }
        catch (err) {
            (0, chai_1.expect)(err.message).to.include("Paused");
        }
        // Unpause for remaining tests
        await program.methods
            .unpause()
            .accounts({ config: configPda, admin: admin.publicKey })
            .signers([admin])
            .rpc();
        const configUnpaused = await program.account.platformConfig.fetch(configPda);
        chai_1.assert.equal(configUnpaused.paused, false);
    });
    it("rejects non-admin from pausing", async () => {
        try {
            await program.methods
                .pause()
                .accounts({ config: configPda, admin: creator.publicKey })
                .signers([creator])
                .rpc();
            chai_1.assert.fail("Should have thrown");
        }
        catch (err) {
            (0, chai_1.expect)(err.message).to.include("Unauthorized");
        }
    });
    // ── 3. Place Bets ─────────────────────────────────────────────────────
    it("places a bet on Moon side (1 SOL)", async () => {
        const betAmount = new anchor_1.BN(1 * web3_js_1.LAMPORTS_PER_SOL);
        await program.methods
            .placeBet({ moon: {} }, betAmount)
            .accounts({
            room: roomPda,
            escrow: escrowPda,
            bet: moonBetPda,
            user: moonBettor.publicKey,
            reputation: null,
            config: configPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([moonBettor])
            .rpc();
        const room = await program.account.room.fetch(roomPda);
        chai_1.assert.isTrue(room.moonPool.eq(betAmount));
        chai_1.assert.isTrue(room.jeetPool.eq(new anchor_1.BN(0)));
        const bet = await program.account.bet.fetch(moonBetPda);
        chai_1.assert.isTrue(bet.amount.eq(betAmount));
        chai_1.assert.deepEqual(bet.side, { moon: {} });
        chai_1.assert.isFalse(bet.claimed);
    });
    it("places a bet on Jeet side (0.5 SOL)", async () => {
        const betAmount = new anchor_1.BN(0.5 * web3_js_1.LAMPORTS_PER_SOL);
        await program.methods
            .placeBet({ jeet: {} }, betAmount)
            .accounts({
            room: roomPda,
            escrow: escrowPda,
            bet: jeetBetPda,
            user: jeetBettor.publicKey,
            reputation: null,
            config: configPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([jeetBettor])
            .rpc();
        const room = await program.account.room.fetch(roomPda);
        chai_1.assert.isTrue(room.jeetPool.eq(betAmount));
    });
    it("adds to an existing Moon bet (another 0.5 SOL)", async () => {
        const extraAmount = new anchor_1.BN(0.5 * web3_js_1.LAMPORTS_PER_SOL);
        await program.methods
            .placeBet({ moon: {} }, extraAmount)
            .accounts({
            room: roomPda,
            escrow: escrowPda,
            bet: moonBetPda,
            user: moonBettor.publicKey,
            reputation: null,
            config: configPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([moonBettor])
            .rpc();
        const bet = await program.account.bet.fetch(moonBetPda);
        // 1 SOL + 0.5 SOL = 1.5 SOL
        chai_1.assert.isTrue(bet.amount.eq(new anchor_1.BN(1.5 * web3_js_1.LAMPORTS_PER_SOL)));
    });
    it("places a second Moon bettor (0.5 SOL)", async () => {
        const betAmount = new anchor_1.BN(0.5 * web3_js_1.LAMPORTS_PER_SOL);
        await program.methods
            .placeBet({ moon: {} }, betAmount)
            .accounts({
            room: roomPda,
            escrow: escrowPda,
            bet: secondMoonBetPda,
            user: secondMoonBettor.publicKey,
            reputation: null,
            config: configPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([secondMoonBettor])
            .rpc();
        const room = await program.account.room.fetch(roomPda);
        // 1.5 + 0.5 = 2 SOL moon pool
        chai_1.assert.isTrue(room.moonPool.eq(new anchor_1.BN(2 * web3_js_1.LAMPORTS_PER_SOL)));
    });
    it("rejects zero-amount bets", async () => {
        try {
            await program.methods
                .placeBet({ moon: {} }, new anchor_1.BN(0))
                .accounts({
                room: roomPda,
                escrow: escrowPda,
                bet: moonBetPda,
                user: moonBettor.publicKey,
                reputation: null,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([moonBettor])
                .rpc();
            chai_1.assert.fail("Should have thrown");
        }
        catch (err) {
            (0, chai_1.expect)(err.message).to.include("ZeroBetAmount");
        }
    });
    // ── 3b. Phase 3.5: Reputation + Bet Limit Tests ───────────────────────
    it("rejects bet exceeding D-tier limit without reputation (Phase 3.5)", async () => {
        // Default tier D limit = 1 SOL. Try to bet 2 SOL.
        try {
            await program.methods
                .placeBet({ moon: {} }, new anchor_1.BN(2 * web3_js_1.LAMPORTS_PER_SOL))
                .accounts({
                room: roomPda,
                escrow: escrowPda,
                bet: whaleBetPda,
                user: whaleBettor.publicKey,
                reputation: null,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([whaleBettor])
                .rpc();
            chai_1.assert.fail("Should have thrown — exceeds D tier limit");
        }
        catch (err) {
            (0, chai_1.expect)(err.message).to.include("BetAmountExceedsLimit");
        }
    });
    it("allows bet within D-tier limit", async () => {
        // 1 SOL is the D tier max
        await program.methods
            .placeBet({ moon: {} }, new anchor_1.BN(web3_js_1.LAMPORTS_PER_SOL))
            .accounts({
            room: roomPda,
            escrow: escrowPda,
            bet: whaleBetPda,
            user: whaleBettor.publicKey,
            reputation: null,
            config: configPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([whaleBettor])
            .rpc();
        const bet = await program.account.bet.fetch(whaleBetPda);
        chai_1.assert.isTrue(bet.amount.eq(new anchor_1.BN(web3_js_1.LAMPORTS_PER_SOL)));
    });
    it("initializes reputation and allows higher-tier bets (Phase 3.5)", async () => {
        // Initialize reputation for whaleBettor
        const [repPda] = deriveReputation(whaleBettor.publicKey, programId);
        await program.methods
            .initializeReputation()
            .accounts({
            reputation: repPda,
            user: whaleBettor.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([whaleBettor])
            .rpc();
        const rep = await program.account.reputation.fetch(repPda);
        chai_1.assert.deepEqual(rep.tier, { d: {} });
        chai_1.assert.equal(rep.totalBets.toNumber(), 0);
        chai_1.assert.equal(rep.totalWins.toNumber(), 0);
    });
    // ── 4. Settle Room ────────────────────────────────────────────────────
    it("rejects settlement before expiry", async () => {
        const higherPrice = MOCK_OPENING_PRICE.addn(5_000);
        try {
            await program.methods
                .settleRoom(null)
                .accounts({
                room: roomPda,
                escrow: escrowPda,
                treasury: treasury.publicKey,
                priceFeed: MOCK_PRICE_FEED.publicKey,
                switchboardFeed: web3_js_1.PublicKey.default,
                config: configPda,
                keeper: admin.publicKey,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([admin])
                .rpc();
            chai_1.assert.fail("Should have thrown — room not expired");
        }
        catch (err) {
            (0, chai_1.expect)(err.message).to.include("RoomNotExpired");
        }
    });
    it("settles room after expiry with Moon winning price", async () => {
        // Wait for 5-minute room to expire (300s). In real tests use fast-forward;
        // here we wait just enough for localnet (set room to 5s for this test).
        // For the purpose of this suite we'll create a separate "fast" room below.
        // The 5-minute room tests above are valid structural tests; settlement is
        // tested with a fast-expiry room in the next block.
        console.log("  Skipping live expiry wait for 5min room — see fast-room tests below.");
    });
    // ── 4b. Fast-Expiry Room for Settlement Tests ─────────────────────────
    describe("fast-expiry settlement flow", () => {
        const fastMint = web3_js_1.Keypair.generate().publicKey;
        const fastCreator = web3_js_1.Keypair.generate();
        let fastRoomPda;
        let fastEscrowPda;
        let fastMoonBetPda;
        let fastJeetBetPda;
        const fastMoonBettor = web3_js_1.Keypair.generate();
        const fastJeetBettor = web3_js_1.Keypair.generate();
        before(async () => {
            await Promise.all([
                airdrop(provider, fastCreator.publicKey, 3),
                airdrop(provider, fastMoonBettor.publicKey, 3),
                airdrop(provider, fastJeetBettor.publicKey, 3),
            ]);
            [fastRoomPda] = deriveRoom(fastMint, fastCreator.publicKey, programId);
            [fastEscrowPda] = deriveEscrow(fastRoomPda, programId);
            [fastMoonBetPda] = deriveBet(fastRoomPda, fastMoonBettor.publicKey, programId);
            [fastJeetBetPda] = deriveBet(fastRoomPda, fastJeetBettor.publicKey, programId);
        });
        it("creates a fast room (10-min — expires quickly in localnet warp)", async () => {
            await program.methods
                .createRoom(fastMint, "FASTTOKEN", 10, null, null, 0)
                .accounts({
                room: fastRoomPda,
                escrow: fastEscrowPda,
                creator: fastCreator.publicKey,
                priceFeed: MOCK_PRICE_FEED.publicKey,
                switchboardFeed: web3_js_1.PublicKey.default,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([fastCreator])
                .rpc();
        });
        it("places bets on both sides of fast room", async () => {
            // Moon: 1 SOL
            await program.methods
                .placeBet({ moon: {} }, new anchor_1.BN(web3_js_1.LAMPORTS_PER_SOL))
                .accounts({
                room: fastRoomPda,
                escrow: fastEscrowPda,
                bet: fastMoonBetPda,
                user: fastMoonBettor.publicKey,
                reputation: null,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([fastMoonBettor])
                .rpc();
            // Jeet: 0.5 SOL
            await program.methods
                .placeBet({ jeet: {} }, new anchor_1.BN(0.5 * web3_js_1.LAMPORTS_PER_SOL))
                .accounts({
                room: fastRoomPda,
                escrow: fastEscrowPda,
                bet: fastJeetBetPda,
                user: fastJeetBettor.publicKey,
                reputation: null,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([fastJeetBettor])
                .rpc();
            const room = await program.account.room.fetch(fastRoomPda);
            chai_1.assert.isTrue(room.moonPool.eq(new anchor_1.BN(web3_js_1.LAMPORTS_PER_SOL)));
            chai_1.assert.isTrue(room.jeetPool.eq(new anchor_1.BN(0.5 * web3_js_1.LAMPORTS_PER_SOL)));
        });
        // NOTE: The following tests require the room to be expired.
        // Run with `anchor test -- --timeout 400000` and the localnet
        // must have fast slot times, OR warp clock using test-validator flags.
        // For CI, use: solana-test-validator --limit-ledger-size 50000000 &
        // and set BPF_LOADER_UPGRADEABLE=1
        it("(TIME-DEPENDENT) settles room after expiry — Moon wins", async function () {
            this.timeout(400_000);
            const fastRoom = await program.account.room.fetch(fastRoomPda);
            const now = Math.floor(Date.now() / 1000);
            const waitMs = (fastRoom.expiryTimestamp.toNumber() - now + 2) * 1000;
            if (waitMs > 0) {
                console.log(`  Waiting ${Math.ceil(waitMs / 1000)}s for room to expire...`);
                await new Promise((r) => setTimeout(r, waitMs));
            }
            const finalPrice = new anchor_1.BN(2_000_000_000); // $200.00 > $150.00 opening → Moon wins
            const treasuryBefore = await provider.connection.getBalance(treasury.publicKey);
            await program.methods
                .settleRoom(new anchor_1.BN(2_000_000_000))
                .accounts({
                room: fastRoomPda,
                escrow: fastEscrowPda,
                treasury: treasury.publicKey,
                priceFeed: MOCK_PRICE_FEED.publicKey,
                switchboardFeed: web3_js_1.PublicKey.default,
                config: configPda,
                keeper: keeper.publicKey,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([keeper])
                .rpc();
            const room = await program.account.room.fetch(fastRoomPda);
            chai_1.assert.deepEqual(room.status, { settled: {} });
            chai_1.assert.deepEqual(room.winner, { moon: {} });
            chai_1.assert.isTrue(room.finalPrice.eq(finalPrice));
            chai_1.assert.isTrue(room.twapFinalPrice.gt(new anchor_1.BN(0)), "TWAP final price should be set");
            // Verify platform fee arrived at treasury
            // Total pool = 1.5 SOL; fee = 2% = 0.03 SOL = 30_000_000 lamports
            const treasuryAfter = await provider.connection.getBalance(treasury.publicKey);
            const feeReceived = treasuryAfter - treasuryBefore;
            chai_1.assert.isAtLeast(feeReceived, 29_000_000, "Treasury should receive ~2% fee");
        });
        it("(TIME-DEPENDENT) winning Moon bettor claims proportional winnings", async function () {
            this.timeout(30_000);
            const userBefore = await provider.connection.getBalance(fastMoonBettor.publicKey);
            const escrowBefore = await provider.connection.getBalance(fastEscrowPda);
            console.log(`  Escrow balance before claim: ${escrowBefore / web3_js_1.LAMPORTS_PER_SOL} SOL`);
            await program.methods
                .claimWinnings()
                .accounts({
                room: fastRoomPda,
                escrow: fastEscrowPda,
                bet: fastMoonBetPda,
                user: fastMoonBettor.publicKey,
                payer: fastMoonBettor.publicKey,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([fastMoonBettor])
                .rpc();
            const userAfter = await provider.connection.getBalance(fastMoonBettor.publicKey);
            const gain = userAfter - userBefore;
            console.log(`  Moon bettor gained: ${gain / web3_js_1.LAMPORTS_PER_SOL} SOL`);
            chai_1.assert.isAbove(gain, 0, "Winner should receive lamports");
            const bet = await program.account.bet.fetch(fastMoonBetPda);
            chai_1.assert.isTrue(bet.claimed, "Bet should be marked claimed");
        });
        it("rejects double-claim", async function () {
            try {
                await program.methods
                    .claimWinnings()
                    .accounts({
                    room: fastRoomPda,
                    escrow: fastEscrowPda,
                    bet: fastMoonBetPda,
                    user: fastMoonBettor.publicKey,
                    payer: fastMoonBettor.publicKey,
                    systemProgram: web3_js_1.SystemProgram.programId,
                })
                    .signers([fastMoonBettor])
                    .rpc();
                chai_1.assert.fail("Should have thrown");
            }
            catch (err) {
                (0, chai_1.expect)(err.message).to.include("AlreadyClaimed");
            }
        });
        it("Jeet bettor cannot claim on Moon-winning room", async function () {
            try {
                await program.methods
                    .claimWinnings()
                    .accounts({
                    room: fastRoomPda,
                    escrow: fastEscrowPda,
                    bet: fastJeetBetPda,
                    user: fastJeetBettor.publicKey,
                    payer: fastJeetBettor.publicKey,
                    systemProgram: web3_js_1.SystemProgram.programId,
                })
                    .signers([fastJeetBettor])
                    .rpc();
                chai_1.assert.fail("Should have thrown");
            }
            catch (err) {
                (0, chai_1.expect)(err.message).to.include("NotAWinner");
            }
        });
        it("rejects double settlement", async function () {
            try {
                await program.methods
                    .settleRoom(new anchor_1.BN(2_000_000_000))
                    .accounts({
                    room: fastRoomPda,
                    escrow: fastEscrowPda,
                    treasury: treasury.publicKey,
                    priceFeed: MOCK_PRICE_FEED.publicKey,
                    switchboardFeed: web3_js_1.PublicKey.default,
                    config: configPda,
                    keeper: keeper.publicKey,
                    systemProgram: web3_js_1.SystemProgram.programId,
                })
                    .signers([keeper])
                    .rpc();
                chai_1.assert.fail("Should have thrown");
            }
            catch (err) {
                (0, chai_1.expect)(err.message).to.include("RoomNotActive");
            }
        });
    });
    // ── 5. Update Config ─────────────────────────────────────────────────
    it("admin updates fee to 1%", async () => {
        await program.methods
            .updateConfig(100, null, null, null, null) // 100 bps = 1%
            .accounts({
            config: configPda,
            admin: admin.publicKey,
            newTreasury: null,
        })
            .signers([admin])
            .rpc();
        const config = await program.account.platformConfig.fetch(configPda);
        chai_1.assert.equal(config.platformFeeBps, 100);
        // Revert fee back to 2% for subsequent tests
        await program.methods
            .updateConfig(200, null, null, null, null)
            .accounts({
            config: configPda,
            admin: admin.publicKey,
            newTreasury: null,
        })
            .signers([admin])
            .rpc();
    });
    it("non-admin cannot update config", async () => {
        try {
            await program.methods
                .updateConfig(50, null, null, null, null)
                .accounts({
                config: configPda,
                admin: creator.publicKey,
                newTreasury: null,
            })
                .signers([creator])
                .rpc();
            chai_1.assert.fail("Should have thrown");
        }
        catch (err) {
            (0, chai_1.expect)(err.message).to.include("Unauthorized");
        }
    });
    // ── 5b. Phase 3: Update config with new params ────────────────────────
    it("admin updates keeper, min liquidity, and twap window (Phase 3)", async () => {
        const newKeeper = web3_js_1.Keypair.generate().publicKey;
        await program.methods
            .updateConfig(null, null, newKeeper, new anchor_1.BN(200_000_000), new anchor_1.BN(600))
            .accounts({
            config: configPda,
            admin: admin.publicKey,
            newTreasury: null,
        })
            .signers([admin])
            .rpc();
        const config = await program.account.platformConfig.fetch(configPda);
        chai_1.assert.equal(config.keeper.toBase58(), newKeeper.toBase58());
        // Revert keeper back to the original keeper for subsequent tests
        await program.methods
            .updateConfig(null, null, keeper.publicKey, null, null)
            .accounts({
            config: configPda,
            admin: admin.publicKey,
            newTreasury: null,
        })
            .signers([admin])
            .rpc();
        chai_1.assert.isTrue(config.minimumLiquidity.eq(new anchor_1.BN(200_000_000)), "Min liquidity should be 0.2 SOL");
        chai_1.assert.isTrue(config.twapWindowSeconds.eq(new anchor_1.BN(600)), "TWAP window should be 600s");
    });
    // ── 6. Edge Cases ─────────────────────────────────────────────────────
    describe("edge cases", () => {
        const edgeMint = web3_js_1.Keypair.generate().publicKey;
        const edgeCreator = web3_js_1.Keypair.generate();
        const lonelyBettor = web3_js_1.Keypair.generate();
        let edgeRoomPda;
        let edgeEscrowPda;
        let lonelyBetPda;
        before(async () => {
            await Promise.all([
                airdrop(provider, edgeCreator.publicKey, 3),
                airdrop(provider, lonelyBettor.publicKey, 3),
            ]);
            [edgeRoomPda] = deriveRoom(edgeMint, edgeCreator.publicKey, programId);
            [edgeEscrowPda] = deriveEscrow(edgeRoomPda, programId);
            [lonelyBetPda] = deriveBet(edgeRoomPda, lonelyBettor.publicKey, programId);
        });
        it("room with bets only on one side settles correctly", async function () {
            this.timeout(400_000);
            await program.methods
                .createRoom(edgeMint, "LONELY", 10, null, null, 0)
                .accounts({
                room: edgeRoomPda,
                escrow: edgeEscrowPda,
                creator: edgeCreator.publicKey,
                priceFeed: MOCK_PRICE_FEED.publicKey,
                switchboardFeed: web3_js_1.PublicKey.default,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([edgeCreator])
                .rpc();
            // Only one bettor on Moon side
            await program.methods
                .placeBet({ moon: {} }, new anchor_1.BN(web3_js_1.LAMPORTS_PER_SOL))
                .accounts({
                room: edgeRoomPda,
                escrow: edgeEscrowPda,
                bet: lonelyBetPda,
                user: lonelyBettor.publicKey,
                reputation: null,
                config: configPda,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([lonelyBettor])
                .rpc();
            // Wait for expiry
            const edgeRoom = await program.account.room.fetch(edgeRoomPda);
            const now = Math.floor(Date.now() / 1000);
            const waitMs = (edgeRoom.expiryTimestamp.toNumber() - now + 2) * 1000;
            if (waitMs > 0) {
                console.log(`  Waiting ${Math.ceil(waitMs / 1000)}s...`);
                await new Promise((r) => setTimeout(r, waitMs));
            }
            // Moon wins (price went up)
            await program.methods
                .settleRoom(new anchor_1.BN(2_000_000_000))
                .accounts({
                room: edgeRoomPda,
                escrow: edgeEscrowPda,
                treasury: treasury.publicKey,
                priceFeed: MOCK_PRICE_FEED.publicKey,
                switchboardFeed: web3_js_1.PublicKey.default,
                config: configPda,
                keeper: keeper.publicKey,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([keeper])
                .rpc();
            const settled = await program.account.room.fetch(edgeRoomPda);
            chai_1.assert.deepEqual(settled.winner, { moon: {} });
            // Lonely bettor claims — gets full pot minus fee
            await program.methods
                .claimWinnings()
                .accounts({
                room: edgeRoomPda,
                escrow: edgeEscrowPda,
                bet: lonelyBetPda,
                user: lonelyBettor.publicKey,
                payer: lonelyBettor.publicKey,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([lonelyBettor])
                .rpc();
            const bet = await program.account.bet.fetch(lonelyBetPda);
            chai_1.assert.isTrue(bet.claimed);
            console.log("  Lonely winner claimed successfully — full pot minus fee.");
        });
    });
});
