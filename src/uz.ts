import {parse} from "csv-parse/sync";
import {unzip} from "unzipit";
import {readFile} from "node:fs/promises";

interface LineItem {
  readonly website: string,
  readonly order_date: number,
  readonly currency: string,
  readonly total_owed_micro_units: number,
  readonly payment_instrument_type: string,
  readonly order_status: string,
  readonly product_name: string
}

interface Order {
  readonly order_id: string,
  readonly line_items: ReadonlyArray<LineItem>
}

function make_order(record: any) : Order{
  return {
    order_id: record["Order ID"],
    line_items: [{
      website: record["Website"],
      order_date: Date.parse(record["Order Date"]),
      currency: record["Currency"],
      total_owed_micro_units: Math.round(record["Total Owed"] * 1000),
      payment_instrument_type: record["Payment Instrument Type"],
      order_status: record["Order Status"],
      product_name: record["Product Name"]
    }]
  }
}

function group_by_order(records: ReadonlyArray<Order>) : Order[] {
  const result = new Array<Order>();
  let current_order_id = "";
  let current_order_date = Infinity; // records[0].order_date;
  let partial_result = new Map<string, Array<LineItem>>();

  const emit = function() {
    for (const [order_id, items] of partial_result) {
      result.push({
	order_id: order_id,
	line_items: items
      })
    }
  }

  for (const record of records) {
    if (record.line_items.length != 1) {
      throw new Error(`${record.order_id}: expected exactly one line item per CSV row`);
    }
    const line_item = record.line_items[0]!;
    if (line_item.order_date > current_order_date) {
      throw new Error(`${record.order_id} out of date order`);
    }
    if (line_item.order_date < current_order_date) {
      emit();
      current_order_id = record.order_id;
      current_order_date = line_item.order_date;
      partial_result = new Map<string, Array<LineItem>>();
    }
    if (!partial_result.has(record.order_id)) {
      partial_result.set(record.order_id, new Array<LineItem>());
    }
    partial_result.get(record.order_id)!.push(line_item);
  }
  emit();
  return result;
}

(async function() {
  const path = "/home/ted/Downloads/Your Orders.zip"; // (1).zip";
  const buf = await readFile(path);
  const {zip, entries} = await unzip(new Uint8Array(buf));
  const text = await entries["Retail.OrderHistory.1/Retail.OrderHistory.1.csv"].text();
  const records = parse(
    text,
    {
      "columns": true,
      "cast": true,
      "on_record": (record, context) => make_order(record),
      "to": 5  // TODO
    });
  for (const order of group_by_order(records)) {
    console.log(order);
  }
})();

// Local Variables:
// compile-command: "(cd .. && npx tsc ) && node uz"
// End:
