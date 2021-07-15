let DEBUG_ENABLED: boolean = false;

export function setLogLevel(level: boolean) {
	DEBUG_ENABLED = level;
}

export function log(msg: string | any) {
	if (DEBUG_ENABLED) {
		console.log(msg);
	}
}
