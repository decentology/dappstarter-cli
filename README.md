<p align="center">
<img src="https://uploads-ssl.webflow.com/5dea4f8b31edea3328b9a0f6/5dea5bbc58e6cbc7d65a5d75_trycrypto_logo.png" alt="TryCrypto Logo" />
</p>
<p align="center">
<img src="https://dev.azure.com/trycrypto/TryCrypto/_apis/build/status/dappstarter-cli?branchName=master" alt="Build Status">
</p>




# DappStarter Command Line Library
This cli utility speeds up creation of dappstarter based blockchain projects. An online version of this utility is available at [dappstarter.trycrypto.com](https://dappstarter.trycrypto.com)

# Installation
- You can go to releases to pull the latest binary compiled version and add installation location to your system's PATH
- TODO: Add Installation Notes for Node.js, (global, npx and pkg)
# Usage
![QuickStart](https://www.dropbox.com/s/vz1kkvz5tkjtblw/dappstarter-cli-branded.gif?raw=1)

Basic usage 

```
dappstarter create
```

Save configuration only
```
dappstarter create -w config.json
```

Create from configuration
```
dappstarter create -c config.json
```

# Help
```
dappstarter create --help
Create dappstarter project

Usage: dappstarter create [arguments]
-h, --help           Print this usage information.
-o, --output         Output directory. If omitted current directory will be used.
-c, --config         Loads configuration from file and processes.
-w, --config-only    Writes configuration to file without processing.

Run "dappstarter help" to see global options.
Example: dappstarter create -c config.json
```

# More Information
- **Websites**
    - www.trycrypto.com/dappstarter
- **Videos**
    - https://www.youtube.com/channel/UCZfZ-YyNb2J_g4bith1OLaw
- **Social**
    - [Twitter @TryCrypto](https://twitter.com/TryCrypto)
