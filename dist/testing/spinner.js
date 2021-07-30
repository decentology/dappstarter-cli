"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ora_1 = __importDefault(require("ora"));
const humanize_duration_1 = __importDefault(require("humanize-duration"));
let counter = new Date().getTime();
let text = () => `Creating container... ${humanize_duration_1.default(new Date().getTime() - counter, {
    maxDecimalPoints: 1,
})}`;
const spinner = ora_1.default(text()).start();
let timer = setInterval(() => ((spinner.text = text()), 1000));
setTimeout(() => {
    clearInterval(timer);
    spinner.stop();
}, 35000);
//# sourceMappingURL=spinner.js.map