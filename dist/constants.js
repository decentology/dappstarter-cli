"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPorts = exports.setServiceUrl = exports.PORTS = exports.SERVICE_URL = exports.CONFIG_FILE = exports.REQUEST_TIMEOUT = void 0;
exports.REQUEST_TIMEOUT = 10 * 1000;
exports.CONFIG_FILE = 'config.json';
exports.SERVICE_URL = process.env.DAPPSTARTER_SERVICE_URL ||
    'https://dappstarter-api.decentology.com';
exports.PORTS = [5000, 5001, 5002, 8080, 8899, 8900, 12537];
function setServiceUrl(url) {
    process.env.DAPPSTARTER_SERVICE_URL = url;
    exports.SERVICE_URL = url;
}
exports.setServiceUrl = setServiceUrl;
function setPorts(ports) {
    exports.PORTS = ports;
}
exports.setPorts = setPorts;
//# sourceMappingURL=constants.js.map