import getPort from 'get-port'

(async () => {
	const syncThingGuiPort = 7000;
	const port = await getPort({ port: syncThingGuiPort });
	if (port != syncThingGuiPort) {
		console.error("Port in use");
	} else {
		console.log(port);
	}
})();
