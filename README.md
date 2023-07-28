# WebC2

WebC2 provides command and control for XSS-infected targets through client-side JavaScript!

Running the Node.js script starts an HTTP server on your device which then hosts the `payload.js` file and various endpoints for communication!

Within the payload, the target will poll the server every 10 seconds to see if a new command is hosted for that session. If one is, it will run that command with `eval` and exfiltrate the result through another endpoint!

Everything you will need to use WebC2 can be found in the `--help` prompt for the Node.js script and the `:help` command within the C2 terminal. This same information can also be found in `cmdhelp.txt` and `help.txt` respectively!

By default, the script sets a host of `localhost` and port of 3000. However, you can change this with command-line arguments as outlined in `--help`!

Good luck and happy hacking!
