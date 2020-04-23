#!/bin/bash
# Copyright 2020 TryCrypto

RELEASE_URL=https://api.github.com/repos/trycrypto/dappstarter-cli/releases/latest
TMPFILE=`mktemp`
if [[ "$OSTYPE" == "linux-gnu" ]]; then
	set -e
	if [[ $(whoami) == "root" ]]; then
		MAKE_ME_ROOT=
	else
		MAKE_ME_ROOT=sudo
	fi
	if [ -f /etc/debian_version ]; then
        if ! which jq >/dev/null 2>&1; then
            $MAKE_ME_ROOT apt update
            $MAKE_ME_ROOT apt install -y jq curl
        fi
    fi

    ASSETS=$(curl -sL $RELEASE_URL | jq '[.assets|.[].browser_download_url]')
    DOWNLOAD_FILE=$(printf "$ASSETS" | jq . | grep linux -m 1 | cut -d '"' -f2)
elif [[ "$OSTYPE" == "darwin"* ]]; then
    if ! which brew >/dev/null 2>&1; then
		/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
	fi

    if ! which jq >/dev/null 2>&1; then
    	brew update
        brew install jq curl
    fi

    ASSETS=$(curl -sL $RELEASE_URL | jq '[.assets|.[].browser_download_url]')
    DOWNLOAD_FILE=$(printf "$ASSETS" | jq . | grep osx -m 1 | cut -d '"' -f2)
fi

curl -sL $DOWNLOAD_FILE -o $TMPFILE
unzip -o $TMPFILE -d $HOME/bin
rm $TMPFILE