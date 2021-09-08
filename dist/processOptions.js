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
const showParams_1 = __importDefault(require("./showParams"));
async function processOptions(blockchain, options, path, { name, children, interface: ui, }) {
    let menuList = children
        .filter((x) => idx_1.default(x, () => x.interface.enabled))
        .filter((x) => {
        if (x.blockchains) {
            return x.blockchains.indexOf(blockchain) > -1;
        }
        return true;
    })
        .map((x, i) => {
        return { name: x.title };
    });
    let listType = 'list';
    switch (ui.children) {
        case 'multiple':
        case 'form':
            listType = 'checkbox';
            break;
    }
    let { value } = await inquirer.prompt({
        name: 'value',
        // @ts-ignore
        type: listType,
        message: 'Select option',
        choices: menuList,
    });
    if (listType !== 'checkbox') {
        let selection = children.find((x) => x.title == value);
        let optionPath = path + '/' + selection.name;
        options[optionPath] = true;
        if (selection.parameters != null) {
            await showParams_1.default(options, optionPath, selection.parameters);
        }
    }
    else {
        value.forEach((val) => {
            let selection = children.find((x) => x.title == val);
            let optionPath = path + '/' + selection.name;
            options[optionPath] = true;
        });
    }
}
exports.default = processOptions;
//# sourceMappingURL=processOptions.js.map