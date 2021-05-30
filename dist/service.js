"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSelections = exports.getManifest = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const chalk_1 = __importDefault(require("chalk"));
const emoji = __importStar(require("node-emoji"));
const ora_1 = __importDefault(require("ora"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const serviceUrl = process.env.DAPPSTARTER_SERVICE_URL ||
    "https://dappstarter-api.decentology.com";
const loading = (message) => {
    return ora_1.default(message).start();
};
const getManifest = async () => {
    const errorMessage = chalk_1.default.red(`${emoji.get("x")} Unable to fetch DappStarter manifest.`);
    const spinner = loading("Fetching manifest...");
    try {
        const resp = await node_fetch_1.default(`${serviceUrl}/manifest`);
        if (resp.ok) {
            const data = await resp.json();
            return data;
        }
        console.error(errorMessage);
    }
    catch (error) {
        if (process.env.DAPPSTARTER_DEBUG === "true") {
            console.error(error);
        }
        spinner.stopAndPersist({
            symbol: chalk_1.default.red(emoji.get("heavy_exclamation_mark")),
            text: spinner.text + ' ' + errorMessage,
        });
    }
    finally {
        spinner.stop();
    }
};
exports.getManifest = getManifest;
const postSelections = async (outputPath, dappName, options) => {
    let errorMessage = chalk_1.default.red(`${emoji.get("x")} Unable to process configuration.`);
    const spinner = loading("DappStarter complete. Generating project...");
    try {
        const resp = await node_fetch_1.default(`${serviceUrl}/process?github=false`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: dappName, blocks: options }),
        });
        if (resp.ok) {
            let { url } = await resp.json();
            let fileResp = await node_fetch_1.default(url.replace('////', '//'));
            if (fileResp.ok) {
                let zip = new adm_zip_1.default(await fileResp.buffer());
                await zip.extractAllToAsync(outputPath);
            }
            spinner.stopAndPersist({
                symbol: emoji.get("100"),
                text: spinner.text + chalk_1.default.green(" Done!"),
            });
            return true;
        }
        console.error(errorMessage);
    }
    catch (error) {
        if (process.env.DAPPSTARTER_DEBUG === "true") {
            console.error(error);
        }
        spinner.stopAndPersist({
            symbol: chalk_1.default.red(emoji.get("heavy_exclamation_mark")),
            text: spinner.text + ' ' + errorMessage,
        });
    }
    finally {
        spinner.stop();
    }
};
exports.postSelections = postSelections;
//# sourceMappingURL=service.js.map