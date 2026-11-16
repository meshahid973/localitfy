import {execFileSync} from "node:child_process";
const repo=process.env.GITHUB_REPOSITORY;
if(repo!=="meshahid973/localitfy")throw Error("Unexpected repository");
const allowlist=[
  {
    "branch": "agent/css-audio-stability",
    "sha": "217cef11b63b13480e10e7007744953c0865b63d",
    "pr": 39
  },
  {
    "branch": "agent/css-debt-cleanup",
    "sha": "23ed83a86f1dd5b0264e8210d60286bed26cab20",
    "pr": 38
  },
  {
    "branch": "agent/deep-css-react-cleanup",
    "sha": "a044ce8067c4ed29127d234d6889d2859798677a",
    "pr": 40
  },
  {
    "branch": "agent/fix-blue-screen-ownership",
    "sha": "c32566d211d788e6f18e8c1196a09e17bd2c6be7",
    "pr": 41
  },
  {
    "branch": "agent/fix-mainmodeapp-boot-hook-order",
    "sha": "30d0fa0fbe377ba9f10537990b3c2bab4a236dfd",
    "pr": 21
  },
  {
    "branch": "agent/perf-css-ownership-repair",
    "sha": "081aaebb759a7f0d679730f06588af55356b8ce0",
    "pr": 42
  },
  {
    "branch": "agent/phase-3-stability-runtime",
    "sha": "02d6f5c38cc2cad3cc2d139e4ffa832ac53088a9",
    "pr": 19
  },
  {
    "branch": "agent/phase-4-runtime-bugfixes",
    "sha": "00874018c8194d2cdffc1ea7c2288bbaf87cfdc4",
    "pr": 20
  },
  {
    "branch": "agent/phase-4b-runtime-monolith-reduction",
    "sha": "b49965972eff448ce371263c521267dd8d5bc4be",
    "pr": 22
  },
  {
    "branch": "agent/r1-app-lifecycle",
    "sha": "53f18a996431d5338e36d281820a6c0b4d029101",
    "pr": 31
  },
  {
    "branch": "agent/r1-app-lifecycle-runtime",
    "sha": "79f734c37a19c44d41e262624ccc22c76c45c78f",
    "pr": 27
  },
  {
    "branch": "agent/r1-body-runtime",
    "sha": "8e4a9c1484214787513761c952b514f8abb40fa1",
    "pr": 25
  },
  {
    "branch": "agent/r1-r2-ownership",
    "sha": "961b204727aec874cc5a3706af27daf3abf59d0e",
    "pr": 24
  },
  {
    "branch": "agent/r3-electron-environment",
    "sha": "3e02c95925d9fc3d676cb36c9f18dfd54901eeed",
    "pr": 28
  },
  {
    "branch": "agent/r3-user-data-bootstrap-fix",
    "sha": "ac89349829cad1582f81d83d211e3a7f528a272b",
    "pr": 30
  },
  {
    "branch": "agent/r3-user-data-runtime",
    "sha": "6368c5d748f95b7e133c6ab105ada9bb175c568a",
    "pr": 29
  },
  {
    "branch": "agent/r3-windows-startup-runtime",
    "sha": "224da788d22f290e2cb5ddb0cb36c6ee55342996",
    "pr": 32
  },
  {
    "branch": "agent/r4-css-adjacent-merge",
    "sha": "81ee5f0f7e5693dd4c809ab4a5918b57e31d7f96",
    "pr": 33
  },
  {
    "branch": "agent/r4-css-dedup",
    "sha": "7405db8b9cb79052405f08cbe98b03ed1b7429e2",
    "pr": 23
  },
  {
    "branch": "agent/r4b-css-property-dedup",
    "sha": "113dd5fa942b6fd516704441fb2253a35f3e687f",
    "pr": 26
  },
  {
    "branch": "agent/r5-catbuddy-types",
    "sha": "966fef34a9d959a8ef8c51eeb5568055dbd7b584",
    "pr": 35
  },
  {
    "branch": "agent/r5-update-island-types",
    "sha": "11c2f1966de62d4fff3ccbd63d352af321d0869d",
    "pr": 34
  },
  {
    "branch": "agent/r6-electron-sandbox",
    "sha": "44dd1831dc106b1de0914b62a8d8a322f7b34a84",
    "pr": 36
  },
  {
    "branch": "audit/ownership-reliability-20261021",
    "sha": "fc72d32adb58e4c4339bf93f2c93cf999321e17f",
    "pr": 94
  },
  {
    "branch": "audit/player-ownership-20261021",
    "sha": "e75ada7c967dce3e398c98f6deec81a0d2594214",
    "pr": 95
  },
  {
    "branch": "chore/verified-css-and-dead-code-cleanup-20261110",
    "sha": "6faa35888ca49b76937320551cf5cb9ed5c23105",
    "pr": 131
  },
  {
    "branch": "cleanup/remove-floating-scan-status-20261021",
    "sha": "a37d4a2c30b92ea71032511a6a17ab3f3f190435",
    "pr": 104
  },
  {
    "branch": "feat/arc-dropdown-all-selects",
    "sha": "29d7ca7ad2a406aded6eb77a413fdc66b0971681",
    "pr": 87
  },
  {
    "branch": "feat/genres-merge",
    "sha": "fe85e06676a461ab8a1a4a933468983ad20492de",
    "pr": 48
  },
  {
    "branch": "feature/manual-lyrics-selection-20261021",
    "sha": "5642399c3e44a8c93761c4b84d14ff1282f14884",
    "pr": 100
  },
  {
    "branch": "feature/opt-in-rust-kernels-phased-20261110",
    "sha": "b3aacb4d69fd27bf803189b96fa3cb0e5a064d29",
    "pr": 132
  },
  {
    "branch": "feature/queue-crash-recovery-20261021",
    "sha": "9af218cd5670c4190c9ff20b1170df396ff04b76",
    "pr": 98
  },
  {
    "branch": "feature/safe-library-relink-20261021",
    "sha": "6fc0de77a4a55c07e5a2071b2d9c23cc8a788f20",
    "pr": 97
  },
  {
    "branch": "fix/album-home-performance-audit-20261019",
    "sha": "dc0844c0dc26e6d6b005eb29ea9005560cb08bd5",
    "pr": 74
  },
  {
    "branch": "fix/artists-pr-43",
    "sha": "3ff1d45def36c4933b899a0b35b1b994d7850c2c",
    "pr": 44
  },
  {
    "branch": "fix/cascade-owner-dead-declarations",
    "sha": "8280efb73620ea2fc0643cc45d712ba4ac3c7eca",
    "pr": 70
  },
  {
    "branch": "fix/context-menu-ui-and-cleanup-20261110",
    "sha": "5a0e5ddbd1d4745939b5e64f8ed4f637aead2e8c",
    "pr": 129
  },
  {
    "branch": "fix/css-ownership-cleanup",
    "sha": "664a9d8d00dcfbd8b12a8aa04167a8204896d61d",
    "pr": 65
  },
  {
    "branch": "fix/css-regressions",
    "sha": "f5d38acb5138ca0b0d51f92102e04d76e25f163d",
    "pr": 59
  },
  {
    "branch": "fix/dead-css-ui-accessibility",
    "sha": "270cb08a024d9c11acd2db7dbb888727197bdef1",
    "pr": 66
  },
  {
    "branch": "fix/deep-css-theme-ownership",
    "sha": "ccb404c0b4b7f8f19b5e9885a5524fd867b13762",
    "pr": 69
  },
  {
    "branch": "fix/discover-privacy-and-stale-requests-20261022",
    "sha": "b6f9c9b18e0460ab1f9e565f385c601571e49492",
    "pr": 115
  },
  {
    "branch": "fix/home-shelf-audit-performance",
    "sha": "2163b6362085bd2a0ebe65ba5ae566fa2a466a65",
    "pr": 73
  },
  {
    "branch": "fix/library-arc-dropdown-and-row-polish",
    "sha": "5a74449b1bd3f1a229c9c1cdb2d279993db8fac0",
    "pr": 86
  },
  {
    "branch": "fix/library-settings-covers-ui",
    "sha": "c0a37d2b3f8dc895f1bf9b464fb6004d227f2379",
    "pr": 67
  },
  {
    "branch": "fix/lrclib-lookup-reliability",
    "sha": "647b5a6bdefdafcc4dfca577dd2944c4c4b3f711",
    "pr": 89
  },
  {
    "branch": "fix/media-cors-audio-graph",
    "sha": "380e6f52ba907703d77b023955306579fbf7e177",
    "pr": 90
  },
  {
    "branch": "fix/media-runtime-library-performance",
    "sha": "a3938f9e2c87ae6b5ea231346394cd36fa13836e",
    "pr": 76
  },
  {
    "branch": "fix/settings-cleanup",
    "sha": "7ce7aecdcdc7f5b587d0cc2a6df69f8fb7be1461",
    "pr": 46
  },
  {
    "branch": "fix/ui-consistency-20261110",
    "sha": "a8330fb8df4288bf32b327b49d2b3ebea1af8e79",
    "pr": 128
  },
  {
    "branch": "integration/lyrics-with-screensaver",
    "sha": "bcbc1ffe437df4c3ba570de30f433aacb7df52d3",
    "pr": 88
  },
  {
    "branch": "integration/music-analysis",
    "sha": "b59d1c1cd798f14ba16554ffbc2df1457144f7e1",
    "pr": 61
  },
  {
    "branch": "integration/player-sidebar-qol",
    "sha": "29e7bde5c5fbfc3ad791c9688cd61020b6a94013",
    "pr": 60
  },
  {
    "branch": "perf/cooperative-thumbnail-queue-20261021",
    "sha": "c19048d8ef99be06f222ea2ae1ebafd1e2cdfff0",
    "pr": 101
  },
  {
    "branch": "perf/download-matching-queue-20261020",
    "sha": "63f96791e00ace09d108040859fb78ce1a47799c",
    "pr": 75
  },
  {
    "branch": "perf/incremental-library-index",
    "sha": "202360c8088738421ac60465401c83ae06aa6817",
    "pr": 91
  },
  {
    "branch": "perf/library-cover-search-20261018",
    "sha": "b12a8b925d00c040fc41ac84dddee5110db86142",
    "pr": 68
  },
  {
    "branch": "perf/optin-local-profiling-20261021",
    "sha": "d3f4c6c16d212ea7be0836308d0752c87e903dd8",
    "pr": 96
  },
  {
    "branch": "redesign/settings-premium",
    "sha": "956a7e36b00fa792bdfdd3adaa9e296b7364d4ee",
    "pr": 62
  },
  {
    "branch": "refactor/dedup-owned-helpers-20261021",
    "sha": "31657515069c7a15845067df4d61fcfc532b928e",
    "pr": 105
  },
  {
    "branch": "refactor/feature-stylesheet-ownership",
    "sha": "9b5fe7d4f08c9c86f294179ea42c5d8819d79006",
    "pr": 82
  },
  {
    "branch": "refactor/lazy-dialog-ownership",
    "sha": "1c239bdc972a6ac01e75eefd500ef0f00267bcd0",
    "pr": 83
  },
  {
    "branch": "refactor/motion-and-effects-ownership",
    "sha": "5c7d18877ee71e89e186de28a6bdbe9c09e5ea1a",
    "pr": 81
  },
  {
    "branch": "refactor/native-media-session-controller",
    "sha": "b5be539103a3fff9c88226456b2243689e266df3",
    "pr": 93
  },
  {
    "branch": "refactor/playback-transition-coordinator",
    "sha": "99bd47f180260073b442850429ae2aae89736975",
    "pr": 92
  },
  {
    "branch": "refactor/runtime-helper-ownership",
    "sha": "4d8c11caa7e8a356cca55339b26134788d386449",
    "pr": 84
  },
  {
    "branch": "refactor/shared-heart-and-player-controls",
    "sha": "e60e49115379f774a92b28e9d2c36da34f23b171",
    "pr": 80
  },
  {
    "branch": "refactor/sidebar-style-ownership",
    "sha": "0f5a0e8afd189904726c2386f74d981364f26c16",
    "pr": 79
  },
  {
    "branch": "refactor/untangle-downloads-theme-presets-20261110",
    "sha": "4f4e238ccb83f021263abe88a89d1803755e1d96",
    "pr": 130
  },
  {
    "branch": "review/artist-bio-secure-integration-20261109",
    "sha": "58f3d6b5b3582af5a04e5293b19042a175d04a0e",
    "pr": 126
  },
  {
    "branch": "review/duplicate-merge-integrated-20261022",
    "sha": "6c9054511d99f0663b181adca446a7cf30105fe8",
    "pr": 116
  },
  {
    "branch": "review/not-for-me-ui-and-radio-20261022",
    "sha": "c0b7802f99f3e6b392be0065e53f6a775deca373",
    "pr": 114
  },
  {
    "branch": "review/scrobbling-with-watched-folders-20261022",
    "sha": "491f81a07480427b8bb762dcb39c13fd9aeca128",
    "pr": 119
  },
  {
    "branch": "review/watched-folders-integration-20261022",
    "sha": "5156723d59dd65575aee8aee6ea403b230085914",
    "pr": 118
  }
];
const api=(endpoint)=>JSON.parse(execFileSync("gh",["api",endpoint],{encoding:"utf8",maxBuffer:32*1024*1024}));
const pages=(name)=>{const out=[];for(let i=1;i<=10;i++){const page=api("repos/"+repo+"/"+name+(name.includes("?")?"&":"?")+"per_page=100&page="+i);out.push(...page);if(page.length<100)return out;}throw Error("Incomplete branch/PR inventory");};
const open=pages("pulls?state=open");
const used=new Set(open.flatMap(p=>[p.head.ref,p.base.ref]));
const branches=new Map(pages("branches").map(b=>[b.name,b]));
const closed=new Map(pages("pulls?state=closed").map(p=>[p.number,p]));
const planned=[];
for(const c of allowlist){
  if(c.branch==="main"||used.has(c.branch)||/backup|snapshot|tauri|^release\//i.test(c.branch))continue;
  const b=branches.get(c.branch),p=closed.get(c.pr);
  if(!b||b.protected||b.commit.sha!==c.sha||!p?.merged_at||p.base.ref!=="main"||p.head.repo?.full_name!==repo||p.head.ref!==c.branch||p.head.sha!==c.sha){
    console.log("SKIP changed or unverified",c.branch);continue;
  }
  planned.push(c);
}
if(!planned.length){console.log("No eligible branches");process.exit(0);}
const args=["push","--atomic",...planned.map(c=>"--force-with-lease=refs/heads/"+c.branch+":"+c.sha),"origin",...planned.map(c=>":refs/heads/"+c.branch)];
console.log("Verified deletion candidates",planned.length);
execFileSync("git",args,{stdio:"inherit"});
const after=new Set(pages("branches").map(b=>b.name));
const gone=planned.filter(c=>!after.has(c.branch));
console.log("VERIFIED_DELETED",gone.length);
for(const c of gone)console.log("DELETED",c.branch,c.sha,"PR",c.pr);
if(gone.length!==planned.length)throw Error("Some branches remain");
