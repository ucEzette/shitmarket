"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var anchor = __importStar(require("@coral-xyz/anchor"));
var web3_js_1 = require("@solana/web3.js");
var fs_1 = __importDefault(require("fs"));
var os_1 = __importDefault(require("os"));
// We load the IDL. Because it is JSON, we can just require it or read it.
var idlPath = "../src/utils/idl.json";
var idl = JSON.parse(fs_1.default.readFileSync(idlPath, "utf8"));
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, secretKeyPath, secretKeyString, secretKeyArray, deployer, wallet, provider, programId, program, configPda, feeBps, tx, e_1, tx2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    connection = new web3_js_1.Connection("https://api.devnet.solana.com", "confirmed");
                    secretKeyPath = os_1.default.homedir() + "/.config/solana/id.json";
                    secretKeyString = fs_1.default.readFileSync(secretKeyPath, "utf8");
                    secretKeyArray = JSON.parse(secretKeyString);
                    deployer = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
                    console.log("Using deployer wallet:", deployer.publicKey.toBase58());
                    wallet = new anchor.Wallet(deployer);
                    provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
                    anchor.setProvider(provider);
                    programId = new web3_js_1.PublicKey("GxkRWMoyKpKkTadmGqqqLvA473YTwvDUeSPK1iS8REim");
                    program = new anchor.Program(idl, provider);
                    configPda = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("platform_config")], program.programId)[0];
                    console.log("Config PDA:", configPda.toBase58());
                    feeBps = 200;
                    console.log("Sending initialize tx... Treasury: ".concat(deployer.publicKey.toBase58(), ", Fee: ").concat(feeBps, " bps"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 7]);
                    return [4 /*yield*/, program.methods.initialize(feeBps)
                            .accounts({
                            config: configPda,
                            admin: deployer.publicKey,
                            treasury: deployer.publicKey,
                            systemProgram: anchor.web3.SystemProgram.programId,
                        })
                            .signers([deployer])
                            .rpc()];
                case 2:
                    tx = _a.sent();
                    console.log("Initialization successful! Tx:", tx);
                    return [3 /*break*/, 7];
                case 3:
                    e_1 = _a.sent();
                    if (!e_1.message.includes("already in use")) return [3 /*break*/, 5];
                    console.log("Contract is already initialized. Let's update the config instead.");
                    return [4 /*yield*/, program.methods.updateConfig(deployer.publicKey, // new_treasury
                        null, // new_keeper
                        feeBps, // new_fee_bps
                        null, // new_min_liquidity
                        null).accounts({
                            config: configPda,
                            admin: deployer.publicKey,
                        }).signers([deployer]).rpc()];
                case 4:
                    tx2 = _a.sent();
                    console.log("Update config successful! Tx:", tx2);
                    return [3 /*break*/, 6];
                case 5:
                    console.error("Error initializing:", e_1);
                    throw e_1;
                case 6: return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
main().then(function () { return process.exit(0); }).catch(function (e) {
    console.error(e);
    process.exit(1);
});
