"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_reachable_1 = __importDefault(require("is-reachable"));
const rxjs_1 = require("rxjs");
(async () => {
    await rxjs_1.lastValueFrom(rxjs_1.interval(1000).pipe(rxjs_1.mergeMap(() => rxjs_1.defer(async () => await is_reachable_1.default('dappstarter-cli-node-2207694351.centralus.cloudapp.azure.com:22'))), rxjs_1.tap((x) => console.log(x)), rxjs_1.takeWhile((x) => !x)));
})();
//# sourceMappingURL=portChecker.js.map