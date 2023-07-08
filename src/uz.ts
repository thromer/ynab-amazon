import {parse} from "csv-parse/sync";
// import {open} from "node:fs/promises";
// import {Readable} from "stream";
// import {open fromFd, Entry, Options, ZipFile} from "yauzl";
// import * as yp from "yauzl-promise";
import {unzip} from "unzipit";
import {readFile} from "node:fs/promises";

const record_fields = new Set([
  "Website",
  "Order ID",
  "Currency",
  "Total Owed",
  "Payment Instrument Type",
  "Order Status",
  "Product Name"
]);

function prune_record(record: any) {
  let result: any = {};
  for (const [key, value] of Object.entries(record)) {
    if (record_fields.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

(async function() {
  const path = "/home/ted/Downloads/Your Orders.zip";
  const buf = await readFile(path);
  const {zip, entries} = await unzip(new Uint8Array(buf));
  const text = await entries["Retail.OrderHistory.1/Retail.OrderHistory.1.csv"].text();
  const records = parse(
    text,
    {
      "columns": true,
      "cast": true,
      "on_record": (record, context) => prune_record(record),
      // "on_record": (record , context) => {
      // 	return { 
      // 	  "Order ID": record["Order ID"]
      // 	  "Order Date": record["Order Date"]
      //          "Currency": record["Currency"]
      // 	}
      // },
      "to": 5  // TODO
    });
  for (const record of records) {
    console.log(JSON.stringify(record, [""], ""));
  }
})();

// Local Variables:
// compile-command: "npx tsc uz.ts && node uz"
// End:
