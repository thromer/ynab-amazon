// Broken and I don't know why.

// TODO use zip library that is typescript friendly .. yauzl-promise?

// let fs = require("fs");
// let yauzl = require("yauzl");
// let fsPromises = require("fs/promises");
import {open} from "node:fs/promises";
import {parse} from "csv-parse";
// import {promisify} from "util";
import {fromFd} from "yauzl";

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
//   - zip file as an input type that yauzl will be happy with. blob seems fine
//     until someone complains about memory issues
//   - ynab connection
//   - map from amazon's payment instrument to ynab account id
//   - minimum date to import
//  calls
//   - unzip2csv to get (iterable?) over entries in interesting files,
//     order unknown, restrict set of fields to just the good ones
//   - groupByOrder to get (iterables?) over those
//     - it appears order history is in reverse time order.
//     - it is definitely the case that multiple orders can have the same
//       timestamp
//   - orderToYnab or returnToYnab to get ynab transactions
//   - post them to ynab

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises

async function fun() {
  let path = "/home/ted/Downloads/Your Orders.zip";
  // error handling?
  open(path, "r")
    .then((f) => {
      console.log(f.fd)
      return promisify(fromFd)(f.fd, {lazyEntries: true});
    })
    .then((z: any) => {   // y not inferred?  TODO
      console.log(z);
      z.on("entry", function(entry: any) {  // TODO
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
    })
}

async function handleEntry(entry: any, z: any) {  // TODO
  console.log("entry");
  console.log(z.entriesRead);
  if (/\/$/.test(entry.fileName)) {
    console.log('THR directory: "' + entry.fileName);
    z.readEntry();
  } else {
    console.log('THR file: "' + entry.fileName + '"');
    if (entry.fileName === "Retail.OrderHistory.1/Retail.OrderHistory.1.csv") {
      console.log('HERE WE GO I HOPE');
      // [Error: ESPIPE: invalid seek, read]
      if (false) {
	promisify(z.openReadStream)(entry)
	  .then((readStream: any) => {  // TODO
	    readStream.on("end", function() {
	      handleEnd(z);
	    })
	    readStream.pipe(parse(
	      {
		"columns": true,
		"cast": true,
		"on_record": (record , context) => {
		  return { 
		    "Order Id": record["Order Id"]
		  };
		},
		"to": 5  // TODO
	      }
	    )).pipe(process.stdout)
	  })
      }
    }
    z.readEntry();
  }
}

function handleEnd(z: any) {  // TODO
  console.log("end");
  console.log(z.entriesRead);
  // z.readEntry();
}

function handleClose(arg: any) {   // TODO
  console.log("close");
  console.log(arg);
}

function handleError(err: any) {  // TODO
  console.log(err);
  throw err;
}

fun();

// Local Variables:
// compile-command: "tsc && node bar"
// End:
