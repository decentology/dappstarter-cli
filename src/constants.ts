
export const REQUEST_TIMEOUT: number = 10 * 1000;
export const CONFIG_FILE = 'config.json';
export let SERVICE_URL =
	process.env.DAPPSTARTER_SERVICE_URL ||
	'https://dappstarter-api.decentology.com';


export function setServiceUrl(url: string) {
	process.env.DAPPSTARTER_SERVICE_URL = url;
	SERVICE_URL = url;
}
