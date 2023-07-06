// import {parse} from "csv-parse";
// import {open} from "node:fs/promises";
// import {Readable} from "stream";
// import {open fromFd, Entry, Options, ZipFile} from "yauzl";
// import * as yp from "yauzl-promise";
import {unzip} from "unzipit";
import {readFile} from "node:fs/promises";

(async function() {
  const path = "/home/tromer/Downloads/Your Orders.zip";
  const buf = await readFile(path);
  const {zip, entries} = await unzip(new Uint8Array(buf));
  // print all entries and their sizes
  for (const [name, entry] of Object.entries(entries)) {
    console.log(name, entry.size);
  }
})();

// Local Variables:
// compile-command: "npx tsc uz.ts && node uz"
// End:
