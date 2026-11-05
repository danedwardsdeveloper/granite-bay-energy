#!/usr/bin/env bash
set -euo pipefail

readonly app='granite-bay-energy'

printf 'This destroys the Fly app %s and its volume. Type the app name to confirm: ' "$app"
read -r confirmation

if [[ "$confirmation" != "$app" ]]; then
	echo 'Not confirmed. Nothing destroyed.'
	exit 1
fi

fly apps destroy "$app" --yes
echo "Destroyed $app."
