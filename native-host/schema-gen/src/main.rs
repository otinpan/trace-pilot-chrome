use schemars::schema_for;
use native_host::types::{Metadata, RequestFromChrome};

fn main() {
    let meta = schema_for!(Metadata);

    println!("{}", serde_json::to_string_pretty(&meta).unwrap());

}
