// let fs = require("fs");
let yauzl = require("yauzl");
// let fsPromises = require("fs/promises");
import {open} from "node:fs/promises";

function promisify(api: any) {
  return function(...args: any[]) {
    return new Promise(function(resolve, reject) {
      api(...args, function(err: any, response: any) {
        if (err) return reject(err);
        resolve(response);
      });
    });
  };
}

// zip2ynab: upload the (possibly split) transactions
//  inputs
//   zip file as an input that yauzl will be happy with
//   ynab connection
//   map from 
//   minimum date to import
//  calls
//   - unzip2csv to get (iterable?) over entries in interesting files,
//     order unknown
//   - groupByOrder to get (iterables?) over those
//   - orderToYnab or returnToYnab to get ynab transactions
//   - post them to ynab

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises

async function fun() {
  let path = "/home/ted/Downloads/Your Orders.zip";
  let fun_f = null;
  let fun_z: any = null;
  // error handling?
  open(path, "r")
    .then((f) => {
      fun_f = f;
      console.log(f.fd)
      return promisify(yauzl.fromFd)(f.fd, {lazyEntries: true});
    })
    .then((z: any) => {   // y not inferred?
      console.log(z);
      fun_z = z;
      z.on("entry", function(entry: any) {
	handleEntry(entry, z);
      });
      z.on("end", function() {
	handleEnd(z);
      });
      z.on("close", handleClose);
      z.on("error", handleError);
      z.readEntry();
      // How do I block until end event is reached? Maybe it is ok
      // with lazyEntries?
    })
    .catch((error) => {
      console.log("boo");
      console.log(error);
      if (!(fun_z === null)) {
	fun_z.close();
      }
    })
}

function handleEntry(entry: any, z: any) {
  console.log("entry");
  console.log(z.entriesRead);
  console.log(entry.fileName);
  z.readEntry();
}

function handleEnd(z: any) {
  console.log("end");
  console.log(z)
  console.log(z.entriesRead);
  z.readEntry();
}

function handleClose(arg: any) {
  console.log("close");
  console.log(arg);
}

function handleError(err: any) {
  console.log(err);
  throw err;
}

fun();



/*
(async () => {
  let zipfile = await promisify(yauzl.fromFd(foo, {lazyEntries: true});
  console.log("number of entries:", zipfile.entryCount);
  let openReadStream = promisify(zipfile.openReadStream.bind(zipfile));
  zipfile.readEntry();
  zipfile.on("entry", async (entry) => {
    console.log("found entry:", entry.fileName);
    let stream = await openReadStream(entry);
    stream.on("end", () => {
      console.log("<EOF>");
      zipfile.readEntry();
    });
    stream.pipe(process.stdout);
  });
  zipfile.on("end", () => {
    console.log("end of entries");
  });
})();

*/
// Local Variables:
// compile-command: "tsc && node fun"
// End:
