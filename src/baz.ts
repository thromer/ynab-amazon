// Broken and I don't know why.

// TODO maybe use zip library that is typescript friendly .. yauzl-promise?
// But yauzl should work it's just the promisify thing seems to screw up its types.

import {parse} from "csv-parse";
import {open, FileHandle} from "node:fs/promises";
import {Readable} from "stream";
import {fromFd, Entry, Options, ZipFile} from "yauzl";

const fromFdPromise = (fd: number, options: Options): Promise<ZipFile> => 
  new Promise((resolve, reject) => {
    fromFd(fd, options, (error, result) => {
      if (error) {
	reject(error);
      } else {
	resolve(result);
      }
    });
  });

function promisifyOpenReadStream(openReadStream: Function) {
  return (entry: Entry) : Promise<Readable> => new Promise(function(resolve, reject) {
      openReadStream(entry, (error: Error | null, result: Readable) => {
	if (error) {
	  reject(error);
	} else {
	  resolve(result);
	}
      })
  });
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
  let path = "/home/tromer/Downloads/Your Orders.zip";
  // error handling?
  let f : FileHandle;
  let z : ZipFile;
  open(path, "r")
    .then((_f) => {
      f = _f;
      console.log(f.fd)
      return fromFdPromise(f.fd, {lazyEntries: true});
    })
    .then((_z) => {
      z = _z;
      console.log(z);
      z.on("entry", function(entry) {
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
    .finally(() => {
      z?.close();
      f?.close();
    })
}

async function handleEntry(entry: Entry, z: ZipFile) {
  console.log("entry");
  console.log(z.entriesRead);
  if (/\/$/.test(entry.fileName)) {
    console.log('THR directory: "' + entry.fileName);


    
    z.readEntry();
  } else {
    console.log('THR file: "' + entry.fileName + '"');
    if (entry.fileName === "Retail.OrderHistory.1/Retail.OrderHistory.1.csv") {
      if (false) {
	// Ugh, this doesn't work for me at all, it closes the file right away.
	// [Error: ESPIPE: invalid seek, read]
	console.log('HERE WE GO I HOPE');
	promisifyOpenReadStream(z.openReadStream)(entry)
	  .then((readStream) => {  // TODO
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

function handleEnd(z: ZipFile) {  // TODO
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
// compile-command: "npx tsc && node baz"
// End:
