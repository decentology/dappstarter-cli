import { Command } from 'commander';

let DEBUG_ENABLED: boolean = false;

export function setLogLevel(level: boolean) {
	DEBUG_ENABLED = level;
}

export function log(msg: string | any) {
	if (DEBUG_ENABLED) {
		console.log(msg);
	}
}

// Search parent object for a property value
// type CustomCommandType<t> = Command | { [index: string]: t };
interface CustomCommandType<t> extends Command {
	[index: string]: t | any;
}

export function optionSearch<t>(
	obj: CustomCommandType<t>,
	property: string
): t | null {
	if (obj.hasOwnProperty(property)) {
		return obj[property] as t;
	}
	if (obj.hasOwnProperty('parent')) {
		return optionSearch(obj.parent, property);
	}
	return null;
}
