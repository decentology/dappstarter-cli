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
            $MAKE_ME_ROOT apt install -y jq curl unzip
        fi
    elif [ -f /etc/arch-release ]; then
		$MAKE_ME_ROOT pacman -Syu --needed --noconfirm jq curl
    else 
        if ! which jq curl unzip >/dev/null 2>&1; then 
            echo "Dependency curl, unzip or jq not met. Please install these packages using the package manager for your distribution."
            exit 1
        fi
    fi

    ASSETS=$(curl -sL $RELEASE_URL | jq '[.assets|.[].browser_download_url]')
    DOWNLOAD_FILE=$(printf "$ASSETS" | jq . | grep linux -m 1 | cut -d '"' -f2)
elif [[ "$OSTYPE" == "darwin"* ]]; then
    if ! which brew >/dev/null 2>&1; then
		/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
	fi

    if ! which jq curl unzip >/dev/null 2>&1; then
    	brew update
        brew install jq curl unzip
    fi

    ASSETS=$(curl -sL $RELEASE_URL | jq '[.assets|.[].browser_download_url]')
    DOWNLOAD_FILE=$(printf "$ASSETS" | jq . | grep osx -m 1 | cut -d '"' -f2)
fi

curl -sL $DOWNLOAD_FILE -o $TMPFILE
unzip -o $TMPFILE -d $HOME/bin
rm $TMPFILE