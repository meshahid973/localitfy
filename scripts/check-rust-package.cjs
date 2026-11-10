"use strict";
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname,"..","release");
const filename = "localtify_rust_kernels."+process.platform+"."+process.arch+".node";
let expected = [];
if(process.platform==="win32") expected=[path.join(root,"win-unpacked","resources","app.asar.unpacked","electron","native",filename)];
else if(process.platform==="linux") expected=[path.join(root,"linux-unpacked","resources","app.asar.unpacked","electron","native",filename)];
else {
  const visit=(dir,depth)=>{
    if(depth>4||!fs.existsSync(dir))return;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()&&entry.name.endsWith(".app"))
        expected.push(path.join(full,"Contents","Resources","app.asar.unpacked","electron","native",filename));
      else if(entry.isDirectory())visit(full,depth+1);
    }
  };
  visit(root,0);
}
const present=expected.filter(file=>fs.existsSync(file)&&fs.statSync(file).size>0);
if(!present.length) {
  console.error("[rust-package] Native addon not unpacked at expected platform path",expected);
  process.exitCode=1;
} else {
  console.log("[rust-package] packaged native binary:",present[0]);
}
