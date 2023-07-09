// TODO
// differentiate ted and shannon's imports somehow
// need to get budget_id from somewhere
// need to get map from payment_instrument_type to account_id somewhere
// need to get secrets from somewhere
// need lower bound on date to import
// don't split everything!
// 
// skip annoying websites maybe? (fresh, whole foods)

// Reference: https://github.com/ynab/ynab-sdk-js/blob/main/dist/api.d.ts

import {parse} from "csv-parse/sync";
import {unzip} from "unzipit";
import {readFile} from "node:fs/promises";
import * as ynab from "ynab";

const payeeMaxLength = 50;
const memoMaxLength = 200;

interface LineItem {
  readonly website: string,
  readonly order_date: number,
  readonly currency: string,
  readonly total_owed_micro_units: number,
  readonly order_status: string,
  readonly product_name: string
}

interface Order {
  readonly order_id: string,
  readonly payment_instrument: string,
  readonly line_items: ReadonlyArray<LineItem>
}

interface YnabConfig {
  readonly budget_id: string,
  readonly payment_instrument_to_account_id: any
}

function make_order(record: any) : Order{
  return {
    order_id: record["Order ID"],
    payment_instrument: record["Payment Instrument Type"],
    line_items: [{
      website: record["Website"],
      order_date: Date.parse(record["Order Date"]),
      currency: record["Currency"],
      total_owed_micro_units: Math.round(record["Total Owed"] * 1000),
      order_status: record["Order Status"],
      product_name: record["Product Name"]
    }]
  }
}

function group_by_order_and_instrument(records: ReadonlyArray<Order>) : Order[] {
  const result = new Array<Order>();
  let current_order_id = "";
  let current_order_date = Infinity; // records[0].order_date;
  let partial_result = new Map<string, Array<LineItem>>();

  const emit = function() {
    for (const [local_key, items] of partial_result) {
      const [order_id, payment_instrument] = JSON.parse(local_key)
      result.push({
	order_id: order_id,
	payment_instrument: payment_instrument,
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
    const local_key = JSON.stringify([record.order_id, record.payment_instrument]);
    if (!partial_result.has(local_key)) {
      partial_result.set(local_key, new Array<LineItem>());
    }
    partial_result.get(local_key)!.push(line_item);
  }
  emit();
  return result;
}

function make_save_transaction(config: YnabConfig, order: Order): any { // TODO (ynab.SaveTransaction | null) {
  // let closed_count = order.line_items.reduce(
  //   (count, line_item) => count + line_item.order_status === "Closed" ? 1 : 0,
  //   0
  // );

  let closed_line_items = new Array<LineItem>();
  for (const line_item of order.line_items) {
    const order_status = line_item.order_status;
    if (order_status !== "Closed" && order_status != "Cancelled") {
      // Wait for all items to complete one way or the other.
      return null;
    }
    if (order_status === "Closed") {
      closed_line_items.push(line_item);
    }
  }

  if (closed_line_items.length === 0) {
    return null;
  }

/*
 TODO  
  const ellipsis = "…";
  const split_product_name = function(input: string, maxLen: number, maxTrim = 15): [string, string] {
    return [input, ""];
    const alphanumeric = /(?:\p{Letter}|p{Number}\p{Mark}$/u;
    // Look back up to maxTrim characters for a non-alpha-numberic. Then give up.
    if (input.length <= maxLen) {
      return [input, ""];
    }
    for (int i = 0; i < maxTrim; i--) {
      if (input[maxLen-1-i]
    }
    
    }
  }
*/
  
  const needs_split = true; // TODO = closed_line_items.length > 0;
  let payee_name: string;
  let memo: string;
  let total_amount = 0;
  let subtransactions : Array<ynab.SaveSubTransaction> | null;
  if (needs_split) {
    payee_name = "Amazon",
    memo = `http://amazon.com/gp/your-account/order-details?orderID=${order.order_id}`;
    subtransactions = new Array<ynab.SaveSubTransaction>();
    for (const line_item of closed_line_items) {
      let line_payee_name: string;
      let line_memo: string;
      if (line_item.product_name.length <= payeeMaxLength) {
	line_payee_name = line_item.product_name;
	line_memo = "";
      } else {
	line_payee_name = line_item.product_name.slice(0, payeeMaxLength-3) + "...";
	const tail = '...' + line_item.product_name.slice(payeeMaxLength-3);
	if (tail.length <= memoMaxLength) {
	  line_memo = tail;
	} else {
	  line_memo = tail.slice(0, memoMaxLength-3) + "...";
	}
      }
      subtransactions.push({
	amount: line_item.total_owed_micro_units,
	payee_name: line_payee_name,
	memo: line_memo
      })
      total_amount += line_item.total_owed_micro_units;
    }
  } else {
    payee_name = "Amazon TODO fancier for not split please",
    memo = `http://amazon.com/gp/your-account/order-details?orderID=${order.order_id}`;
    total_amount = closed_line_items[0].total_owed_micro_units;
    subtransactions = null;
  }

  return {
    account_id: config.payment_instrument_to_account_id[order.payment_instrument],
    date: new Date(order.line_items[0].order_date).toISOString().slice(0,10), // TODO push order_date up
    amount: total_amount,
    payee_name: payee_name,
    memo: memo,
    import_id: order.order_id,
    subtransactions: subtransactions
  };    
}

(async function() {
  // const ynab_config_path = process.env["HOME"]! + "/ynab-config.json";
  const ynab_config_path = `${process.env["HOME"]}/ynab-config.json`;
  const ynab_config = JSON.parse(await readFile(ynab_config_path, "utf8"));

  const path = "/home/ted/Downloads/Your Orders.zip"; //  (1).zip";
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
  console.log("hi");
  console.log(records.length);
  const orders = group_by_order_and_instrument(records);
  for (const order of orders) {
    console.log(make_save_transaction(ynab_config, order));
  }
})();

// Local Variables:
// compile-command: "(cd .. && npx tsc ) && node uz"
// End:
