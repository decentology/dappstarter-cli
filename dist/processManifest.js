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
const inquirer = __importStar(require("inquirer"));
const idx_1 = __importDefault(require("idx"));
const processOptions_1 = __importDefault(require("./processOptions"));
async function processManifest(selections, options, manifest) {
    let { singular, name, children } = manifest;
    let menuList = children
        .filter((x) => idx_1.default(x, () => x.interface.enabled))
        .filter((x) => {
        if (name == "categories") {
            let hasValidChildren = x.children.filter((y) => y.blockchains.includes(selections.blockchain) &&
                y.languages.includes(selections.language));
            return hasValidChildren.length > 0;
        }
        else if (selections.blockchain != "" && x.blockchains) {
            return x.blockchains.includes(selections.blockchain);
        }
        return true;
    })
        .map((x) => x.title);
    if (menuList && menuList.length > 0) {
        let doneMessage = "I'm done!";
        if (name == "categories") {
            menuList.unshift(doneMessage);
        }
        let { value } = await inquirer.prompt({
            type: "list",
            name: "value",
            message: `Select ${singular || name}`,
            choices: menuList,
        });
        let selection = children.find((x) => x.title == value);
        if (selection != null) {
            let pathName;
            if (/blockchains|frameworks/.test(name)) {
                if (name === "blockchains") {
                    selections.blockchain = selection.name;
                }
                pathName = name.substring(0, name.length - 1);
            }
            else if (name === "languages") {
                pathName = "blockchain/" + selections.blockchain;
                selections.language = selection.name;
            }
            else if (name == "categories") {
                pathName = "category";
            }
            let path = `/${pathName}/${selection.name}`;
            options[path] = true;
            if (idx_1.default(selection, () => selection.children.length) > 0) {
                await processOptions_1.default(selections.blockchain, options, path, selection);
            }
        }
        if (name == "categories" && value != doneMessage) {
            await processManifest(selections, options, manifest);
        }
    }
    // if(children(answer))
}
exports.default = processManifest;
//# sourceMappingURL=processManifest.js.map