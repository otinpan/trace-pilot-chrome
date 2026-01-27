use std::{fs,path::Path};

use native_host::types::RequestFromChrome;

#[test]
fn ts_generated_json_should_desirialize(){
    let dir=Path::new("../fixtures/chrome_to_native");
    let mut ok=0;

    for entry in fs::read_dir(dir).expect("read fixtures dir"){
        let entry=entry.unwrap();
        if entry.path().extension().and_then(|s| s.to_str()) !=Some("json"){
            continue;
        }

        let s=fs::read_to_string(entry.path()).unwrap();
        let _msg: RequestFromChrome = serde_json::from_str(&s)
            .unwrap_or_else(|e| panic!("failed to parse {:?}: {e}\njson={s}", entry.path()));

        ok += 1;
     }

     assert!(ok>0, "no fixtures found");

}