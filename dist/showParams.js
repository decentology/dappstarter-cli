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
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const inquirer = __importStar(require("inquirer"));
async function showParams(options, path, params) {
    return await (0, rxjs_1.from)(params)
        .pipe((0, operators_1.map)((param) => (0, rxjs_1.defer)(async () => {
        let { name, title, description, placeholder, options: paramOptions, } = param;
        if (param.type === 'choice') {
            const menuList = param.options.map((x) => x.title);
            let { value } = await inquirer.prompt({
                name: 'value',
                type: 'list',
                message: `Choose ${title}`,
                choices: menuList,
            });
            let selection = paramOptions.find((x) => x.title == value);
            let optionPath = path + '/' + name;
            options[optionPath] = selection.name;
        }
        else {
            placeholder =
                placeholder != null
                    ? ` (${placeholder}, ${description})`
                    : ` (${description})`;
            let value = await inquirer.prompt({
                name,
                type: 'input',
                message: `Enter: ${title}${placeholder}`,
            });
            let key = path + '/' + name;
            options[key] = value[name];
        }
    })), (0, operators_1.mergeAll)(1))
        .toPromise();
}
exports.default = showParams;
//# sourceMappingURL=showParams.js.map