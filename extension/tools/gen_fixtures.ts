import fs from "node:fs";
import path from "node:path";
import { object, z } from "zod";
import type { ZodTypeAny } from "zod";
import { MessageToNativeHostSchema,ThreadPairSchema,CodeBlockSchema } from "../src/protocol/schema.ts";
import { mockFromSchema } from "./zod_mock.ts";

function main(){
  const outDir=path.resolve("../fixtures/generated");
  fs.mkdirSync(outDir,{recursive:true});



  const mock0=mockFromSchema(MessageToNativeHostSchema,0);
  const mock1=mockFromSchema(MessageToNativeHostSchema,1);
  const mock2=mockFromSchema(MessageToNativeHostSchema,2);
  //const mockt=mockFromSchema(ThreadPairSchema,0);
  //const mockc=mockFromSchema(CodeBlockSchema,0);

  console.log(JSON.stringify(mock0,null,2));
  console.log(JSON.stringify(mock1,null,2));
  console.log(JSON.stringify(mock2,null,2));
  //console.log(JSON.stringify(mockt,null,2));
  //console.log(JSON.stringify(mockc,null,2));

  let file=path.join(outDir,"msg_pdf.json");
  fs.writeFileSync(file,JSON.stringify(mock0,null,2),"utf8");
  file=path.join(outDir,"msg_gpt.json");
  fs.writeFileSync(file,JSON.stringify(mock1,null,2),"utf8");
  file=path.join(outDir,"msg_other.json");
  fs.writeFileSync(file,JSON.stringify(mock2,null,2),"utf8");
}


main();