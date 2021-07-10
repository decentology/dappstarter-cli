<p align="center">
<img src="https://info.decentology.com/assets/brand/SVG/decentology-logo.svg" width="256" alt="Decentology Logo" />
</p>
<p align="center">
<img src="https://dev.azure.com/trycrypto/TryCrypto/_apis/build/status/decentology.dappstarter-cli?branchName=production" alt="Build Status">
</p>




# DappStarter Command Line Library
This cli utility speeds up creation of dappstarter based blockchain projects. An online version of this utility is available at [dappstarter.decentology.com](https://dappstarter.decentology.com)

# Installation
- ```npm install -g @decentology/dappstarter```
- You can go to releases to pull the latest binary compiled version and add installation location to your system's PATH

# Usage
![QuickStart](https://www.dropbox.com/s/sxp4f4tc8ejds2q/dappstarter-cli-branded.gif?raw=1)

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
Usage: dappstarter create [options]

Options:
  -c, --config <file>        Loads configuration from file and processes.
  -o, --output <path>        Output directory. If omitted current directory will be used.
  -w, --write-config [path]  Writes configuration to file without processing.
  -p, --print-config         Echos configuration to terminal without processing.
  -h, --help                 display help for command
```

# More Information
- **Websites**
    - www.decentology.com/dappstarter
- **Videos**
    - https://www.youtube.com/channel/UCZfZ-YyNb2J_g4bith1OLaw
- **Social**
    - [Twitter @Decentology](https://twitter.com/decentology)
