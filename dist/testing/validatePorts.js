"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const get_port_1 = __importDefault(require("get-port"));
(async () => {
    const syncThingGuiPort = 7000;
    const port = await (0, get_port_1.default)({ port: syncThingGuiPort });
    if (port != syncThingGuiPort) {
        console.error('Port in use');
    }
    else {
        console.log(port);
    }
})();
//# sourceMappingURL=validatePorts.js.map